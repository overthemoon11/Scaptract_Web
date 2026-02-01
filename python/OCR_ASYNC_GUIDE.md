# OCR API Async Workflow Guide

## Problem
The `PPStructureV3` OCR processing takes too long and causes HTTP request timeouts in Dify workflows.

## Solution
Split the workflow into two parts:
1. **Workflow 1**: Submit OCR job (returns immediately)
2. **Workflow 2**: Poll for results or use callback

## API Endpoints

### 1. Asynchronous Job Submission
**Endpoint**: `POST http://localhost:8000/imgOcr/async`

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file (required)
  - Query parameter: `callback_url` (optional) - URL to call when job completes

**Response** (returns immediately):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "OCR job submitted. Use GET /imgOcr/status/{job_id} to check status."
}
```

**Example with curl**:
```bash
curl -X POST "http://localhost:8000/imgOcr/async?callback_url=http://your-server.com/webhook" \
  -F "file=@image.jpg"
```

### 2. Check Job Status
**Endpoint**: `GET http://localhost:8000/imgOcr/status/{job_id}`

**Response** (pending/processing):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "created_at": "2024-01-01T12:00:00",
  "started_at": "2024-01-01T12:00:01"
}
```

**Response** (completed):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "created_at": "2024-01-01T12:00:00",
  "completed_at": "2024-01-01T12:00:30",
  "text": "# Markdown content here..."
}
```

**Response** (failed):
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "created_at": "2024-01-01T12:00:00",
  "failed_at": "2024-01-01T12:00:30",
  "error": "Error message here"
}
```

### 3. Delete Job (optional cleanup)
**Endpoint**: `DELETE http://localhost:8000/imgOcr/status/{job_id}`

## Dify Workflow Setup

### Workflow 1: Submit OCR Jobs
1. **USER INPUT** - User uploads files
2. **IF/ELSE** - Check if files are PDFs
3. **PDF TO IMAGE CONVERTER** (if PDFs) - Convert PDFs to images
4. **VARIABLE AGGREGATOR** - Collect all images into array
5. **ITERATION** - Loop through each image
   - **HTTP REQUEST** - `POST http://192.168.0.24:8000/imgOcr/async`
     - Method: `POST`
     - URL: `http://192.168.0.24:8000/imgOcr/async`
     - Body: Form-data
       - Key: `file`
       - Value: `{{current_item}}` (the image file from iteration)
     - Response: `{"job_id": "...", "status": "pending"}`
   - **VARIABLE ASSIGNMENT** - Store `job_id` in an array
6. **OUTPUT** - Return array of `job_id`s

### Workflow 2: Poll for Results
1. **INPUT** - Receive array of `job_id`s from Workflow 1
2. **ITERATION** - Loop through each `job_id`
   - **HTTP REQUEST** - `GET http://192.168.0.24:8000/imgOcr/status/{{job_id}}`
     - Method: `GET`
     - URL: `http://192.168.0.24:8000/imgOcr/status/{{current_item}}`
     - Response: Check `status` field
   - **IF/ELSE** - Check if `status == "completed"`
     - **IF**: Extract `text` field and add to results array
     - **ELSE**: Wait and retry (or use a loop with delay)
3. **OUTPUT** - Return array of OCR text results

### Alternative: Using Callback (Webhook)
Dify workflows can receive webhooks using the **Webhook Trigger** node! Here's how to set it up:

#### Step 1: Create a Webhook Trigger in Dify Workflow 2

1. **Open your Dify workflow editor** (Workflow 2 - the one that will receive OCR results)

2. **Add a Webhook Trigger node:**
   - Right-click on the canvas (or use "Add Node" button)
   - Select **"Start → Webhook Trigger"**
   - This creates a START node that listens for incoming HTTP requests

3. **Configure the Webhook Trigger:**
   - **HTTP Method**: Select `POST` (since OCR API sends POST requests)
   - **Content-Type**: Select `application/json`
   - **Extract Variables**: Configure which parts of the request to extract:
     - From **Body**: Extract `job_id`, `status`, `text`, `timestamp`
     - These will become variables you can use in your workflow

4. **Copy the Webhook URL:**
   - Dify automatically generates a unique webhook URL
   - It will look like: `http://your-dify-instance.com/webhook/{workflow_id}` or similar
   - **Copy this URL** - you'll need it in Step 2
   - The URL is shown in the Webhook Trigger node configuration panel

#### Step 2: Update Workflow 1 to Use Callback

In your **Workflow 1** (where you submit OCR jobs), modify the HTTP REQUEST node:

1. **Open the HTTP REQUEST node** (the one that calls the OCR API)

2. **Configure the request:**
   - **Method**: `POST`
   - **URL**: `http://192.168.0.24:8000/imgOcr/async?callback_url=YOUR_DIFY_WEBHOOK_URL`
     - Replace `YOUR_DIFY_WEBHOOK_URL` with the webhook URL from Step 1
     - Example: `http://192.168.0.24:8000/imgOcr/async?callback_url=http://192.168.0.24:5001/webhook/abc123`
   - **Body Type**: `form-data`
   - **Body Fields**:
     - Key: `file`
     - Value: `{{current_item}}` (the image file from iteration)

3. **The response** will still be: `{"job_id": "...", "status": "pending"}`

#### Step 3: Configure Workflow 2 to Process Callback

When the OCR job completes, the OCR API will POST to your Dify webhook with:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "text": "# Markdown content here...",
  "timestamp": "2024-01-01T12:00:30"
}
```

In your **Workflow 2** (after the Webhook Trigger):

1. **Add nodes to extract data:**
   - Use a **Variable Assigner** or **Code** node
   - Extract `text` from the webhook payload (it's available as a variable from Step 1)
   - Variable name will be something like `{{#webhook.body.text}}` or `{{text}}` (depends on your Dify version)

2. **Process the OCR results:**
   - Add your processing logic (save to database, send to LLM, etc.)
   - The `text` variable contains the markdown OCR result

#### Testing the Webhook

1. **Test in Dify:**
   - Use "Run this step" or "Test Webhook Trigger" in Dify
   - Check "Last Run" logs in the trigger to see received requests

2. **Test with curl:**
   ```bash
   curl -X POST "http://your-dify-webhook-url" \
     -H "Content-Type: application/json" \
     -d '{
       "job_id": "test-123",
       "status": "completed",
       "text": "# Test OCR Result",
       "timestamp": "2024-01-01T12:00:00"
     }'
   ```

#### Important Notes

- **HTTP Request node** (what you're looking at) is for **sending** requests, not receiving
- **Webhook Trigger** is a **START node** for **receiving** webhooks
- The webhook URL is automatically generated by Dify - you don't need to configure it manually
- Make sure your Dify instance is accessible from the OCR API server (not just localhost)

## Job Status Values
- `pending`: Job created, waiting to start
- `processing`: OCR is currently running
- `completed`: OCR finished successfully
- `failed`: OCR encountered an error

## Notes
- Jobs are stored in-memory. Restarting the server will clear all jobs.
- For production, consider using Redis or a database for job storage.
- The synchronous endpoint `/imgOcr` is still available for quick processing.
- Temporary image files are automatically cleaned up after processing.
