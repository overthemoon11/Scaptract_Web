#from paddleocr import TextDetection
from paddleocr import PaddleOCRVL
model = PaddleOCRVL(model_name="PP-OCRv5_server_det")
output = model.predict(input="C:/Users/user/Downloads/171198_page-0002 (5).jpg", batch_size=1)
#output = model.predict(input="https://paddle-model-ecology.bj.bcebos.com/paddlex/imgs/demo_image/general_ocr_002.png", batch_size=1)
for res in output:
    res.print()
    res.save_to_img(save_path="./output1/")
    res.save_to_json(save_path="./output1/res.json")
    res.save_to_markdown(save_path="./output1/")