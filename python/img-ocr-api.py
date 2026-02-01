from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from paddleocr import PPStructureV3
import os
import sys
import io
import glob
import requests

# Set stdout encoding to UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize pipeline globally
pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        pipeline = PPStructureV3()
    return pipeline

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Image OCR API"}

@app.post("/imgOcr")
async def img_ocr(
    groupname: str = Query(..., description="Group name for organizing output files"),
    extraction_result_id: str = Query(None, description="Extraction result ID for status callback"),
    document_id: str = Query(None, description="Document ID for status callback"),
    callback_url: str = Query(None, description="Callback URL to update extraction result status")
):
    """
    Process all image files in the groupname directory with OCR
    Processes all image files in uploads/documents/{groupname}/
    Saves markdown and images using res.save_to_markdown()
    Output: server/uploads/ocr-results/{groupname}/
    """
    try:
        # Files are saved to server/uploads/documents/{groupname}/
        # project_root is python/ directory, so go up one level to get project root
        project_root = Path(__file__).parent.parent
        documents_dir = project_root / "server" / "uploads" / "documents" / groupname
        
        # Check if directory exists
        if not documents_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Directory not found: {documents_dir}"
            )
        
        allowed_extensions = ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'gif', 'webp']
        
        # Process all image files in directory (like two-column-test.py)
        image_files = []
        for ext in allowed_extensions:
            image_files.extend(glob.glob(str(documents_dir / f"*.{ext}")))
            image_files.extend(glob.glob(str(documents_dir / f"*.{ext.upper()}")))
        image_files = [Path(f) for f in image_files]
        
        if not image_files:
            raise HTTPException(
                status_code=404,
                detail=f"No image files found in: {documents_dir}"
            )
        
        # Get pipeline
        ocr_pipeline = get_pipeline()
        
        # Prepare output directory
        output_path = project_root / "server" / "uploads" / "ocr-results" / groupname
        output_path.mkdir(parents=True, exist_ok=True)
        
        processed_files = []
        
        # Process each image file (like two-column-test.py)
        for img_path in image_files:
            print(f"[INFO] Processing image: {img_path}")
            output = ocr_pipeline.predict(str(img_path))
            name_base = os.path.splitext(os.path.basename(img_path))[0]
            
            # Save markdown and images using res.save_to_markdown()
            for idx, res in enumerate(output):
                # Save with unique name like two-column-test.py: {name}_{idx}.md
                save_path = str(output_path / f"{name_base}_{idx}")
                res.save_to_json(save_path=save_path)
                res.save_to_markdown(save_path=save_path)
                print(f"[SAVE] Saved markdown and images to: {save_path}")
            
            processed_files.append(str(img_path.relative_to(project_root)))
        
        # Call callback endpoint to update extraction result status
        if callback_url and extraction_result_id:
            try:
                # Calculate relative path from project root (e.g., server/uploads/ocr-results/{groupname}/)
                # Store without leading "server/" so Node (process.cwd() = server/) doesn't double-prepend
                ocr_result_path = str(output_path.relative_to(project_root)).replace("\\", "/")
                if ocr_result_path.startswith("server/"):
                    ocr_result_path = ocr_result_path[len("server/"):]
                callback_response = requests.post(
                    callback_url,
                    json={
                        "extraction_result_id": extraction_result_id,
                        "document_id": document_id,
                        "status": "completed",
                        "ocr_result_path": ocr_result_path
                    },
                    timeout=10
                )
                if callback_response.status_code == 200:
                    print(f"[CALLBACK] Successfully updated extraction result {extraction_result_id} to 'completed'")
                else:
                    print(f"[CALLBACK] Warning: Callback returned status {callback_response.status_code}")
            except Exception as callback_error:
                print(f"[CALLBACK] Error calling callback: {callback_error}")
                # Don't fail the whole request if callback fails
        
        return {
            "success": True,
            "message": f"Processed {len(processed_files)} image file(s) successfully",
            "processed_files": processed_files,
            "output_path": str(output_path.relative_to(project_root))
        }
                    
    except Exception as e:
        import traceback
        print(f"[ERROR] {str(e)}")
        print(traceback.format_exc())
        
        # Call callback endpoint to update extraction result status to failed
        if callback_url and extraction_result_id:
            try:
                callback_response = requests.post(
                    callback_url,
                    json={
                        "extraction_result_id": extraction_result_id,
                        "document_id": document_id,
                        "status": "failed",
                        "error_message": str(e)
                    },
                    timeout=10
                )
                if callback_response.status_code == 200:
                    print(f"[CALLBACK] Updated extraction result {extraction_result_id} to 'failed'")
            except Exception as callback_error:
                print(f"[CALLBACK] Error calling callback: {callback_error}")
        
        raise HTTPException(status_code=500, detail=f"OCR processing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
