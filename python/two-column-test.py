from paddleocr import PPStructureV3

pipeline = PPStructureV3()

output = pipeline.predict("two_column_paper/two_column_paper_page-0002.jpg")
for res in output:
    res.print()
    res.save_to_markdown(save_path="output") 


from pathlib import Path
from paddleocr import PPStructureV3

input_file = "testing-pdf/2302.12854v2.pdf"
output_path = Path("./testing-output/pdf-output")

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


from paddleocr import PPStructureV3
import glob, os

pipeline = PPStructureV3()

image_files = glob.glob("testing-pdf/2207.11081v2-300dpi/*.jpg")

for img in image_files:
    output = pipeline.predict(img)
    name = os.path.splitext(os.path.basename(img))[0]

    for idx, res in enumerate(output):
        res.save_to_json(f"testing-output/image-output/{name}_{idx}.json")
        res.save_to_markdown(f"testing-output/image-output/{name}_{idx}.md")

