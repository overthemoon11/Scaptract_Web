import { Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { connectDB, getConnection } from '../lib/supabase.ts';
import ExtractionResult from '../models/supabase/ExtractionResult.ts';
import Document from '../models/supabase/Document.ts';
import Notification from '../models/supabase/Notification.ts';

/**
 * Webhook endpoint to receive OCR callbacks (for error handling only)
 * OCR API should call Workflow 2's webhook directly, not this endpoint
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    if (!payload.job_id || !payload.status) {
      return res.status(400).json({ error: 'Missing required fields: job_id, status' });
    }

    console.log(`📥 Received OCR callback for job ${payload.job_id}, status: ${payload.status}`);

    // Only handle failures here - successful callbacks should go to Workflow 2
    if (payload.status === 'failed') {
      console.error(`❌ OCR job ${payload.job_id} failed: ${payload.error}`);
      if (payload.extraction_result_id) {
        await connectDB();
        await ExtractionResult.updateStatus(payload.extraction_result_id, 'failed', payload.error);
        if (payload.document_id) {
          await Document.updateStatus(payload.document_id, 'failed');
        }
      }
      return res.status(200).json({ message: 'Job failure logged' });
    }

    // If successful callback reaches here, OCR API didn't call Workflow 2 directly
    console.warn(`⚠️ OCR API should call Workflow 2 webhook directly, not this endpoint`);
    return res.status(200).json({ message: 'Callback received (OCR should call Workflow 2 directly)' });

  } catch (error: any) {
    console.error('Error processing OCR webhook:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Fetch Workflow 2 run results from Dify API with retry logic
 * GET /v1/workflows/run/:workflow_run_id
 * Polls until workflow completes (max 30 seconds, 3 second intervals)
 */
async function fetchWorkflow2Results(workflowRunId: string): Promise<{ answer1?: any; combined_text?: string } | null> {
  try {
    const difyApiUrl = process.env.DIFY_API_URL;
    const difyWorkflowApiKey = process.env.DIFY_OCR_API_KEY_W2;

    if (!difyApiUrl || !difyWorkflowApiKey) {
      console.error('⚠️ Dify API not configured for fetching workflow results');
      return null;
    }

    const baseUrl = difyApiUrl.replace('/v1', '').replace(/\/$/, '');
    const apiUrl = `${baseUrl}/v1/workflows/run/${workflowRunId}`;

    console.log(`📥 Fetching Workflow 2 results for run_id: ${workflowRunId}`);

    // Retry logic: poll until workflow completes (max 40 attempts, 30 seconds apart = 20 minutes total)
    const maxAttempts = 100;
    const retryDelay = 5000; // 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${difyWorkflowApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data) {
        console.error('   No data in response');
        return null;
      }

      const status = response.data.status;
      console.log(`   Attempt ${attempt}/${maxAttempts}: Workflow status: ${status}`);

      // Check workflow status
      if (status === 'succeeded') {
        // Workflow completed successfully, parse results
        console.log(`   ✅ Workflow completed successfully`);

        // Parse outputs - it's a JSON string that needs parsing
        let outputs: any;
        try {
          if (typeof response.data.outputs === 'string') {
            outputs = JSON.parse(response.data.outputs);
          } else {
            outputs = response.data.outputs;
          }
        } catch (parseError) {
          console.error('   Failed to parse outputs:', parseError);
          return null;
        }

        // Extract answer1 and combined_text
        let answer1: any = outputs.answer1;
        const combined_text = outputs.combined_text;

        // answer1 is an array where the first element might be a JSON string
        if (Array.isArray(answer1) && answer1.length > 0 && typeof answer1[0] === 'string') {
          try {
            // Try to parse the first element as JSON
            answer1 = JSON.parse(answer1[0]);
          } catch {
            // If parsing fails, keep it as is
            console.log('   answer1[0] is not JSON, keeping as string');
          }
        }

        console.log(`   ✅ Fetched results: answer1 type=${typeof answer1}, combined_text length=${combined_text?.length || 0}`);

        return {
          answer1: answer1,
          combined_text: combined_text
        };
      } else if (status === 'failed' || status === 'stopped') {
        console.error(`   ❌ Workflow ${status}`);
        return null;
      } else if (status === 'running' || status === 'pending') {
        // Workflow still running, wait and retry
        if (attempt < maxAttempts) {
          console.log(`   ⏳ Workflow still ${status}, waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          console.warn(`   ⚠️ Workflow still ${status} after ${maxAttempts} attempts, giving up`);
          return null;
        }
      } else {
        console.warn(`   ⚠️ Unknown workflow status: ${status}`);
        return null;
      }
    }

    return null;

  } catch (error: any) {
    console.error('❌ Failed to fetch Workflow 2 results:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    return null;
  }
}

/**
 * Convert markdown to JSON using Python markdown_to_json library
 */
async function convertMarkdownToJson(markdownText: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Get the project root directory using process.cwd() (server directory)
      // Then go up one level to get project root
      const serverDir = process.cwd();
      const projectRoot = path.resolve(serverDir, '..');
      
      console.log(`   🔄 [CONVERT] Converting markdown to JSON using Python...`);
      
      // Python script that uses markdown_to_json library with order preservation
      const pythonScript = `
import sys
import json
from collections import OrderedDict
try:
    import markdown_to_json
    markdown_text = sys.stdin.read()
    dictified = markdown_to_json.dictify(markdown_text)
    # Convert to OrderedDict to preserve order (Python 3.7+ dicts preserve order, but being explicit)
    if isinstance(dictified, dict):
        # If result has only "root" key with array, convert to "Content" key for better structure
        if len(dictified) == 1 and "root" in dictified:
            # Check if root is a list (plain text without headers)
            if isinstance(dictified["root"], list):
                # Convert list to single string, filtering out "--- Page Break ---" markers
                content_parts = []
                for item in dictified["root"]:
                    if isinstance(item, str):
                        item_clean = item.strip()
                        # Skip page break markers and empty strings
                        if item_clean and "--- Page Break ---" not in item_clean:
                            content_parts.append(item_clean)
                # Join with double newlines for readability
                if content_parts:
                    content = chr(10) + chr(10).join(content_parts)
                else:
                    filtered_items = [str(x) for x in dictified["root"] if str(x).strip() and "--- Page Break ---" not in str(x)]
                    content = chr(10).join(filtered_items)
                ordered_dict = OrderedDict({"Content": content})
                # Add sectionOrder for Content
                ordered_dict["sectionOrder"] = ["Content"]
            else:
                ordered_dict = OrderedDict({"Content": dictified["root"]})
                ordered_dict["sectionOrder"] = ["Content"]
        else:
            ordered_dict = OrderedDict(dictified)
            # Generate sectionOrder from the keys (preserving order)
            # Filter out keys that are metadata (sectionOrder, summaries, Content)
            section_keys = [key for key in ordered_dict.keys() 
                          if key not in ["sectionOrder", "section_order", "summaries", "Content"] 
                          and isinstance(ordered_dict[key], (str, dict, list))]
            if section_keys:
                # Add sectionOrder at the beginning to preserve insertion order
                final_dict = OrderedDict()
                final_dict["sectionOrder"] = section_keys
                # Add all original keys
                for key, value in ordered_dict.items():
                    final_dict[key] = value
                ordered_dict = final_dict
        print(json.dumps(ordered_dict, ensure_ascii=False))
    else:
        print(json.dumps(dictified, ensure_ascii=False))
except ImportError:
    # Fallback if markdown_to_json not available
    print(json.dumps({"error": "markdown_to_json library not installed", "raw_markdown": markdown_text[:500]}), file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(json.dumps({"error": str(e), "raw_markdown": markdown_text[:500]}), file=sys.stderr)
    sys.exit(1)
`;
      
      // Spawn Python process
      const pythonProcess = spawn('python', ['-c', pythonScript], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      // Collect stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const jsonData = JSON.parse(stdout.trim());
            console.log(`   ✅ [CONVERT] Successfully converted markdown to JSON`);
            resolve(jsonData);
          } catch (parseError: any) {
            console.error(`   ❌ [CONVERT] Failed to parse JSON output: ${parseError.message}`);
            reject(new Error(`Failed to parse JSON: ${parseError.message}`));
          }
        } else {
          // Try to parse error from stderr
          try {
            const errorData = JSON.parse(stderr.trim());
            console.error(`   ❌ [CONVERT] Python error: ${errorData.error || stderr}`);
            reject(new Error(errorData.error || 'Markdown conversion failed'));
          } catch {
            console.error(`   ❌ [CONVERT] Python process failed with code ${code}: ${stderr}`);
            reject(new Error(`Markdown conversion failed: ${stderr || 'Unknown error'}`));
          }
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        console.error(`   ❌ [CONVERT] Failed to spawn Python process: ${error.message}`);
        reject(error);
      });
      
      // Write markdown text to stdin
      pythonProcess.stdin.write(markdownText);
      pythonProcess.stdin.end();
      
    } catch (error: any) {
      console.error(`   ❌ [CONVERT] Error setting up conversion: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Save structured_data and combined_text to database and send notification
 */
async function saveStructuredDataAndCombinedText(
  extractionResultId: string,
  structuredData: any,
  combinedText: string,
  documentId?: string,
  userId?: string
): Promise<void> {
  try {
    await connectDB();

    console.log(`💾 Saving to extraction_result ${extractionResultId}:`);
    console.log(`   Structured data: ${JSON.stringify(structuredData).substring(0, 200)}...`);
    console.log(`   Extracted text length: ${combinedText.trim().length} chars`);

    await ExtractionResult.update(extractionResultId, {
      structured_data: structuredData,
      extracted_text: combinedText.trim(),
      status: 'completed'
    });

    console.log(`✅ Database update completed for extraction_result ${extractionResultId}`);

    // Verify the update
    const updated = await ExtractionResult.findById(extractionResultId);
    if (updated) {
      console.log(`   Verified: extracted_text length = ${updated.extracted_text?.length || 0} chars`);
      console.log(`   Verified: structured_data exists = ${updated.structured_data ? 'yes' : 'no'}`);
      console.log(`   Verified: status = ${updated.status}`);
    }

    // Update document status
    if (documentId) {
      await Document.updateStatus(documentId, 'completed');
      console.log(`✅ Document ${documentId} status updated to 'completed'`);
      
      // Check if all documents in the group are completed, then create/update group-level extraction_result
      try {
        const document = await Document.findById(documentId);
        if (document?.group_name) {
          await createOrUpdateGroupExtractionResult(document.group_name, userId);
        }
      } catch (groupError: any) {
        console.error(`⚠️ Error creating group extraction result: ${groupError.message}`);
        // Don't fail the whole operation if group result creation fails
      }
    }

    // Send notification to user
    if (userId && documentId) {
      const document = await Document.findById(documentId);
      const originalName = document?.original_name || 'your document';
      
      await Notification.create({
        user_id: userId,
        title: 'Extraction Complete!',
        message: `Your document '${originalName}' has been successfully processed and extracted.`,
        is_read: false
      });

      console.log(`🔔 Sent notification to user ${userId} for document ${documentId}`);
    }

  } catch (error: any) {
    console.error('❌ Error saving structured_data and combined_text:', error);
    throw error;
  }
}

/**
 * Create or update group-level extraction_result after all documents in group complete
 * This stores the combined extracted_text and structured_data for the entire group
 */
async function createOrUpdateGroupExtractionResult(
  groupName: string,
  userId?: string | number
): Promise<void> {
  try {
    await connectDB();
    const supabase = getConnection();

    // Get all documents in this group
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('group_name', groupName);
    
    if (docsError || !documents || documents.length === 0) {
      console.log(`   [GROUP] No documents found for group: ${groupName}`);
      return;
    }

    // Filter by user if userId provided
    const userDocuments = userId 
      ? documents.filter(doc => doc.user_id === String(userId))
      : documents;

    if (userDocuments.length === 0) {
      return;
    }

    const documentIds = userDocuments.map(doc => doc.id);

    // Get all extraction results for documents in this group
    const { data: extractionResults, error: resultsError } = await supabase
      .from('extraction_results')
      .select('*')
      .in('document_id', documentIds)
      .order('created_at', { ascending: true });

    if (resultsError || !extractionResults || extractionResults.length === 0) {
      console.log(`   [GROUP] No extraction results found for group: ${groupName}`);
      return;
    }

    // Check if all documents in group are completed
    const allCompleted = userDocuments.every(doc => 
      doc.status === 'completed' || doc.status === 'failed'
    );
    const allResultsCompleted = extractionResults.every(result => 
      result.status === 'completed' || result.status === 'failed'
    );

    if (!allCompleted || !allResultsCompleted) {
      console.log(`   [GROUP] Not all documents/results completed yet for group: ${groupName}`);
      return;
    }

    // Combine extracted_text from all individual document results
    // Use document break markers to separate content from different documents
    const combinedExtractedText = extractionResults
      .map((result: any) => result.extracted_text)
      .filter((text: string) => text && text.trim())
      .map((text: string) => {
        // Remove page break markers from individual documents (they're internal to each document)
        return text.replace(/---\s*Page\s*Break\s*---/gi, '').trim();
      })
      .join('\n\n--- Document Break ---\n\n') || '';

    console.log(`   [GROUP] Combined extracted_text length: ${combinedExtractedText.length} chars from ${extractionResults.length} documents`);

    // IMPORTANT: Run markdown-to-JSON conversion on the COMBINED extracted_text
    // This ensures structured_data is derived from the combined markdown, not from Workflow 2's individual outputs
    let combinedStructuredData: any = {};
    if (combinedExtractedText && combinedExtractedText.trim()) {
      try {
        console.log(`   [GROUP] Converting combined markdown to JSON...`);
        combinedStructuredData = await convertMarkdownToJson(combinedExtractedText);
        
        if (!combinedStructuredData || typeof combinedStructuredData !== 'object' || combinedStructuredData.error) {
          console.warn(`   [GROUP] Markdown conversion returned invalid result, using empty object`);
          combinedStructuredData = {};
        } else {
          console.log(`   ✅ [GROUP] Successfully converted combined markdown to JSON`);
        }
      } catch (error: any) {
        console.error(`   ❌ [GROUP] Error converting combined markdown to JSON: ${error.message}`);
        combinedStructuredData = {};
      }
    } else {
      console.warn(`   [GROUP] No combined extracted_text to convert`);
    }

    // Calculate aggregate metrics
    const accuracies = extractionResults
      .map(r => r.accuracy || 0)
      .filter(acc => acc > 0);
    const avgAccuracy = accuracies.length > 0
      ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
      : 0;

    const totalProcessingTime = extractionResults
      .reduce((sum, r) => sum + (r.processing_time_ms || 0), 0);

    const statuses = extractionResults.map(r => r.status);
    let overallStatus = 'completed';
    if (statuses.some(s => s === 'processing')) {
      overallStatus = 'processing';
    } else if (statuses.some(s => s === 'failed')) {
      overallStatus = statuses.every(s => s === 'failed') ? 'failed' : 'completed';
    }

    // Check if group extraction_result already exists
    const { data: existingGroupResult, error: findError } = await supabase
      .from('extraction_results')
      .select('*')
      .eq('group_name', groupName)
      .is('document_id', null)
      .limit(1);

    if (findError) {
      console.error(`   [GROUP] Error finding existing group result: ${findError}`);
    }

    if (existingGroupResult && existingGroupResult.length > 0) {
      // Update existing group result
      const groupResultId = existingGroupResult[0].id;
      await ExtractionResult.update(groupResultId, {
        extracted_text: combinedExtractedText,
        structured_data: combinedStructuredData,
        accuracy: Math.round(avgAccuracy * 100) / 100,
        processing_time_ms: totalProcessingTime,
        status: overallStatus
      });
      console.log(`   ✅ [GROUP] Updated group extraction_result for ${groupName}`);
    } else {
      // Create new group result
      const groupResultId = await ExtractionResult.create({
        document_id: undefined, // NULL for group-level results (use undefined, not null)
        group_name: groupName,
        extracted_text: combinedExtractedText,
        structured_data: combinedStructuredData,
        accuracy: Math.round(avgAccuracy * 100) / 100,
        processing_time_ms: totalProcessingTime,
        extraction_method: 'dify-workflow',
        status: overallStatus
      });
      console.log(`   ✅ [GROUP] Created group extraction_result ${groupResultId} for ${groupName}`);
    }

  } catch (error: any) {
    console.error(`❌ [GROUP] Error creating/updating group extraction result: ${error.message}`);
    // Don't throw - this is a background operation
  }
}

/**
 * Webhook endpoint for Workflow 2 output node to call back with results
 * POST /api/ocr-webhook/workflow2-callback
 * 
 * Accepts JSON payload:
 * {
 *   "answer1": ["...", "...", ...] or {...},
 *   "combined_text": "...",
 *   "extraction_result_id": "...",
 *   "document_id": "...",
 *   "user_id": "..."
 * }
 * 
 * OR multipart/form-data with file containing JSON
 */
export async function workflow2CallbackHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract IDs immediately (before any async operations)
  let workflow_run_id: string | undefined;
  let extraction_result_id: string | undefined;
  let document_id: string | undefined;
  let user_id: string | undefined;

  try {
    console.log(`📥 Received Workflow 2 callback`);
    console.log(`   Content-Type: ${req.headers['content-type']}`);

    // Parse request body synchronously
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Parse multipart/form-data - use multer's .none() to only parse fields, no files
      const upload = multer();
      
      await new Promise<void>((resolve, reject) => {
        upload.none()(req, res, (err: any) => {
          if (err) {
            console.error(`   Multer error: ${err.message}`);
            resolve();
          } else {
            resolve();
          }
        });
      });

      const body = (req as any).body || {};
      workflow_run_id = body.workflow_run_id;
      extraction_result_id = body.extraction_result_id;
      document_id = body.document_id;
      user_id = body.user_id;
      
      console.log(`   Extracted from form-data: workflow_run_id=${workflow_run_id}, extraction_result_id=${extraction_result_id}`);
    } else {
      // Handle JSON payload
      const body = req.body;
      workflow_run_id = body.workflow_run_id;
      extraction_result_id = body.extraction_result_id;
      document_id = body.document_id;
      user_id = body.user_id;
      
      console.log(`   Extracted from JSON: workflow_run_id=${workflow_run_id}, extraction_result_id=${extraction_result_id}`);
    }

    // Validate required fields
    if (!extraction_result_id) {
      return res.status(400).json({ error: 'extraction_result_id is required' });
    }

    // Send immediate response to Dify to prevent timeout
    // Process the workflow_run_id fetching asynchronously
    res.status(200).json({
      success: true,
      message: 'Callback received, processing workflow results asynchronously...',
      extraction_result_id,
      workflow_run_id
    });

    // Process asynchronously (don't await - let it run in background)
    processWorkflow2ResultsAsync(workflow_run_id, extraction_result_id, document_id, user_id)
      .catch((error: any) => {
        console.error('❌ Error in async processing:', error);
      });

  } catch (error: any) {
    console.error('Error processing Workflow 2 callback:', error);
    // Only send error if response hasn't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

/**
 * Process workflow results asynchronously (after response sent to Dify)
 */
async function processWorkflow2ResultsAsync(
  workflow_run_id: string | undefined,
  extraction_result_id: string,
  document_id: string | undefined,
  user_id: string | undefined
): Promise<void> {
  try {
    let answer1: any;
    let combined_text: string = '';

    // If workflow_run_id is provided, fetch everything from Dify API
    if (workflow_run_id && extraction_result_id) {
      console.log(`   🔄 [ASYNC] Fetching results from Dify API using workflow_run_id: ${workflow_run_id}`);
      const workflowResults = await fetchWorkflow2Results(workflow_run_id);
      
      if (workflowResults) {
        answer1 = workflowResults.answer1;
        combined_text = workflowResults.combined_text || '';
        console.log(`   ✅ [ASYNC] Successfully fetched results from Dify API`);
      } else {
        console.error(`   ❌ [ASYNC] Workflow run not found or not completed after retries`);
        // Update status to failed
        await connectDB();
        await ExtractionResult.updateStatus(extraction_result_id, 'failed');
        return;
      }
    } else {
      console.log(`   ⚠️ [ASYNC] No workflow_run_id provided, cannot fetch results`);
      return;
    }

    if (!answer1 && !combined_text) {
      console.error(`   ❌ [ASYNC] No answer1 or combined_text available`);
      return;
    }

    console.log(`   [ASYNC] Extraction result ID: ${extraction_result_id}`);
    console.log(`   [ASYNC] Answer1: ${answer1 ? (Array.isArray(answer1) ? `array[${answer1.length}]` : typeof answer1) : 'not provided'}`);
    console.log(`   [ASYNC] Combined text length: ${combined_text ? combined_text.length : 0} chars`);

    // Process structured data
    let structuredData: any;
    if (answer1) {
      if (Array.isArray(answer1)) {
        structuredData = {
          chunks: answer1,
          combined: answer1.join('\n\n')
        };
      } else {
        structuredData = answer1;
      }
    } else {
      structuredData = {};
    }

    const finalCombinedText: string = combined_text || (structuredData.combined || '');

    // Step 1: Save Dify output to database first
    await saveStructuredDataAndCombinedText(
      extraction_result_id,
      structuredData,
      finalCombinedText,
      document_id,
      user_id
    );
    console.log(`   ✅ [ASYNC] Dify output saved to database`);

    // Step 2: Convert markdown to JSON and overwrite structured_data
    if (finalCombinedText) {
      console.log(`   🔄 [ASYNC] Converting markdown extracted_text to JSON...`);
      try {
        const markdownJson = await convertMarkdownToJson(finalCombinedText);
        // Overwrite structured_data with markdown JSON (preserves order)
        if (markdownJson && typeof markdownJson === 'object' && !markdownJson.error) {
          // Update only structured_data field, keep extracted_text as is
          await connectDB();
          await ExtractionResult.update(extraction_result_id, {
            structured_data: markdownJson
          });
          console.log(`   ✅ [ASYNC] Markdown converted to JSON and overwrote structured_data (order preserved)`);
        } else {
          console.warn(`   ⚠️ [ASYNC] Markdown conversion returned invalid result`);
        }
      } catch (error: any) {
        console.error(`   ⚠️ [ASYNC] Markdown conversion failed: ${error.message}`);
      }
    }

    console.log(`   ✅ [ASYNC] Successfully processed and saved workflow results`);

    // Check if all documents in the group are completed, then create/update group-level extraction_result
    if (document_id) {
      try {
        await connectDB();
        const document = await Document.findById(document_id);
        if (document?.group_name) {
          console.log(`   [ASYNC] Checking if group ${document.group_name} is ready for aggregation...`);
          await createOrUpdateGroupExtractionResult(document.group_name, user_id);
        }
      } catch (groupError: any) {
        console.error(`   ⚠️ [ASYNC] Error creating group extraction result: ${groupError.message}`);
        // Don't fail the whole operation if group result creation fails
      }
    }

  } catch (error: any) {
    console.error('❌ [ASYNC] Error processing workflow results:', error);
    // Try to update status to failed
    try {
      await connectDB();
      await ExtractionResult.updateStatus(extraction_result_id, 'failed');
    } catch (updateError) {
      console.error('❌ [ASYNC] Failed to update status:', updateError);
    }
  }
}
