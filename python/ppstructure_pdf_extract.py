from pathlib import Path
from paddleocr import PPStructureV3
import sys

if len(sys.argv) < 3:
    print("Usage: python ppstructure_pdf_extract.py <groupname> <filename>")
    sys.exit(1)

groupname = sys.argv[1]
filename = sys.argv[2]

# Input file
input_file = os.path.join("uploads", "documents", groupname, filename)

# Output path
output_path = Path("uploads", "ocr-results", groupname)
output_path.mkdir(parents=True, exist_ok=True)

pipeline = PPStructureV3()
output = pipeline.predict(input=input_file)

markdown_list = []
markdown_images = []

for res in output:
    md_info = res.markdown
    markdown_list.append(md_info)
    markdown_images.append(md_info.get("markdown_images", {}))

markdown_texts = pipeline.concatenate_markdown_pages(markdown_list)

mkd_file_path = output_path / f"{Path(input_file).stem}.md"
mkd_file_path.parent.mkdir(parents=True, exist_ok=True)

with open(mkd_file_path, "w", encoding="utf-8") as f:
    f.write(markdown_texts)

for item in markdown_images:
    if item:
        for path, image in item.items():
            file_path = output_path / path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(file_path)
