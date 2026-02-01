from paddleocr import PaddleOCR
import os

# Initialize the PaddleOCR model (this downloads the models on the first run)
# You can specify language, use_gpu, etc.
ocr = PaddleOCR(use_angle_cls=True, lang="en") 

# Define your image inputs: can be file paths or NumPy arrays
image_paths = [
    'sample_paper/171198_page-0001.jpg',
    'sample_paper/171198_page-0002.jpg',
    'sample_paper/171198_page-0003.jpg',
    'sample_paper/171198_page-0004.jpg',
    'sample_paper/171198_page-0005.jpg',
    'sample_paper/171198_page-0006.jpg',
    'sample_paper/171198_page-0007.jpg',
    'sample_paper/171198_page-0008.jpg',
    'sample_paper/171198_page-0009.jpg',
    'sample_paper/171198_page-0010.jpg',
    'sample_paper/171198_page-0011.jpg',
]

# The ocr() method accepts a list of inputs and returns a list of results
# Each element in the outer list corresponds to the result for one input image
#results = ocr.ocr(image_paths, cls=True)
results = ocr.ocr(image_paths)

# Process and display the results
for i, result in enumerate(results):
    print(f"--- Results for Image {i+1} ---")
    if result:
        for line in result:
            # line structure is [box, (text, confidence)]
            print(f"Text: {line[1][0]}, Confidence: {line[1][1]:.2f}")
    else:
        print("No text detected.")
