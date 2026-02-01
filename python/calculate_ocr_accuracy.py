"""
OCR Accuracy Calculator
Calculates character-level and word-level accuracy by comparing OCR output with ground truth text.
"""

import re
from typing import Tuple, List
from difflib import SequenceMatcher


def normalize_text(text: str) -> str:
    """
    Normalize text for comparison:
    - Remove extra whitespace
    - Convert to lowercase (optional - can be disabled)
    - Remove special characters (optional)
    """
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())
    # Optionally convert to lowercase (uncomment if needed)
    # text = text.lower()
    return text


def calculate_character_accuracy(ground_truth: str, ocr_output: str) -> Tuple[float, int, int, int]:
    """
    Calculate character-level accuracy.
    
    Returns:
        - accuracy: Percentage of correct characters (0-100)
        - correct_chars: Number of correct characters
        - total_chars: Total characters in ground truth
        - errors: Number of character errors
    """
    # Normalize texts
    gt_normalized = normalize_text(ground_truth)
    ocr_normalized = normalize_text(ocr_output)
    
    # Use SequenceMatcher for character-level comparison
    matcher = SequenceMatcher(None, gt_normalized, ocr_normalized)
    
    # Calculate matches
    matches = matcher.matching_blocks()
    correct_chars = sum(block.size for block in matches)
    total_chars = len(gt_normalized)
    
    # Calculate errors (insertions, deletions, substitutions)
    errors = total_chars - correct_chars
    
    # Calculate accuracy
    if total_chars == 0:
        accuracy = 0.0
    else:
        accuracy = (correct_chars / total_chars) * 100
    
    return accuracy, correct_chars, total_chars, errors


def calculate_word_accuracy(ground_truth: str, ocr_output: str) -> Tuple[float, int, int, int]:
    """
    Calculate word-level accuracy.
    
    Returns:
        - accuracy: Percentage of correct words (0-100)
        - correct_words: Number of correct words
        - total_words: Total words in ground truth
        - errors: Number of word errors
    """
    # Normalize and split into words
    gt_words = normalize_text(ground_truth).split()
    ocr_words = normalize_text(ocr_output).split()
    
    # Use SequenceMatcher for word-level comparison
    matcher = SequenceMatcher(None, gt_words, ocr_words)
    
    # Calculate matches
    matches = matcher.matching_blocks()
    correct_words = sum(block.size for block in matches)
    total_words = len(gt_words)
    
    # Calculate errors
    errors = total_words - correct_words
    
    # Calculate accuracy
    if total_words == 0:
        accuracy = 0.0
    else:
        accuracy = (correct_words / total_words) * 100
    
    return accuracy, correct_words, total_words, errors


def calculate_levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate Levenshtein distance (edit distance) between two strings.
    Useful for understanding the minimum number of edits needed.
    """
    if len(s1) < len(s2):
        return calculate_levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def detailed_accuracy_report(ground_truth: str, ocr_output: str) -> dict:
    """
    Generate a detailed accuracy report with multiple metrics.
    """
    # Character-level metrics
    char_accuracy, correct_chars, total_chars, char_errors = calculate_character_accuracy(
        ground_truth, ocr_output
    )
    
    # Word-level metrics
    word_accuracy, correct_words, total_words, word_errors = calculate_word_accuracy(
        ground_truth, ocr_output
    )
    
    # Levenshtein distance
    gt_normalized = normalize_text(ground_truth)
    ocr_normalized = normalize_text(ocr_output)
    edit_distance = calculate_levenshtein_distance(gt_normalized, ocr_normalized)
    
    # Error rate
    char_error_rate = (char_errors / total_chars * 100) if total_chars > 0 else 0
    word_error_rate = (word_errors / total_words * 100) if total_words > 0 else 0
    
    return {
        'character_level': {
            'accuracy': round(char_accuracy, 2),
            'correct': correct_chars,
            'total': total_chars,
            'errors': char_errors,
            'error_rate': round(char_error_rate, 2)
        },
        'word_level': {
            'accuracy': round(word_accuracy, 2),
            'correct': correct_words,
            'total': total_words,
            'errors': word_errors,
            'error_rate': round(word_error_rate, 2)
        },
        'edit_distance': edit_distance,
        'ground_truth_length': len(gt_normalized),
        'ocr_output_length': len(ocr_normalized)
    }


def compare_files(ground_truth_file: str, ocr_output_file: str) -> dict:
    """
    Compare OCR output with ground truth from files.
    """
    try:
        with open(ground_truth_file, 'r', encoding='utf-8') as f:
            ground_truth = f.read()
    except FileNotFoundError:
        print(f"Error: Ground truth file '{ground_truth_file}' not found.")
        return None
    
    try:
        with open(ocr_output_file, 'r', encoding='utf-8') as f:
            ocr_output = f.read()
    except FileNotFoundError:
        print(f"Error: OCR output file '{ocr_output_file}' not found.")
        return None
    
    return detailed_accuracy_report(ground_truth, ocr_output)


def print_report(report: dict, document_name: str = "Document"):
    """
    Print a formatted accuracy report.
    """
    print(f"\n{'='*60}")
    print(f"OCR Accuracy Report: {document_name}")
    print(f"{'='*60}\n")
    
    # Character-level
    char = report['character_level']
    print("CHARACTER-LEVEL METRICS:")
    print(f"  Accuracy:     {char['accuracy']:.2f}%")
    print(f"  Correct:      {char['correct']:,} characters")
    print(f"  Total:        {char['total']:,} characters")
    print(f"  Errors:       {char['errors']:,} characters")
    print(f"  Error Rate:   {char['error_rate']:.2f}%\n")
    
    # Word-level
    word = report['word_level']
    print("WORD-LEVEL METRICS:")
    print(f"  Accuracy:     {word['accuracy']:.2f}%")
    print(f"  Correct:      {word['correct']:,} words")
    print(f"  Total:        {word['total']:,} words")
    print(f"  Errors:       {word['errors']:,} words")
    print(f"  Error Rate:   {word['error_rate']:.2f}%\n")
    
    # Additional metrics
    print("ADDITIONAL METRICS:")
    print(f"  Edit Distance: {report['edit_distance']:,} characters")
    print(f"  GT Length:     {report['ground_truth_length']:,} characters")
    print(f"  OCR Length:    {report['ocr_output_length']:,} characters")
    print(f"{'='*60}\n")


# Example usage
if __name__ == "__main__":
    # Example 1: Direct text comparison
    print("Example 1: Direct Text Comparison")
    ground_truth = """
    The abstract is brief (50 words) summary of your 2 or 4 page paper.
    Use it to provide quick outline of your research.
    """
    
    ocr_output = """
    The abstract is brief(5-0 words)sopis ofyour 2 or 4(CircuitsOnl-pagepapr.
    tsuseito providequick outlineofourtioivgthanvvwf the research.
    """
    
    report = detailed_accuracy_report(ground_truth, ocr_output)
    print_report(report, "Example Document")
    
    # Example 2: File comparison
    print("\nExample 2: File Comparison")
    print("To compare files, use:")
    print("  report = compare_files('ground_truth.txt', 'ocr_output.txt')")
    print("  print_report(report, 'My Document')")
    
    # Example 3: Batch processing multiple documents
    print("\nExample 3: Batch Processing")
    print("""
    documents = [
        ('ground_truth_1.txt', 'ocr_output_1.txt', 'Document 1'),
        ('ground_truth_2.txt', 'ocr_output_2.txt', 'Document 2'),
    ]
    
    for gt_file, ocr_file, name in documents:
        report = compare_files(gt_file, ocr_file)
        if report:
            print_report(report, name)
    """)
