import { Request, Response } from 'express';
import { connectDB } from '../../lib/supabase.ts';
import ExtractionResult from '../../models/supabase/ExtractionResult.ts';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import axios from 'axios';

/**
 * Summarize a section using Dify Workflow 3
 * POST /api/documents/summarize-section/:id
 * Body: { sectionKey: string, sectionValue: string }
 * 
 * Returns: { sectionKey: string, summary: string }
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

    const { id } = req.params; // document_id or group_name
    const { sectionKey, sectionValue } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Document ID or group name is required' });
    }

    if (!sectionKey || !sectionValue) {
      return res.status(400).json({ error: 'sectionKey and sectionValue are required' });
    }

    const { getConnection } = await import('../../lib/supabase.ts');
    const supabase = getConnection();

    // Try to get extraction result for this document first
    let extractionResult = await ExtractionResult.getByDocumentId(id);
    let isGroupView = false;

    // If not found, check if it's a group view (group_name)
    if (!extractionResult) {
      // Try to find group-level extraction result
      const { data: groupResult, error: groupError } = await supabase
        .from('extraction_results')
        .select('*')
        .eq('group_name', id)
        .is('document_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (groupResult && !groupError) {
        extractionResult = groupResult as any;
        isGroupView = true;
      }
    }

    if (!extractionResult) {
      return res.status(404).json({ error: 'Extraction result not found' });
    }

    // Verify user has access
    if (isGroupView) {
      // For group view, verify user owns at least one document in the group
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId.toString())
        .eq('group_name', id)
        .limit(1);

      if (docsError || !documents || documents.length === 0) {
        return res.status(403).json({ error: 'Access denied or group not found' });
      }
    } else {
      // For individual document view, verify user owns the document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('user_id')
        .eq('id', id)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (document.user_id !== String(userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Check if Dify API is configured
    const difyApiUrl = process.env.DIFY_API_URL;
    // Check multiple possible environment variable names for Chatflow 3 API key
    // Priority: DIFY_WORKFLOW_3_API_KEY > DIFY_OCR_API_KEY_W3 > DIFY_OCR_API_KEY_W2
    // NOTE: For Chatflow, the API key from the Chatflow app works directly with /chat-messages endpoint
    const difyWorkflow3ApiKey = process.env.DIFY_WORKFLOW_3_API_KEY 
      || process.env.DIFY_OCR_API_KEY_W3 
      || process.env.DIFY_OCR_API_KEY_W2; // Fallback to W2 if W3 not set

    if (!difyApiUrl) {
      return res.status(503).json({ error: 'DIFY_API_URL environment variable is not set' });
    }

    if (!difyWorkflow3ApiKey) {
      return res.status(503).json({ 
        error: 'Chatflow 3 API key not found. Please set DIFY_WORKFLOW_3_API_KEY or DIFY_OCR_API_KEY_W3' 
      });
    }

    // Prepare the input for Dify Workflow 3
    // Following the same pattern as start-extraction.ts and ocr-service.ts
    // The workflow expects inputs: { "section_key": "SectionName", "section_text": "..." }
    const workflowInputs = {
      section_key: sectionKey,
      section_text: typeof sectionValue === 'string' ? sectionValue : JSON.stringify(sectionValue)
    };

    // Call Dify Workflow 3 using chat-messages endpoint (same pattern as start-extraction.ts)
    const workflowEndpoint = `${difyApiUrl.replace(/\/$/, '')}/chat-messages`;
    
    // Create JSON request body according to Dify API format (exactly like start-extraction.ts)
    const requestBody = {
      inputs: workflowInputs,
      query: `Summarize the following ${sectionKey} section`,
      response_mode: 'streaming', // Use streaming mode (Dify standard)
      conversation_id: '',
      user: `user-${userId}`
    };

    console.log(`📤 Sending summarization request to Dify Workflow 3...`);
    console.log(`   Section: ${sectionKey}`);
    console.log(`   Endpoint: ${workflowEndpoint}`);
    console.log(`   Inputs:`, JSON.stringify(workflowInputs));

    // Call Dify chat-messages endpoint with streaming (exactly like start-extraction.ts)
    // NOTE: The API key must be from a Chat app that calls the workflow, not a Workflow app directly
    const difyResponse = await axios.post(workflowEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${difyWorkflow3ApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000, // 60 seconds timeout
      responseType: 'stream' // Use stream like start-extraction.ts and ocr-service.ts
    });

    // Parse streaming response (SSE format)
    let summary = '';
    const stream = difyResponse.data;
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        stream.destroy();
        reject(new Error('Timeout waiting for Dify response'));
      }, 55000);

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });

      stream.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Parse SSE chunks
    // For streaming responses, we need to collect all answer chunks
    const fullText = Buffer.concat(chunks).toString('utf-8');
    const lines = fullText.split('\n');
    
    let accumulatedAnswer = '';
    let finalAnswer = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          // For streaming, accumulate answer chunks
          if (data.event === 'message' || data.event === 'message_chunk') {
            if (data.answer) {
              accumulatedAnswer += data.answer;
            }
          }
          
          // Look for final/complete answer in different formats
          if (data.event === 'message_end' || data.event === 'message') {
            // Final message - use accumulated or direct answer
            if (data.answer) {
              finalAnswer = data.answer;
            } else if (accumulatedAnswer) {
              finalAnswer = accumulatedAnswer;
            }
          } else if (data.outputs?.answer) {
            finalAnswer = data.outputs.answer;
          } else if (data.outputs?.summary_json) {
            finalAnswer = data.outputs.summary_json;
          } else if (data.outputs?.summary) {
            finalAnswer = data.outputs.summary;
          } else if (data.event === 'workflow_finished' && data.outputs) {
            if (data.outputs.summary_json) {
              finalAnswer = data.outputs.summary_json;
            } else if (data.outputs[sectionKey]) {
              finalAnswer = data.outputs[sectionKey];
            } else {
              finalAnswer = data.outputs.answer || data.outputs.summary || '';
            }
          } else if (data.outputs && data.outputs[sectionKey]) {
            finalAnswer = data.outputs[sectionKey];
          } else if (data.outputs && data.outputs.summary_json) {
            finalAnswer = data.outputs.summary_json;
          } else if (data.answer && !data.event) {
            // Direct answer without event (non-streaming or final chunk)
            finalAnswer = data.answer;
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
    
    // Use final answer if found, otherwise use accumulated
    summary = finalAnswer || accumulatedAnswer;

    if (!summary) {
      console.error('⚠️ No summary found in Dify response. Full response:', fullText.substring(0, 500));
      return res.status(500).json({ error: 'Failed to get summary from Dify workflow' });
    }

    console.log(`📥 Received summary from Dify (length: ${summary.length}):`, summary.substring(0, 200));

    // Parse summary if it's JSON (Method 2: Code node returns JSON string)
    let summaryText = summary;
    try {
      // First parse: might be a JSON string like "{\"Abstract\": \"summary\"}"
      let parsed = JSON.parse(summary);
      
      // If it's a string after first parse, parse again (double-encoded JSON)
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // Not double-encoded, use the string as-is
          summaryText = parsed;
        }
      }
      
      // If parsed is an object, extract the value using section_key
      if (typeof parsed === 'object' && parsed !== null) {
        // Method 2: Code node returns { "section_key": "summary_text" }
        if (parsed[sectionKey]) {
          summaryText = parsed[sectionKey];
        } else if (parsed.answer) {
          summaryText = parsed.answer;
        } else if (parsed.summary) {
          summaryText = parsed.summary;
        } else {
          // If it's an object but doesn't have expected keys, try to get first value
          const keys = Object.keys(parsed);
          if (keys.length > 0) {
            summaryText = parsed[keys[0]];
          } else {
            summaryText = JSON.stringify(parsed);
          }
        }
      } else if (typeof parsed === 'string') {
        summaryText = parsed;
      }
      
      console.log(`✅ Extracted summary text (length: ${summaryText.length}):`, summaryText.substring(0, 100));
    } catch (parseError) {
      // Not JSON, use as-is (summary is already a string)
      console.warn('⚠️ Summary is not valid JSON, using as-is:', summary.substring(0, 100));
    }

    // Update structured_data to store the summary
    let structuredData: any = extractionResult.structured_data;
    if (typeof structuredData === 'string') {
      structuredData = JSON.parse(structuredData);
    }

    // Initialize summaries object if it doesn't exist
    if (!structuredData.summaries) {
      structuredData.summaries = {};
    }

    // Store summary: { "summaries": { "SectionName": "summary text" } }
    structuredData.summaries[sectionKey] = summaryText;

    // Save updated structured_data
    await ExtractionResult.update(extractionResult.id!, {
      structured_data: structuredData
    });

    console.log(`✅ Summary saved for section: ${sectionKey}`);

    // Return the summary in the requested format: { "SectionName": "summary text" }
    return res.status(200).json({
      success: true,
      [sectionKey]: summaryText
    });

  } catch (error: any) {
    console.error('Error summarizing section:', error);
    
    if (error.response) {
      // Read error response from stream
      let errorMessage = 'Dify API error';
      let errorDetails: any = null;
      
      try {
        const stream = error.response.data;
        if (stream && typeof stream.read === 'function') {
          const chunks: Buffer[] = [];
          
          // Try to read the error response
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 2000);
            
            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            
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
            try {
              errorDetails = JSON.parse(errorText);
              errorMessage = errorDetails.message || errorDetails.code || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (typeof error.response.data === 'object') {
          errorDetails = error.response.data;
          errorMessage = errorDetails.message || errorDetails.code || errorMessage;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      
      console.error('Dify API error:', error.response.status, errorMessage);
      
      // Check for specific error codes
      if (errorDetails?.code === 'not_chat_app') {
        return res.status(400).json({ 
          error: 'Invalid API key type. The API key must be from a Chat app, not a Workflow app. Please use a Chat app API key that can call workflows.',
          code: 'not_chat_app'
        });
      }
      
      return res.status(error.response.status || 500).json({ 
        error: errorMessage,
        code: errorDetails?.code,
        status: error.response.status
      });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
