import numpy as np
import logging
import sys
from app.services.ocr_fusion import fuse_ocr_results

logger = logging.getLogger(__name__)

paddle_engine = None
easyocr_engine = None

def get_paddle_engine():
    global paddle_engine
    if paddle_engine is None:
        try:
            from paddleocr import PaddleOCR
            paddle_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            logger.info("PaddleOCR engine initialized successfully.")
        except Exception as e:
            try:
                from paddleocr import PaddleOCR
                paddle_engine = PaddleOCR(lang='en')
                logger.info("PaddleOCR fallback engine initialized.")
            except Exception as inner_e:
                logger.warning(f"PaddleOCR initialization failed: {inner_e}")
                paddle_engine = False
    return paddle_engine

def get_easyocr_engine():
    global easyocr_engine
    if easyocr_engine is None:
        try:
            import easyocr
            sys.stdout.reconfigure(encoding='utf-8', errors='ignore')
            easyocr_engine = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("EasyOCR engine initialized successfully.")
        except Exception as e:
            logger.warning(f"EasyOCR initialization failed: {e}")
            easyocr_engine = False
    return easyocr_engine

def extract_ocr_text(processed_img: np.ndarray, file_name: str = "") -> dict:
    """
    Executes PaddleOCR & EasyOCR engines and applies OCR Result Fusion.
    """
    paddle_boxes = []
    easy_boxes = []

    # 1. PaddleOCR Engine
    try:
        paddle = get_paddle_engine()
        if paddle:
            result = paddle.ocr(processed_img)
            if result and result[0]:
                for line in result[0]:
                    box, (text, conf) = line
                    top_y = float(box[0][1]) if isinstance(box, list) and len(box) > 0 else 0.0
                    paddle_boxes.append({"top_y": top_y, "text": text.strip(), "confidence": float(conf), "box": box})
                paddle_boxes.sort(key=lambda b: b["top_y"])
                logger.info(f"PaddleOCR extracted {len(paddle_boxes)} text blocks")
    except Exception as e:
        logger.warning(f"PaddleOCR execution error: {e}")

    # 2. EasyOCR Engine
    try:
        easy_reader = get_easyocr_engine()
        if easy_reader:
            easy_result = easy_reader.readtext(processed_img)
            if easy_result:
                for item in easy_result:
                    box, text, conf = item
                    box_list = [[float(p[0]), float(p[1])] for p in box] if isinstance(box, (list, np.ndarray)) else None
                    top_y = float(box[0][1]) if isinstance(box, (list, np.ndarray)) and len(box) > 0 else 0.0
                    easy_boxes.append({"top_y": top_y, "text": text.strip(), "confidence": float(conf), "box": box_list})
                easy_boxes.sort(key=lambda b: b["top_y"])
                logger.info(f"EasyOCR extracted {len(easy_boxes)} text blocks")
    except Exception as e:
        logger.warning(f"EasyOCR execution error: {e}")

    # 3. Fuse Results
    fused = fuse_ocr_results(paddle_boxes, easy_boxes)

    return {
        "raw_text": fused["fused_text"],
        "raw_paddle": "\n".join([b["text"] for b in paddle_boxes]),
        "raw_easy": "\n".join([b["text"] for b in easy_boxes]),
        "ocr_engine": fused["engine"],
        "confidence_score": fused["confidence"],
        "bounding_boxes": fused["fused_boxes"],
        "using_fallback": fused["engine"] == "none",
    }
