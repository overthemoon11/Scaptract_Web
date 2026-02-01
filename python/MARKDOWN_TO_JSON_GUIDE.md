# Converting PPStructureV3 Markdown to JSON

This guide explains how to convert the markdown output from PPStructureV3 OCR to structured JSON format.

## Installation

First, install the required library:

```bash
pip install markdown-to-json
```

## Quick Start

### Method 1: Command Line (Easiest)

```bash
# Convert a single file
python convert_ocr_markdown_to_json.py output/two_column_paper_page-0001.md

# Specify output file
python convert_ocr_markdown_to_json.py output/two_column_paper_page-0001.md output.json
```

### Method 2: Python Script

```python
from markdown_to_json_converter import convert_file_to_json, print_json_summary

# Convert markdown file to JSON
json_data = convert_file_to_json('output/two_column_paper_page-0001.md', 'output.json')

# Print summary
print_json_summary(json_data)
```

### Method 3: Direct Text Conversion

```python
from markdown_to_json_converter import convert_markdown_to_json
import json

# Your markdown text from OCR
markdown_text = """
# AUTHOR'S GUIDE
## Abstract
The abstract is brief summary...
"""

# Convert to JSON
json_data = convert_markdown_to_json(markdown_text)

# Save to file
with open('output.json', 'w', encoding='utf-8') as f:
    json.dump(json_data, f, indent=2, ensure_ascii=False)

# Or get JSON string
json_string = json.dumps(json_data, indent=2, ensure_ascii=False)
print(json_string)
```

## JSON Structure

The converted JSON has the following structure:

```json
{
  "metadata": {
    "source": "PPStructureV3",
    "total_length": 12345,
    "line_count": 65
  },
  "structured_elements": {
    "tables": [
      {
        "type": "table",
        "html": "<div>...<table>...</table>...</div>",
        "rows": [
          ["Font Size", "Bold", "Italic Text", ""],
          ["10", "Yes", "", "Main text"]
        ],
        "row_count": 7,
        "column_count": 4
      }
    ],
    "images": [
      {
        "type": "image",
        "src": "imgs/img_in_image_box_168_97_464_306.jpg",
        "alt": "Image",
        "width": "23%",
        "html": "<div>...<img>...</div>"
      }
    ],
    "equations": [
      {
        "type": "equation",
        "latex": "\\int_{0}^{r_{2}}F(r,\\mathbf{m})dr",
        "full_match": "$$...$$"
      }
    ],
    "sections": [
      {
        "type": "section",
        "level": 1,
        "title": "AUTHOR'S GUIDE",
        "content": "Center the Authors Names Here..."
      },
      {
        "type": "section",
        "level": 2,
        "title": "Abstract",
        "content": "The abstract is brief summary..."
      }
    ],
    "table_count": 1,
    "image_count": 1,
    "equation_count": 1,
    "section_count": 5
  },
  "content": {
    "AUTHOR'S GUIDE": "Center the Authors Names Here...",
    "Abstract": "The abstract is brief summary...",
    "Introduction": "These instructions give you..."
  },
  "raw_markdown": "# AUTHOR'S GUIDE\n\n## Abstract\n..."
}
```

## Features

### 1. Table Extraction
- Extracts HTML tables from markdown
- Converts to structured row/column format
- Preserves table HTML for reference

### 2. Image Extraction
- Extracts image references
- Captures alt text and dimensions
- Preserves image HTML

### 3. Equation Extraction
- Extracts LaTeX equations ($$...$$ or $...$)
- Preserves equation formatting

### 4. Section Extraction
- Identifies markdown headers (#, ##, ###)
- Groups content under each section
- Maintains hierarchy (level 1, 2, 3, etc.)

## Batch Processing

Convert multiple markdown files:

```python
import os
from markdown_to_json_converter import convert_file_to_json

# Process all markdown files in a directory
input_dir = 'python/output'
output_dir = 'python/output_json'

os.makedirs(output_dir, exist_ok=True)

for filename in os.listdir(input_dir):
    if filename.endswith('.md'):
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename.replace('.md', '.json'))
        
        print(f"Converting: {filename}")
        convert_file_to_json(input_path, output_path)
        print(f"✅ Saved: {output_path}\n")
```

## Integration with OCR System

You can integrate this into your OCR workflow:

```python
from ocr import ocr_single_image
from markdown_to_json_converter import convert_markdown_to_json
import json

# Process image and get markdown
markdown_text = ocr_single_image('image.jpg')

# Convert to JSON
json_data = convert_markdown_to_json(markdown_text)

# Save or use JSON data
with open('output.json', 'w') as f:
    json.dump(json_data, f, indent=2)

# Access structured data
tables = json_data['structured_elements']['tables']
sections = json_data['structured_elements']['sections']
```

## Example: Extract Specific Fields

```python
from markdown_to_json_converter import convert_file_to_json

# Convert markdown
json_data = convert_file_to_json('output/two_column_paper_page-0001.md')

# Extract title (usually first H1)
sections = json_data['structured_elements']['sections']
title = sections[0]['title'] if sections else None

# Extract abstract (section with "Abstract" in title)
abstract_section = next(
    (s for s in sections if 'abstract' in s['title'].lower()),
    None
)
abstract = abstract_section['content'] if abstract_section else None

# Extract tables
tables = json_data['structured_elements']['tables']
first_table = tables[0] if tables else None

print(f"Title: {title}")
print(f"Abstract: {abstract[:100]}...")
print(f"Tables found: {len(tables)}")
```

## Handling Special Cases

### HTML in Markdown
The converter handles HTML tables and images embedded in markdown:
- Tables are extracted and converted to structured format
- Images are extracted with metadata
- HTML is preserved in the JSON for reference

### LaTeX Equations
Equations are extracted separately:
```python
equations = json_data['structured_elements']['equations']
for eq in equations:
    print(f"Equation: {eq['latex']}")
```

### Multi-column Layouts
For documents with complex layouts:
- Sections are extracted based on headers
- Content is grouped by section
- You may need post-processing for column ordering

## Troubleshooting

### Error: "markdown-to-json not installed"
```bash
pip install markdown-to-json
```

### Error: "File not found"
- Check file path is correct
- Use absolute path if needed
- Ensure file has .md extension

### JSON output is empty
- Check if markdown file has content
- Verify markdown format is valid
- Check for encoding issues (should be UTF-8)

## Advanced Usage

### Custom Parsing
If you need custom parsing logic:

```python
from markdown_to_json_converter import convert_markdown_to_json, extract_sections, extract_tables

markdown_text = "..."
json_data = convert_markdown_to_json(markdown_text, use_markdown_to_json_lib=False)

# Or extract specific elements
sections = extract_sections(markdown_text)
tables = extract_tables(markdown_text)
```

### Filtering Content
```python
# Only extract sections with specific keywords
json_data = convert_file_to_json('input.md')
sections = json_data['structured_elements']['sections']

# Filter sections
important_sections = [
    s for s in sections 
    if any(keyword in s['title'].lower() 
           for keyword in ['abstract', 'introduction', 'conclusion'])
]
```

## Output Examples

### Simple Document
```json
{
  "content": {
    "Title": "Document Title",
    "Content": "Document body text..."
  }
}
```

### Document with Tables
```json
{
  "structured_elements": {
    "tables": [
      {
        "rows": [
          ["Header1", "Header2"],
          ["Data1", "Data2"]
        ]
      }
    ]
  },
  "content": {
    "Section": "Text with table reference..."
  }
}
```

## Next Steps

1. **Convert your OCR outputs:**
   ```bash
   python convert_ocr_markdown_to_json.py output/two_column_paper_page-0001.md
   ```

2. **Review the JSON structure** to understand the format

3. **Extract specific fields** for your use case

4. **Integrate** into your extraction workflow

For more details, see the `markdown_to_json_converter.py` source code.
