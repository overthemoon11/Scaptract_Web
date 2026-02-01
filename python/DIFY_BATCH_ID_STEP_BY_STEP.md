# Step-by-Step Guide: Adding Batch ID to Your Dify Workflows

## Overview
This guide will help you modify your existing Dify workflows to support multi-page PDFs by grouping OCR results using `batch_id`.

## Workflow 1: Submit OCR Jobs with Batch ID

### Step 1: Generate Batch ID

**Location:** After PDF TO IMAGE CONVERTER, before VARIABLE AGGREGATOR

1. **Add a CODE node** (or Variable Assigner if CODE is not available)
   - Right-click on canvas → Add Node → CODE
   - Or use Variable Assigner

2. **Configure the node:**
   - **Node Name:** "Generate Batch ID"
   - **Input Variables:** None needed
   - **Code/Expression:**
     ```javascript
     // Generate unique batch ID
     const batch_id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     return { batch_id: batch_id };
     ```
   - **Output Variable:** `batch_id`

3. **Alternative (if CODE node not available):**
   - Use Variable Assigner
   - Variable: `batch_id`
   - Value: Use a function or timestamp-based expression

### Step 2: Count Pages/Images

**Location:** After PDF TO IMAGE CONVERTER, before VARIABLE AGGREGATOR

1. **Add a CODE node** (or check VARIABLE AGGREGATOR output)
   - If VARIABLE AGGREGATOR outputs an array, you can get the count from it

2. **Configure:**
   - **Node Name:** "Count Pages"
   - **Input Variables:** Select the array from VARIABLE AGGREGATOR (or PDF converter output)
   - **Code:**
     ```javascript
     const images = INPUT_VARIABLE; // Replace with actual variable name
     const page_count = images.length;
     return { page_count: page_count };
     ```
   - **Output Variable:** `page_count`

### Step 3: Update HTTP REQUEST 3 URL

**Location:** Inside ITERATION 4, the HTTP REQUEST 3 node

1. **Click on HTTP REQUEST 3 node**

2. **Update the URL field:**
   - **Current URL:** `http://192.168.0.24:8000/imgOcr/async?callback_url=YOUR_WEBHOOK_URL`
   - **New URL:**
     ```
     http://192.168.0.24:8000/imgOcr/async?callback_url=YOUR_WEBHOOK_URL&batch_id={{batch_id}}&page_number={{index + 1}}
     ```
   
   **Important:**
   - Replace `YOUR_WEBHOOK_URL` with your actual webhook URL from Workflow 2
   - `{{batch_id}}` - References the batch_id from Step 1
   - `{{index + 1}}` - Page number (1-based). If your iteration index starts at 1, use `{{index}}` instead
   - If Dify uses different variable syntax, try: `{{#batch_id}}` or `{{$batch_id}}`

3. **Keep everything else the same:**
   - Method: `POST`
   - Body: `form-data`
   - Key: `file`
   - Value: `{{item}}` or `{{current_item}}`

### Step 4: Verify Workflow 1 Structure

Your Workflow 1 should now look like:
```
USER INPUT
  ↓
IF/ELSE (Check if PDF)
  ↓ (IF PDF)
PDF TO IMAGE CONVERTER
  ↓
Generate Batch ID (NEW - Step 1)
  ↓
Count Pages (NEW - Step 2)
  ↓
VARIABLE AGGREGATOR (collect images)
  ↓
ITERATION 4
  ↓
  HTTP REQUEST 3 (UPDATED - Step 3)
    URL: ...&batch_id={{batch_id}}&page_number={{index + 1}}
```

## Workflow 2: Receive Webhooks and Combine Results

### Step 1: Update Webhook Trigger Configuration

**Location:** Start of Workflow 2

1. **Click on Webhook Trigger node**

2. **Go to SETTINGS tab**

3. **Add Request Body Parameters:**
   - Click "Enter variable name..." in REQUEST BODY PARAMETERS section
   - Add these parameters one by one:

   | Variable Name | Type | Required |
   |--------------|------|----------|
   | `batch_id` | String | ✅ Check |
   | `page_number` | Number | ✅ Check |
   | `job_id` | String | ✅ Check |
   | `status` | String | ✅ Check |
   | `text` | String | ✅ Check |
   | `timestamp` | String | ❌ Uncheck |

4. **Verify Content Type:** `application/json` (should already be set)

5. **Copy your Webhook URL** (you'll need it for Workflow 1)

### Step 2: Initialize Results Storage

**Location:** After Webhook Trigger

1. **Add a CODE node**
   - **Node Name:** "Initialize Results"
   - **Input Variables:** None
   - **Code:**
     ```javascript
     // Initialize empty results storage
     // This will be used to collect all pages
     return {
       results: {},
       initialized: true
     };
     ```
   - **Output:** Creates `results` object

### Step 3: Store Each Webhook Result

**Location:** After Initialize Results

1. **Add a CODE node** (or Variable Aggregator)
   - **Node Name:** "Store Page Result"
   - **Input Variables:**
     - `batch_id` (from Webhook Trigger)
     - `page_number` (from Webhook Trigger)
     - `text` (from Webhook Trigger)
     - `results` (from Initialize Results node)
   
   - **Code:**
     ```javascript
     const batch_id = BATCH_ID; // Replace with actual variable name
     const page_number = PAGE_NUMBER; // Replace with actual variable name
     const text = TEXT; // Replace with actual variable name
     const results = RESULTS || {}; // Replace with actual variable name
     
     // Initialize batch if doesn't exist
     if (!results[batch_id]) {
       results[batch_id] = [];
     }
     
     // Store this page's result
     results[batch_id].push({
       page_number: page_number,
       text: text
     });
     
     return {
       results: results,
       current_batch_id: batch_id,
       current_page_count: results[batch_id].length
     };
     ```

2. **Alternative (Simpler):**
   - Use Variable Aggregator node
   - Collect `text` values into an array
   - But you'll lose the page_number ordering info

### Step 4: Check if All Pages Received

**Location:** After Store Page Result

1. **Add an IF/ELSE node**
   - **Node Name:** "Check Completion"
   - **Condition:**
     - Check if `current_page_count == expected_page_count`
     - Or check if `results[batch_id].length == expected_page_count`
   
   **Note:** You need to know the expected page count. Options:
   - Pass it from Workflow 1 via webhook (add to callback payload)
   - Or use a fixed value if PDFs always have same page count
   - Or check if all pages received by comparing with a list

2. **Alternative:** Use a CODE node to check:
   ```javascript
   const results = RESULTS;
   const batch_id = CURRENT_BATCH_ID;
   const expected_count = EXPECTED_PAGE_COUNT; // You need to set this
   
   const current_count = results[batch_id] ? results[batch_id].length : 0;
   const is_complete = current_count >= expected_count;
   
   return { is_complete: is_complete, current_count: current_count };
   ```

### Step 5: Combine All Pages' Text

**Location:** After Check Completion (IF branch)

1. **Add a CODE node**
   - **Node Name:** "Combine Pages"
   - **Input Variables:**
     - `results` (from Store Page Result)
     - `batch_id` (from Webhook Trigger or Store Page Result)
   
   - **Code:**
     ```javascript
     const results = RESULTS;
     const batch_id = BATCH_ID;
     
     // Get all pages for this batch
     const pages = results[batch_id] || [];
     
     // Sort by page_number
     pages.sort((a, b) => a.page_number - b.page_number);
     
     // Combine all texts
     const combined_text = pages.map(page => page.text).join('\n\n--- Page Break ---\n\n');
     
     // Or without page breaks:
     // const combined_text = pages.map(page => page.text).join('\n\n');
     
     return {
       combined_text: combined_text,
       page_count: pages.length,
       batch_id: batch_id
     };
     ```

### Step 6: Process Combined Result

**Location:** After Combine Pages

1. **Add your processing nodes:**
   - LLM node to process the combined text
   - Save to database
   - Or whatever you need to do with the final result

2. **Use the variable:** `{{combined_text}}` (or whatever you named it)

### Step 7: Verify Workflow 2 Structure

Your Workflow 2 should now look like:
```
Webhook Trigger (UPDATED - Step 1)
  Extracts: batch_id, page_number, text, status
  ↓
Initialize Results (NEW - Step 2)
  ↓
Store Page Result (NEW - Step 3)
  Stores each page's text with page_number
  ↓
Check Completion (NEW - Step 4)
  IF: All pages received
  ELSE: Wait for more
  ↓ (IF true)
Combine Pages (NEW - Step 5)
  Sort by page_number, combine texts
  ↓
Process Combined Text (Step 6)
  Your existing processing logic
```

## Testing Your Setup

### Test 1: Single Page Image
1. Upload a single image (not PDF)
2. Should work as before (batch_id optional)

### Test 2: Multi-Page PDF
1. Upload a 3-page PDF
2. Check Workflow 1:
   - Should generate 1 batch_id
   - Should submit 3 OCR jobs with same batch_id
   - Each job should have page_number: 1, 2, 3

3. Check Workflow 2:
   - Should receive 3 webhook calls
   - Each call should have same batch_id
   - Each call should have different page_number
   - After 3rd call, should combine all texts

### Test 3: Verify Webhook Payload
1. In Workflow 2, check Webhook Trigger's "LAST RUN" tab
2. Should see:
   ```json
   {
     "job_id": "...",
     "batch_id": "batch_1234567890_abc123",
     "page_number": 1,
     "status": "completed",
     "text": "# OCR text...",
     "timestamp": "..."
   }
   ```

## Troubleshooting

### Problem: batch_id is undefined in HTTP REQUEST 3
**Solution:** 
- Make sure Generate Batch ID node is before ITERATION
- Check variable name matches: `{{batch_id}}` vs `{{#batch_id}}`
- Try using the output variable name from the CODE node

### Problem: page_number is wrong
**Solution:**
- Check if iteration index starts at 0 or 1
- Use `{{index + 1}}` if index starts at 0
- Use `{{index}}` if index starts at 1
- Or use `{{item.index}}` depending on Dify version

### Problem: Webhook not receiving batch_id
**Solution:**
- Check Webhook Trigger has `batch_id` in Request Body Parameters
- Verify OCR API is sending it (check API logs)
- Test webhook with curl to see actual payload

### Problem: Results not combining
**Solution:**
- Check Store Page Result is actually storing data
- Verify Check Completion logic is correct
- Make sure expected_page_count matches actual page count
- Check Combine Pages is sorting correctly

## Quick Reference: Variable Names

In Dify, variable names might vary. Common patterns:
- `{{variable_name}}` - Standard
- `{{#variable_name}}` - Some versions
- `{{$variable_name}}` - Some versions
- `{{node_name.variable_name}}` - From specific node

Check your Dify version's documentation or use autocomplete when typing `{{` in any field.
