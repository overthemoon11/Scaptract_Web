import { Request, Response } from 'express';
import { connectDB, getConnection } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import Notification from '../../models/supabase/Notification.ts';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

/**
 * Generate OCR token for file access
 */
function generateOcrToken(documentId: string | number): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  // Token expires in 1 hour (enough time for OCR processing)
  const token = jwt.sign(
    {
      documentId: documentId,
      purpose: 'ocr-access'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return token;
}

/**
 * Start OCR processing by sending to Dify chatflow
 * This endpoint:
 * 1. Creates extraction_result record
 * 2. Copies file to server/uploads/documents/{groupname}/{filename}
 * 3. Sends groupname, filename, and filetype to Dify chatflow (DIFY_OCR_API_KEY_V2)
 * 4. Chatflow handles calling OCR APIs (pdf-ocr-api.py or img-ocr-api.py)
 * 5. Returns immediately (async processing)
 */
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

    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    // Get document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user owns the document
    if (document.user_id !== String(userId)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Determine file extension early (needed for multiple checks)
    const fileExtension = path.extname(document.file_path).toLowerCase();
    const normalizedExtension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
    const isPDF = fileExtension === '.pdf';
    const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'].includes(fileExtension);

    // For images, check if extraction is already in progress for any document with the same file_name
    // This prevents duplicate processing when multiple images are uploaded together
    if (isImage) {
      const supabase = getConnection();
      const { data: relatedDocs, error: queryError } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)
        .eq('file_name', document.file_name)
        .in('mime_type', ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/gif', 'image/webp']);
      
      if (!queryError && relatedDocs && relatedDocs.length > 0) {
        // Check if any related document already has a processing extraction_result
        const relatedDocIds = relatedDocs.map((doc: any) => doc.id);
        const { data: existingExtractions } = await supabase
          .from('extraction_results')
          .select('id, document_id, status')
          .in('document_id', relatedDocIds)
          .in('status', ['processing', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existingExtractions && existingExtractions.length > 0) {
          // Extraction already in progress for this batch
          const existingExtraction = existingExtractions[0];
          console.log(`⏭️  Extraction already in progress for file_name "${document.file_name}" (extraction_result_id: ${existingExtraction.id})`);
          return res.status(200).json({
            success: true,
            message: 'Extraction already in progress for this batch of images.',
            documentId: documentId,
            extractionResultId: existingExtraction.id,
            alreadyInProgress: true
          });
        }
      }
    }

    // Update document status to processing
    await Document.updateStatus(documentId, 'processing', {
      processing_started_at: new Date().toISOString()
    });

    // Get groupname and filename
    const groupName = document.group_name || '';
    const fileName = document.file_name || '';

    if (!groupName || !fileName) {
      await Document.updateStatus(documentId, 'failed');
      return res.status(400).json({
        error: 'Group name and file name are required'
      });
    }

    if (!isPDF && !isImage) {
      await Document.updateStatus(documentId, 'failed');
      return res.status(400).json({
        error: 'Unsupported file type. Only PDF and image files are supported.'
      });
    }

    // Save document to server/uploads/documents/{groupname}/{filename}
    // Use the same path structure as upload.ts: uploads/documents/{groupname}/
    const documentsDir = path.join(process.cwd(), 'uploads', 'documents', groupName);
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    // Construct target filename with extension (fileExtension is already defined above)
    // Use normalizedExtension which already has the '.' prefix
    const targetFileName = fileName + normalizedExtension;
    const targetFilePath = path.join(documentsDir, targetFileName);
    
    // Copy file to target location
    try {
      if (fs.existsSync(document.file_path)) {
        fs.copyFileSync(document.file_path, targetFilePath);
        console.log(`📁 Saved document to: ${targetFilePath}`);
      } else {
        console.warn(`⚠️  Source file not found: ${document.file_path}`);
        await Document.updateStatus(documentId, 'failed');
        return res.status(404).json({
          error: `Source file not found: ${document.file_path}`
        });
      }
    } catch (copyError: any) {
      console.error('Error copying file:', copyError);
      await Document.updateStatus(documentId, 'failed');
      return res.status(500).json({
        error: `Failed to save document: ${copyError.message}`
      });
    }

    // Create extraction result record
    const extractionResultId = await ExtractionResult.create({
      document_id: documentId,
      extracted_text: '',
      structured_data: null,
      accuracy: 0.0,
      processing_time_ms: 0,
      extraction_method: 'ocr-chatflow',
      status: 'processing'
    });

    // Check Dify API configuration
    const difyApiUrl = process.env.DIFY_API_URL;
    const difyChatflowApiKey = process.env.DIFY_OCR_API_KEY_V2;

    if (!difyApiUrl) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'DIFY_API_URL environment variable is not set');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'DIFY_API_URL environment variable is not set'
      });
    }

    if (!difyChatflowApiKey) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'DIFY_OCR_API_KEY_V2 environment variable is not set');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'DIFY_OCR_API_KEY_V2 environment variable is not set'
      });
    }

    // Determine file type
    const fileType = isPDF ? 'pdf' : 'image';

    // Prepare callback URL for OCR APIs
    const fileServerUrl = process.env.FILE_SERVER_URL || 'http://localhost:3000';
    const callbackUrl = `${fileServerUrl.replace(/\/$/, '')}/api/documents/ocr-callback`;

    // Prepare inputs for Dify chatflow
    // For images: only groupname needed (processes all images in folder)
    // For PDFs: need groupname and filename
    const chatflowInputs: any = {
      groupname: groupName,
      filetype: fileType,
      extraction_result_id: extractionResultId.toString(),
      document_id: documentId.toString(),
      callback_url: callbackUrl
    };
    
    // Only include filename for PDFs (images process all files in folder)
    if (isPDF) {
      chatflowInputs.filename = targetFileName; // Include extension for PDF OCR API
    }

    // Create request body for Dify chatflow
    // For chatflows, the inputs are available as variables, and query can be simple
    const requestBody = {
      inputs: chatflowInputs,
      query: 'Start OCR processing',
      response_mode: 'streaming',
      conversation_id: '',
      user: `user-${userId}`
    };

    console.log(`📤 Sending request to Dify Chatflow...`);
    console.log(`   Endpoint: ${difyApiUrl}/chat-messages`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Extraction Result ID: ${extractionResultId}`);
    console.log(`   Group Name: ${groupName}`);
    console.log(`   File Name: ${fileName}`);
    console.log(`   File Type: ${fileType}`);
    console.log(`   Callback URL: ${callbackUrl}`);
    console.log(`   Request Body:`, JSON.stringify(requestBody, null, 2));

    // Call Dify chatflow endpoint
    const chatflowEndpoint = `${difyApiUrl.replace(/\/$/, '')}/chat-messages`;
    
    // Trigger asynchronously - don't block the response
    axios.post(chatflowEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${difyChatflowApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 seconds to get initial response
      responseType: 'stream'
    }).then(async (response) => {
      console.log(`✅ Chatflow request accepted by Dify`);
      console.log(`   Response status: ${response.status}`);
      
      // Try to read initial stream data to get task_id (non-blocking)
      const stream = response.data as Readable;
      let hasData = false;
      let answer = '';
      
      stream.once('data', (chunk: Buffer) => {
        hasData = true;
        const chunkStr = chunk.toString('utf-8');
        // Try to extract task_id from SSE format
        const taskIdMatch = chunkStr.match(/task_id["\s:]+([^"}\s,]+)/);
        if (taskIdMatch) {
          console.log(`   Task ID: ${taskIdMatch[1]}`);
        }
        // Check for answer
        const answerMatch = chunkStr.match(/answer["\s:]+"([^"]+)"/);
        if (answerMatch) {
          answer = answerMatch[1];
        }
        // Don't wait for more - just acknowledge it started
        stream.destroy();
      });
      
      // Set timeout to close stream if no data comes
      setTimeout(() => {
        if (!hasData) {
          stream.destroy();
        }
      }, 2000);

      // If answer contains "ocr start", consider it successful
      if (answer.toLowerCase().includes('ocr start')) {
        console.log(`✅ OCR started successfully via chatflow`);
      }
    }).catch(async (error: any) => {
      console.error('Error triggering Chatflow:', error.message || error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.response) {
        console.error('   Response status:', error.response.status);
        try {
          if (error.response.data) {
            if (error.response.data.readable !== undefined && error.response.data.readable) {
              const chunks: Buffer[] = [];
              const stream = error.response.data;
              
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                  resolve();
                }, 5000);
                
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('end', () => {
                  clearTimeout(timeout);
                  resolve();
                });
                stream.on('error', () => {
                  clearTimeout(timeout);
                  resolve();
                });
                
                if (stream.isPaused()) {
                  stream.resume();
                }
              });
              
              if (chunks.length > 0) {
                const errorText = Buffer.concat(chunks).toString('utf-8');
                console.error('   Response data:', errorText);
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.message || errorJson.error || errorJson.detail || errorText;
                } catch {
                  errorMessage = errorText;
                }
              }
            } else if (typeof error.response.data === 'string') {
              errorMessage = error.response.data;
            } else if (typeof error.response.data === 'object') {
              errorMessage = JSON.stringify(error.response.data);
            }
          }
        } catch (parseError) {
          console.error('   Could not parse error response:', parseError);
        }
      }
      
      // Update status to failed
      await ExtractionResult.updateStatus(extractionResultId, 'failed', errorMessage);
      await Document.updateStatus(documentId, 'failed');

      // Create notification for user about processing failure
      try {
        const doc = await Document.findById(documentId);
        if (doc && doc.user_id) {
          const documentName = doc.display_name || doc.group_name || doc.original_name || doc.file_name || 'your document';
          
          await Notification.create({
            user_id: doc.user_id,
            title: 'Processing Error',
            message: `Your document "${documentName}" failed to process. Error: ${errorMessage}. Please try uploading again or contact support if the issue persists.`,
            is_read: false
          });
          
          console.log(`🔔 Sent failure notification to user ${doc.user_id} for document ${documentId}`);
        }
      } catch (notificationError: any) {
        console.error(`⚠️ Failed to create failure notification: ${notificationError.message}`);
        // Don't fail the whole operation if notification creation fails
      }
    });

    // Return immediately (async processing)
    res.status(200).json({
      success: true,
      message: 'OCR processing started. Results will be saved to ocr-results folder.',
      documentId: documentId,
      extractionResultId: extractionResultId
    });

  } catch (error: any) {
    console.error('Start OCR error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
