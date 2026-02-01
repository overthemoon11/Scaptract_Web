#!/usr/bin/env python3
"""
Test script for RapidOCR
Tests OCR extraction on a local image file
"""

from rapidocr import RapidOCR
import os
from pathlib import Path

def test_rapidocr():
    try:
        print('🚀 Initializing RapidOCR engine...')
        engine = RapidOCR()

        # Get the project root directory (assuming script is in server/scripts/)
        script_dir = Path(__file__).parent
        project_root = script_dir.parent.parent
        
        # Use the local image file
        image_path = project_root / 'server' / 'uploads' / 'documents' / 'files-1765922002262-857008139.jpg'
        
        # Convert to absolute path
        image_path = image_path.resolve()

        print(f'📸 Processing image: {image_path}')

        # Check if file exists
        if not os.path.exists(image_path):
            print(f'❌ Image file not found: {image_path}')
            return

        # Run OCR
        print('⏳ Running OCR...')
        result = engine(str(image_path))

        print('\n✅ OCR Result:')
        print('=' * 80)
        print(result)
        print('=' * 80)

        # Extract text from result
        if result and isinstance(result, list) and len(result) > 0:
            # Result format: [[box, text, confidence], ...]
            extracted_texts = []
            confidences = []
            
            for item in result:
                if isinstance(item, list) and len(item) >= 3:
                    box = item[0]  # Bounding box coordinates
                    text = item[1]  # Extracted text
                    confidence = item[2]  # Confidence score
                    
                    extracted_texts.append(text)
                    confidences.append(confidence)
                    
                    print(f'\n📝 Text: "{text}"')
                    print(f'   Confidence: {confidence:.4f}')
                    print(f'   Box: {box}')

            # Combine all text
            full_text = '\n'.join(extracted_texts)
            
            print('\n' + '-' * 80)
            print('📄 Full Extracted Text:')
            print('-' * 80)
            print(full_text)
            print('-' * 80)
            print(f'\nTotal lines: {len(extracted_texts)}')
            print(f'Total characters: {len(full_text)}')
            if confidences:
                avg_confidence = sum(confidences) / len(confidences)
                print(f'Average confidence: {avg_confidence:.4f}')

        # Save visualization
        output_dir = project_root / 'server' / 'uploads' / 'documents'
        output_path = output_dir / 'rapidocr-vis-result.jpg'
        
        print(f'\n💾 Saving visualization to: {output_path}')
        engine.vis(str(image_path), str(output_path))
        print('✅ Visualization saved!')

    except Exception as e:
        print(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_rapidocr()

