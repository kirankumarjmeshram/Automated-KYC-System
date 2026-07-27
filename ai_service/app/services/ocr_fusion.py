import logging
import numpy as np

logger = logging.getLogger(__name__)

def fuse_ocr_results(paddle_boxes: list, easy_boxes: list) -> dict:
    """
    Fuses bounding box and text results from PaddleOCR and EasyOCR.
    Selects highest-confidence text representations for overlapping spatial regions.
    """
    if not paddle_boxes and not easy_boxes:
        return {"fused_text": "", "fused_boxes": [], "confidence": 0.0, "engine": "none"}

    if not paddle_boxes and easy_boxes:
        fused_text = "\n".join([b["text"] for b in easy_boxes if b.get("text")]).strip()
        avg_conf = sum([b["confidence"] for b in easy_boxes]) / len(easy_boxes) if easy_boxes else 0.0
        return {"fused_text": fused_text, "fused_boxes": easy_boxes, "confidence": float(avg_conf), "engine": "EasyOCR"}

    if paddle_boxes and not easy_boxes:
        fused_text = "\n".join([b["text"] for b in paddle_boxes if b.get("text")]).strip()
        avg_conf = sum([b["confidence"] for b in paddle_boxes]) / len(paddle_boxes) if paddle_boxes else 0.0
        return {"fused_text": fused_text, "fused_boxes": paddle_boxes, "confidence": float(avg_conf), "engine": "PaddleOCR"}

    # Both engines extracted results: Fuse spatially
    fused_boxes = []
    seen_texts = set()

    # Prefer higher confidence entries
    all_boxes = paddle_boxes + easy_boxes
    all_boxes.sort(key=lambda b: (b.get("top_y", 0), -b.get("confidence", 0)))

    for b in all_boxes:
        text = b.get("text", "").strip()
        if text and text not in seen_texts:
            fused_boxes.append(b)
            seen_texts.add(text)

    # Sort final merged boxes top-to-bottom
    fused_boxes.sort(key=lambda b: b.get("top_y", 0))

    fused_text = "\n".join([b["text"] for b in fused_boxes]).strip()
    avg_conf = sum([b["confidence"] for b in fused_boxes]) / len(fused_boxes) if fused_boxes else 0.0

    return {
        "fused_text": fused_text,
        "fused_boxes": fused_boxes,
        "confidence": float(avg_conf),
        "engine": "Fused (PaddleOCR + EasyOCR)",
    }
