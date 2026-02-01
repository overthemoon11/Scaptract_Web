# OCR API Setup Guide

## Overview

The OCR workflow has been updated to use dedicated OCR APIs:
- **PDF OCR API** (`pdf-ocr-api.py`) - Processes PDF files
- **Image OCR API** (`img-ocr-api.py`) - Processes image files

Both APIs save results in the proper structure:
- Markdown: `server/uploads/ocr-results/{groupname}/{name}.md`
- Images: `server/uploads/ocr-results/{groupname}/imgs/` (folder with extracted images)

## Running the OCR APIs

### 1. Image OCR API (Port 8001)

```bash
cd python
python img-ocr-api.py
```

Or using uvicorn directly:
```bash
cd python
uvicorn img-ocr-api:app --host 0.0.0.0 --port 8001
```

### 2. PDF OCR API (Port 8002)

```bash
cd python
python pdf-ocr-api.py
```

Or using uvicorn directly:
```bash
cd python
uvicorn pdf-ocr-api:app --host 0.0.0.0 --port 8002
```

## Environment Variables

Add these to your `.env` file (optional - defaults shown):

```env
# Image OCR API URL (default: http://localhost:8001)
IMG_OCR_API_URL=http://localhost:8001

# PDF OCR API URL (default: http://localhost:8002)
PDF_OCR_API_URL=http://localhost:8002
```

## API Endpoints

### Image OCR API

**Endpoint**: `POST http://localhost:8001/imgOcr`

**Parameters**:
- `file`: Image file (multipart/form-data)
- `groupname`: Group name for organizing output files (query parameter)
- `name`: Base name for output files without extension (query parameter)

**Example**:
```bash
curl -X POST "http://localhost:8001/imgOcr?groupname=my-group&name=document" \
  -F "file=@image.jpg"
```

**Response**:
```json
{
  "success": true,
  "message": "Image processed successfully",
  "markdown_path": "server/uploads/ocr-results/my-group/document.md",
  "images_path": "server/uploads/ocr-results/my-group/imgs"
}
```

### PDF OCR API

**Endpoint**: `POST http://localhost:8002/pdfOcr`

**Parameters**:
- `file`: PDF file (multipart/form-data)
- `groupname`: Group name for organizing output files (query parameter)
- `name`: Base name for output files without extension (query parameter)

**Example**:
```bash
curl -X POST "http://localhost:8002/pdfOcr?groupname=my-group&name=document" \
  -F "file=@document.pdf"
```

**Response**:
```json
{
  "success": true,
  "message": "PDF processed successfully",
  "markdown_path": "server/uploads/ocr-results/my-group/document.md",
  "images_path": "server/uploads/ocr-results/my-group/imgs"
}
```

## Workflow

1. User uploads PDF or image files
2. `start-extraction.ts` endpoint is called
3. File type is determined (PDF or image)
4. File is downloaded and sent to appropriate OCR API:
   - PDF → `pdf-ocr-api.py` (port 8002)
   - Image → `img-ocr-api.py` (port 8001)
5. OCR API processes file and saves:
   - Markdown to: `server/uploads/ocr-results/{groupname}/{name}.md`
   - Images to: `server/uploads/ocr-results/{groupname}/imgs/`
6. Extraction result status is updated to `completed`

## Output Structure

```
server/uploads/ocr-results/
└── {groupname}/
    ├── {name}.md          # Markdown file with extracted text
    └── imgs/              # Folder containing extracted images
        ├── img_in_table_box_xxx.jpg
        └── img_in_image_box_xxx.jpg
```

## Notes

- Both APIs use `PPStructureV3` from PaddleOCR
- Images are extracted and saved separately in the `imgs/` folder
- Markdown files contain the full OCR text with references to images
- The APIs process files synchronously (may take time for large files)
- For production, consider running these APIs as separate services with proper process management
