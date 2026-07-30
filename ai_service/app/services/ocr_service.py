import numpy as np
import logging
import sys
import os
from app.services.ocr_fusion import fuse_ocr_results

logger = logging.getLogger(__name__)

paddle_engine = None
easyocr_engine = None
easyocr_version = "unknown"

def get_paddle_engine():
    global paddle_engine
    if not paddle_engine:
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
                paddle_engine = None
    return paddle_engine

def get_easyocr_engine():
    global easyocr_engine, easyocr_version
    if not easyocr_engine:
        try:
            import easyocr
            easyocr_version = getattr(easyocr, "__version__", "1.7.x")
            try:
                sys.stdout.reconfigure(encoding='utf-8', errors='ignore')
            except Exception:
                pass
            easyocr_engine = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info(f"EasyOCR v{easyocr_version} engine initialized successfully.")
        except Exception as e:
            logger.warning(f"EasyOCR initialization failed: {e}", exc_info=True)
            easyocr_engine = None
    return easyocr_engine

def encode_cv2_image_b64(img: np.ndarray) -> str:
    if img is None or img.size == 0:
        return None
    try:
        import cv2
        import base64
        success, buffer = cv2.imencode('.jpg', img)
        if not success:
            return None
        return base64.b64encode(buffer).decode('utf-8')
    except Exception:
        return None

def extract_ocr_text(processed_img: np.ndarray, file_name: str = "") -> dict:
    """
    Executes PaddleOCR & EasyOCR engines and returns fused text, raw outputs,
    bounding boxes, and base64 crop.
    """
    paddle = get_paddle_engine()
    easy_reader = get_easyocr_engine()

    paddle_boxes = []
    easy_boxes = []
    raw_paddle_objects = []
    raw_easyocr_objects = []
    engine_info = {
        "engine": "EasyOCR/PaddleOCR",
        "version": easyocr_version,
        "languages": ["en"],
        "gpu_enabled": False,
        "model_path": os.path.expanduser("~/.EasyOCR/model"),
        "configuration": {"verbose": False, "gpu": False},
        "paddle_available": paddle is not None,
        "easyocr_available": easy_reader is not None,
    }

    print("===== OCR ENGINE RUN =====", flush=True)

    # 1. PaddleOCR Engine
    try:
        print("Starting PaddleOCR", flush=True)
        if paddle:
            try:
                p_res = paddle.ocr(processed_img)
            except TypeError:
                p_res = paddle.ocr(processed_img, cls=True)
            raw_paddle_objects = p_res
            if p_res and p_res[0]:
                for line in p_res[0]:
                    box, (text, conf) = line
                    top_y = float(box[0][1]) if isinstance(box, list) and len(box) > 0 else 0.0
                    paddle_boxes.append({"top_y": top_y, "text": text.strip(), "confidence": float(conf), "box": box})
                paddle_boxes.sort(key=lambda b: b["top_y"])
        print("PaddleOCR completed", flush=True)
    except Exception as e:
        logger.warning(f"PaddleOCR execution error: {e}")
        print(f"PaddleOCR exception: {e}", flush=True)

    # 2. EasyOCR Engine
    try:
        print("Starting EasyOCR", flush=True)
        if easy_reader:
            easy_result = easy_reader.readtext(processed_img)
            if easy_result:
                for item in easy_result:
                    box, text, conf = item
                    box_list = [[float(p[0]), float(p[1])] for p in box] if isinstance(box, (list, np.ndarray)) else []
                    raw_easyocr_objects.append([box_list, str(text), float(conf)])
                    top_y = float(box_list[0][1]) if len(box_list) > 0 else 0.0
                    easy_boxes.append({"top_y": top_y, "text": str(text).strip(), "confidence": float(conf), "box": box_list})
                easy_boxes.sort(key=lambda b: b["top_y"])
        print("EasyOCR completed", flush=True)
    except Exception as e:
        logger.warning(f"EasyOCR execution error: {e}")
        print(f"EasyOCR exception: {e}", flush=True)

    # 3. Fuse Results
    fused = fuse_ocr_results(paddle_boxes, easy_boxes)
    print(f"Merged OCR text length: {len(fused.get('fused_text', ''))}", flush=True)

    # Construct per-line confidence strings
    per_line_confidence = []
    for b in fused.get("fused_boxes", []):
        per_line_confidence.append({
            "text": b.get("text", ""),
            "confidence": b.get("confidence", 0.0),
            "box": b.get("box", []),
        })

    return {
        "raw_text": fused.get("fused_text", ""),
        "raw_paddle": "\n".join([b["text"] for b in paddle_boxes]),
        "raw_easy": "\n".join([b["text"] for b in easy_boxes]),
        "raw_paddle_objects": raw_paddle_objects,
        "raw_easyocr_objects": raw_easyocr_objects,
        "engine_info": engine_info,
        "per_line_confidence": per_line_confidence,
        "ocr_engine": fused.get("engine", "none"),
        "confidence_score": fused.get("confidence", 0),
        "bounding_boxes": fused.get("fused_boxes", []),
        "ocr_crop": encode_cv2_image_b64(processed_img),
        "using_fallback": fused.get("engine", "none") == "none",
    }
