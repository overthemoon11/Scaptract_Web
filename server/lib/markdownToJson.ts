import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import axios from 'axios';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

/**
 * Call Dify Workflow 4 to extract structured fields from Additional Information
 * Returns JSON object with extracted fields (e.g., {"Author": "...", "Email": "...", "Abstract": "..."})
 * Values can be strings, arrays, or other valid JSON types
 */
async function extractStructuredFieldsFromAdditionalInfo(additionalInfoContent: string): Promise<Record<string, any> | null> {
  try {
    const difyApiUrl = process.env.DIFY_API_URL;
    // Check for workflow 4 API key (priority: DIFY_WORKFLOW_4_API_KEY > DIFY_OCR_API_KEY_W4)
    const difyWorkflow4ApiKey = process.env.DIFY_NLP_API_KEY_V1 || process.env.DIFY_OCR_API_KEY_W4;
    
    if (!difyApiUrl) {
      console.log('   ⚠️ DIFY_API_URL not configured, skipping workflow 4 extraction');
      return null;
    }
    
    if (!difyWorkflow4ApiKey) {
      console.log('   ⚠️ Workflow 4 API key not configured (DIFY_WORKFLOW_4_API_KEY or DIFY_OCR_API_KEY_W4), skipping extraction');
      return null;
    }
    
    if (!additionalInfoContent || additionalInfoContent.trim().length === 0) {
      return null;
    }
    
    console.log(`   🤖 Calling Workflow 4 to extract structured fields from Additional Information...`);
    console.log(`   Content preview: ${additionalInfoContent.substring(0, 100)}...`);
    
    // Prepare request body for Dify workflow
    // Use blocking mode to get immediate response (not streaming)
    // Note: The prompt/instructions should be defined in Dify Workflow 4's SYSTEM message
    // The query here is just a simple instruction - the main logic is in Dify's SYSTEM prompt
    const workflowEndpoint = `${difyApiUrl.replace(/\/$/, '')}/chat-messages`;
    const requestBody = {
      inputs: {
        additional_information: additionalInfoContent
      },
      query: `Extract structured fields from the additional information provided. Return only valid JSON.`,
      response_mode: 'blocking', // Use blocking mode to get immediate response
      user: 'system'
    };
    
    const response = await axios.post(workflowEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${difyWorkflow4ApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data) {
      // Try to parse the answer from different possible response formats
      let answerText: string | null = null;
      
      // Check different possible response formats for blocking mode
      if (response.data.answer) {
        answerText = typeof response.data.answer === 'string' 
          ? response.data.answer 
          : JSON.stringify(response.data.answer);
      } else if (response.data.data && response.data.data.answer) {
        answerText = typeof response.data.data.answer === 'string'
          ? response.data.data.answer
          : JSON.stringify(response.data.data.answer);
      } else if (response.data.message) {
        // Some Dify responses have 'message' instead of 'answer'
        answerText = typeof response.data.message === 'string'
          ? response.data.message
          : JSON.stringify(response.data.message);
      } else if (typeof response.data === 'string') {
        answerText = response.data;
      } else if (response.data.text) {
        answerText = typeof response.data.text === 'string'
          ? response.data.text
          : JSON.stringify(response.data.text);
      } else {
        // Try to stringify the entire response as fallback
        answerText = JSON.stringify(response.data);
      }
      
      if (!answerText) {
        console.warn(`   ⚠️ No answer found in Workflow 4 response`);
        console.warn(`   Response structure: ${JSON.stringify(Object.keys(response.data))}`);
        return null;
      }
      
      // Try to parse the answer as JSON
      let extractedFields: Record<string, string> = {};
      
      try {
        // The answer might be a JSON string or already parsed
        // Try to extract JSON from the answer (might be wrapped in markdown code blocks or have extra text)
        let jsonStr: string | null = null;
        
        // Try markdown code block first
        const codeBlockMatch = answerText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
        } else {
          // Try to find JSON object in the text
          const jsonMatch = answerText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          } else {
            // Try parsing the entire answer as JSON
            jsonStr = answerText.trim();
          }
        }
        
        if (jsonStr) {
          extractedFields = JSON.parse(jsonStr);
        } else {
          console.warn(`   ⚠️ Could not extract JSON from Workflow 4 response`);
          console.warn(`   Response preview: ${answerText.substring(0, 300)}`);
          return null;
        }
        
        // Validate that extractedFields is an object
        if (typeof extractedFields === 'object' && extractedFields !== null && !Array.isArray(extractedFields)) {
          // Filter and clean values - support strings, arrays, numbers, booleans
          const filteredFields: Record<string, any> = {};
          for (const [key, value] of Object.entries(extractedFields)) {
            if (value === null || value === undefined) {
              continue; // Skip null/undefined values
            } else if (typeof value === 'string') {
              // Clean string values
              const cleanedValue = value.replace(/\[object Object\]/g, '').trim();
              if (cleanedValue.length > 0) {
                filteredFields[key] = cleanedValue;
              }
            } else if (Array.isArray(value)) {
              // Handle arrays (e.g., multiple authors)
              // Filter out empty strings and clean array items
              const cleanedArray = value
                .map(item => {
                  if (typeof item === 'string') {
                    const cleaned = item.replace(/\[object Object\]/g, '').trim();
                    return cleaned.length > 0 ? cleaned : null;
                  } else if (typeof item === 'number' || typeof item === 'boolean') {
                    return String(item);
                  }
                  return null;
                })
                .filter((item): item is string => item !== null && item !== '');
              
              if (cleanedArray.length > 0) {
                // Keep as array - it will be properly serialized when stored
                filteredFields[key] = cleanedArray;
              }
            } else if (typeof value === 'number' || typeof value === 'boolean') {
              // Convert numbers and booleans to strings for consistency
              filteredFields[key] = String(value);
            } else if (typeof value === 'object') {
              // Nested objects - stringify them (but this shouldn't happen often)
              try {
                const stringified = JSON.stringify(value);
                if (stringified && stringified !== '{}' && stringified !== 'null') {
                  filteredFields[key] = stringified;
                }
              } catch {
                // Skip if can't stringify
              }
            }
          }
          
          if (Object.keys(filteredFields).length > 0) {
            const fieldNames = Object.keys(filteredFields).map(key => {
              const value = filteredFields[key];
              const type = Array.isArray(value) ? 'array' : typeof value;
              return `${key}(${type})`;
            });
            console.log(`   ✅ Workflow 4 extracted ${Object.keys(filteredFields).length} fields: ${fieldNames.join(', ')}`);
            return filteredFields;
          } else {
            console.warn(`   ⚠️ No valid fields extracted from Workflow 4 response`);
          }
        } else {
          console.warn(`   ⚠️ Workflow 4 response is not a valid object`);
        }
      } catch (parseError: any) {
        console.warn(`   ⚠️ Failed to parse Workflow 4 response as JSON: ${parseError.message}`);
        console.warn(`   Response preview: ${answerText.substring(0, 300)}`);
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`   ❌ Error calling Workflow 4: ${error.message}`);
    // Don't throw - just return null so processing can continue
    return null;
  }
}

/**
 * Convert markdown file(s) to JSON using Python script
 * Returns structured JSON with sections in order
 */
export async function convertMarkdownToJson(
  markdownPathOrContent: string,
  isContent: boolean = false
): Promise<any> {
  try {
    let markdownContent: string;
    let tempMarkdownFile: string | null = null;

    if (isContent) {
      // If content is provided directly, write to temp file
      markdownContent = markdownPathOrContent;
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      tempMarkdownFile = path.join(tempDir, `temp_${Date.now()}.md`);
      fs.writeFileSync(tempMarkdownFile, markdownContent, 'utf-8');
    } else {
      // Read from file path
      const fullPath = path.isAbsolute(markdownPathOrContent)
        ? markdownPathOrContent
        : path.join(process.cwd(), markdownPathOrContent);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Markdown file not found: ${fullPath}`);
      }
      markdownContent = await readFile(fullPath, 'utf-8');
    }

    // Use Python script to convert markdown to JSON
    // Get project root - handle both cases: running from server/ or project root
    const currentDir = process.cwd();
    let projectRoot: string;
    let pythonScript: string;
    
    // Check if we're in the project root (has python/ directory)
    const pythonInCurrent = path.join(currentDir, 'python', 'markdown_to_json_converter.py');
    if (fs.existsSync(pythonInCurrent)) {
      projectRoot = currentDir;
      pythonScript = pythonInCurrent;
    } else {
      // Check if we're in server/ directory
      const pythonInParent = path.join(currentDir, '..', 'python', 'markdown_to_json_converter.py');
      if (fs.existsSync(pythonInParent)) {
        projectRoot = path.resolve(currentDir, '..');
        pythonScript = pythonInParent;
      } else {
        // Fallback: assume we're in server/ and go up one level
        projectRoot = path.resolve(currentDir, '..');
        pythonScript = path.join(projectRoot, 'python', 'markdown_to_json_converter.py');
      }
    }
    
    const scriptExists = fs.existsSync(pythonScript);
    
    if (!scriptExists) {
      console.warn(`Python script not found at ${pythonScript}, using fallback conversion`);
      console.warn(`   Current working directory: ${currentDir}`);
      console.warn(`   Project root resolved to: ${projectRoot}`);
      console.warn(`   Looking for script at: ${pythonScript}`);
      return convertMarkdownToJsonFallback(markdownContent);
    }

    // Create temp output file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempJsonFile = path.join(tempDir, `temp_${Date.now()}.json`);

    // Execute Python script (use the input file path)
    const inputFile = isContent ? tempMarkdownFile! : markdownPathOrContent;
    const pythonProcess = spawn('python', [
      pythonScript,
      inputFile,
      tempJsonFile
    ], {
      cwd: projectRoot
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    await new Promise<void>((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });
    });

    // Read JSON result
    if (fs.existsSync(tempJsonFile)) {
      const jsonContent = await readFile(tempJsonFile, 'utf-8');
      const jsonData = JSON.parse(jsonContent);
      
      // Ensure section order is preserved in content
      // The Python script returns sections in structured_elements.sections in order
      if (jsonData.content && typeof jsonData.content === 'object') {
        // Helper to normalize section names consistently
        const normalizeSectionName = (name: string): string => {
          return name.replace(/\s+/g, ' ').trim();
        };
        
        // Extract sections in order from structured_elements
        const sectionOrder: string[] = [];
        const orderedContent: { [key: string]: any } = {};
        const normalizedKeys = new Map<string, string>(); // Map normalized -> original key
        
        // Get sections from structured_elements if available (these are in order)
        if (jsonData.structured_elements?.sections && Array.isArray(jsonData.structured_elements.sections)) {
          for (const section of jsonData.structured_elements.sections) {
            if (section.title) {
              const normalizedKey = normalizeSectionName(section.title);
              // Only add if we haven't seen this normalized key before
              if (!normalizedKeys.has(normalizedKey)) {
                normalizedKeys.set(normalizedKey, normalizedKey);
                sectionOrder.push(normalizedKey);
                // Use content from section object, or fallback to content dict
                // Try to find the original key in content (might have different whitespace)
                const originalKey = Object.keys(jsonData.content).find(k => 
                  normalizeSectionName(k) === normalizedKey
                ) || normalizedKey;
                orderedContent[normalizedKey] = section.content || jsonData.content[originalKey] || '';
              } else {
                // Duplicate section - merge content
                const existingContent = orderedContent[normalizedKey] || '';
                const newContent = section.content || jsonData.content[section.title] || '';
                if (newContent && newContent !== existingContent) {
                  orderedContent[normalizedKey] = existingContent 
                    ? `${existingContent}\n\n---\n\n${newContent}`
                    : newContent;
                }
              }
            }
          }
        }
        
        // Add any remaining keys from content that weren't in sections
        for (const key in jsonData.content) {
          const normalizedKey = normalizeSectionName(key);
          if (!normalizedKeys.has(normalizedKey)) {
            normalizedKeys.set(normalizedKey, key);
            sectionOrder.push(normalizedKey);
            orderedContent[normalizedKey] = jsonData.content[key];
          } else if (orderedContent[normalizedKey] !== jsonData.content[key]) {
            // Merge if content is different
            const existingContent = orderedContent[normalizedKey] || '';
            const newContent = jsonData.content[key];
            if (newContent && newContent !== existingContent) {
              orderedContent[normalizedKey] = existingContent 
                ? `${existingContent}\n\n---\n\n${newContent}`
                : newContent;
            }
          }
        }
        
        // Replace content with ordered version and add sectionOrder
        jsonData.content = orderedContent;
        jsonData.sectionOrder = sectionOrder;
      }
      
      // Clean up temp files
      if (tempMarkdownFile && fs.existsSync(tempMarkdownFile)) {
        fs.unlinkSync(tempMarkdownFile);
      }
      if (fs.existsSync(tempJsonFile)) {
        fs.unlinkSync(tempJsonFile);
      }
      
      return jsonData;
    } else {
      throw new Error('Python script did not generate JSON file');
    }

  } catch (error: any) {
    console.error('Error converting markdown to JSON:', error);
    // Fallback to simple conversion
    if (isContent) {
      return convertMarkdownToJsonFallback(markdownPathOrContent);
    } else {
      const content = await readFile(markdownPathOrContent, 'utf-8');
      return convertMarkdownToJsonFallback(content);
    }
  }
}

/**
 * Fallback markdown to JSON conversion (simpler, Node.js only)
 * Extracts sections in order
 * Handles duplicate section names by merging content
 */
function convertMarkdownToJsonFallback(markdownContent: string): any {
  const lines = markdownContent.split('\n');
  const sections: { [key: string]: string[] } = {}; // Store as array to handle duplicates
  let currentSection: string | null = null;
  let currentContent: string[] = [];
  const sectionOrder: string[] = [];
  const normalizedSectionMap = new Map<string, string>(); // Map normalized -> original for deduplication
  let headerCount = 0;

  // Helper function to normalize section names consistently
  const normalizeSectionName = (name: string): string => {
    return name.replace(/\s+/g, ' ').trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for headers (# Header or ## Header) - must match at start of line
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      headerCount++;
      // Save previous section before starting a new one
      if (currentSection) {
        const contentStr = currentContent.join('\n').trim();
        if (contentStr) {
          // Handle duplicate sections by appending content
          // Use normalized name as key
          const normalizedKey = normalizeSectionName(currentSection);
          if (!sections[normalizedKey]) {
            sections[normalizedKey] = [];
            // Check if normalized name already exists in sectionOrder
            if (!normalizedSectionMap.has(normalizedKey)) {
              sectionOrder.push(normalizedKey);
              normalizedSectionMap.set(normalizedKey, normalizedKey);
            }
          }
          sections[normalizedKey].push(contentStr);
        }
      }
      
      // Start new section - normalize section name
      const sectionName = headerMatch[2].trim();
      // Clean up section names (remove extra spaces, normalize)
      const normalizedSectionName = normalizeSectionName(sectionName);
      
      // Skip if it's just a page break marker
      if (normalizedSectionName.toLowerCase().includes('page break')) {
        currentSection = null;
        currentContent = [];
        continue;
      }
      
      // All headers (regardless of level) become their own sections
      // Use normalized name consistently
      currentSection = normalizedSectionName;
      currentContent = [];
      
      // Debug: log header found
      if (headerCount <= 5) {
        console.log(`   🔍 Found header #${headerCount}: "${normalizedSectionName}" (level ${headerMatch[1].length})`);
      }
    } else {
      // Add content to current section
      if (currentSection) {
        currentContent.push(line);
      } else if (line.trim() && !line.trim().startsWith('---')) {
        // If no section yet and we have content, start with "Content" section
        // This handles content that appears before any headers
        if (!currentSection) {
          currentSection = 'Content';
        }
        currentContent.push(line);
      }
    }
  }

  // Save last section
  if (currentSection) {
    const contentStr = currentContent.join('\n').trim();
    if (contentStr) {
      // Handle duplicate sections by appending content
      // Use normalized name as key
      const normalizedKey = normalizeSectionName(currentSection);
      if (!sections[normalizedKey]) {
        sections[normalizedKey] = [];
        // Check if normalized name already exists in sectionOrder
        if (!normalizedSectionMap.has(normalizedKey)) {
          sectionOrder.push(normalizedKey);
          normalizedSectionMap.set(normalizedKey, normalizedKey);
        }
      }
      sections[normalizedKey].push(contentStr);
    }
  }

  // Convert arrays to strings (merge duplicates with double newline)
  const finalSections: { [key: string]: string } = {};
  for (const [key, contentArray] of Object.entries(sections)) {
    if (contentArray.length === 1) {
      // Single occurrence - just use the content
      finalSections[key] = contentArray[0];
    } else {
      // Multiple occurrences - check if they're identical or different
      // Normalize all content for comparison
      const normalizedContents = contentArray.map(c => c.trim().replace(/\s+/g, ' '));
      
      // Check if all occurrences are identical
      const firstNormalized = normalizedContents[0];
      const allIdentical = normalizedContents.every(n => n === firstNormalized);
      
      if (allIdentical) {
        // All duplicates are identical - keep only one copy
        finalSections[key] = contentArray[0];
      } else {
        // Different content - merge unique content
        const uniqueContent: string[] = [];
        const seenContent = new Set<string>();
        
        for (const content of contentArray) {
          // Normalize: trim, collapse whitespace, and compare
          const normalized = content.trim().replace(/\s+/g, ' ');
          if (normalized && !seenContent.has(normalized)) {
            seenContent.add(normalized);
            uniqueContent.push(content);
          }
        }
        
        if (uniqueContent.length === 1) {
          finalSections[key] = uniqueContent[0];
        } else if (uniqueContent.length > 1) {
          // Merge unique content with separator, preserving original formatting
          finalSections[key] = uniqueContent.join('\n\n---\n\n');
        }
      }
    }
  }

  // Ensure sectionOrder doesn't have duplicates (shouldn't happen, but double-check)
  const uniqueSectionOrder = Array.from(new Set(sectionOrder));
  
  // If no sections found at all, put everything in Content
  if (Object.keys(finalSections).length === 0 && markdownContent.trim()) {
    finalSections['Content'] = markdownContent.trim();
    if (!uniqueSectionOrder.includes('Content')) {
      uniqueSectionOrder.push('Content');
    }
  }

  // Debug logging
  const extractedSections = Object.keys(finalSections);
  const duplicateCount = Object.values(sections).filter(arr => arr.length > 1).length;
  if (duplicateCount > 0) {
    console.log(`   ⚠️ Found ${duplicateCount} sections with duplicates, merged/deduplicated content`);
  }
  console.log(`   🔍 Fallback extracted ${extractedSections.length} sections from ${headerCount} headers: ${extractedSections.join(', ')}`);

  return {
    metadata: {
      source: 'OCR',
      conversion_method: 'fallback'
    },
    content: finalSections,
    sectionOrder: uniqueSectionOrder.length > 0 ? uniqueSectionOrder : Object.keys(finalSections),
    structured_elements: {
      section_count: Object.keys(finalSections).length
    }
  };
}

/**
 * Convert all markdown files in OCR result directory to JSON
 * Combines all markdown files and converts to structured JSON
 * Also extracts doc_title from _res.json files if available
 */
export async function convertOcrMarkdownToJson(ocrResultPath: string): Promise<any> {
  try {
    // Normalize path to avoid double "server" prefix when process.cwd() already is /server
    const normalizedPath = ocrResultPath.startsWith('server/')
      ? ocrResultPath.replace(/^server[\\/]/, '')
      : ocrResultPath;

    // Resolve full path
    const fullPath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.join(process.cwd(), normalizedPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`OCR result directory not found: ${fullPath}`);
    }

    // Find all markdown files and JSON result files recursively
    const markdownFiles: string[] = [];
    const jsonResultFiles: string[] = [];
    
    function findFiles(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findFiles(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.md')) {
            markdownFiles.push(fullPath);
          } else if (entry.name.endsWith('_res.json')) {
            jsonResultFiles.push(fullPath);
          }
        }
      }
    }

    findFiles(fullPath);

    // Extract doc_title from JSON result files
    let extractedDocTitle: string | null = null;
    if (jsonResultFiles.length > 0) {
      // Sort JSON files by name to process in order
      jsonResultFiles.sort();
      
      for (const jsonFile of jsonResultFiles) {
        try {
          const jsonContent = await readFile(jsonFile, 'utf-8');
          const jsonData = JSON.parse(jsonContent);
          
          // Look for doc_title in parsing_res_list
          if (jsonData.parsing_res_list && Array.isArray(jsonData.parsing_res_list)) {
            const docTitleBlock = jsonData.parsing_res_list.find((block: any) => 
              block.block_label === 'doc_title' && block.block_content
            );
            
            if (docTitleBlock && docTitleBlock.block_content) {
              const titleText = String(docTitleBlock.block_content).trim();
              if (titleText && !extractedDocTitle) {
                extractedDocTitle = titleText;
                console.log(`📄 Extracted doc_title from ${path.basename(jsonFile)}: "${extractedDocTitle}"`);
                // Use first found doc_title, break if found
                break;
              }
            }
          }
        } catch (jsonError: any) {
          console.warn(`⚠️ Failed to parse JSON file ${jsonFile}: ${jsonError.message}`);
        }
      }
    }

    if (markdownFiles.length === 0) {
      console.warn(`No markdown files found in ${fullPath}`);
      // If we found a doc_title but no markdown, return a minimal structure with the title
      if (extractedDocTitle) {
        return {
          content: {
            Title: extractedDocTitle
          },
          sectionOrder: ['Title']
        };
      }
      return null;
    }

    // Sort files by name (to maintain order) - use numeric sort for page numbers
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

    // Read and combine all markdown files, fixing image paths with subdirectories
    let combinedMarkdown = '';
    for (const mdFile of markdownFiles) {
      let content = await readFile(mdFile, 'utf-8');
      
      // Determine the subdirectory path for this markdown file
      // Full path: .../ocr-results/groupname/subdirectory/markdown.md
      // We need: subdirectory (relative to groupname)
      const ocrResultsDir = path.dirname(fullPath);
      const mdFileDir = path.dirname(mdFile);
      const relativeDir = path.relative(ocrResultsDir, mdFileDir).replace(/\\/g, '/');
      const isInSubdirectory = relativeDir && relativeDir !== '.' && relativeDir !== '';
      
      // Fix image paths in this markdown file to include subdirectory
      if (isInSubdirectory) {
        // Handle HTML img tags: <img src="imgs/..." or <img src="./imgs/..."
        content = content.replace(
          /(<img[^>]+src=["'])([^"']*imgs\/[^"']+)(["'])/gi,
          (_match, prefix, imgPath, suffix) => {
            // Handle relative paths (./imgs/ or imgs/)
            let cleanPath = imgPath.replace(/^\.\//, '');
            
            // Only prepend subdirectory if path doesn't already include it
            const normalizedRelativeDir = relativeDir.replace(/\\/g, '/');
            const normalizedCleanPath = cleanPath.replace(/\\/g, '/');
            
            if (!normalizedCleanPath.startsWith(normalizedRelativeDir + '/') && !normalizedCleanPath.startsWith('/')) {
              cleanPath = `${normalizedRelativeDir}/${normalizedCleanPath}`;
            }
            
            return `${prefix}${cleanPath}${suffix}`;
          }
        );
        
        // Handle markdown image syntax: ![alt](imgs/...)
        content = content.replace(
          /(!\[[^\]]*\]\()([^)]*imgs\/[^)]+)(\))/gi,
          (_match, prefix, imgPath, suffix) => {
            let cleanPath = imgPath.replace(/^\.\//, '');
            
            const normalizedRelativeDir = relativeDir.replace(/\\/g, '/');
            const normalizedCleanPath = cleanPath.replace(/\\/g, '/');
            
            if (!normalizedCleanPath.startsWith(normalizedRelativeDir + '/') && !normalizedCleanPath.startsWith('/')) {
              cleanPath = `${normalizedRelativeDir}/${normalizedCleanPath}`;
            }
            
            return `${prefix}${cleanPath}${suffix}`;
          }
        );
      }
      
      combinedMarkdown += content + '\n\n---\n\n';
    }

    // Convert combined markdown to JSON
    const jsonData = await convertMarkdownToJson(combinedMarkdown, true);
    
    // Debug: Log what sections were extracted
    if (jsonData && jsonData.content) {
      const extractedSections = Object.keys(jsonData.content);
      console.log(`📋 Extracted ${extractedSections.length} sections from markdown: ${extractedSections.join(', ')}`);
    }
    
    // Clean up useless blocks from content
    if (jsonData && jsonData.content && typeof jsonData.content === 'object') {
      const cleanedContent: any = {};
      for (const [key, value] of Object.entries(jsonData.content)) {
        // Skip numeric keys
        if (/^\d+$/.test(key)) {
          continue;
        }
        
        // Skip if value is object with malformed structure
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (value.title && value.content) {
            const titleStr = String(value.title);
            let contentStr = String(value.content);
            // Remove "[object Object]" from content strings
            contentStr = contentStr.replace(/\[object Object\]/g, '').trim();
            if (/^\d+$/.test(titleStr) || contentStr === '' || contentStr === 'content') {
              continue;
            }
            // Update the content with cleaned value
            cleanedContent[key] = { ...value, content: contentStr };
          } else {
            cleanedContent[key] = value;
          }
        } else {
          // Skip if value is "[object Object]" or empty placeholder
          if (typeof value === 'string') {
            // Remove "[object Object]" from strings
            const cleanedValue = value.replace(/\[object Object\]/g, '').trim();
            if (cleanedValue === '' || cleanedValue === 'content' || cleanedValue.length === 0) {
              continue;
            }
            cleanedContent[key] = cleanedValue;
          } else {
            cleanedContent[key] = value;
          }
        }
      }
      jsonData.content = cleanedContent;
      
      // Update sectionOrder to remove filtered keys
      if (jsonData.sectionOrder && Array.isArray(jsonData.sectionOrder)) {
        jsonData.sectionOrder = jsonData.sectionOrder.filter((key: string) => 
          cleanedContent.hasOwnProperty(key)
        );
      }
    }
    
    // If we extracted a doc_title and it's not already in the structured data, add it
    if (extractedDocTitle && jsonData) {
      // Check if title already exists in content (case-insensitive check)
      const hasTitle = jsonData.content && (
        jsonData.content.Title || 
        jsonData.content.title ||
        Object.keys(jsonData.content).some(key => {
          const keyLower = key.toLowerCase();
          const value = jsonData.content[key];
          return (keyLower === 'title' || keyLower.includes('title')) && 
                 typeof value === 'string' &&
                 value.trim().length > 0;
        })
      );
      
      if (!hasTitle) {
        // Add Title as the first section, but preserve ALL other sections
        // Even if the first section matches the title, we keep all sections
        if (!jsonData.content) {
          jsonData.content = {};
        }
        
        // Create new content object with Title first, preserving ALL existing sections
        const newContent: any = { Title: extractedDocTitle };
        
        // Preserve ALL existing sections - don't skip any, even the first one
        // This ensures headers like "ABSTRACT", "INTRODUCTION", etc. are all preserved
        for (const [key, value] of Object.entries(jsonData.content)) {
          // Skip only if it's explicitly "Title" or "title", but keep all other sections
          if (key !== 'Title' && key !== 'title') {
            newContent[key] = value;
          }
        }
        jsonData.content = newContent;
        
        // Update sectionOrder to have Title first, but preserve all other sections in order
        if (!jsonData.sectionOrder || !Array.isArray(jsonData.sectionOrder)) {
          jsonData.sectionOrder = Object.keys(newContent);
        } else {
          // Remove Title if it exists in sectionOrder, then add it at the beginning
          // Keep all other sections in their original order
          const orderWithoutTitle = jsonData.sectionOrder.filter((k: string) => 
            k !== 'Title' && k !== 'title'
          );
          jsonData.sectionOrder = ['Title', ...orderWithoutTitle];
        }
        
        console.log(`✅ Added extracted doc_title as "Title" in structured_data`);
        const sectionsAfter = Object.keys(newContent);
        console.log(`   📋 Sections after adding title: ${sectionsAfter.join(', ')}`);
        console.log(`   📋 Preserved ${sectionsAfter.length - 1} other sections`);
      } else {
        console.log(`ℹ️ Title already exists in structured_data, skipping doc_title extraction`);
      }
    }
    
    // Group sections similar to document title into "Additional Information"
    if (jsonData && jsonData.content && typeof jsonData.content === 'object') {
      // Get document title (from Title field or extractedDocTitle)
      let docTitle = '';
      if (jsonData.content.Title && typeof jsonData.content.Title === 'string') {
        docTitle = jsonData.content.Title.trim();
      } else if (extractedDocTitle) {
        docTitle = extractedDocTitle.trim();
      }
      
      if (docTitle) {
        // Helper function to check if two strings are similar (case-insensitive, ignoring punctuation)
        const areSimilar = (str1: string, str2: string): boolean => {
          if (!str1 || !str2) return false;
          const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
          const normalized1 = normalize(str1);
          const normalized2 = normalize(str2);
          
          // Check if they're exactly the same after normalization
          if (normalized1 === normalized2) return true;
          
          // Check if one contains the other (for partial matches)
          if (normalized1.length > 20 && normalized2.length > 20) {
            // For longer strings, check if one is a substantial substring of the other
            const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
            const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
            if (longer.includes(shorter) && shorter.length / longer.length > 0.8) {
              return true;
            }
          }
          
          // Calculate similarity using simple word overlap
          const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 2));
          const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 2));
          const intersection = new Set([...words1].filter(w => words2.has(w)));
          const union = new Set([...words1, ...words2]);
          const similarity = union.size > 0 ? intersection.size / union.size : 0;
          
          // Consider similar if > 70% word overlap
          return similarity > 0.7;
        };
        
        // Separate sections into regular sections and additional information
        const regularSections: any = {};
        const additionalInfoContent: string[] = []; // Collect content strings, not objects
        
        for (const [sectionKey, sectionValue] of Object.entries(jsonData.content)) {
          // Skip the "Title" section itself (don't move it to Additional Information)
          if (sectionKey === 'Title' || sectionKey === 'title') {
            regularSections[sectionKey] = sectionValue;
            continue;
          }
          
          // Skip if section key exactly matches the document title (after normalization)
          const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
          const normalizedKey = normalize(sectionKey);
          const normalizedDocTitle = normalize(docTitle);
          if (normalizedKey === normalizedDocTitle) {
            // Exact match - skip it, don't add to Additional Information
            continue;
          }
          
          // Ensure sectionValue is properly formatted before grouping
          // Convert objects to strings if they would stringify to "[object Object]"
          let processedValue: any = sectionValue;
          
          if (typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue)) {
            // Handle object values - extract content if available, otherwise stringify properly
            if (sectionValue.content && typeof sectionValue.content === 'string') {
              processedValue = sectionValue.content;
            } else {
              // Check if this object would stringify to "[object Object]"
              try {
                const stringified = JSON.stringify(sectionValue);
                // If it's a simple object without meaningful content, convert to string
                if (stringified === '{}' || Object.keys(sectionValue).length === 0) {
                  continue; // Skip empty objects
                }
                // Keep the object structure if it has meaningful content
                processedValue = sectionValue;
              } catch {
                // If stringification fails, skip this section
                continue;
              }
            }
          } else if (typeof sectionValue === 'string') {
            // Skip if value is "[object Object]" or empty
            if (sectionValue === '[object Object]' || sectionValue.trim().length === 0) {
              continue;
            }
            // Remove "[object Object]" if it appears in the string
            processedValue = sectionValue.replace(/\[object Object\]/g, '').trim();
            if (processedValue.length === 0) {
              continue;
            }
          }
          
          // Check if this section's title is similar to the document title
          if (areSimilar(sectionKey, docTitle)) {
            // Collect content for Additional Information - ensure value is a string
            if (typeof processedValue === 'string') {
              // Remove any remaining "[object Object]" from the content
              const cleanedValue = processedValue.replace(/\[object Object\]/g, '').trim();
              // Remove trailing "---" separators
              const finalValue = cleanedValue.replace(/\n*---\s*$/g, '').trim();
              if (finalValue.length > 0) {
                additionalInfoContent.push(finalValue);
              }
            } else {
              // If it's still an object, try to extract meaningful content
              try {
                const content = processedValue.content || JSON.stringify(processedValue);
                if (content && content !== '[object Object]') {
                  const cleanedContent = String(content).replace(/\[object Object\]/g, '').trim();
                  const finalContent = cleanedContent.replace(/\n*---\s*$/g, '').trim();
                  if (finalContent.length > 0) {
                    additionalInfoContent.push(finalContent);
                  }
                }
              } catch {
                // Skip if we can't extract meaningful content
              }
            }
          } else {
            // Keep in regular sections - preserve original value type but clean strings
            if (typeof processedValue === 'string') {
              // Remove "[object Object]" from regular sections too
              const cleanedValue = processedValue.replace(/\[object Object\]/g, '').trim();
              if (cleanedValue.length > 0) {
                regularSections[sectionKey] = cleanedValue;
              }
            } else {
              regularSections[sectionKey] = processedValue;
            }
          }
        }
        
        // Add Additional Information section if we found similar titles
        // Combine all content into a single string
        if (additionalInfoContent.length > 0) {
          // Join all content with double newlines, remove any trailing separators
          const combinedContent = additionalInfoContent
            .map(content => content.trim())
            .filter(content => content.length > 0)
            .join('\n\n')
            .replace(/\n*---\s*$/g, '') // Remove trailing "---"
            .trim();
          
          if (combinedContent.length > 0) {
            regularSections['Additional Information'] = combinedContent;
            
            // Call Workflow 4 to extract structured fields from Additional Information
            const extractedFields = await extractStructuredFieldsFromAdditionalInfo(combinedContent);
            
            if (extractedFields && Object.keys(extractedFields).length > 0) {
              // Merge extracted fields into regularSections (they'll replace "Additional Information")
              // Remove "Additional Information" and add the extracted fields
              delete regularSections['Additional Information'];
              
              // Add extracted fields to regularSections
              for (const [key, value] of Object.entries(extractedFields)) {
                // Handle arrays by converting to string if needed, or keep as array
                if (Array.isArray(value)) {
                  // For arrays (like multiple authors), join with ", " or keep as array
                  // Let's keep as array for now, but ensure it's properly serialized
                  regularSections[key] = value;
                } else {
                  regularSections[key] = value;
                }
              }
              
              // Update sectionOrder: remove "Additional Information", add extracted field keys
              if (jsonData.sectionOrder && Array.isArray(jsonData.sectionOrder)) {
                // Remove sections that were moved to Additional Information
                const normalizeForCheck = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
                const normalizedDocTitleForCheck = normalizeForCheck(docTitle);
                
                const movedSections = Object.keys(jsonData.content).filter(key => {
                  if (key === 'Title' || key === 'title') return false;
                  const normalizedKey = normalizeForCheck(key);
                  if (normalizedKey === normalizedDocTitleForCheck) return false;
                  return areSimilar(key, docTitle);
                });
                
                // Remove moved sections and "Additional Information"
                jsonData.sectionOrder = jsonData.sectionOrder.filter((key: string) => 
                  !movedSections.includes(key) && key !== 'Additional Information'
                );
                
                // Add extracted field keys to sectionOrder (in order they were extracted)
                // Place them after "Title" if it exists, otherwise at the beginning
                const extractedKeys = Object.keys(extractedFields);
                const titleIndex = jsonData.sectionOrder.findIndex((key: string) => 
                  key.toLowerCase() === 'title'
                );
                
                if (titleIndex >= 0) {
                  // Insert after Title
                  jsonData.sectionOrder.splice(titleIndex + 1, 0, ...extractedKeys);
                } else {
                  // If Title doesn't exist, add at the beginning
                  jsonData.sectionOrder.unshift(...extractedKeys);
                }
                
                console.log(`   ✅ Merged ${extractedKeys.length} extracted fields into structured_data: ${extractedKeys.join(', ')} (placed after Title)`);
              }
            } else {
              // No fields extracted - keep "Additional Information" as is
              // Update sectionOrder to include "Additional Information" at the end
              if (jsonData.sectionOrder && Array.isArray(jsonData.sectionOrder)) {
                // Remove sections that were moved to Additional Information
                const normalizeForCheck = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
                const normalizedDocTitleForCheck = normalizeForCheck(docTitle);
                
                const movedSections = Object.keys(jsonData.content).filter(key => {
                  if (key === 'Title' || key === 'title') return false;
                  const normalizedKey = normalizeForCheck(key);
                  if (normalizedKey === normalizedDocTitleForCheck) return false;
                  return areSimilar(key, docTitle);
                });
                
                jsonData.sectionOrder = jsonData.sectionOrder.filter((key: string) => 
                  !movedSections.includes(key) && key !== 'Additional Information'
                );
                // Add "Additional Information" at the end
                jsonData.sectionOrder.push('Additional Information');
              }
              
              console.log(`📋 Grouped ${additionalInfoContent.length} sections into "Additional Information" (combined as single string)`);
            }
          }
        }
        
        // Replace content with reorganized sections
        jsonData.content = regularSections;
      }
    }
    
    return jsonData;

  } catch (error: any) {
    console.error('Error converting OCR markdown to JSON:', error);
    throw error;
  }
}
