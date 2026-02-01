# OCR Accuracy Evaluation Usage Guide

This guide explains how to use `evaluate_ocr_accuracy.py` to calculate OCR accuracy metrics.

## Features

The script calculates:
- **Character-level accuracy**: Percentage of correct characters
- **Word-level accuracy**: Percentage of correct words
- **Field-level extraction accuracy**: Accuracy for Title, Author, Abstract, Introduction, Conclusion

## Ground Truth File Format

### Option 1: Plain Text File
A simple text file with all content:
```
ground_truth/document1.txt
```

### Option 2: JSON File with Fields
A JSON file with structured fields:
```json
{
  "Title": "Document Title Here",
  "Author": "Author Name, University, email@example.com",
  "Abstract": "Abstract text here...",
  "Introduction": "Introduction text here...",
  "Conclusion": "Conclusion text here..."
}
```

## Usage Methods

### Method 1: Single File Evaluation

Evaluate one document:
```bash
python evaluate_ocr_accuracy.py \
  --gt-file ground_truth/document1.txt \
  --ocr-file testing-output/pdf-output/document1.md \
  --input-type PDF
```

### Method 2: Config File (Recommended)

Create a JSON config file (`evaluation_config.json`):
```json
[
  {
    "ground_truth": "ground_truth/2302.12854v2.txt",
    "ocr_markdown": "testing-output/pdf-output/2302.12854v2.md",
    "input_type": "PDF"
  },
  {
    "ground_truth": "ground_truth/2302.12854v2.txt",
    "ocr_markdown": "testing-output/image-output/2302.12854v2_page-0001_0.md",
    "input_type": "Image"
  }
]
```

Run evaluation:
```bash
python evaluate_ocr_accuracy.py --config evaluation_config.json
```

### Method 3: Directory-Based (Auto-Match)

Automatically match ground truth files with OCR outputs:
```bash
python evaluate_ocr_accuracy.py \
  --gt-dir ground_truth/ \
  --pdf-dir testing-output/pdf-output/ \
  --image-dir testing-output/image-output/
```

The script will automatically match files by base name.

## Output Format

The script generates a report like:

```
================================================================================
OCR ACCURACY EVALUATION REPORT
================================================================================

Evaluation - PDF Input
--------------------------------------------------------------------------------
OCR Accuracy
  - Character-level: 94.23%
  - Word-level:      96.45%

Field-level Extraction Accuracy
  - Title:        98.50%
  - Author:       95.20%
  - Abstract:     93.80%
  - Introduction: 94.10%
  - Conclusion:   92.30%

Evaluation - Image Input
--------------------------------------------------------------------------------
OCR Accuracy
  - Character-level: 93.15%
  - Word-level:      95.80%

Field-level Extraction Accuracy
  - Title:        97.20%
  - Author:       94.50%
  - Abstract:     92.10%
  - Introduction: 93.40%
  - Conclusion:   91.20%
```

## Example Workflow

1. **Prepare ground truth files:**
   ```bash
   # Create ground_truth/ directory
   mkdir ground_truth
   
   # Create ground truth text files
   # Option A: Plain text
   echo "Full document text here..." > ground_truth/document1.txt
   
   # Option B: JSON with fields
   cat > ground_truth/document1.json << EOF
   {
     "Title": "Document Title",
     "Author": "Author Name",
     "Abstract": "Abstract text...",
     "Introduction": "Introduction text...",
     "Conclusion": "Conclusion text..."
   }
   EOF
   ```

2. **Run evaluation:**
   ```bash
   python evaluate_ocr_accuracy.py --config evaluation_config.json
   ```

3. **Review results:**
   The script will print a formatted report with all metrics.

## Notes

- Ground truth files can be `.txt` or `.json`
- OCR markdown files should be `.md` files from PPStructureV3
- Field extraction uses heuristics to find Title, Author, and sections
- If a field is not found in ground truth, it will show "N/A"
- Character and word accuracy use normalized text comparison
