"""
Automatic OCR Accuracy Evaluation Script
Scans the evaluation/ directory and calculates accuracy for all PDF and Image inputs.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
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
            if len(line) < 200 and '@' not in line and 'University' not in line:
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


def extract_fields_from_plain_text(text: str) -> Dict[str, Optional[str]]:
    """Extract fields from plain text ground truth (similar to markdown extraction)"""
    lines = text.strip().split('\n')
    
    # Extract title (first non-empty line)
    title = None
    for line in lines:
        line = line.strip()
        if line and len(line) < 200 and '@' not in line and 'University' not in line:
            title = line
            break
    
    # Extract author (line after title, often in caps or with email)
    author = None
    found_title = False
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        if line == title:
            found_title = True
            continue
        if found_title:
            if line.isupper() and len(line) > 5 and len(line) < 200:
                author = line
                break
            if '@' in line:
                author = line
                break
            if any(keyword in line for keyword in ['University', 'Institute', 'College', 'Lab']):
                author = line
                break
    
    # Extract Abstract (usually the paragraph after author, before numbered sections)
    abstract = None
    abstract_started = False
    abstract_lines = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        # Skip title and author
        if line == title or line == author:
            continue
        # Check if we've hit a numbered section (Introduction starts)
        if re.match(r'^\d+\.', line):
            break
        # Collect abstract content
        if len(line) > 50:  # Likely abstract paragraph
            abstract_lines.append(line)
    
    if abstract_lines:
        abstract = ' '.join(abstract_lines)
    
    # Extract Introduction (section starting with "1." or similar)
    introduction = None
    intro_started = False
    intro_lines = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        # Check for introduction start (numbered section 1 or 2)
        if re.match(r'^[12]\.', line) and ('introduction' in line.lower() or 'what is' in line.lower() or 'context' in line.lower()):
            intro_started = True
            intro_lines.append(line)
            continue
        if intro_started:
            # Stop at conclusion or next major section
            if re.match(r'^[45]\.', line) and 'conclusion' in line.lower():
                break
            intro_lines.append(line)
    
    if intro_lines:
        introduction = '\n'.join(intro_lines)
    
    # Extract Conclusion (section starting with "5. Conclusion" or similar)
    conclusion = None
    concl_started = False
    concl_lines = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        # Check for conclusion start
        if re.match(r'^[45]\.', line) and 'conclusion' in line.lower():
            concl_started = True
            concl_lines.append(line)
            continue
        if concl_started:
            # Stop at acknowledgements or references
            if 'acknowledgement' in line.lower() or 'reference' in line.lower():
                break
            concl_lines.append(line)
    
    if concl_lines:
        conclusion = '\n'.join(concl_lines)
    
    return {
        'Title': title,
        'Author': author,
        'Abstract': abstract,
        'Introduction': introduction,
        'Conclusion': conclusion,
    }


def load_ground_truth(gt_path: str) -> Dict[str, str]:
    """
    Load ground truth from file.
    Supports:
    - Plain text file (extracts fields automatically)
    - JSON file with field structure: {"Title": "...", "Author": "...", etc.}
    """
    if not os.path.exists(gt_path):
        raise FileNotFoundError(f"Ground truth file not found: {gt_path}")
    
    with open(gt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try to parse as JSON first
    try:
        import json
        gt_data = json.loads(content)
        if isinstance(gt_data, dict):
            return gt_data
    except json.JSONDecodeError:
        pass
    
    # If not JSON, extract fields from plain text
    fields = extract_fields_from_plain_text(content)
    # Also include full content for overall accuracy calculation
    fields['Content'] = content
    return fields


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


def find_all_evaluation_files(evaluation_dir: str) -> List[Dict]:
    """
    Find all ground truth files and their matching PDF/Image OCR outputs.
    Returns list of file pairs to evaluate.
    """
    evaluation_path = Path(evaluation_dir)
    if not evaluation_path.exists():
        raise FileNotFoundError(f"Evaluation directory not found: {evaluation_dir}")
    
    # Find all ground truth files (.txt)
    gt_files = {}
    for txt_file in evaluation_path.glob('*.txt'):
        base_name = txt_file.stem  # e.g., "2302.12854v2"
        gt_files[base_name] = str(txt_file)
    
    # Find matching PDF and Image OCR files
    file_pairs = []
    
    for base_name, gt_path in gt_files.items():
        pdf_file = evaluation_path / f"{base_name}_pdf.md"
        img_file = evaluation_path / f"{base_name}_img.md"
        
        if pdf_file.exists():
            file_pairs.append({
                'ground_truth': gt_path,
                'ocr_markdown': str(pdf_file),
                'input_type': 'PDF'
            })
        
        if img_file.exists():
            file_pairs.append({
                'ground_truth': gt_path,
                'ocr_markdown': str(img_file),
                'input_type': 'Image'
            })
    
    return file_pairs


def print_evaluation_report(results: List[Dict]):
    """Print formatted evaluation report in the requested format"""
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


def main():
    """
    Main function - automatically processes all files in evaluation/ directory.
    """
    # Get the evaluation directory (same directory as this script)
    script_dir = Path(__file__).parent.resolve()
    evaluation_dir = script_dir / "evaluation"
    
    if not evaluation_dir.exists():
        print(f"Error: Evaluation directory not found: {evaluation_dir}")
        print("Please create the directory and add your files:")
        print("  - {document_name}.txt (ground truth)")
        print("  - {document_name}_pdf.md (PDF OCR output)")
        print("  - {document_name}_img.md (Image OCR output)")
        return
    
    print(f"Scanning evaluation directory: {evaluation_dir}")
    print("Looking for file pairs...\n")
    
    # Find all file pairs
    file_pairs = find_all_evaluation_files(str(evaluation_dir))
    
    if not file_pairs:
        print("No matching files found!")
        print("\nExpected file structure:")
        print("  evaluation/")
        print("    - 2302.12854v2.txt (ground truth)")
        print("    - 2302.12854v2_pdf.md (PDF OCR)")
        print("    - 2302.12854v2_img.md (Image OCR)")
        return
    
    print(f"Found {len(file_pairs)} file pairs to evaluate:\n")
    for pair in file_pairs:
        print(f"  {pair['input_type']}: {os.path.basename(pair['ground_truth'])} -> {os.path.basename(pair['ocr_markdown'])}")
    print()
    
    # Evaluate all pairs
    results = []
    for pair in file_pairs:
        try:
            print(f"Evaluating {pair['input_type']}: {os.path.basename(pair['ocr_markdown'])}...")
            result = evaluate_document(
                pair['ground_truth'],
                pair['ocr_markdown'],
                pair['input_type']
            )
            results.append(result)
        except Exception as e:
            print(f"  Error: {e}")
            continue
    
    if results:
        print_evaluation_report(results)
    else:
        print("No results to display.")


if __name__ == "__main__":
    main()
