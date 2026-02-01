import 'dotenv/config';
import { connectDB, getConnection } from '../lib/supabase.ts';
import ExtractionResult from '../models/supabase/ExtractionResult.ts';
import Document from '../models/supabase/Document.ts';
import { convertOcrMarkdownToJson } from '../lib/markdownToJson.ts';
import path from 'path';
import fs from 'fs';

// Ensure we're loading from the correct .env location
const serverEnvPath = path.join(process.cwd(), 'server', '.env');
const rootEnvPath = path.join(process.cwd(), '.env');
if (fs.existsSync(serverEnvPath)) {
  console.log(`📁 Using .env from: ${serverEnvPath}`);
} else if (fs.existsSync(rootEnvPath)) {
  console.log(`📁 Using .env from: ${rootEnvPath}`);
} else {
  console.log('⚠️  No .env file found, using environment variables');
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️  Connection attempt ${attempt} failed: ${error.message || error}`);
      console.log(`   Retrying in ${delay}ms... (${maxRetries - attempt} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Backfill script to populate extracted_text column for existing extraction results
 * that were processed before the new code was added.
 * 
 * Usage: npx tsx server/scripts/backfill-extracted-text.ts
 */
async function backfillExtractedText() {
  try {
    console.log('🔄 Starting backfill of extracted_text column...');
    
    // Verify environment variables are loaded
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials!');
      console.error('   Please ensure SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY) are set in server/.env');
      process.exit(1);
    }
    
    console.log(`   Using Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
    
    // Retry connection with exponential backoff
    await retryWithBackoff(async () => {
      await connectDB();
      // Test the connection by getting the client
      const supabase = getConnection();
      // Try a simple query to verify connection
      const { error: testError } = await supabase.from('extraction_results').select('id').limit(1);
      if (testError) {
        throw new Error(`Connection test failed: ${testError.message}`);
      }
      console.log('✅ Connected to Supabase database');
    }, 5, 2000); // 5 retries, starting with 2 second delay
    
    const supabase = getConnection();
    
    // Find all extraction results that:
    // 1. Have status 'completed'
    // 2. Have a document_id
    // Note: We process ALL completed results to regenerate with correct page ordering
    const { data: extractionResults, error: fetchError } = await retryWithBackoff(async () => {
      const result = await supabase
        .from('extraction_results')
        .select(`
          id,
          document_id,
          extracted_text,
          ocr_result_path,
          status
        `)
        .eq('status', 'completed');
      
      if (result.error) {
        throw new Error(`Failed to fetch extraction results: ${result.error.message}`);
      }
      
      return result;
    }, 3, 1000);
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!extractionResults || extractionResults.length === 0) {
      console.log('✅ No extraction results need backfilling.');
      return;
    }
    
    console.log(`📋 Found ${extractionResults.length} extraction results to process...`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const result of extractionResults) {
      try {
        const extractionResultId = result.id;
        const documentId = result.document_id;
        
        if (!documentId) {
          console.log(`⏭️  Skipping ${extractionResultId}: No document_id`);
          skipCount++;
          continue;
        }
        
        // Get document to find group_name
        const document = await Document.findById(documentId.toString());
        if (!document) {
          console.log(`⏭️  Skipping ${extractionResultId}: Document not found`);
          skipCount++;
          continue;
        }
        
        // Determine OCR path - check multiple possible locations
        let ocrPathToUse: string | null = null;
        
        // List of possible paths to check (in order of preference)
        const possiblePaths: string[] = [];
        
        if (result.ocr_result_path) {
          // Try the stored path as-is
          const normalizedPath = result.ocr_result_path.startsWith('server/')
            ? result.ocr_result_path.replace(/^server[\\/]/, '')
            : result.ocr_result_path;
          const storedPath = path.isAbsolute(normalizedPath)
            ? normalizedPath
            : path.join(process.cwd(), normalizedPath);
          possiblePaths.push(storedPath);
        }
        
        // Always check server/uploads/ocr-results (current structure)
        if (document.group_name) {
          possiblePaths.push(
            path.join(process.cwd(), 'server', 'uploads', 'ocr-results', document.group_name)
          );
          // Also check uploads/ocr-results (legacy structure)
          possiblePaths.push(
            path.join(process.cwd(), 'uploads', 'ocr-results', document.group_name)
          );
        }
        
        // Find the first path that exists
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            ocrPathToUse = testPath;
            break;
          }
        }
        
        if (!ocrPathToUse || !fs.existsSync(ocrPathToUse)) {
          console.log(`⏭️  Skipping ${extractionResultId}: OCR path not found (${ocrPathToUse || 'N/A'})`);
          skipCount++;
          continue;
        }
        
        // Read markdown from files
        console.log(`📖 Processing ${extractionResultId}: Reading markdown from ${ocrPathToUse}...`);
        
        const markdownFiles: string[] = [];
        function findMarkdownFiles(dir: string): void {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                findMarkdownFiles(fullPath);
              } else if (entry.isFile() && entry.name.endsWith('.md')) {
                markdownFiles.push(fullPath);
              }
            }
          } catch (error) {
            console.error(`   ⚠️  Error reading directory ${dir}:`, error);
          }
        }
        
        findMarkdownFiles(ocrPathToUse);
        
        if (markdownFiles.length === 0) {
          console.log(`   ⏭️  No markdown files found in ${ocrPathToUse}`);
          skipCount++;
          continue;
        }
        
        // Sort files for consistent ordering - use numeric sort for page numbers
        // Handles both PDF uploads (files-xxx.pdf_N.md) and Image uploads (images-xxx-N_0/images-xxx-N_0.md)
        markdownFiles.sort((a, b) => {
          // Extract numeric page index from file path
          // Pattern 1 (PDF): filename_123.md -> extract 123
          // Pattern 2 (Image): .../images-xxx-123_0/... or images-xxx-123_0.md -> extract 123
          const getNumericSuffix = (filePath: string): number => {
            // Try PDF pattern first: _N.md at end of filename
            let match = filePath.match(/_(\d+)\.md$/);
            if (match) {
              return parseInt(match[1], 10);
            }
            
            // Try image pattern: -N_0 in directory or filename
            match = filePath.match(/-(\d+)_0/);
            if (match) {
              return parseInt(match[1], 10);
            }
            
            return 999; // No match found
          };
          
          const aNum = getNumericSuffix(a);
          const bNum = getNumericSuffix(b);
          
          // If both have numeric suffixes, sort numerically
          if (aNum !== 999 && bNum !== 999) {
            return aNum - bNum;
          }
          
          // Otherwise, fall back to lexicographic sort
          return a.localeCompare(b);
        });
        
        // Read and combine all markdown files
        const markdownContents: string[] = [];
        for (const mdFile of markdownFiles) {
          try {
            const content = fs.readFileSync(mdFile, 'utf-8');
            markdownContents.push(content);
          } catch (error) {
            console.error(`   ⚠️  Error reading markdown file ${mdFile}:`, error);
          }
        }
        
        if (markdownContents.length === 0) {
          console.log(`   ⏭️  Could not read any markdown files`);
          skipCount++;
          continue;
        }
        
        // Combine markdown with separators
        const extractedText = markdownContents
          .map((content, index) => index > 0 ? `\n\n---\n\n${content}` : content)
          .join('');
        
        // Convert markdown to JSON for structured_data
        let structuredData: any = null;
        try {
          console.log(`   🔄 Converting markdown to JSON for structured_data...`);
          structuredData = await convertOcrMarkdownToJson(ocrPathToUse);
          
          if (structuredData && typeof structuredData === 'object' && !structuredData.error) {
            console.log(`   ✅ Successfully converted markdown to JSON (${Object.keys(structuredData.content || {}).length} sections)`);
          } else {
            console.warn(`   ⚠️  Markdown conversion returned invalid result, skipping structured_data update`);
            structuredData = null;
          }
        } catch (conversionError: any) {
          console.error(`   ⚠️  Error converting markdown to JSON: ${conversionError.message}`);
          // Continue without structured_data if conversion fails
          structuredData = null;
        }
        
        // Update extraction result with both extracted_text and structured_data
        const updateData: any = {
          extracted_text: extractedText
        };
        
        if (structuredData) {
          updateData.structured_data = structuredData;
        }
        
        await ExtractionResult.update(extractionResultId.toString(), updateData);
        
        const structuredDataMsg = structuredData ? ` and structured_data` : '';
        console.log(`   ✅ Updated ${extractionResultId} with ${extractedText.length} chars from ${markdownContents.length} files${structuredDataMsg}`);
        successCount++;
        
      } catch (error: any) {
        console.error(`   ❌ Error processing ${result.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total processed: ${extractionResults.length}`);
    
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    const isConnectionError = 
      errorMessage.includes('Connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout');
    
    console.error('\n❌ Backfill failed!');
    
    if (isConnectionError) {
      console.error('🔌 Connection Error Detected:');
      console.error(`   ${errorMessage}`);
      console.error('\n💡 Troubleshooting steps:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify VPN is connected (if required)');
      console.error('   3. Check if Supabase URL and keys are correct in server/.env');
      console.error('   4. Try running the script again - it will retry automatically');
      console.error('   5. Check firewall/proxy settings');
    } else {
      console.error(`   Error: ${errorMessage}`);
      console.error(error);
    }
    
    process.exit(1);
  }
}

// Run the backfill
backfillExtractedText()
  .then(() => {
    console.log('\n🎉 Backfill completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
