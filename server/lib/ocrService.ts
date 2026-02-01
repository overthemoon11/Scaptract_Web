import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';

interface DifyFile {
  type: 'image' | 'document';
  transfer_method: 'remote_url' | 'local_file';
  url?: string;
  path?: string;
}

interface DifyRequest {
  inputs: Record<string, unknown>;
  query: string;
  response_mode: 'streaming';
  conversation_id?: string;
  user: string;
  files?: DifyFile[];
}

interface DifyStreamEvent {
  event: string;
  task_id?: string;
  answer?: string;
  message_id?: string;
  conversation_id?: string;
  metadata?: any;
}

interface OCRStartResult {
  success: boolean;
  taskId?: string;
  conversationId?: string;
  answer?: string;
  error?: string;
}

class OCRService {
  private difyApiUrl: string;
  private difyOcrApiKey: string;
  private difyChatEndpoint: string;
  private timeout: number;

  constructor() {
    // Get Dify API URL and OCR API key from environment variables
    this.difyApiUrl = process.env.DIFY_API_URL || '';
    this.difyOcrApiKey = process.env.DIFY_OCR_API_KEY_V1 || '';
    this.timeout = parseInt(process.env.OCR_TIMEOUT || '300000', 10); // Default 5 minutes for async processing

    // Use chat-messages endpoint for OCR (same as chatbot but with file attachments)
    this.difyChatEndpoint = `${this.difyApiUrl}/chat-messages`;

    if (!this.difyApiUrl) {
      console.warn('⚠️ DIFY_API_URL environment variable is not set');
    }

    if (!this.difyOcrApiKey) {
      console.warn('⚠️ DIFY_OCR_API_KEY_V1 environment variable is not set');
    }
  }

  /**
   * Start OCR processing for an image file
   * Returns task_id for async processing
   */
  async startImageOCR(documentId: string | number, fileExtension: string = '.jpg', query: string = 'Extract all text from this image'): Promise<OCRStartResult> {
    return this.startOCR(documentId, 'image', fileExtension, query);
  }

  /**
   * Start OCR processing for a PDF file
   * Returns task_id for async processing
   */
  async startPDFOCR(documentId: string | number, fileExtension: string = '.pdf', query: string = 'Extract all text from this PDF document'): Promise<OCRStartResult> {
    return this.startOCR(documentId, 'document', fileExtension, query);
  }

  /**
   * Start OCR processing for multiple images
   * Sends all image URLs to Dify in a single request
   */
  async startMultipleImageOCR(
    documentIds: (string | number)[],
    fileExtensions: string[],
    query: string = 'Extract all text from these images. Process each image separately, then combine all extracted text into a single structured JSON format with title, authors, abstract, topics (with subtopics), conclusion, and references. Ensure the output is valid JSON.'
  ): Promise<OCRStartResult> {
    try {
      console.log(`🔄 Starting multiple image OCR processing for ${documentIds.length} images`);

      if (!this.difyApiUrl || !this.difyOcrApiKey || !process.env.FILE_SERVER_URL || !process.env.JWT_SECRET) {
        return {
          success: false,
          error: 'Required environment variables not configured'
        };
      }

      const baseUrl = process.env.FILE_SERVER_URL.replace(/\/$/, '');
      const files: DifyFile[] = [];

      // Generate file URLs for all images
      for (let i = 0; i < documentIds.length; i++) {
        const documentId = documentIds[i];
        const fileExtension = fileExtensions[i] || '.png';
        const normalizedExtension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;
        
        const ocrToken = this.generateOcrToken(documentId);
        const encodedToken = encodeURIComponent(ocrToken);
        const fileUrl = `${baseUrl}/api/documents/ocr-download/${documentId}${normalizedExtension}?token=${encodedToken}`;

        files.push({
          type: 'image',
          transfer_method: 'remote_url',
          url: fileUrl
        });

        console.log(`   Image ${i + 1}: ${fileUrl.substring(0, 80)}...`);
      }

      const requestBody: DifyRequest = {
        inputs: {},
        query: query,
        response_mode: 'streaming',
        conversation_id: '',
        user: 'ocr-service',
        files: files
      };

      console.log(`📤 Sending ${files.length} images to Dify OCR API...`);

      const response = await axios.post(
        this.difyChatEndpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.difyOcrApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout,
          responseType: 'stream'
        }
      );

      const streamResult = await this.processStreamResponse(response.data);

      if (!streamResult.taskId) {
        return {
          success: false,
          error: 'Failed to get task_id from Dify response'
        };
      }

      console.log(`✅ OCR processing started for ${files.length} images. Task ID: ${streamResult.taskId}`);

      return {
        success: true,
        taskId: streamResult.taskId,
        answer: streamResult.answer,
        conversationId: streamResult.conversationId
      };

    } catch (error: any) {
      console.error('Error starting multiple image OCR:', error);
      return {
        success: false,
        error: `Failed to start OCR processing: ${error.message}`
      };
    }
  }

  /**
   * Generate a secure token for OCR file access
   */
  private generateOcrToken(documentId: string | number): string {
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
   * Start OCR processing - sends request to Dify and returns task_id
   */
  private async startOCR(documentId: string | number, fileType: 'image' | 'document', fileExtension: string, query: string): Promise<OCRStartResult> {
    try {
      console.log(`🔄 Starting ${fileType} OCR processing for document: ${documentId}`);

      // Check if Dify API is configured
      if (!this.difyApiUrl) {
        return {
          success: false,
          error: 'DIFY_API_URL environment variable is not set'
        };
      }

      if (!this.difyOcrApiKey) {
        return {
          success: false,
          error: 'DIFY_OCR_API_KEY_V1 environment variable is not set'
        };
      }

      // Always use remote_url method with FILE_SERVER_URL
      if (!process.env.FILE_SERVER_URL) {
        return {
          success: false,
          error: 'FILE_SERVER_URL environment variable is required for remote_url transfer method'
        };
      }

      if (!process.env.JWT_SECRET) {
        return {
          success: false,
          error: 'JWT_SECRET environment variable is required for OCR file access'
        };
      }

      // Generate secure token for OCR file access
      const ocrToken = this.generateOcrToken(documentId);

      // Normalize file extension (ensure it starts with a dot)
      const normalizedExtension = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;

      // Construct file URL using OCR download endpoint with token
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

      // Create JSON request body according to Dify API format
      const requestBody: DifyRequest = {
        inputs: {},
        query: query,
        response_mode: 'streaming',
        conversation_id: '',
        user: 'ocr-service',
        files: [fileConfig]
      };

      // {
      //   "inputs": {},
      //   "query": "What are the specs of the iPhone 13 Pro Max?",
      //   "response_mode": "streaming",
      //   "conversation_id": "",
      //   "user": "abc-123",
      //   "files": [
      //       {
      //           "type": "image",
      //           "transfer_method": "remote_url",
      //           "url": "https://cloud.dify.ai/logo/logo-site.png"
      //       }
      //   ]
      // }


      console.log(`📤 Sending request to Dify OCR API...`);
      console.log(`   Endpoint: ${this.difyChatEndpoint}`);
      console.log(`   Document ID: ${documentId}`);
      console.log(`   Transfer method: remote_url`);
      console.log(`   File URL: ${fileUrl}`);
      
      // Warn if using localhost - Dify might not be able to access it
      if (fileUrl.includes('localhost') || fileUrl.includes('127.0.0.1')) {
        console.warn('⚠️  WARNING: Using localhost in file URL. Dify may not be able to access this URL if running on a different machine or container.');
      }

      // Call Dify chat-messages endpoint with streaming
      const response = await axios.post(
        this.difyChatEndpoint,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.difyOcrApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout,
          responseType: 'stream'
        }
      );

      // Process the stream to get task_id and full answer
      const streamResult = await this.processStreamResponse(response.data);

      if (!streamResult.taskId) {
        return {
          success: false,
          error: 'Failed to get task_id from Dify response'
        };
      }

      console.log(`✅ OCR processing started. Task ID: ${streamResult.taskId}`);

      return {
        success: true,
        taskId: streamResult.taskId,
        answer: streamResult.answer,
        conversationId: streamResult.conversationId
      };

    } catch (error: any) {
      console.error('Error starting OCR processing:', error.message || error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response headers:', error.response.headers);
        
        // Try to read error response body
        try {
          if (error.response.data) {
            // If responseType is 'stream', we need to read the stream
            if (error.response.data.readable !== undefined && error.response.data.readable) {
              const chunks: Buffer[] = [];
              const stream = error.response.data;
              
              // Check if stream is already ended
              if (stream.readableEnded) {
                console.error('   Response stream already ended');
              } else {
                await new Promise<void>((resolve, reject) => {
                  const timeout = setTimeout(() => {
                    resolve(); // Resolve after 5 seconds even if stream doesn't end
                  }, 5000);
                  
                  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                  stream.on('end', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  stream.on('error', (err: Error) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                  
                  // If stream is paused, resume it
                  if (stream.isPaused()) {
                    stream.resume();
                  }
                }).catch(() => {
                  // Ignore stream errors, just use what we have
                });
                
                if (chunks.length > 0) {
                  const errorText = Buffer.concat(chunks).toString('utf-8');
                  console.error('   Response data:', errorText);
                  try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || errorJson.detail || errorText;
                  } catch {
                    errorMessage = errorText || errorMessage;
                  }
                }
              }
            } else if (typeof error.response.data === 'string') {
              console.error('   Response data:', error.response.data);
              errorMessage = error.response.data;
            } else if (typeof error.response.data === 'object') {
              // Try to stringify, but handle circular references
              try {
                const errorStr = JSON.stringify(error.response.data, (key, value) => {
                  // Remove circular references
                  if (key === 'request' || key === 'config' || key === 'response' || key === 'socket') {
                    return '[Circular]';
                  }
                  return value;
                }, 2);
                console.error('   Response data:', errorStr);
                const errorObj = error.response.data as any;
                errorMessage = errorObj.message || errorObj.error || errorObj.detail || errorStr;
              } catch (e) {
                console.error('   Response data: [Unable to stringify]');
              }
            }
          }
        } catch (readError: any) {
          console.error('   Failed to read error response:', readError.message);
        }
      }
      
      return {
        success: false,
        error: `Failed to start OCR processing: ${errorMessage}`
      };
    }
  }

  /**
   * Process streaming response to extract task_id and full answer
   */
  private async processStreamResponse(stream: Readable): Promise<{ taskId: string | null; answer: string; conversationId?: string }> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let taskId: string | null = null;
      let fullAnswer = '';
      let conversationId: string | undefined;
      let resolved = false;
      let timeoutId: NodeJS.Timeout;

      const processBuffer = () => {
        // Process complete SSE events
        while (true) {
          const separatorIndex = buffer.indexOf('\n\n');
          if (separatorIndex === -1) break;

          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          // Parse SSE event
          if (rawEvent.startsWith('data: ')) {
            try {
              const data: DifyStreamEvent = JSON.parse(rawEvent.slice(6));
              
              // Get task_id from first event
              if (data.task_id && !taskId) {
                taskId = data.task_id;
              }

              // Accumulate answer text
              if (data.answer) {
                fullAnswer += data.answer;
              }
              
              // Check for message_end event which indicates completion
              if (data.event === 'message_end' || data.event === 'workflow_finished') {
                receivedCompletionEvent = true;
              }

              // Store conversation_id if present
              if (data.conversation_id) {
                conversationId = data.conversation_id;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      };

      stream.on('data', (chunk: Buffer) => {
        lastDataTime = Date.now(); // Update last data received time
        buffer += chunk.toString('utf-8');
        processBuffer();
      });

      // Track if we've received a completion event
      let receivedCompletionEvent = false;
      
      // Track last data received time to detect if stream is still active
      let lastDataTime = Date.now();
      let dataReceivedAfterTimeout = false;
      
      // Timeout after configured timeout (default 5 minutes) - only as safety fallback
      // Don't resolve early if we're still receiving data
      timeoutId = setTimeout(() => {
        if (!resolved) {
          const timeSinceLastData = Date.now() - lastDataTime;
          // If we received data recently (within last 30 seconds), stream is still active
          if (timeSinceLastData < 30000) {
            dataReceivedAfterTimeout = true;
            console.warn(`⚠️ Initial timeout reached but stream still active (data received ${timeSinceLastData}ms ago). Extending timeout... Answer so far: ${fullAnswer.length} characters`);
            // Extend timeout by another 5 minutes
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              if (!resolved) {
                const finalTimeSinceLastData = Date.now() - lastDataTime;
                if (finalTimeSinceLastData < 30000) {
                  // Still receiving data - extend again
                  console.warn(`⚠️ Extended timeout reached but still receiving data. Extending once more... Answer: ${fullAnswer.length} characters`);
                  clearTimeout(timeoutId);
                  timeoutId = setTimeout(() => {
                    if (!resolved) {
                      resolved = true;
                      console.warn(`⚠️ Final timeout reached. Answer length: ${fullAnswer.length} characters.`);
                      resolve({
                        taskId: taskId,
                        answer: fullAnswer.trim(),
                        conversationId: conversationId
                      });
                    }
                  }, this.timeout);
                } else {
                  // No data for 30+ seconds, resolve with what we have
                  resolved = true;
                  console.warn(`⚠️ Extended timeout reached. No data for ${finalTimeSinceLastData}ms. Answer length: ${fullAnswer.length} characters.`);
                  resolve({
                    taskId: taskId,
                    answer: fullAnswer.trim(),
                    conversationId: conversationId
                  });
                }
              }
            }, this.timeout);
          } else if (receivedCompletionEvent) {
            // We got completion event and no recent data - resolve
            resolved = true;
            console.warn(`⚠️ Stream timeout after completion event. Answer length: ${fullAnswer.length} characters.`);
            resolve({
              taskId: taskId,
              answer: fullAnswer.trim(),
              conversationId: conversationId
            });
          } else {
            // No recent data and no completion event - resolve with what we have
            resolved = true;
            console.warn(`⚠️ Stream timeout reached. No data for ${timeSinceLastData}ms. Answer length: ${fullAnswer.length} characters. This may be incomplete.`);
            resolve({
              taskId: taskId,
              answer: fullAnswer.trim(),
              conversationId: conversationId
            });
          }
        }
      }, this.timeout);

      stream.on('end', () => {
        clearTimeout(timeoutId);
        if (!resolved) {
          // Process any remaining data in buffer (might be incomplete SSE event)
          if (buffer.trim()) {
            // Try to process remaining buffer data
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data: DifyStreamEvent = JSON.parse(line.slice(6));
                  
                  if (data.task_id && !taskId) {
                    taskId = data.task_id;
                  }
                  
                  if (data.answer) {
                    fullAnswer += data.answer;
                  }
                  
                  if (data.conversation_id) {
                    conversationId = data.conversation_id;
                  }
                  
                  // Check for completion event in remaining data
                  if (data.event === 'message_end' || data.event === 'workflow_finished') {
                    receivedCompletionEvent = true;
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete data
                }
              }
            }
          }
          
          resolved = true;
          const finalAnswerLength = fullAnswer.trim().length;
          console.log(`📝 Stream ended. Final answer length: ${finalAnswerLength} characters, Task ID: ${taskId}`);
          if (receivedCompletionEvent) {
            console.log(`✅ Stream completed successfully with completion event`);
          } else {
            console.warn(`⚠️ Stream ended without completion event - answer may be incomplete`);
          }
          resolve({
            taskId: taskId,
            answer: fullAnswer.trim(),
            conversationId: conversationId
          });
        }
      });

      stream.on('error', (error) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
    });
  }


  /**
   * Get file type for Dify API
   */
  private getFileType(filePath: string): 'image' | 'document' {
    const ext = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp'];
    return imageExtensions.includes(ext) ? 'image' : 'document';
  }
}

export default OCRService;
