#!/usr/bin/env python3
"""
Convert PDF to images using pdf2image (similar to the working Colab code)
Called from Node.js to convert PDF pages to images for OCR processing
"""

import sys
import json
import os
os.environ['POPPLER_PATH'] = r'D:\Poppler\poppler-25.12.0\Library\bin'
from pdf2image import convert_from_path
from PIL import Image
import io
import base64

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "PDF file path required"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)
    
    try:
        PDF_DPI = 200
        MAX_PAGES = 50
        
        # Poppler path - explicitly set for Windows
        # Check environment variable first, then try common locations
        poppler_path = os.environ.get('POPPLER_PATH')
        
        if not poppler_path:
            # Try common Windows locations
            possible_paths = [
                r'D:\Poppler\poppler-25.12.0\Library\bin',
                r'C:\Poppler\poppler-25.12.0\Library\bin',
                r'C:\Program Files\poppler\bin',
            ]
            for ppath in possible_paths:
                if os.path.exists(ppath):
                    pdftoppm = os.path.join(ppath, 'pdftoppm.exe')
                    if os.path.exists(pdftoppm):
                        poppler_path = ppath
                        break
        
        if not poppler_path:
            raise Exception("Poppler not found. Please set POPPLER_PATH environment variable or install Poppler at D:\\Poppler\\poppler-25.12.0\\Library\\bin")
        
        # Convert PDF to images (similar to your Colab code)
        # Explicitly pass poppler_path for Windows compatibility
        pdf_pages = convert_from_path(
            pdf_path,
            dpi=PDF_DPI,
            first_page=1,
            last_page=MAX_PAGES,
            poppler_path=poppler_path
        )
        
        # Get the directory where we'll save images
        pdf_dir = os.path.dirname(pdf_path)
        pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
        output_dir = os.path.join(pdf_dir, f"temp_pdf_pages_{pdf_name}")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        image_paths = []
        
        for i, page in enumerate(pdf_pages, start=1):
            # Save page as PNG
            image_filename = f"page_{i}.png"
            image_path = os.path.join(output_dir, image_filename)
            page.save(image_path, 'PNG')
            image_paths.append(image_path)
        
        # Return JSON with image paths
        result = {
            "success": True,
            "page_count": len(image_paths),
            "image_paths": image_paths,
            "output_dir": output_dir
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()

