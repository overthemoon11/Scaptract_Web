"""
Quick script to convert PPStructureV3 markdown output to JSON
Usage: py convert_ocr_markdown_to_json.py <input.md> [output.json]
"""

import sys
import os
from markdown_to_json_converter import convert_file_to_json, print_json_summary

def main():
    if len(sys.argv) < 2:
        print("Usage: python convert_ocr_markdown_to_json.py <input.md> [output.json]")
        print("\nExamples:")
        print("  python convert_ocr_markdown_to_json.py output/two_column_paper_page-0001.md")
        print("  python convert_ocr_markdown_to_json.py output/two_column_paper_page-0001.md output.json")
        print("\nIf output file not specified, will use input filename with .json extension")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    # Generate output filename if not provided
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        base_name = os.path.splitext(input_file)[0]
        output_file = f"{base_name}.json"
    
    print(f"Converting: {input_file}")
    print(f"Output: {output_file}\n")
    
    # Convert
    json_data = convert_file_to_json(input_file, output_file)
    
    # Print summary
    if json_data:
        print_json_summary(json_data)
        print(f"Conversion complete! JSON saved to: {output_file}")
    else:
        print("Conversion failed. Check error messages above.")

if __name__ == "__main__":
    main()
