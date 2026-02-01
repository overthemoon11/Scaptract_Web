# Flow Analysis: start-extraction.ts → ocr.py → ocr-webhook.ts

## Complete Flow Diagram

```
1. User clicks "Start Extraction"
   ↓
2. start-extraction.ts
   - Creates extraction_result record
   - Calls Dify Workflow 1 with:
     * File URL (with JWT token)
     * Query: "Document ID: {id}, Extraction Result ID: {id}, User ID: {id}, Group Name: {name}, File Name: {name}"
   ↓
3. Dify Workflow 1 (configured in Dify)
   - Receives file URL and query
   - Extracts: document_id, extraction_result_id, user_id, group_name, file_name from query
   - Calls OCR API: POST /imgOcr/async
     * callback_url = Workflow 2 webhook URL
     * document_id, extraction_result_id, user_id, groupname, name as query params
     * file as form-data
   ↓
4. ocr.py (OCR API)
   - Receives async OCR request
   - Processes images with PPStructureV3
   - Sends callback to Workflow 2 webhook:
     {
       "text": "...",
       "extraction_result_id": "...",
       "document_id": "...",
       "user_id": "..."
     }
   ↓
5. Dify Workflow 2 (configured in Dify)
   - Receives callback from OCR API
   - Processes text (extraction, structuring)
   - Calls ocr-webhook.ts: POST /api/ocr-webhook/workflow2-callback
     * workflow_run_id (from sys.workflow_run_id)
     * extraction_result_id
     * document_id
     * user_id
   ↓
6. ocr-webhook.ts
   - Receives callback from Workflow 2
   - Fetches results from Dify API using workflow_run_id
   - Saves to database
   - Converts markdown to JSON
   - Sends notification
```

## Issues Found

### ✅ **CORRECT: start-extraction.ts**
- ✓ Creates extraction_result record
- ✓ Passes all required IDs in query string
- ✓ Uses correct Dify API format
- ✓ Handles errors properly

### ⚠️ **POTENTIAL ISSUE: Dify Workflow 1 Configuration**
**Expected behavior:**
- Must extract `document_id`, `extraction_result_id`, `user_id`, `group_name`, `file_name` from query string
- Must pass these to OCR API as query parameters:
  ```
  POST /imgOcr/async?callback_url={workflow2_webhook}&document_id={id}&extraction_result_id={id}&user_id={id}&groupname={name}&name={name}
  ```

**Check:**
- Does Workflow 1 use a Code node or Variable Extractor to parse the query?
- Are the variables correctly passed to the HTTP Request node?

### ✅ **CORRECT: ocr.py**
- ✓ Receives async request correctly
- ✓ Processes images with thread-safe pipeline lock
- ✓ Sends callback to Workflow 2 webhook with correct payload
- ✓ Includes all required IDs

**Note:** OCR API doesn't send `workflow_run_id` because it doesn't know it. Workflow 2 generates its own `workflow_run_id` when it runs.

### ⚠️ **POTENTIAL ISSUE: Dify Workflow 2 Configuration**
**Expected behavior:**
- Must receive callback from OCR API with: `text`, `extraction_result_id`, `document_id`, `user_id`
- Must process the text
- Must call ocr-webhook.ts with:
  ```
  POST /api/ocr-webhook/workflow2-callback
  {
    "workflow_run_id": "{{sys.workflow_run_id}}",
    "extraction_result_id": "{{extraction_result_id}}",
    "document_id": "{{document_id}}",
    "user_id": "{{user_id}}"
  }
  ```

**Check:**
- Does Workflow 2 webhook trigger extract the variables correctly?
- Does Workflow 2's HTTP Request node use `sys.workflow_run_id` to pass the run ID?
- Is the HTTP Request node configured to call the correct endpoint?

### ✅ **CORRECT: ocr-webhook.ts**
- ✓ Receives callback from Workflow 2
- ✓ Extracts workflow_run_id correctly
- ✓ Fetches results from Dify API with retry logic
- ✓ Saves to database correctly
- ✓ Converts markdown to JSON
- ✓ Sends notifications

## Critical Dependencies

1. **Dify Workflow 1 must:**
   - Parse query string to extract IDs
   - Pass IDs to OCR API as query parameters
   - Use correct callback URL (Workflow 2 webhook)

2. **Dify Workflow 2 must:**
   - Receive OCR callback correctly
   - Pass `sys.workflow_run_id` to ocr-webhook.ts
   - Call ocr-webhook.ts endpoint correctly

## Testing Checklist

- [ ] Workflow 1 extracts IDs from query string correctly
- [ ] Workflow 1 passes IDs to OCR API correctly
- [ ] OCR API receives and processes images correctly
- [ ] OCR API sends callback to Workflow 2 correctly
- [ ] Workflow 2 receives callback correctly
- [ ] Workflow 2 passes workflow_run_id to ocr-webhook.ts
- [ ] ocr-webhook.ts fetches results from Dify API correctly
- [ ] Database is updated correctly
- [ ] Notifications are sent correctly

## Common Issues

1. **OCR returns minimal text (34-35 chars)**
   - Check if images are blank
   - Check OCR service logs for errors
   - Verify pipeline lock is working (restart OCR service)

2. **workflow_run_id is missing**
   - Verify Workflow 2 uses `sys.workflow_run_id` variable
   - Check HTTP Request node configuration in Workflow 2

3. **IDs not passed correctly**
   - Verify Workflow 1 extracts IDs from query string
   - Check variable names match between workflows
