"""
OCR Accuracy Evaluation Script
Calculates OCR accuracy metrics for PDF and Image inputs:
- Character-level accuracy
- Word-level accuracy
- Field-level extraction accuracy (Title, Author, Abstract, Introduction, Conclusion)
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from difflib import SequenceMatcher
from calculate_ocr_accuracy import (
    calculate_character_accuracy,
    calculate_word_accuracy,
    normalize_text
)


def extract_title_from_markdown(markdown: str) -> Optional[str]:
    """Extract title from markdown (usually first # header or first line)"""
    lines = markdown.strip().split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Check for markdown header
        if line.startswith('#'):
            # Remove # symbols and return
            title = re.sub(r'^#+\s*', '', line).strip()
            if title:
                return title
        # If first non-empty line doesn't start with #, it might be the title
        elif len([l for l in lines if l.strip()]) > 0:
            # Check if it looks like a title (not too long, not author info)
            if len(line) < 200 and not '@' in line and not 'University' in line:
                return line
    return None


def extract_author_from_markdown(markdown: str) -> Optional[str]:
    """Extract author from markdown (usually after title, often in caps or with email)"""
    lines = markdown.strip().split('\n')
    found_title = False
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        # Skip title
        if line.startswith('#') or (i == 0 and len(line) < 200):
            found_title = True
            continue
        
        # Look for author patterns
        if found_title:
            # Pattern 1: All caps line (common for author names)
            if line.isupper() and len(line) > 5 and len(line) < 200:
                return line
            # Pattern 2: Contains email
            if '@' in line:
                return line
            # Pattern 3: Contains "University" or similar
            if any(keyword in line for keyword in ['University', 'Institute', 'College', 'Lab']):
                return line
            # Pattern 4: Name pattern (capitalized words)
            if re.match(r'^[A-Z][a-z]+ [A-Z]', line) and len(line) < 200:
                return line
    
    return None


def extract_section_from_markdown(markdown: str, section_name: str) -> Optional[str]:
    """Extract a specific section (Abstract, Introduction, Conclusion) from markdown"""
    # Normalize section name for matching
    section_lower = section_name.lower()
    
    # Patterns to match section headers
    patterns = [
        rf'^#+\s*{section_name}',
        rf'^#+\s*\d+\.?\s*{section_name}',
        rf'^#+\s*{section_name}',
        rf'###\s*\d+\.?\s*{section_name}',
        rf'##\s*{section_name}',
    ]
    
    lines = markdown.split('\n')
    in_section = False
    section_content = []
    current_header_level = None
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Check if this line is a header matching our section
        if not in_section:
            for pattern in patterns:
                if re.match(pattern, stripped, re.IGNORECASE):
                    in_section = True
                    # Get header level
                    if stripped.startswith('#'):
                        current_header_level = len(stripped) - len(stripped.lstrip('#'))
                    break
        else:
            # Check if we've hit another header at same or higher level
            if stripped.startswith('#'):
                header_level = len(stripped) - len(stripped.lstrip('#'))
                if current_header_level and header_level <= current_header_level:
                    # End of section
                    break
            
            # Collect content
            if stripped:
                section_content.append(stripped)
    
    if section_content:
        return '\n'.join(section_content)
    
    return None


def extract_fields_from_markdown(markdown: str) -> Dict[str, Optional[str]]:
    """Extract all fields from markdown"""
    return {
        'Title': extract_title_from_markdown(markdown),
        'Author': extract_author_from_markdown(markdown),
        'Abstract': extract_section_from_markdown(markdown, 'Abstract'),
        'Introduction': extract_section_from_markdown(markdown, 'Introduction'),
        'Conclusion': extract_section_from_markdown(markdown, 'Conclusion'),
    }


def load_ground_truth(gt_path: str) -> Dict[str, str]:
    """
    Load ground truth from file.
    Supports:
    - Plain text file (all content as one field)
    - JSON file with field structure: {"Title": "...", "Author": "...", etc.}
    """
    if not os.path.exists(gt_path):
        raise FileNotFoundError(f"Ground truth file not found: {gt_path}")
    
    with open(gt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try to parse as JSON first
    try:
        gt_data = json.loads(content)
        if isinstance(gt_data, dict):
            return gt_data
    except json.JSONDecodeError:
        pass
    
    # If not JSON, treat as plain text
    # Try to extract fields from plain text if it has structure
    # Otherwise, return as single "Content" field
    return {'Content': content}


def calculate_field_accuracy(gt_field: str, ocr_field: Optional[str]) -> Tuple[float, bool]:
    """
    Calculate accuracy for a specific field.
    Returns: (accuracy_percentage, was_extracted)
    """
    if not ocr_field:
        return 0.0, False
    
    if not gt_field:
        return 0.0, False
    
    # Calculate character-level accuracy for the field
    accuracy, _, _, _ = calculate_character_accuracy(gt_field, ocr_field)
    return accuracy, True


def evaluate_document(
    ground_truth_path: str,
    ocr_markdown_path: str,
    input_type: str = "PDF"  # "PDF" or "Image"
) -> Dict:
    """
    Evaluate OCR accuracy for a single document.
    
    Args:
        ground_truth_path: Path to ground truth file
        ocr_markdown_path: Path to OCR markdown output
        input_type: "PDF" or "Image"
    
    Returns:
        Dictionary with evaluation results
    """
    # Load ground truth
    gt_fields = load_ground_truth(ground_truth_path)
    
    # Load OCR markdown
    if not os.path.exists(ocr_markdown_path):
        raise FileNotFoundError(f"OCR markdown file not found: {ocr_markdown_path}")
    
    with open(ocr_markdown_path, 'r', encoding='utf-8') as f:
        ocr_markdown = f.read()
    
    # Extract fields from OCR markdown
    ocr_fields = extract_fields_from_markdown(ocr_markdown)
    
    # Get full text for overall accuracy
    gt_full_text = gt_fields.get('Content', '')
    if not gt_full_text:
        # Combine all fields if no "Content" field
        gt_full_text = ' '.join([v for v in gt_fields.values() if v])
    
    ocr_full_text = ocr_markdown
    
    # Calculate overall OCR accuracy
    char_accuracy, correct_chars, total_chars, char_errors = calculate_character_accuracy(
        gt_full_text, ocr_full_text
    )
    word_accuracy, correct_words, total_words, word_errors = calculate_word_accuracy(
        gt_full_text, ocr_full_text
    )
    
    # Calculate field-level accuracy
    field_results = {}
    field_names = ['Title', 'Author', 'Abstract', 'Introduction', 'Conclusion']
    
    for field_name in field_names:
        gt_field = gt_fields.get(field_name, '')
        ocr_field = ocr_fields.get(field_name)
        
        if gt_field:
            accuracy, extracted = calculate_field_accuracy(gt_field, ocr_field)
            field_results[field_name] = {
                'accuracy': round(accuracy, 2),
                'extracted': extracted,
                'ground_truth_length': len(gt_field),
                'ocr_length': len(ocr_field) if ocr_field else 0
            }
        else:
            field_results[field_name] = {
                'accuracy': None,
                'extracted': ocr_field is not None,
                'ground_truth_length': 0,
                'ocr_length': len(ocr_field) if ocr_field else 0
            }
    
    return {
        'input_type': input_type,
        'ground_truth_file': os.path.basename(ground_truth_path),
        'ocr_file': os.path.basename(ocr_markdown_path),
        'overall': {
            'character_level': {
                'accuracy': round(char_accuracy, 2),
                'correct': correct_chars,
                'total': total_chars,
                'errors': char_errors
            },
            'word_level': {
                'accuracy': round(word_accuracy, 2),
                'correct': correct_words,
                'total': total_words,
                'errors': word_errors
            }
        },
        'field_level': field_results
    }


def print_evaluation_report(results: List[Dict]):
    """Print formatted evaluation report"""
    print("\n" + "="*80)
    print("OCR ACCURACY EVALUATION REPORT")
    print("="*80 + "\n")
    
    # Separate PDF and Image results
    pdf_results = [r for r in results if r['input_type'] == 'PDF']
    image_results = [r for r in results if r['input_type'] == 'Image']
    
    # PDF Input Evaluation
    if pdf_results:
        print("Evaluation - PDF Input")
        print("-" * 80)
        
        # Calculate averages
        avg_char_acc = sum(r['overall']['character_level']['accuracy'] for r in pdf_results) / len(pdf_results)
        avg_word_acc = sum(r['overall']['word_level']['accuracy'] for r in pdf_results) / len(pdf_results)
        
        print("OCR Accuracy")
        print(f"  - Character-level: {avg_char_acc:.2f}%")
        print(f"  - Word-level:      {avg_word_acc:.2f}%")
        print()
        
        # Field-level averages
        field_names = ['Title', 'Author', 'Abstract', 'Introduction', 'Conclusion']
        print("Field-level Extraction Accuracy")
        
        for field_name in field_names:
            field_accs = []
            for r in pdf_results:
                field_data = r['field_level'].get(field_name, {})
                if field_data.get('accuracy') is not None:
                    field_accs.append(field_data['accuracy'])
            
            if field_accs:
                avg_field_acc = sum(field_accs) / len(field_accs)
                print(f"  - {field_name}: {avg_field_acc:.2f}%")
            else:
                print(f"  - {field_name}: N/A")
        print()
    
    # Image Input Evaluation
    if image_results:
        print("Evaluation - Image Input")
        print("-" * 80)
        
        # Calculate averages
        avg_char_acc = sum(r['overall']['character_level']['accuracy'] for r in image_results) / len(image_results)
        avg_word_acc = sum(r['overall']['word_level']['accuracy'] for r in image_results) / len(image_results)
        
        print("OCR Accuracy")
        print(f"  - Character-level: {avg_char_acc:.2f}%")
        print(f"  - Word-level:      {avg_word_acc:.2f}%")
        print()
        
        # Field-level averages
        field_names = ['Title', 'Author', 'Abstract', 'Introduction', 'Conclusion']
        print("Field-level Extraction Accuracy")
        
        for field_name in field_names:
            field_accs = []
            for r in image_results:
                field_data = r['field_level'].get(field_name, {})
                if field_data.get('accuracy') is not None:
                    field_accs.append(field_data['accuracy'])
            
            if field_accs:
                avg_field_acc = sum(field_accs) / len(field_accs)
                print(f"  - {field_name}: {avg_field_acc:.2f}%")
            else:
                print(f"  - {field_name}: N/A")
        print()
    
    # Detailed results per document
    print("\n" + "="*80)
    print("DETAILED RESULTS BY DOCUMENT")
    print("="*80 + "\n")
    
    for result in results:
        print(f"Document: {result['ocr_file']} ({result['input_type']})")
        print(f"  Character-level: {result['overall']['character_level']['accuracy']:.2f}%")
        print(f"  Word-level:      {result['overall']['word_level']['accuracy']:.2f}%")
        print("  Field-level:")
        for field_name in ['Title', 'Author', 'Abstract', 'Introduction', 'Conclusion']:
            field_data = result['field_level'].get(field_name, {})
            if field_data.get('accuracy') is not None:
                extracted = "✓" if field_data['extracted'] else "✗"
                print(f"    - {field_name}: {field_data['accuracy']:.2f}% {extracted}")
            else:
                extracted = "✓" if field_data['extracted'] else "✗"
                print(f"    - {field_name}: N/A {extracted}")
        print()


def main():
    """
    Main function to run evaluation.
    Configure your file paths here or pass as command-line arguments.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='Evaluate OCR accuracy')
    parser.add_argument('--gt-dir', type=str, help='Directory containing ground truth files')
    parser.add_argument('--pdf-dir', type=str, help='Directory containing PDF OCR markdown files')
    parser.add_argument('--image-dir', type=str, help='Directory containing Image OCR markdown files')
    parser.add_argument('--gt-file', type=str, help='Single ground truth file')
    parser.add_argument('--ocr-file', type=str, help='Single OCR markdown file')
    parser.add_argument('--input-type', type=str, choices=['PDF', 'Image'], help='Input type for single file evaluation')
    parser.add_argument('--config', type=str, help='JSON config file with file pairs')
    
    args = parser.parse_args()
    
    results = []
    
    # Single file evaluation
    if args.gt_file and args.ocr_file:
        result = evaluate_document(args.gt_file, args.ocr_file, args.input_type or 'PDF')
        results.append(result)
    
    # Config file evaluation
    elif args.config:
        with open(args.config, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        for item in config:
            gt_path = item['ground_truth']
            ocr_path = item['ocr_markdown']
            input_type = item.get('input_type', 'PDF')
            result = evaluate_document(gt_path, ocr_path, input_type)
            results.append(result)
    
    # Directory-based evaluation (auto-match files)
    elif args.gt_dir and (args.pdf_dir or args.image_dir):
        gt_files = {}
        for file in os.listdir(args.gt_dir):
            if file.endswith(('.txt', '.json')):
                base_name = os.path.splitext(file)[0]
                gt_files[base_name] = os.path.join(args.gt_dir, file)
        
        # PDF files
        if args.pdf_dir:
            for file in os.listdir(args.pdf_dir):
                if file.endswith('.md'):
                    base_name = os.path.splitext(file)[0]
                    if base_name in gt_files:
                        result = evaluate_document(gt_files[base_name], 
                                                  os.path.join(args.pdf_dir, file), 
                                                  'PDF')
                        results.append(result)
        
        # Image files
        if args.image_dir:
            for file in os.listdir(args.image_dir):
                if file.endswith('.md'):
                    base_name = os.path.splitext(file)[0]
                    # Try to match (might have _page-0001_0 suffix)
                    matched = False
                    for gt_base in gt_files.keys():
                        if base_name.startswith(gt_base) or gt_base in base_name:
                            result = evaluate_document(gt_files[gt_base], 
                                                      os.path.join(args.image_dir, file), 
                                                      'Image')
                            results.append(result)
                            matched = True
                            break
                    if not matched and base_name in gt_files:
                        result = evaluate_document(gt_files[base_name], 
                                                  os.path.join(args.image_dir, file), 
                                                  'Image')
                        results.append(result)
    
    else:
        print("Usage examples:")
        print("  Single file:")
        print("    python evaluate_ocr_accuracy.py --gt-file ground_truth.txt --ocr-file ocr_output.md --input-type PDF")
        print()
        print("  Config file:")
        print("    python evaluate_ocr_accuracy.py --config evaluation_config.json")
        print()
        print("  Directory-based:")
        print("    python evaluate_ocr_accuracy.py --gt-dir ground_truth/ --pdf-dir pdf_output/ --image-dir image_output/")
        print()
        print("Config file format (JSON):")
        print("""
        [
          {
            "ground_truth": "path/to/ground_truth.txt",
            "ocr_markdown": "path/to/pdf_output.md",
            "input_type": "PDF"
          },
          {
            "ground_truth": "path/to/ground_truth.txt",
            "ocr_markdown": "path/to/image_output.md",
            "input_type": "Image"
          }
        ]
        """)
        return
    
    if results:
        print_evaluation_report(results)
    else:
        print("No results to display. Check your file paths and configuration.")


if __name__ == "__main__":
    main()
