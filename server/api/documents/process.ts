import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import Notification from '../../models/supabase/Notification.ts';
import Analytic from '../../models/supabase/Analytic.ts';
import OCRService from '../../lib/ocrService.ts';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

// Background processing function
async function processOCRInBackground(
  documentId: string | number,
  extractionResultId: string | number,
  extractedText: string,
  fileTypeId: string | null,
  startTime: number
) {
  try {
    console.log(`📥 Saving OCR results for document: ${documentId}`);
    console.log(`   Extracted text length: ${extractedText?.length || 0} characters`);
    console.log(`   Extracted text preview: ${extractedText?.substring(0, 200) || 'empty'}...`);

    const processingTime = Date.now() - startTime;

    if (extractedText && extractedText.trim()) {
      const trimmedText = extractedText.trim();
      console.log(`   Trimmed text length: ${trimmedText.length} characters`);
      
      // Update extraction result with extracted text
      await ExtractionResult.update(extractionResultId, {
        extracted_text: trimmedText,
        structured_data: null,
        accuracy: 1.0,
        processing_time_ms: processingTime,
        status: 'completed'
      });
      
      console.log(`   ✅ Saved ${trimmedText.length} characters to database`);

      // Update document status
      await Document.updateStatus(documentId, 'completed', {
        processing_completed_at: new Date().toISOString()
      });

      // Record analytics
      if (fileTypeId) {
        await Analytic.create({
          file_type_id: fileTypeId,
          metric_type: 'processing_time',
          value: processingTime,
          date_recorded: new Date().toISOString().split('T')[0]
        });

        await Analytic.create({
          file_type_id: fileTypeId,
          metric_type: 'successful_extractions',
          value: 1,
          date_recorded: new Date().toISOString().split('T')[0]
        });
      }

      console.log(`✅ Successfully saved OCR results for document ${documentId} (${processingTime}ms)`);
    } else {
      throw new Error('No text extracted from document');
    }

  } catch (error: any) {
    console.error(`❌ Failed to save OCR results for document ${documentId}:`, error);
    
    const processingTime = Date.now() - startTime;

    // Update status to failed
    await ExtractionResult.updateStatus(extractionResultId, 'failed', error.message);
    await Document.updateStatus(documentId, 'failed');

    // Create notification for user about processing failure
    try {
      const doc = await Document.findById(documentId);
      if (doc && doc.user_id) {
        const documentName = doc.display_name || doc.group_name || doc.original_name || doc.file_name || 'your document';
        
        await Notification.create({
          user_id: doc.user_id,
          title: 'Processing Error',
          message: `Your document "${documentName}" failed to process. Error: ${error.message}. Please try uploading again or contact support if the issue persists.`,
          is_read: false
        });
        
        console.log(`🔔 Sent failure notification to user ${doc.user_id} for document ${documentId}`);
      }
    } catch (notificationError: any) {
      console.error(`⚠️ Failed to create failure notification: ${notificationError.message}`);
      // Don't fail the whole operation if notification creation fails
    }

    // Record failed extraction
    if (fileTypeId) {
      await Analytic.create({
        file_type_id: fileTypeId,
        metric_type: 'failed_extractions',
        value: 1,
        date_recorded: new Date().toISOString().split('T')[0]
      });
    }
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    // Verify JWT token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number | string };
    const userId = decoded.userId;

    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }

    // Initialize Dify OCR service
    const ocrService = new OCRService();

    // Check if Dify OCR is configured
    if (!process.env.DIFY_API_URL) {
      return res.status(503).json({
        error: 'Dify API is not configured',
        message: 'Please ensure DIFY_API_URL environment variable is set'
      });
    }

    if (!process.env.DIFY_OCR_API_KEY_V1) {
      return res.status(503).json({
        error: 'Dify OCR API key is not configured',
        message: 'Please ensure DIFY_OCR_API_KEY_V1 environment variable is set'
      });
    }

    console.log('✅ Dify OCR service initialized');
    const processingResults: any[] = [];

    for (const documentId of documentIds) {
      try {
        // Get document
        const document = await Document.findById(documentId);
        if (!document) {
          processingResults.push({
            documentId,
            success: false,
            error: 'Document not found'
          });
          continue;
        }

        // Check if user owns the document
        if (document.user_id !== userId) {
          processingResults.push({
            documentId,
            success: false,
            error: 'Unauthorized access'
          });
          continue;
        }

        // Update document status to processing
        await Document.updateStatus(documentId, 'processing', {
          processing_started_at: new Date().toISOString()
        });

        // Create extraction result record
        const extractionResultId = await ExtractionResult.create({
          document_id: documentId,
          extracted_text: '',
          structured_data: null,
          accuracy: 0.0,
          processing_time_ms: 0,
          extraction_method: 'dify-ocr',
          status: 'processing'
        });

        // Start async OCR processing
        const startTime = Date.now();

        try {
          console.log(`🔄 Starting OCR processing for: ${document.original_name}`);

          // Check if file exists
          if (!fs.existsSync(document.file_path)) {
            throw new Error(`File not found: ${document.file_path}`);
          }

          // Get file extension to determine processing method
          const fileExtension = path.extname(document.file_path).toLowerCase();
          let ocrStartResult: any;

          // Check if this is an image with multiple related images (same file_name)
          if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'].includes(fileExtension)) {
            // Find all images with the same file_name
            const supabase = getConnection();
            const { data: relatedImages, error: queryError } = await supabase
              .from('documents')
              .select('id, file_path, original_name, mime_type')
              .eq('user_id', userId)
              .eq('file_name', document.file_name)
              .in('mime_type', ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/gif', 'image/webp'])
              .order('created_at', { ascending: true });

            if (!queryError && relatedImages && relatedImages.length > 1) {
              console.log(`📸 Found ${relatedImages.length} images with same file_name, sending all to Dify...`);
              
              // Get file extensions for each image
              const imageIds = relatedImages.map((img: any) => img.id);
              const imageExtensions = relatedImages.map((img: any) => {
                const ext = path.extname(img.file_path || img.original_name || '').toLowerCase();
                return ext || '.png';
              });

              // Send all images to Dify
              ocrStartResult = await ocrService.startMultipleImageOCR(
                imageIds,
                imageExtensions,
                'Extract all text from these images. Process each image separately, then combine all extracted text into a single structured JSON format with title, authors, abstract, topics (with subtopics), conclusion, and references. Ensure the output is valid JSON.'
              );
            } else {
              // Single image - process normally
              ocrStartResult = await ocrService.startImageOCR(documentId, fileExtension);
            }
          } else if (fileExtension === '.pdf') {
            // PDF processing
            ocrStartResult = await ocrService.startPDFOCR(documentId, fileExtension);
          } else if (fileExtension === '.txt') {
            // For text files, just read the content synchronously
            const extractedText = fs.readFileSync(document.file_path, 'utf-8');
            const processingTime = Date.now() - startTime;

            await ExtractionResult.update(extractionResultId, {
              extracted_text: extractedText,
              structured_data: null,
              accuracy: 1.0,
              processing_time_ms: processingTime,
              status: 'completed'
            });

            await Document.updateStatus(documentId, 'completed', {
              processing_completed_at: new Date().toISOString()
            });

            processingResults.push({
              documentId,
              success: true,
              extractionResultId,
              message: 'Text file processed successfully'
            });

            continue;
          } else {
            throw new Error(`Unsupported file type: ${fileExtension}`);
          }

          if (!ocrStartResult.success || !ocrStartResult.taskId) {
            throw new Error(ocrStartResult.error || 'Failed to start OCR processing');
          }

          // Return immediately - processing will continue in background
          processingResults.push({
            documentId,
            success: true,
            taskId: ocrStartResult.taskId,
            message: 'OCR text extraction started. Results will be saved automatically when processing completes.'
          });

          // Process the answer in the background (fire and forget)
          // The answer is already extracted from the stream, just need to save it
          const answerText = ocrStartResult.answer || '';
          console.log(`📋 Answer received from stream: ${answerText.length} characters`);
          if (answerText.length > 0) {
            console.log(`   Preview: ${answerText.substring(0, 200)}...`);
          }
          
          processOCRInBackground(
            documentId,
            extractionResultId,
            answerText,
            document.file_type_id,
            startTime
          ).catch((error: any) => {
            console.error(`Background processing error for document ${documentId}:`, error);
          });

        } catch (processingError: any) {
          console.error('Error starting OCR processing:', processingError);
          console.error('   Document:', document.original_name);
          console.error('   File path:', document.file_path);
          console.error('   File type:', document.mime_type);

          // Update status to failed
          await ExtractionResult.updateStatus(extractionResultId, 'failed', processingError.message);
          await Document.updateStatus(documentId, 'failed');

          // Create notification for user about processing failure
          try {
            const doc = await Document.findById(documentId);
            if (doc && doc.user_id) {
              const documentName = doc.display_name || doc.group_name || doc.original_name || doc.file_name || 'your document';
              
              await Notification.create({
                user_id: doc.user_id,
                title: 'Processing Error',
                message: `Your document "${documentName}" failed to process. Error: ${processingError.message}. Please try uploading again or contact support if the issue persists.`,
                is_read: false
              });
              
              console.log(`🔔 Sent failure notification to user ${doc.user_id} for document ${documentId}`);
            }
          } catch (notificationError: any) {
            console.error(`⚠️ Failed to create failure notification: ${notificationError.message}`);
            // Don't fail the whole operation if notification creation fails
          }

          // Record failed extraction
          await Analytic.create({
            file_type_id: document.file_type_id,
            metric_type: 'failed_extractions',
            value: 1,
            date_recorded: new Date().toISOString().split('T')[0]
          });

          processingResults.push({
            documentId,
            success: false,
            error: processingError.message
          });

          console.log(`❌ Failed to start processing: ${document.original_name} - ${processingError.message}`);
        }

      } catch (error: any) {
        console.error('Error processing document:', error);
        processingResults.push({
          documentId,
          success: false,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'OCR text extraction started for documents. Results will be saved automatically when processing completes.',
      results: processingResults
    });

  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

