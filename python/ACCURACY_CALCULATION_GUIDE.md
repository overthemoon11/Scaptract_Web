# How to Calculate OCR Accuracy

This guide explains different methods to calculate OCR accuracy for your Scaptract system.

## Methods Overview

1. **Character-Level Accuracy** - Compares each character
2. **Word-Level Accuracy** - Compares each word
3. **Edit Distance (Levenshtein)** - Measures minimum edits needed
4. **Field-Level Accuracy** - Compares specific fields (title, author, etc.)

---

## Method 1: Using the Python Script (Automated)

### Step 1: Prepare Ground Truth Text

Create a text file with the correct/expected text from your document:

```bash
# ground_truth.txt
The abstract is brief (50 words) summary of your 2 or 4 page paper.
Use it to provide quick outline of your research.
This is an important aspect of your paper.
```

### Step 2: Get OCR Output

Save the OCR output from your system:

```bash
# ocr_output.txt
The abstract is brief(5-0 words)sopis ofyour 2 or 4(CircuitsOnl-pagepapr.
tsuseito providequick outlineofourtioivgthanvvwf the research.
Thisianimportataspct ofyour papra itis this description.
```

### Step 3: Run the Script

```bash
python calculate_ocr_accuracy.py
```

Or use it programmatically:

```python
from calculate_ocr_accuracy import compare_files, print_report

# Compare files
report = compare_files('ground_truth.txt', 'ocr_output.txt')
print_report(report, 'My Document')
```

### Step 4: Interpret Results

The script will output:
- **Character-Level Accuracy**: Percentage of correct characters
- **Word-Level Accuracy**: Percentage of correct words
- **Error Counts**: Number of errors at each level
- **Edit Distance**: Minimum edits needed to fix

---

## Method 2: Manual Calculation

### Character-Level Accuracy

**Formula:**
```
Accuracy = (Correct Characters / Total Characters) × 100
```

**Example:**
```
Ground Truth: "The abstract is brief"
OCR Output:   "The abstract is brie f"
              ^^^^^^^^^^^^^^^^^^^^
              Correct: 19 characters
              Total: 20 characters
              Accuracy = (19/20) × 100 = 95%
```

**Steps:**
1. Align the texts character by character
2. Count matching characters
3. Count total characters in ground truth
4. Calculate percentage

### Word-Level Accuracy

**Formula:**
```
Accuracy = (Correct Words / Total Words) × 100
```

**Example:**
```
Ground Truth: "The abstract is brief summary"
OCR Output:   "The abstract is brie f summary"
              ^^^ ^^^^^^^^ ^^ ^^^^ ^^^^^^^
              Correct: 5 words
              Total: 5 words
              Accuracy = (5/5) × 100 = 100%
```

**Note:** Word-level is usually higher because word order matters less than character accuracy.

---

## Method 3: Using Online Tools

### Tool 1: Diff Checker
1. Go to https://www.diffchecker.com/
2. Paste ground truth in left panel
3. Paste OCR output in right panel
4. Manually count differences

### Tool 2: Text Compare
1. Use any text comparison tool
2. Count differences manually
3. Calculate accuracy percentage

---

## Method 4: Field-Level Accuracy

For structured documents, calculate accuracy per field:

### Example: Academic Paper

```python
# Define ground truth fields
ground_truth_fields = {
    'title': 'Preparation of Papers in Two-Column Format',
    'author': 'John Doe, Jane Smith',
    'abstract': 'The abstract is brief summary...',
    'keywords': 'OCR, document processing, extraction'
}

# Get OCR extracted fields
ocr_extracted_fields = {
    'title': 'Preparation of Papers in Two-Column Format',  # ✓ Correct
    'author': 'John Doe',  # ✗ Missing "Jane Smith"
    'abstract': 'The abstract is brief(5-0 words)sopis...',  # ✗ Has errors
    'keywords': None  # ✗ Not extracted
}

# Calculate field-level accuracy
def calculate_field_accuracy(gt_fields, ocr_fields):
    results = {}
    for field, gt_value in gt_fields.items():
        ocr_value = ocr_fields.get(field, '')
        if ocr_value is None:
            results[field] = {'extracted': False, 'accuracy': 0.0}
        else:
            # Use character-level accuracy for field content
            from calculate_ocr_accuracy import calculate_character_accuracy
            accuracy, _, _, _ = calculate_character_accuracy(gt_value, ocr_value)
            results[field] = {
                'extracted': True,
                'accuracy': accuracy,
                'correct': accuracy == 100.0
            }
    return results

# Calculate
field_results = calculate_field_accuracy(ground_truth_fields, ocr_extracted_fields)

# Results:
# title: 100% (extracted correctly)
# author: 0% (partially extracted)
# abstract: 85% (extracted with errors)
# keywords: 0% (not extracted)
```

---

## Method 5: Batch Processing Multiple Documents

### Create a Test Dataset

```python
from calculate_ocr_accuracy import compare_files, print_report
import json

# List of document pairs
test_documents = [
    {
        'name': 'Document 1 - Academic Paper',
        'ground_truth': 'ground_truth/doc1.txt',
        'ocr_output': 'ocr_output/doc1.txt',
        'type': 'PDF',
        'quality': 'High'
    },
    {
        'name': 'Document 2 - Research Paper',
        'ground_truth': 'ground_truth/doc2.txt',
        'ocr_output': 'ocr_output/doc2.txt',
        'type': 'Image',
        'quality': 'Medium'
    },
    # Add more documents...
]

# Process all documents
results = []
for doc in test_documents:
    report = compare_files(doc['ground_truth'], doc['ocr_output'])
    if report:
        results.append({
            'name': doc['name'],
            'type': doc['type'],
            'quality': doc['quality'],
            'char_accuracy': report['character_level']['accuracy'],
            'word_accuracy': report['word_level']['accuracy'],
            'char_errors': report['character_level']['errors'],
            'word_errors': report['word_level']['errors']
        })
        print_report(report, doc['name'])

# Calculate averages
if results:
    avg_char_acc = sum(r['char_accuracy'] for r in results) / len(results)
    avg_word_acc = sum(r['word_accuracy'] for r in results) / len(results)
    
    print(f"\n{'='*60}")
    print("OVERALL STATISTICS")
    print(f"{'='*60}")
    print(f"Documents Tested: {len(results)}")
    print(f"Average Character Accuracy: {avg_char_acc:.2f}%")
    print(f"Average Word Accuracy: {avg_word_acc:.2f}%")
    print(f"{'='*60}\n")
    
    # Save results to JSON
    with open('accuracy_results.json', 'w') as f:
        json.dump(results, f, indent=2)
```

---

## Method 6: Real-Time Accuracy Calculation

### Integrate with Your OCR System

```python
# In your ocr.py or extraction workflow
from calculate_ocr_accuracy import detailed_accuracy_report

def process_with_accuracy(ground_truth: str, ocr_text: str):
    """
    Process OCR and calculate accuracy if ground truth is available.
    """
    # Your OCR processing...
    # ocr_text = ocr_single_image(image_path)
    
    # Calculate accuracy
    if ground_truth:
        report = detailed_accuracy_report(ground_truth, ocr_text)
        
        # Store accuracy in database
        accuracy = report['character_level']['accuracy']
        
        # Update extraction_result
        await ExtractionResult.update(extraction_result_id, {
            'accuracy': accuracy / 100.0  # Convert to 0-1 scale
        })
        
        return ocr_text, report
    else:
        return ocr_text, None
```

---

## Accuracy Metrics Explained

### 1. Character-Level Accuracy
- **Best for:** Detailed error analysis
- **Shows:** Exact character mismatches
- **Typical Range:** 85-98% for good OCR
- **Use Case:** When you need precise text extraction

### 2. Word-Level Accuracy
- **Best for:** Overall readability assessment
- **Shows:** Whether words are correctly identified
- **Typical Range:** 90-99% for good OCR
- **Use Case:** When word-level understanding is sufficient

### 3. Edit Distance
- **Best for:** Understanding error complexity
- **Shows:** Minimum edits needed to fix
- **Use Case:** Error correction algorithms

### 4. Field-Level Accuracy
- **Best for:** Structured document evaluation
- **Shows:** How well specific fields are extracted
- **Use Case:** Academic papers, forms, invoices

---

## Tips for Accurate Evaluation

1. **Normalize Text First**
   - Remove extra whitespace
   - Handle encoding issues (UTF-8)
   - Consider case sensitivity

2. **Handle Special Cases**
   - Mathematical notation
   - Tables and figures
   - Multi-column layouts

3. **Use Representative Test Data**
   - Include various document types
   - Different quality levels
   - Different formats (PDF, images)

4. **Document Your Methodology**
   - How ground truth was created
   - What normalization was applied
   - Any manual corrections made

---

## Example: Complete Evaluation Workflow

```python
# 1. Prepare ground truth (manual transcription)
ground_truth = """
# AUTHOR'S GUIDE
# Preparation of Papers in Two-Column Format for the VLSI Symposia

Center the Authors Names Here
Center the Affiliations Here

## Abstract
The abstract is brief (50 words) summary of your 2 or 4 page paper.
"""

# 2. Get OCR output from your system
ocr_output = """
# AUTHOR'S GUIDE
# Preparation of Papers in Two-Column Format  for the VLSI Symposia

Center the Authors Names Here
Center the Affiliations Here

## Abstract
The abstract is  brief(5-0 words)sopis ofyour 2 or 4(CircuitsOnl-pagepapr.
"""

# 3. Calculate accuracy
from calculate_ocr_accuracy import detailed_accuracy_report, print_report

report = detailed_accuracy_report(ground_truth, ocr_output)
print_report(report, "VLSI Paper - Page 1")

# Output:
# Character-Level Accuracy: 93.1%
# Word-Level Accuracy: 96.4%
```

---

## Quick Reference

| Metric | Formula | When to Use |
| --- | --- | --- |
| **Character Accuracy** | (Correct Chars / Total Chars) × 100 | Detailed analysis |
| **Word Accuracy** | (Correct Words / Total Words) × 100 | Overall assessment |
| **Error Rate** | (Errors / Total) × 100 | Quality measurement |
| **Field Accuracy** | (Correct Fields / Total Fields) × 100 | Structured documents |

---

## Next Steps

1. **Run the script** on your test documents
2. **Create ground truth** for 5-10 sample documents
3. **Calculate baseline** accuracy metrics
4. **Compare** PDF vs Image inputs
5. **Document** your findings in the evaluation report

For questions or issues, refer to the `calculate_ocr_accuracy.py` script comments.
