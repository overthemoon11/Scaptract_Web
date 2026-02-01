# Initialize PaddleOCR instance
from paddleocr import PaddleOCR
import os

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False)

# Process all sample paper images from 0001 to 0015
sample_paper_dir = "sample_paper"
output_dir = "output1"

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Process each image
for i in range(1, 16):
    # Format the filename with zero-padding
    filename = f"171198_pages-to-jpg-{i:04d}.jpg"
    input_path = os.path.join(sample_paper_dir, filename)
    
    if os.path.exists(input_path):
        print(f"\nProcessing {filename}...")
        
        # Run OCR inference on the image
        result = ocr.predict(input=input_path)
        
        # Visualize the results and save the JSON results
        for res in result:
            res.print()
            res.save_to_img(output_dir)
            res.save_to_json(output_dir)
        
        print(f"Completed processing {filename}")
    else:
        print(f"Warning: {input_path} not found")

print("\nAll images processed!")

