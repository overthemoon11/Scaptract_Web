from paddleocr import PPStructureV3

pipeline = PPStructureV3()

output = pipeline.predict("two_column_paper/two_column_paper_page-0002.jpg")
for res in output:
    res.print()
    res.save_to_markdown(save_path="output") 