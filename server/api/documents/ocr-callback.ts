import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import Notification from '../../models/supabase/Notification.ts';
import { convertOcrMarkdownToJson, convertMarkdownToJson } from '../../lib/markdownToJson.ts';
import path from 'path';
import fs from 'fs';

/**
 * Callback endpoint for OCR APIs to update extraction result status
 * Called by img-ocr-api.py or pdf-ocr-api.py after processing completes
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { extraction_result_id, document_id, status, error_message, ocr_result_path } = req.body;

    if (!extraction_result_id) {
      return res.status(400).json({ error: 'extraction_result_id is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    // Validate status
    const validStatuses = ['completed', 'failed', 'processing'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    console.log(`📝 Updating extraction result ${extraction_result_id} to status: ${status}`);

    // Before marking as completed, read markdown and save to extracted_text, convert to JSON and store in structured_data
    let structuredData: any = null;
    let extractedText: string | null = null;
    
    if (status === 'completed') {
      // Get current extraction result to check if structured_data exists
      const currentResult = await ExtractionResult.findById(extraction_result_id);
      
      // Determine OCR path to read markdown from
      let ocrPathToUse: string | null = null;
      
      if (ocr_result_path) {
        const normalizedPath = ocr_result_path.startsWith('server/')
          ? ocr_result_path.replace(/^server[\\/]/, '')
          : ocr_result_path;
        ocrPathToUse = path.isAbsolute(normalizedPath)
          ? normalizedPath
          : path.join(process.cwd(), normalizedPath);
      } else if (currentResult?.ocr_result_path) {
        ocrPathToUse = path.isAbsolute(currentResult.ocr_result_path)
          ? currentResult.ocr_result_path
          : path.join(process.cwd(), currentResult.ocr_result_path);
      } else if (document_id) {
        const document = await Document.findById(document_id);
        if (document?.group_name) {
          const defaultOcrPath = path.join(
            process.cwd(),
            'uploads',
            'ocr-results',
            document.group_name
          );
          if (fs.existsSync(defaultOcrPath)) {
            ocrPathToUse = defaultOcrPath;
          }
        }
      }
      
      // Read markdown from files and save to extracted_text
      if (ocrPathToUse && fs.existsSync(ocrPathToUse)) {
        try {
          console.log(`📖 Reading markdown from OCR path: ${ocrPathToUse}`);
          
          // Read all markdown files recursively
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
              console.error(`Error reading directory ${dir}:`, error);
            }
          }
          
          findMarkdownFiles(ocrPathToUse);
          
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
          
          // Read and combine all markdown files, fixing image paths with subdirectories
          const markdownContents: string[] = [];
          for (const mdFile of markdownFiles) {
            try {
              let content = fs.readFileSync(mdFile, 'utf-8');
              
              // Determine the subdirectory path for this markdown file
              // Full path: .../ocr-results/groupname/subdirectory/markdown.md
              // We need: subdirectory (relative to groupname)
              const mdFileDir = path.dirname(mdFile);
              const relativeDir = path.relative(ocrPathToUse, mdFileDir).replace(/\\/g, '/');
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
                      cleanPath = `${normalizedRelativeDir}/${cleanPath}`;
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
                      cleanPath = `${normalizedRelativeDir}/${cleanPath}`;
                    }
                    
                    return `${prefix}${cleanPath}${suffix}`;
                  }
                );
              }
              
              markdownContents.push(content);
            } catch (error) {
              console.error(`Error reading markdown file ${mdFile}:`, error);
            }
          }
          
          // Combine markdown with separators
          if (markdownContents.length > 0) {
            extractedText = markdownContents
              .map((content, index) => index > 0 ? `\n\n---\n\n${content}` : content)
              .join('');
            console.log(`✅ Read markdown (${extractedText.length} chars from ${markdownContents.length} files)`);
          } else {
            console.warn(`⚠️ No markdown files found in ${ocrPathToUse}`);
          }
        } catch (readError: any) {
          console.error(`❌ Error reading markdown: ${readError.message}`);
        }
      }
      
      // If no structured_data exists, convert markdown to JSON
      if (!currentResult?.structured_data || 
          (typeof currentResult.structured_data === 'object' && Object.keys(currentResult.structured_data).length === 0)) {
        
        console.log(`🔄 Converting markdown to JSON for extraction result ${extraction_result_id}...`);
        
        try {
          if (ocrPathToUse && fs.existsSync(ocrPathToUse)) {
            console.log(`📁 Converting markdown from OCR path: ${ocrPathToUse}`);
            structuredData = await convertOcrMarkdownToJson(ocrPathToUse);
          }
          
          if (structuredData) {
            console.log(`✅ Successfully converted markdown to JSON (${Object.keys(structuredData.content || {}).length} sections)`);
          } else {
            console.warn(`⚠️ Could not find markdown files to convert`);
          }
        } catch (conversionError: any) {
          console.error(`❌ Error converting markdown to JSON: ${conversionError.message}`);
          // Don't fail the whole operation if conversion fails
        }
      } else {
        console.log(`ℹ️ Structured data already exists, skipping markdown conversion`);
        structuredData = currentResult.structured_data;
      }
    }

    // Update extraction result with extracted_text, structured_data and status
    const updateData: any = {};
    
    if (ocr_result_path) {
      // Store without leading "server/" to avoid double-prepend with process.cwd()
      updateData.ocr_result_path = ocr_result_path.startsWith('server/')
        ? ocr_result_path.replace(/^server[\\/]/, '')
        : ocr_result_path;
      console.log(`📁 Saving OCR result path: ${ocr_result_path}`);
    }
    
    // Save markdown to extracted_text column
    if (extractedText !== null) {
      updateData.extracted_text = extractedText;
      console.log(`💾 Saving markdown to extracted_text (${extractedText.length} chars)`);
    }
    
    if (structuredData) {
      updateData.structured_data = structuredData;
    }
    
    // Update extraction result status
    if (status) {
      await ExtractionResult.updateStatus(extraction_result_id, status, error_message || undefined);
    }
    
    // Update other fields if provided
    if (Object.keys(updateData).length > 0) {
      await ExtractionResult.update(extraction_result_id, updateData);
    }

    // Update document status if document_id is provided
    if (document_id) {
      if (status === 'completed') {
        const completedAtIso = new Date().toISOString();
        await Document.updateStatus(document_id, 'completed', {
          processing_completed_at: completedAtIso
        });
        console.log(`✅ Document ${document_id} status updated to 'completed'`);

        // Calculate processing time (ms) using document processing_started_at/completed_at
        try {
          const doc = await Document.findById(document_id);
          const startedAt = doc?.processing_started_at;
          const completedAt = doc?.processing_completed_at || completedAtIso;
          if (startedAt && completedAt) {
            const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
            if (!Number.isNaN(durationMs) && durationMs >= 0) {
              await ExtractionResult.update(extraction_result_id, {
                processing_time_ms: durationMs
              });
              console.log(`⏱️ Saved processing_time_ms=${durationMs} for extraction_result ${extraction_result_id}`);
            }
          }
        } catch (durationError: any) {
          console.warn(`⚠️ Could not compute processing_time_ms: ${durationError.message}`);
        }
      } else if (status === 'failed') {
        await Document.updateStatus(document_id, 'failed');
        console.log(`❌ Document ${document_id} status updated to 'failed'`);

        // Create notification for user about processing failure
        try {
          const doc = await Document.findById(document_id);
          if (doc && doc.user_id) {
            const documentName = doc.display_name || doc.group_name || doc.original_name || doc.file_name || 'your document';
            const errorMsg = error_message ? ` Error: ${error_message}` : '';
            
            await Notification.create({
              user_id: doc.user_id,
              title: 'Processing Error',
              message: `Your document "${documentName}" failed to process.${errorMsg} Please try uploading again or contact support if the issue persists.`,
              is_read: false
            });
            
            console.log(`🔔 Sent failure notification to user ${doc.user_id} for document ${document_id}`);
          }
        } catch (notificationError: any) {
          console.error(`⚠️ Failed to create failure notification: ${notificationError.message}`);
          // Don't fail the whole operation if notification creation fails
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Extraction result ${extraction_result_id} updated to ${status}`
    });

  } catch (error: any) {
    console.error('OCR callback error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
