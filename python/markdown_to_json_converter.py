"""
Convert PPStructureV3 Markdown Output to JSON
Handles tables, images, equations, and structured content from OCR markdown.
"""

import json
import re
import os
from typing import Dict, List, Any, Optional
try:
    import markdown_to_json
except ImportError:
    print("Error: markdown-to-json not installed. Run: pip install markdown-to-json")
    markdown_to_json = None


def extract_html_tables(markdown_text: str) -> List[Dict[str, Any]]:
    """
    Extract HTML tables from markdown and convert to structured format.
    """
    tables = []
    # Pattern to match HTML table divs
    table_pattern = r'<div[^>]*>.*?<table[^>]*>(.*?)</table>.*?</div>'
    
    matches = re.finditer(table_pattern, markdown_text, re.DOTALL)
    for match in matches:
        table_html = match.group(0)
        table_content = match.group(1)
        
        # Extract table rows
        rows = []
        row_pattern = r'<tr[^>]*>(.*?)</tr>'
        row_matches = re.finditer(row_pattern, table_content, re.DOTALL)
        
        for row_match in row_matches:
            row_html = row_match.group(1)
            # Extract cells
            cells = []
            cell_pattern = r'<td[^>]*>(.*?)</td>'
            cell_matches = re.finditer(cell_pattern, row_html, re.DOTALL)
            
            for cell_match in cell_matches:
                cell_content = cell_match.group(1).strip()
                # Remove HTML tags from cell content
                cell_text = re.sub(r'<[^>]+>', '', cell_content)
                cells.append(cell_text)
            
            if cells:
                rows.append(cells)
        
        if rows:
            tables.append({
                'type': 'table',
                'html': table_html,
                'rows': rows,
                'row_count': len(rows),
                'column_count': len(rows[0]) if rows else 0
            })
    
    return tables


def extract_images(markdown_text: str) -> List[Dict[str, Any]]:
    """
    Extract image references from markdown.
    """
    images = []
    # Pattern to match image divs
    img_pattern = r'<div[^>]*>.*?<img[^>]*src=["\']([^"\']+)["\'][^>]*>.*?</div>'
    
    matches = re.finditer(img_pattern, markdown_text, re.DOTALL)
    for match in matches:
        img_src = match.group(1)
        full_match = match.group(0)
        
        # Extract alt text and other attributes
        alt_match = re.search(r'alt=["\']([^"\']+)["\']', full_match)
        width_match = re.search(r'width=["\']([^"\']+)["\']', full_match)
        
        images.append({
            'type': 'image',
            'src': img_src,
            'alt': alt_match.group(1) if alt_match else '',
            'width': width_match.group(1) if width_match else '',
            'html': full_match
        })
    
    return images


def extract_equations(markdown_text: str) -> List[Dict[str, Any]]:
    """
    Extract LaTeX equations from markdown.
    """
    equations = []
    # Pattern to match LaTeX equations ($$...$$ or $...$)
    equation_pattern = r'\$\$([^$]+)\$\$|\$([^$]+)\$'
    
    matches = re.finditer(equation_pattern, markdown_text)
    for match in matches:
        equation = match.group(1) or match.group(2)
        equations.append({
            'type': 'equation',
            'latex': equation.strip(),
            'full_match': match.group(0)
        })
    
    return equations


def extract_sections(markdown_text: str) -> List[Dict[str, Any]]:
    """
    Extract sections based on markdown headers.
    """
    sections = []
    lines = markdown_text.split('\n')
    current_section = None
    current_content = []
    
    for line in lines:
        # Check if line is a header
        header_match = re.match(r'^(#+)\s+(.+)$', line.strip())
        if header_match:
            # Save previous section
            if current_section:
                current_section['content'] = '\n'.join(current_content).strip()
                sections.append(current_section)
            
            # Start new section
            level = len(header_match.group(1))
            title = header_match.group(2).strip()
            current_section = {
                'type': 'section',
                'level': level,
                'title': title,
                'content': ''
            }
            current_content = []
        else:
            if current_section:
                current_content.append(line)
            else:
                # Content before first header
                if line.strip():
                    current_content.append(line)
    
    # Save last section
    if current_section:
        current_section['content'] = '\n'.join(current_content).strip()
        sections.append(current_section)
    elif current_content:
        # No headers, just content
        sections.append({
            'type': 'section',
            'level': 0,
            'title': 'Content',
            'content': '\n'.join(current_content).strip()
        })
    
    return sections


def convert_markdown_to_json(markdown_text: str, use_markdown_to_json_lib: bool = True) -> Dict[str, Any]:
    """
    Convert PPStructureV3 markdown output to structured JSON.
    
    Args:
        markdown_text: Markdown text from PPStructureV3
        use_markdown_to_json_lib: Whether to use markdown-to-json library for basic conversion
    
    Returns:
        Dictionary with structured JSON representation
    """
    result = {
        'metadata': {
            'source': 'PPStructureV3',
            'total_length': len(markdown_text),
            'line_count': len(markdown_text.split('\n'))
        },
        'content': {}
    }
    
    # Extract structured elements
    tables = extract_html_tables(markdown_text)
    images = extract_images(markdown_text)
    equations = extract_equations(markdown_text)
    sections = extract_sections(markdown_text)
    
    result['structured_elements'] = {
        'tables': tables,
        'images': images,
        'equations': equations,
        'sections': sections,
        'table_count': len(tables),
        'image_count': len(images),
        'equation_count': len(equations),
        'section_count': len(sections)
    }
    
    # Use markdown-to-json library for basic conversion
    if use_markdown_to_json_lib and markdown_to_json:
        try:
            # Clean markdown for library (remove HTML tables/images first)
            clean_markdown = markdown_text
            # Replace HTML tables with placeholder
            for i, table in enumerate(tables):
                clean_markdown = clean_markdown.replace(
                    table['html'],
                    f"\n[TABLE_{i}]\n",
                    1
                )
            # Replace images with placeholder
            for i, img in enumerate(images):
                clean_markdown = clean_markdown.replace(
                    img['html'],
                    f"\n[IMAGE_{i}: {img.get('alt', '')}]\n",
                    1
                )
            
            # Convert using library
            dictified = markdown_to_json.dictify(clean_markdown)
            result['content'] = dictified
            
            # Replace placeholders with actual table/image data
            if isinstance(result['content'], dict):
                for key, value in result['content'].items():
                    if isinstance(value, str):
                        # Replace table placeholders
                        for i, table in enumerate(tables):
                            placeholder = f"[TABLE_{i}]"
                            if placeholder in value:
                                result['content'][key] = value.replace(
                                    placeholder,
                                    json.dumps(table, indent=2)
                                )
                        # Replace image placeholders
                        for i, img in enumerate(images):
                            placeholder = f"[IMAGE_{i}:"
                            if placeholder in value:
                                result['content'][key] = value.replace(
                                    f"[IMAGE_{i}: {img.get('alt', '')}]",
                                    json.dumps(img, indent=2)
                                )
        except Exception as e:
            print(f"Warning: markdown-to-json library conversion failed: {e}")
            print("Falling back to custom parsing...")
            result['content'] = parse_markdown_custom(markdown_text)
    else:
        result['content'] = parse_markdown_custom(markdown_text)
    
    # Add raw markdown
    result['raw_markdown'] = markdown_text
    
    return result


def parse_markdown_custom(markdown_text: str) -> Dict[str, Any]:
    """
    Custom markdown parser as fallback.
    """
    content = {}
    lines = markdown_text.split('\n')
    current_key = None
    current_content = []
    
    for line in lines:
        # Check for headers
        header_match = re.match(r'^(#+)\s+(.+)$', line.strip())
        if header_match:
            # Save previous section
            if current_key:
                content[current_key] = '\n'.join(current_content).strip()
            
            # Start new section
            title = header_match.group(2).strip()
            current_key = title
            current_content = []
        else:
            if line.strip():
                current_content.append(line)
    
    # Save last section
    if current_key:
        content[current_key] = '\n'.join(current_content).strip()
    elif current_content:
        content['Content'] = '\n'.join(current_content).strip()
    
    return content


def convert_file_to_json(markdown_file: str, output_file: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert a markdown file to JSON file.
    
    Args:
        markdown_file: Path to input markdown file
        output_file: Path to output JSON file (optional)
    
    Returns:
        Dictionary with JSON structure
    """
    try:
        with open(markdown_file, 'r', encoding='utf-8') as f:
            markdown_text = f.read()
    except FileNotFoundError:
        print(f"Error: File '{markdown_file}' not found.")
        return {}
    except Exception as e:
        print(f"Error reading file: {e}")
        return {}
    
    # Convert to JSON
    json_data = convert_markdown_to_json(markdown_text)
    
    # Save to file if output path provided
    if output_file:
        try:
            # Create output directory if it doesn't exist
            output_dir = os.path.dirname(output_file)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            print(f"JSON saved to: {output_file}")
        except Exception as e:
            print(f"Error saving JSON file: {e}")
    
    return json_data


def print_json_summary(json_data: Dict[str, Any]):
    """
    Print a summary of the JSON structure.
    """
    print("\n" + "="*60)
    print("JSON CONVERSION SUMMARY")
    print("="*60)
    
    metadata = json_data.get('metadata', {})
    print(f"\nMetadata:")
    print(f"  Source: {metadata.get('source', 'Unknown')}")
    print(f"  Total Length: {metadata.get('total_length', 0):,} characters")
    print(f"  Line Count: {metadata.get('line_count', 0):,} lines")
    
    structured = json_data.get('structured_elements', {})
    print(f"\nStructured Elements:")
    print(f"  Tables: {structured.get('table_count', 0)}")
    print(f"  Images: {structured.get('image_count', 0)}")
    print(f"  Equations: {structured.get('equation_count', 0)}")
    print(f"  Sections: {structured.get('section_count', 0)}")
    
    content = json_data.get('content', {})
    if isinstance(content, dict):
        print(f"\nContent Sections: {len(content)}")
        for key in list(content.keys())[:5]:  # Show first 5
            print(f"  - {key}")
        if len(content) > 5:
            print(f"  ... and {len(content) - 5} more")
    
    print("="*60 + "\n")


# Example usage
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python markdown_to_json_converter.py <markdown_file> [output_json_file]")
        print("\nExample:")
        print("  python markdown_to_json_converter.py output/two_column_paper_page-0001.md output.json")
        sys.exit(1)
    
    markdown_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Convert
    json_data = convert_file_to_json(markdown_file, output_file)
    
    # Print summary
    if json_data:
        print_json_summary(json_data)
        
        # Print JSON structure (first level)
        print("\nJSON Structure Preview:")
        print(json.dumps(json_data, indent=2, ensure_ascii=False)[:1000] + "...")
    else:
        print("Conversion failed.")
