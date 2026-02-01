from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import shutil
import os
import re
import uuid
import threading
import requests
from datetime import datetime
from typing import Dict, Optional, List
from paddleocr import PPStructureV3
from pathlib import Path
import sys
import io
import json

# Set stdout encoding to UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def safe_print(message: str):
    """Prints a message, handling potential UnicodeEncodeErrors on Windows."""
    try:
        print(message)
    except UnicodeEncodeError:
        # Fallback to ASCII-only message
        ascii_message = message.encode('ascii', 'replace').decode('ascii')
        print(f"[ASCII-ONLY] {ascii_message}")

# Initialize PPStructureV3 pipeline with error handling
pipeline = None
try:
    safe_print("[INIT] Initializing PaddleOCR PPStructureV3...")
    pipeline = PPStructureV3()
    safe_print("[OK] PaddleOCR initialized successfully")
except Exception as e:
    safe_print(f"[ERROR] Failed to initialize PaddleOCR: {e}")
    import traceback
    safe_print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
    safe_print("[ERROR] OCR API will start but will fail on requests until PaddleOCR is fixed")
    # Don't raise - let the app start so we can see health check errors

# Allowed image extensions
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'webp'}

# Job storage (in-memory, for production consider Redis or database)
job_storage: Dict[str, Dict] = {}
job_lock = threading.Lock()

# Pipeline lock for thread-safe access (PPStructureV3 is not thread-safe)
pipeline_lock = threading.Lock()

# Job statuses
JOB_STATUS_PENDING = "pending"
JOB_STATUS_PROCESSING = "processing"
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"

def fix_spacing_errors(text: str) -> str:
    """
    Fix spacing errors in OCR text, especially in titles
    Examples: "I ntroduction" -> "Introduction", "I llustration" -> "Illustration"
    """
    if not text:
        return text
    
    # Fix: single capital letter followed by space and lowercase letter (common OCR error in titles)
    # Pattern: "I ntroduction" -> "Introduction", "A bstract" -> "Abstract", "I llustration" -> "Illustration"
    text = re.sub(r'\b([A-Z])\s+([a-z])', r'\1\2', text)
    
    # Fix: lowercase letter followed by space and capital letter (word boundary)
    # text = re.sub(r'([a-z])\s+([A-Z])', r'\1 \2', text)
    
    # Fix: common word concatenations
    # "ofyour" -> "of your", "inthe" -> "in the", "tothe" -> "to the"
    # common_words = ['of', 'in', 'to', 'the', 'and', 'or', 'is', 'it', 'as', 'at', 'on', 'for', 'with']
    # for word in common_words:
        # Pattern: letter + common word + letter (e.g., "ofyour")
        # text = re.sub(rf'([a-z])({word})([a-z])', rf'\1 {word} \3', text, flags=re.IGNORECASE)
    
    # Fix: letter/number followed by opening parenthesis
    # text = re.sub(r'([a-zA-Z0-9])([\(\[\{])', r'\1 \2', text)
    
    # Fix: closing parenthesis followed by letter/number
    # text = re.sub(r'([\)\]\}])([a-zA-Z0-9])', r'\1 \2', text)
    
    # Fix: number followed by letter
    # text = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', text)
    
    # Fix: multiple spaces to single space
    # text = re.sub(r'\s+', ' ', text)
    
    # Fix: spaces before punctuation
    # text = re.sub(r'\s+([,\.;:!?])', r'\1', text)
    
    # Fix: spaces after punctuation
    # text = re.sub(r'([,\.;:!?])\s*([a-zA-Z])', r'\1 \2', text)
    
    # Fix: remove spaces before closing quotes/parentheses
    # text = re.sub(r'\s+([\)\]\}])', r'\1', text)
    # text = re.sub(r'([\(\[\{])\s+', r'\1', text)
    
    return text.strip()

def fix_title_spacing(markdown_text: str) -> str:
    """
    Fix spacing errors in markdown, especially in headers/titles
    """
    lines = markdown_text.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Fix spacing in headers (lines starting with #)
        if line.strip().startswith('#'):
            # Extract header level and content
            header_match = re.match(r'^(#+\s*)(.*)', line)
            if header_match:
                header_prefix = header_match.group(1)
                header_content = header_match.group(2)
                fixed_content = fix_spacing_errors(header_content)
                fixed_lines.append(header_prefix + fixed_content)
            else:
                fixed_lines.append(fix_spacing_errors(line))
        else:
            fixed_lines.append(fix_spacing_errors(line))
    
    return '\n'.join(fixed_lines)

def ocr_single_image(image_path: str, groupname: Optional[str] = None, name: Optional[str] = None) -> str:
    """
    Process a single image with PPStructureV3 and return markdown
    If groupname and name are provided, saves markdown to server/uploads/ocr-results/{groupname}/{name}.md
    and JSON to server/uploads/ocr-results/{groupname}/{name}.json
    Otherwise, uses a temporary directory
    """
    global pipeline  # Declare global at the top of the function
    
    if pipeline is None:
        raise Exception("PaddleOCR pipeline not initialized. Check OCR API logs for initialization errors.")
    
    try:
        # PPStructureV3 is not thread-safe, so we need to serialize access
        # Also implement retry logic for PreconditionNotMetError
        max_retries = 2
        retry_count = 0
        output = None
        
        while retry_count <= max_retries:
            try:
                with pipeline_lock:
                    output = pipeline.predict(image_path)
                break  # Success, exit retry loop
            except RuntimeError as e:
                error_str = str(e)
                if ("Tensor holds no memory" in error_str or 
                    "PreconditionNotMetError" in error_str or
                    "PreconditionNotMet" in error_str):
                    retry_count += 1
                    if retry_count <= max_retries:
                        safe_print(f"[WARNING] Pipeline error (attempt {retry_count}/{max_retries}): {error_str}")
                        safe_print(f"[WARNING] Reinitializing pipeline and retrying...")
                        # Reinitialize pipeline within lock
                        with pipeline_lock:
                            try:
                                pipeline = PPStructureV3()
                                safe_print(f"[OK] Pipeline reinitialized successfully")
                            except Exception as init_error:
                                safe_print(f"[ERROR] Failed to reinitialize pipeline: {init_error}")
                                raise Exception(f"Failed to reinitialize pipeline after error: {init_error}")
                    else:
                        raise Exception(f"Pipeline failed after {max_retries} retries: {error_str}")
                else:
                    # Not a PreconditionNotMetError, re-raise immediately
                    raise

        markdown_blocks = []

        # Determine save directory
        if groupname and name:
            # Save to specified directory
            # Path relative to python/ directory: go up one level, then into server/uploads/ocr-results
            script_dir = Path(__file__).parent.resolve()  # python/ directory
            project_root = script_dir.parent  # project root
            save_dir = project_root / "server" / "uploads" / "ocr-results" / groupname
            save_dir.mkdir(parents=True, exist_ok=True)
            safe_print(f"[INFO] Saving markdown to: {save_dir}")
            use_temp = False
        else:
            # Use temporary directory
            save_dir = tempfile.mkdtemp()
            use_temp = True

        try:
            # Extract markdown and JSON from results
            for res in output:
                try:
                    # Try to save markdown directly
                    res.save_to_markdown(save_path=str(save_dir))
                except Exception as e:
                    safe_print(f"Warning: Could not save markdown: {e}")
                
                try:
                    # Try to save JSON directly
                    res.save_to_json(save_path=str(save_dir))
                except Exception as e:
                    safe_print(f"Warning: Could not save JSON: {e}")

            # Read all markdown files
            temp_md_files = []
            for file in sorted(os.listdir(save_dir)):
                if file.endswith(".md"):
                    file_path = os.path.join(save_dir, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        markdown_blocks.append(content)
                        temp_md_files.append(file_path)
            
            # Read all JSON files
            temp_json_files = []
            json_data_list = []
            for file in sorted(os.listdir(save_dir)):
                if file.endswith(".json"):
                    file_path = os.path.join(save_dir, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        json_data = json.load(f)
                        json_data_list.append(json_data)
                        temp_json_files.append(file_path)
            
            # If saving to permanent location and we have a name, save combined markdown to desired filename
            if not use_temp and name and markdown_blocks:
                target_md_path = save_dir / f"{name}.md"
                # Combine all markdown blocks
                combined_markdown = "\n\n".join(markdown_blocks)
                with open(target_md_path, "w", encoding="utf-8") as f:
                    f.write(combined_markdown)
                safe_print(f"[SAVE] Saved markdown to: {target_md_path}")
                
                # Clean up temporary markdown files created by PaddleOCR
                for temp_file in temp_md_files:
                    if temp_file != str(target_md_path) and os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception as e:
                            safe_print(f"[WARNING] Could not remove temp file {temp_file}: {e}")
            
            # If saving to permanent location and we have a name, save combined JSON to desired filename
            if not use_temp and name and json_data_list:
                target_json_path = save_dir / f"{name}.json"
                # Combine JSON data
                if len(json_data_list) == 1:
                    combined_json = json_data_list[0]
                else:
                    # Multiple JSON files - save as array
                    combined_json = json_data_list
                
                with open(target_json_path, "w", encoding="utf-8") as f:
                    json.dump(combined_json, f, indent=2, ensure_ascii=False)
                safe_print(f"[SAVE] Saved JSON to: {target_json_path}")
                
                # Clean up temporary JSON files created by PaddleOCR
                for temp_file in temp_json_files:
                    if temp_file != str(target_json_path) and os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception as e:
                            safe_print(f"[WARNING] Could not remove temp file {temp_file}: {e}")
        finally:
            # Only clean up if using temporary directory
            if use_temp and os.path.exists(save_dir):
                shutil.rmtree(save_dir)

        # Combine markdown blocks
        if markdown_blocks:
            markdown_text = "\n\n".join(markdown_blocks)
        else:
            # Fallback: generate markdown from parsing results
            markdown_text = ""
            for res in output:
                if hasattr(res, 'res') and 'parsing_res_list' in res.res:
                    for block in res.res['parsing_res_list']:
                        if isinstance(block, dict):
                            block_content = block.get('block_content', '')
                        else:
                            block_content = getattr(block, 'block_content', '')
                        if block_content:
                            markdown_text += block_content + "\n"
        
        # Fix spacing errors
        markdown_text = fix_title_spacing(markdown_text)
        
        # Warn if OCR returned very little text (might indicate failure)
        if len(markdown_text.strip()) < 50:
            safe_print(f"[WARNING] OCR returned minimal text ({len(markdown_text)} chars). Image might be blank or OCR failed silently.")

        return markdown_text
    except Exception as e:
        raise Exception(f"Error processing image: {str(e)}")

def send_callback(callback_url: str, job_id: str, status: str, text: Optional[str] = None, error: Optional[str] = None, document_id: Optional[str] = None, extraction_result_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    Send HTTP callback to the specified URL when job completes
    Note: callback_url should point to Workflow 2's webhook trigger URL
    """
    try:
        # Warn if callback URL uses localhost (OCR API cannot reach localhost)
        if callback_url and ('localhost' in callback_url.lower() or '127.0.0.1' in callback_url):
            safe_print(f"[WARNING] Callback URL uses localhost/127.0.0.1: {callback_url}")
            safe_print(f"[WARNING] OCR API may not be able to reach localhost. Use your Dify server's network IP address instead.")
        
        # Prepare payload matching Workflow 2 webhook trigger input variables
        # Note: batch_id, page_number, and total_pages removed - all images processed in one job
        payload = {
            "text": text if status == JOB_STATUS_COMPLETED and text else "",
            "extraction_result_id": extraction_result_id if extraction_result_id else "",
            "document_id": document_id if document_id else "",
            "user_id": user_id if user_id else ""
        }
        
        # For failed jobs, still send the payload but with empty text
        if status == JOB_STATUS_FAILED and error:
            payload["error"] = error
            payload["text"] = ""  # Empty text for failed jobs
        
        response = requests.post(callback_url, json=payload, timeout=10)
        response.raise_for_status()
        safe_print(f"[OK] Callback sent successfully to {callback_url}")
    except requests.exceptions.ConnectionError as e:
        safe_print(f"[ERROR] Failed to connect to callback URL {callback_url}")
        safe_print(f"[ERROR] Connection error: {str(e)}")
        if 'localhost' in callback_url.lower() or '127.0.0.1' in callback_url:
            safe_print(f"[ERROR] TIP: Replace 'localhost' with your Dify server's network IP address (e.g., 192.168.0.24)")
    except Exception as e:
        safe_print(f"[WARNING] Failed to send callback to {callback_url}: {str(e)}")

def process_ocr_job(job_id: str, image_paths: List[str]):
    """
    Background processing function for OCR jobs
    Can handle single or multiple images
    """
    callback_url = None
    batch_id = None
    page_number = None
    total_pages = None
    document_id = None
    extraction_result_id = None
    user_id = None
    groupname = None
    name = None
    
    try:
        with job_lock:
            job = job_storage.get(job_id)
            if not job:
                safe_print(f"[WARNING] Job {job_id} not found in storage")
                return
            callback_url = job.get("callback_url")
            document_id = job.get("document_id")
            extraction_result_id = job.get("extraction_result_id")
            user_id = job.get("user_id")
            groupname = job.get("groupname")
            name = job.get("name")
            job["status"] = JOB_STATUS_PROCESSING
            job["started_at"] = datetime.now().isoformat()
        
        num_images = len(image_paths)
        safe_print(f"[PROCESSING] Starting OCR processing for job {job_id} ({num_images} image(s))")
        
        # ALWAYS fetch groupname/name from server API if document_id is available
        # This ensures we use the correct unique filename even if Dify Workflow 1 doesn't pass it correctly
        if document_id:
            server_url = os.getenv("FILE_SERVER_URL", "http://localhost:3000")
            server_url = server_url.rstrip('/')
            internal_token = os.getenv("OCR_INTERNAL_TOKEN", "ocr-internal-secret")
            
            try:
                api_url = f"{server_url}/api/documents/ocr-info/{document_id}?token={internal_token}"
                response = requests.get(api_url, timeout=3)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and data.get("document"):
                        doc = data["document"]
                        fetched_groupname = doc.get("group_name")
                        fetched_name = doc.get("file_name")
                        
                        # ALWAYS use fetched values (they're the source of truth from database)
                        if fetched_groupname:
                            groupname = fetched_groupname
                            safe_print(f"[INFO] Using groupname from server: {groupname}")
                        if fetched_name:
                            name = fetched_name
                            safe_print(f"[INFO] Using file_name from server: {name} (unique per document)")
                        
                        if not groupname or not name:
                            # Fallback: Use document_id if server doesn't have values
                            safe_doc_id = re.sub(r'[^a-zA-Z0-9\-_]', '_', str(document_id))
                            if not groupname:
                                groupname = safe_doc_id
                            if not name:
                                name = safe_doc_id
                            safe_print(f"[WARNING] Document missing group_name/file_name in DB, using document_id: groupname={groupname}, name={name}")
                    else:
                        raise Exception("Invalid response format")
                else:
                    raise Exception(f"HTTP {response.status_code}")
            except Exception as e:
                # Only use fallback if we couldn't fetch from server
                if not groupname or not name:
                    safe_doc_id = re.sub(r'[^a-zA-Z0-9\-_]', '_', str(document_id))
                    if not groupname:
                        groupname = safe_doc_id
                    if not name:
                        name = safe_doc_id
                    safe_print(f"[WARNING] Could not fetch document info from server ({str(e)}), using document_id: groupname={groupname}, name={name}")
                else:
                    safe_print(f"[INFO] Using provided groupname={groupname}, name={name} (server fetch failed but values provided)")
        
        # Process all images with OCR
        all_markdown_texts = []
        for idx, image_path in enumerate(image_paths):
            try:
                safe_print(f"[PROCESSING] Processing image {idx + 1}/{num_images}: {os.path.basename(image_path)}")
                # IMPORTANT: For single image processing (each document processed separately),
                # use the name as-is (it's already unique per document from upload.ts)
                # Only append page number if we're processing multiple images in ONE job
                image_name = name
                if num_images > 1 and name:
                    # Multiple images in one job - append page number
                    name_base = Path(name).stem
                    name_ext = Path(name).suffix or ".md"
                    image_name = f"{name_base}_page-{idx + 1:04d}{name_ext}"
                # For single image (num_images == 1), use name as-is (already unique)
                
                safe_print(f"[INFO] Calling ocr_single_image with groupname={groupname}, name={image_name}")
                markdown_text = ocr_single_image(image_path, groupname=groupname, name=image_name)
                all_markdown_texts.append(markdown_text)
                safe_print(f"[OK] Image {idx + 1}/{num_images} processed (text length: {len(markdown_text)} chars)")
            except Exception as e:
                import traceback
                safe_print(f"[ERROR] Failed to process image {idx + 1}/{num_images}: {str(e)}")
                safe_print(f"[ERROR] Traceback: {traceback.format_exc()}")
                # Continue with other images even if one fails
                all_markdown_texts.append(f"[ERROR: Failed to process image {idx + 1}]\n")
        
        # Combine all markdown texts with page separators
        if num_images > 1:
            # Smart deduplication: Extract only new content from cumulative pages
            # This handles cases where images contain cumulative content (each page has all previous + new)
            deduplicated_texts = []
            previous_normalized = ""
            
            for idx, text in enumerate(all_markdown_texts):
                # Normalize text for comparison (remove extra whitespace, newlines, page breaks)
                normalized = ' '.join(text.replace('--- Page Break ---', '').split())
                
                if not normalized:
                    # Empty page, skip it
                    continue
                
                if idx == 0:
                    # First page, always keep full content
                    deduplicated_texts.append(text)
                    previous_normalized = normalized
                else:
                    # Check if current page contains all previous content (cumulative page)
                    if normalized.startswith(previous_normalized) and len(normalized) > len(previous_normalized):
                        # Current page is cumulative - extract only the new part
                        # Strategy: Find new section headers that weren't in the previous page
                        prev_text = all_markdown_texts[idx - 1]
                        prev_lines = prev_text.split('\n')
                        prev_headers = set()
                        for prev_line in prev_lines:
                            if prev_line.strip().startswith('##') or prev_line.strip().startswith('#'):
                                # Extract header text (normalize for comparison)
                                header_text = ' '.join(prev_line.strip().split()).lower()
                                prev_headers.add(header_text)
                        
                        # Find new sections in current page
                        lines = text.split('\n')
                        new_lines = []
                        found_new_section = False
                        current_section_lines = []
                        
                        for line in lines:
                            line_stripped = line.strip()
                            if line_stripped.startswith('##') or line_stripped.startswith('#'):
                                # This is a header
                                header_text = ' '.join(line_stripped.split()).lower()
                                if header_text not in prev_headers:
                                    # New section found - start collecting
                                    if current_section_lines:
                                        new_lines.extend(current_section_lines)
                                        current_section_lines = []
                                    found_new_section = True
                                    new_lines.append(line)
                                else:
                                    # This header exists in previous page - stop collecting if we were
                                    if found_new_section and current_section_lines:
                                        new_lines.extend(current_section_lines)
                                    found_new_section = False
                                    current_section_lines = []
                            else:
                                if found_new_section:
                                    new_lines.append(line)
                                elif not prev_headers:
                                    # No headers in previous page, collect everything after first new header
                                    current_section_lines.append(line)
                        
                        # Add any remaining lines from current section
                        if current_section_lines and found_new_section:
                            new_lines.extend(current_section_lines)
                        
                        if new_lines:
                            new_content = '\n'.join(new_lines).strip()
                            if new_content:
                                deduplicated_texts.append(new_content)
                                previous_normalized = normalized
                            else:
                                # No new content found, keep full page
                                deduplicated_texts.append(text)
                                previous_normalized = normalized
                        else:
                            # Couldn't find new sections, keep full page
                            deduplicated_texts.append(text)
                            previous_normalized = normalized
                    else:
                        # Different content (not cumulative), keep it
                        deduplicated_texts.append(text)
                        previous_normalized = normalized
            
            if deduplicated_texts:
                combined_markdown = "\n\n--- Page Break ---\n\n".join(deduplicated_texts)
            else:
                # Fallback: use original if deduplication removed everything
                combined_markdown = "\n\n--- Page Break ---\n\n".join(all_markdown_texts)
        else:
            combined_markdown = all_markdown_texts[0] if all_markdown_texts else ""
        
        # Warn if combined text is very short (might indicate all images failed)
        if len(combined_markdown.strip()) < 50:
            safe_print(f"[WARNING] Combined OCR text is very short ({len(combined_markdown)} chars). Check if images contain text or if OCR failed.")
            # Count how many images had errors
            error_count = sum(1 for text in all_markdown_texts if text.startswith("[ERROR:"))
            if error_count > 0:
                safe_print(f"[WARNING] {error_count} of {num_images} image(s) had processing errors.")
        
        # Update job status
        with job_lock:
            if job_id in job_storage:
                job_storage[job_id]["status"] = JOB_STATUS_COMPLETED
                job_storage[job_id]["text"] = combined_markdown
                job_storage[job_id]["completed_at"] = datetime.now().isoformat()
        
        safe_print(f"[OK] Job {job_id} completed successfully ({num_images} image(s), total text length: {len(combined_markdown)} chars)")
        
        # Send callback if URL is provided
        # Note: callback_url should point to Workflow 2's webhook trigger URL
        if callback_url:
            safe_print(f"[SEND] Sending callback for job {job_id} to {callback_url}")
            send_callback(callback_url, job_id, JOB_STATUS_COMPLETED, text=combined_markdown, document_id=document_id, extraction_result_id=extraction_result_id, user_id=user_id)
        else:
            safe_print(f"[INFO] No callback URL provided for job {job_id}")
            
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        
        safe_print(f"[ERROR] Job {job_id} failed: {error_msg}")
        safe_print(f"Traceback: {error_traceback}")
        
        with job_lock:
            if job_id in job_storage:
                job_storage[job_id]["status"] = JOB_STATUS_FAILED
                job_storage[job_id]["error"] = error_msg
                job_storage[job_id]["failed_at"] = datetime.now().isoformat()
        
        # Send callback if URL is provided
        if callback_url:
            # Get metadata from job storage
            with job_lock:
                job = job_storage.get(job_id)
                document_id = job.get("document_id") if job else None
                extraction_result_id = job.get("extraction_result_id") if job else None
                user_id = job.get("user_id") if job else None
            
            safe_print(f"[SEND] Sending error callback for job {job_id} to {callback_url}")
            send_callback(callback_url, job_id, JOB_STATUS_FAILED, error=error_msg, document_id=document_id, extraction_result_id=extraction_result_id, user_id=user_id)
    finally:
        # Clean up temporary files
        for image_path in image_paths:
            if os.path.exists(image_path):
                try:
                    os.remove(image_path)
                    safe_print(f"[CLEANUP] Cleaned up temp file: {os.path.basename(image_path)}")
                except Exception as e:
                    safe_print(f"[WARNING] Failed to clean up temp file {image_path}: {e}")

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for Dify integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if pipeline is None:
        return {
            "status": "unhealthy", 
            "service": "OCR API",
            "error": "PaddleOCR pipeline not initialized. Check logs for initialization errors."
        }
    return {"status": "healthy", "service": "OCR API"}

@app.post("/imgOcr")
async def img_ocr(
    files: List[UploadFile] = File(...),
    groupname: Optional[str] = Query(None, description="Group name for organizing output files"),
    name: Optional[str] = Query(None, description="Base name for output files (without extension)")
):
    """
    Synchronous OCR endpoint for single or multiple image files
    Accepts form-data with key 'files' (array) and image file(s) as value(s)
    Optional query parameters: groupname, name (for saving results to upload/ocrresults/{groupname}/{name}.md)
    Returns: {"text": "combined markdown content"}
    Note: This endpoint may timeout for large images or many files. Use /imgOcr/async for long-running jobs.
    """
    # Validate that at least one file is provided
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one file is required. Use 'files' as the form-data key (array)."
        )
    
    # Validate all file extensions
    invalid_files = []
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower().lstrip('.')
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            invalid_files.append(file.filename)
    
    if invalid_files:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type(s): {', '.join(invalid_files)}. Supported formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )
    
    # Process all images
    all_markdown_texts = []
    tmp_paths = []
    
    try:
        for idx, file in enumerate(files):
            # Save uploaded file temporarily
            suffix = os.path.splitext(file.filename)[1].lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_paths.append(tmp.name)
            
            # For multiple images, append page number to name if provided
            image_name = name
            if len(files) > 1 and name:
                # Add page number to filename for multi-page documents
                name_base = Path(name).stem
                name_ext = Path(name).suffix or ".md"
                image_name = f"{name_base}_page-{idx + 1:04d}{name_ext}"
            
            # Process image with OCR
            markdown_text = ocr_single_image(tmp_paths[-1], groupname=groupname, name=image_name)
            all_markdown_texts.append(markdown_text)
        
        # Combine all markdown texts
        if len(all_markdown_texts) > 1:
            combined_markdown = "\n\n--- Page Break ---\n\n".join(all_markdown_texts)
        else:
            combined_markdown = all_markdown_texts[0]
        
        return {"text": combined_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing error: {str(e)}")
    finally:
        # Clean up temporary files
        for tmp_path in tmp_paths:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass

@app.post("/imgOcr/async")
async def img_ocr_async(
    files: List[UploadFile] = File(...),
    callback_url: Optional[str] = Query(None, description="Webhook URL to call when job completes (should point to Workflow 2's webhook trigger)"),
    document_id: Optional[str] = Query(None, description="Optional document ID to include in callback"),
    extraction_result_id: Optional[str] = Query(None, description="Optional extraction result ID to include in callback"),
    user_id: Optional[str] = Query(None, description="Optional user ID to include in callback"),
    groupname: Optional[str] = Query(None, description="Group name for organizing output files"),
    name: Optional[str] = Query(None, description="Base name for output files (without extension)")
):
    """
    Asynchronous OCR endpoint for single or multiple image files
    Accepts form-data with key 'files' (array) and image file(s) as value(s)
    Optional query parameter: callback_url for webhook notification when job completes
    Returns immediately with job_id: {"job_id": "...", "status": "pending"}
    
    Use GET /imgOcr/status/{job_id} to check job status and retrieve results.
    
    Note: All images will be processed in one job and combined results sent in a single callback.
    """
    # Validate that at least one file is provided
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one file is required. Use 'files' as the form-data key (array)."
        )
    
    # Validate all file extensions
    invalid_files = []
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower().lstrip('.')
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            invalid_files.append(file.filename)
    
    if invalid_files:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type(s): {', '.join(invalid_files)}. Supported formats: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Save uploaded files temporarily
    tmp_paths = []
    filenames = []
    for file in files:
        suffix = os.path.splitext(file.filename)[1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_paths.append(tmp.name)
            filenames.append(file.filename)
    
    # Create job entry
    with job_lock:
        job_storage[job_id] = {
            "status": JOB_STATUS_PENDING,
            "created_at": datetime.now().isoformat(),
            "filename": ", ".join(filenames) if len(filenames) > 1 else filenames[0],
            "num_files": len(files),
            "callback_url": callback_url,
            "document_id": document_id,
            "extraction_result_id": extraction_result_id,
            "user_id": user_id,
            "groupname": groupname,
            "name": name,
            "image_paths": tmp_paths
        }
    
    # Start background processing thread
    thread = threading.Thread(target=process_ocr_job, args=(job_id, tmp_paths), daemon=True)
    thread.start()
    safe_print(f"[START] Started background thread for job {job_id} ({len(files)} file(s), thread: {thread.name})")
    
    return {
        "job_id": job_id,
        "status": JOB_STATUS_PENDING,
        "num_files": len(files),
        "message": f"OCR job submitted for {len(files)} file(s). Use GET /imgOcr/status/{job_id} to check status."
    }

@app.get("/imgOcr/status/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status of an OCR job
    Returns: {
        "job_id": "...",
        "status": "pending|processing|completed|failed",
        "text": "..." (if completed),
        "error": "..." (if failed),
        "created_at": "...",
        "completed_at": "..." (if completed)
    }
    """
    with job_lock:
        job = job_storage.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    response = {
        "job_id": job_id,
        "status": job["status"],
        "created_at": job["created_at"]
    }
    
    if job["status"] == JOB_STATUS_COMPLETED:
        response["text"] = job.get("text", "")
        response["completed_at"] = job.get("completed_at")
    elif job["status"] == JOB_STATUS_FAILED:
        response["error"] = job.get("error", "Unknown error")
        response["failed_at"] = job.get("failed_at")
    elif job["status"] == JOB_STATUS_PROCESSING:
        response["started_at"] = job.get("started_at")
    
    return response

@app.delete("/imgOcr/status/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a completed or failed job from storage
    """
    with job_lock:
        if job_id not in job_storage:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job = job_storage[job_id]
        if job["status"] in [JOB_STATUS_PROCESSING, JOB_STATUS_PENDING]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete job that is still pending or processing"
            )
        
        # Clean up image file if it still exists
        image_path = job.get("image_path")
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except:
                pass
        
        del job_storage[job_id]
    
    return {"message": "Job deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    safe_print("Starting OCR API server...")
    safe_print("Synchronous endpoint: POST http://localhost:8000/imgOcr")
    safe_print("Asynchronous endpoint: POST http://localhost:8000/imgOcr/async")
    safe_print("Status endpoint: GET http://localhost:8000/imgOcr/status/{job_id}")
    safe_print("Health check: GET http://localhost:8000/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)
