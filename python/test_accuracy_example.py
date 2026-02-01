"""
Quick Example: Calculate OCR Accuracy
Run this script to see how accuracy calculation works with your actual OCR output.
"""

from calculate_ocr_accuracy import detailed_accuracy_report, print_report

# Example using your actual OCR output from two_column_paper_page-0001.md
# This is the OCR output from your system
ocr_output = """# AUTHOR'S GUIDE 

# Preparation of Papers in Two-Column Format  for the VLSI Symposia on Technology and Circuits 

Center the Authors Names Here 

Center the Affiliations Here 

Center the City, States and Country Here 

(it is your option if you want your entire address and e-mail address listed)



## Abstract 

The abstract is  brief(5-0 words)sopis ofyour 2 or 4(CircuitsOnl-pagepapr.tsuseito providequick outlineofourtioivgthanvvwf the research.Thisianimportataspct ofyour papra itis this description that may atract the reader to continue and finish your full report.


## Introduction 

These instructions give you basic guidelines for preparing camera-ready (CR) papers for the VLSI Symposia. The instructions assume that you have computer desktop publishing equipment with several fonts.



Your goal isto simulate,asclosely as possible,the usual appearance of published papers intheVLSI Symposia Digess.These instructions have been prepared in the preferred format."""

# Ground truth (what the text should be - manually transcribed from original)
ground_truth = """# AUTHOR'S GUIDE

# Preparation of Papers in Two-Column Format for the VLSI Symposia on Technology and Circuits

Center the Authors Names Here

Center the Affiliations Here

Center the City, States and Country Here

(it is your option if you want your entire address and e-mail address listed)



## Abstract

The abstract is brief (50 words) summary of your 2 or 4 page paper. Use it to provide quick outline of your research. This is an important aspect of your paper. It is this description that may attract the reader to continue and finish your full report.


## Introduction

These instructions give you basic guidelines for preparing camera-ready (CR) papers for the VLSI Symposia. The instructions assume that you have computer desktop publishing equipment with several fonts.



Your goal is to simulate, as closely as possible, the usual appearance of published papers in the VLSI Symposia Digest. These instructions have been prepared in the preferred format."""

# Calculate accuracy
print("="*70)
print("OCR ACCURACY CALCULATION EXAMPLE")
print("="*70)
print("\nThis example uses actual OCR output from your system.")
print("Ground truth is manually transcribed from the original document.\n")

report = detailed_accuracy_report(ground_truth, ocr_output)
print_report(report, "Two-Column Paper - Page 1")

# Show specific errors
print("\n" + "="*70)
print("ERROR ANALYSIS")
print("="*70)
print("\nCommon errors found:")
print("  1. Character spacing: 'brief(5-0 words)' instead of 'brief (50 words)'")
print("  2. Word merging: 'sopis ofyour' instead of 'summary of your'")
print("  3. Missing spaces: 'Thisianimportataspct' instead of 'This is an important aspect'")
print("  4. Character substitution: 'atract' instead of 'attract'")
print("  5. Missing spaces: 'isto simulate,asclosely' instead of 'is to simulate, as closely'")
print("  6. Word merging: 'intheVLSI' instead of 'in the VLSI'")
print("  7. Character substitution: 'Digess' instead of 'Digest'")

print("\n" + "="*70)
print("HOW TO USE THIS SCRIPT")
print("="*70)
print("""
1. Replace 'ocr_output' with your actual OCR text
2. Replace 'ground_truth' with manually transcribed correct text
3. Run: python test_accuracy_example.py
4. Review the accuracy metrics

To calculate for multiple documents:
  - Save OCR outputs to files (e.g., ocr_doc1.txt)
  - Save ground truth to files (e.g., gt_doc1.txt)
  - Use compare_files() function from calculate_ocr_accuracy.py
""")
