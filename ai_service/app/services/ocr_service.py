import numpy as np
import logging
import re
import sys
import io

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
            logger.warning(f"PaddleOCR initialization failed: {e}")
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
    Executes primary PaddleOCR engine. If confidence is low or PaddleOCR fails,
    executes secondary EasyOCR fallback. Strictly returns empty text if OCR fails (no dummy data).
    """
    raw_text_lines = []
    bounding_boxes = []
    engine_used = "none"
    avg_confidence = 0.0

    # 1. Primary Engine: PaddleOCR
    try:
        paddle = get_paddle_engine()
        if paddle:
            result = paddle.ocr(processed_img, cls=True)
            if result and result[0]:
                conf_sum = 0.0
                count = 0
                for line in result[0]:
                    box, (text, conf) = line
                    raw_text_lines.append(text)
                    conf_sum += conf
                    count += 1
                    bounding_boxes.append({"text": text, "confidence": float(conf), "box": box})
                if count > 0:
                    avg_confidence = conf_sum / count
                    engine_used = "PaddleOCR"
                    logger.info(f"PaddleOCR extracted {count} text blocks with avg confidence {avg_confidence:.2f}")
    except Exception as e:
        logger.warning(f"PaddleOCR execution error: {e}")

    # 2. Secondary Fallback Engine: EasyOCR
    if not raw_text_lines or avg_confidence < 0.5:
        try:
            easy_reader = get_easyocr_engine()
            if easy_reader:
                easy_result = easy_reader.readtext(processed_img)
                if easy_result:
                    easy_lines = []
                    conf_sum = 0.0
                    bounding_boxes = []
                    for item in easy_result:
                        box, text, conf = item
                        easy_lines.append(text)
                        conf_sum += float(conf)
                        box_list = [[float(p[0]), float(p[1])] for p in box] if isinstance(box, (list, np.ndarray)) else None
                        bounding_boxes.append({"text": text, "confidence": float(conf), "box": box_list})
                    if easy_lines:
                        raw_text_lines = easy_lines
                        avg_confidence = conf_sum / len(easy_result)
                        engine_used = "EasyOCR"
                        logger.info(f"EasyOCR fallback extracted {len(easy_lines)} blocks with avg confidence {avg_confidence:.2f}")
        except Exception as e:
            logger.warning(f"EasyOCR execution error: {e}")

    using_fallback = False
    raw_text = "\n".join(raw_text_lines).strip()
    if not raw_text:
        using_fallback = True
        engine_used = "none"

    return {
        "raw_text": raw_text,
        "ocr_engine": engine_used,
        "confidence_score": float(avg_confidence),
        "bounding_boxes": bounding_boxes,
        "using_fallback": using_fallback
    }
