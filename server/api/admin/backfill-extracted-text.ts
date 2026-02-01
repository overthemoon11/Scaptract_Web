import { Request, Response } from 'express';
import { requireAuth } from '../../lib/auth.ts';
import { connectDB, getConnection } from '../../lib/supabase.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import Document from '../../models/supabase/Document.ts';
import { convertOcrMarkdownToJson } from '../../lib/markdownToJson.ts';
import path from 'path';
import fs from 'fs';

/**
 * Admin endpoint to backfill extracted_text for existing documents
 * POST /api/admin/backfill-extracted-text
 * Optional query params:
 *   - limit: Maximum number of records to process (default: all)
 *   - dry-run: If true, only report what would be updated without making changes
 */
export default async function handler(req: Request, res: Response) {
  try {
    await requireAuth(req, 'admin');
    await connectDB();
    
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const dryRun = req.query['dry-run'] === 'true';
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No changes will be made');
    }
    
    const supabase = getConnection();
    
    // Find all extraction results that:
    // 1. Have status 'completed'
    // 2. Have a document_id
    // Note: We process ALL completed results to regenerate with correct page ordering
    let query = supabase
      .from('extraction_results')
      .select(`
        id,
        document_id,
        extracted_text,
        ocr_result_path,
        status
      `)
      .eq('status', 'completed');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: extractionResults, error: fetchError } = await query;
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!extractionResults || extractionResults.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No extraction results need backfilling.',
        stats: {
          total: 0,
          success: 0,
          skipped: 0,
          errors: 0
        }
      });
    }
    
    console.log(`📋 Found ${extractionResults.length} extraction results to process...`);
    
    const results: Array<{
      id: string;
      status: 'success' | 'skipped' | 'error';
      message: string;
      extractedTextLength?: number;
      fileCount?: number;
    }> = [];
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const result of extractionResults) {
      try {
        const extractionResultId = result.id;
        const documentId = result.document_id;
        
        if (!documentId) {
          results.push({
            id: extractionResultId,
            status: 'skipped',
            message: 'No document_id'
          });
          skipCount++;
          continue;
        }
        
        // Get document to find group_name
        const document = await Document.findById(documentId.toString());
        if (!document) {
          results.push({
            id: extractionResultId,
            status: 'skipped',
            message: 'Document not found'
          });
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
          results.push({
            id: extractionResultId,
            status: 'skipped',
            message: `OCR path not found: ${ocrPathToUse || 'N/A'}`
          });
          skipCount++;
          continue;
        }
        
        // Read markdown from files
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
            // Ignore directory read errors
          }
        }
        
        findMarkdownFiles(ocrPathToUse);
        
        if (markdownFiles.length === 0) {
          results.push({
            id: extractionResultId,
            status: 'skipped',
            message: `No markdown files found in ${ocrPathToUse}`
          });
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
            // Skip files that can't be read
          }
        }
        
        if (markdownContents.length === 0) {
          results.push({
            id: extractionResultId,
            status: 'skipped',
            message: 'Could not read any markdown files'
          });
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
        
        if (!dryRun) {
          // Update extraction result with both extracted_text and structured_data
          const updateData: any = {
            extracted_text: extractedText
          };
          
          if (structuredData) {
            updateData.structured_data = structuredData;
          }
          
          await ExtractionResult.update(extractionResultId.toString(), updateData);
        }
        
        const structuredDataMsg = structuredData ? ' and structured_data' : '';
        results.push({
          id: extractionResultId,
          status: 'success',
          message: dryRun ? 'Would update' : 'Updated',
          extractedTextLength: extractedText.length,
          fileCount: markdownContents.length
        });
        successCount++;
        
      } catch (error: any) {
        results.push({
          id: result.id,
          status: 'error',
          message: error.message || 'Unknown error'
        });
        errorCount++;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: dryRun 
        ? `Dry run completed. Would update ${successCount} records.`
        : `Backfill completed. Updated ${successCount} records.`,
      dryRun,
      stats: {
        total: extractionResults.length,
        success: successCount,
        skipped: skipCount,
        errors: errorCount
      },
      results: results.slice(0, 100) // Limit results in response to first 100
    });
    
  } catch (error: any) {
    console.error('Backfill error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to backfill extracted_text'
    });
  }
}
