import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import Document from '../../models/supabase/Document.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { Readable } from 'stream';

interface DifyFile {
  type: 'image' | 'document';
  transfer_method: 'remote_url';
  url: string;
}

interface DifyRequest {
  inputs: Record<string, unknown>;
  query: string;
  response_mode: 'streaming';
  conversation_id: string;
  user: string;
  files?: DifyFile[];
}

/**
 * Generate OCR token for file access (same as OCR service)
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
 * Start extraction by triggering Dify Workflow 1
 * This endpoint:
 * 1. Creates extraction_result record
 * 2. Triggers Dify Workflow 1 with file URL (using chat-messages endpoint like OCR service)
 * 3. Returns immediately (async processing)
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
      extraction_method: 'dify-workflow',
      status: 'processing'
    });

    // Check if Dify API is configured (exactly like OCR service)
    const difyApiUrl = process.env.DIFY_API_URL;
    const difyWorkflow1ApiKey = process.env.DIFY_OCR_API_KEY_W1;

    if (!difyApiUrl) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'DIFY_API_URL environment variable is not set');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'DIFY_API_URL environment variable is not set'
      });
    }

    if (!difyWorkflow1ApiKey) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'DIFY_OCR_API_KEY_W1 environment variable is not set');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'DIFY_OCR_API_KEY_W1 environment variable is not set'
      });
    }

    // Always use remote_url method with FILE_SERVER_URL (exactly like OCR service)
    if (!process.env.FILE_SERVER_URL) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'FILE_SERVER_URL environment variable is required for remote_url transfer method');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'FILE_SERVER_URL environment variable is required for remote_url transfer method'
      });
    }

    if (!process.env.JWT_SECRET) {
      await ExtractionResult.updateStatus(extractionResultId, 'failed', 'JWT_SECRET environment variable is required for OCR file access');
      await Document.updateStatus(documentId, 'failed');
      return res.status(503).json({
        error: 'JWT_SECRET environment variable is required for OCR file access'
      });
    }

    // Determine file type from extension (like OCR service)
    const fileExtension = document.file_path.split('.').pop() || '';
    const normalizedExtension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
    const isPDF = fileExtension.toLowerCase() === 'pdf';
    const fileType: 'image' | 'document' = isPDF ? 'document' : 'image';

    // Generate secure token for OCR file access (exactly like OCR service)
    const ocrToken = generateOcrToken(documentId);

    // Construct file URL using OCR download endpoint with token (exactly like OCR service)
    // Format: http://192.168.0.24:3000/api/documents/ocr-download/{documentId}{extension}?token={token}
    // Note: JWT tokens contain special characters (., +, /, =) that need URL encoding
    const baseUrl = process.env.FILE_SERVER_URL.replace(/\/$/, '');
    const encodedToken = encodeURIComponent(ocrToken);
    const fileUrl = `${baseUrl}/api/documents/ocr-download/${documentId}${normalizedExtension}?token=${encodedToken}`;

    const fileConfig: DifyFile = {
      type: fileType,
      transfer_method: 'remote_url',
      url: fileUrl
    };

    // Create JSON request body according to Dify API format (exactly like OCR service)
    // Include group_name and file_name in query so Dify can pass them to OCR API
    const groupName = document.group_name || '';
    const fileName = document.file_name || '';
    const requestBody: DifyRequest = {
      inputs: {},
      query: `Process this file and extract text. Document ID: ${documentId}, Extraction Result ID: ${extractionResultId}, User ID: ${userId}, Group Name: ${groupName}, File Name: ${fileName}`,
      response_mode: 'streaming',
      conversation_id: '',
      user: `user-${userId}`,
      files: [fileConfig]
    };

    console.log(`📤 Sending request to Dify Workflow 1...`);
    console.log(`   Endpoint: ${difyApiUrl}/chat-messages`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Transfer method: remote_url`);
    console.log(`   File URL: ${fileUrl}`);
    
    // Warn if using localhost - Dify might not be able to access it (like OCR service)
    if (fileUrl.includes('localhost') || fileUrl.includes('127.0.0.1')) {
      console.warn('⚠️  WARNING: Using localhost in file URL. Dify may not be able to access this URL if running on a different machine or container.');
    }

    // Call Dify chat-messages endpoint with streaming (exactly like OCR service)
    // But we don't wait for the full response - just initiate it
    const workflow1Endpoint = `${difyApiUrl.replace(/\/$/, '')}/chat-messages`;
    
    // Trigger asynchronously - don't block the response
    axios.post(workflow1Endpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${difyWorkflow1ApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 seconds to get initial response
      responseType: 'stream' // Use stream like OCR service
    }).then(async (response) => {
      console.log(`✅ Workflow 1 request accepted by Dify`);
      console.log(`   Response status: ${response.status}`);
      
      // Try to read initial stream data to get task_id (non-blocking)
      // We don't wait for the full stream, just check if it started successfully
      const stream = response.data as Readable;
      let hasData = false;
      
      stream.once('data', (chunk: Buffer) => {
        hasData = true;
        const chunkStr = chunk.toString('utf-8');
        // Try to extract task_id from SSE format
        const taskIdMatch = chunkStr.match(/task_id["\s:]+([^"}\s,]+)/);
        if (taskIdMatch) {
          console.log(`   Task ID: ${taskIdMatch[1]}`);
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
      
    }).catch(async (error: any) => {
      console.error('Error triggering Workflow 1:', error.message || error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response headers:', error.response.headers);
        
        // Try to read error response body (handle stream if needed)
        try {
          if (error.response.data) {
            // If responseType is 'stream', we need to read the stream
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
    });

    // Return immediately (async processing)
    res.status(200).json({
      success: true,
      message: 'Extraction started. You will be notified when it completes.',
      documentId: documentId,
      extractionResultId: extractionResultId
    });

  } catch (error: any) {
    console.error('Start extraction error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
