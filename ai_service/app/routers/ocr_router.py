import time
import uuid
import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from app.models.ocr_schemas import OCRResponse, ExtractedDetails, BoundingBox
from app.services.cv_service import preprocess_image
from app.services.ocr_service import extract_ocr_text
from app.services.gemini_service import structure_text_with_gemini
from app.utils.logger import setup_logger, TraceAdapter

raw_logger = setup_logger("ai_service")
router = APIRouter(prefix="/ocr", tags=["OCR Processing"])

@router.post("/process", response_model=OCRResponse)
async def process_document_ocr(request: Request, file: UploadFile = File(...)):
    """
    Complete AI OCR Pipeline with Performance & Trace Logging:
    1. Read x-trace-id request header (or generate UUID)
    2. Log UPLOAD_RECEIVED & image size
    3. Measure & log OpenCV Preprocessing duration
    4. Measure & log Dual-Engine OCR duration
    5. Measure & log Gemini LLM structuring duration
    6. Return structured response JSON with traceId
    """
    start_total = time.time()
    trace_id = request.headers.get("x-trace-id") or request.headers.get("traceid") or str(uuid.uuid4())
    log = TraceAdapter(raw_logger, {"trace_id": trace_id})

    if not file or not file.filename:
        log.warning("Upload received with empty filename")
        raise HTTPException(status_code=400, detail="No file provided")

    log.info(f"[UPLOAD_RECEIVED] Processing file '{file.filename}'")

    try:
        contents = await file.read()
        if not contents:
            log.warning("Upload received with zero bytes")
            raise HTTPException(status_code=400, detail="Empty file payload")

        log.info(f"[IMAGE_VALIDATION] Payload verified: Size={len(contents)} bytes")

        # Step 1: OpenCV Preprocessing
        start_cv = time.time()
        processed_img, cv_status = preprocess_image(contents)
        cv_duration = int((time.time() - start_cv) * 1000)
        log.info(f"[IMAGE_PREPROCESSING] OpenCV completed in {cv_duration}ms")

        # Step 2: OCR Extraction
        start_ocr = time.time()
        ocr_result = extract_ocr_text(processed_img, file.filename)
        ocr_duration = int((time.time() - start_ocr) * 1000)
        engine_used = ocr_result.get("ocr_engine", "none")
        log.info(f"[OCR_COMPLETED] Engine={engine_used} Duration={ocr_duration}ms Confidence={ocr_result['confidence_score']:.2f}")

        # Step 3: Gemini Structuring
        start_gemini = time.time()
        structured_details = structure_text_with_gemini(ocr_result["raw_text"])
        gemini_duration = int((time.time() - start_gemini) * 1000)
        log.info(f"[GEMINI_COMPLETED] Structuring completed in {gemini_duration}ms Type={structured_details.type}")

        total_duration = int((time.time() - start_total) * 1000)
        log.info(f"[PIPELINE_COMPLETE] TotalDuration={total_duration}ms (Preprocess={cv_duration}ms, OCR={ocr_duration}ms, Gemini={gemini_duration}ms)")

        boxes = [BoundingBox(**b) for b in ocr_result.get("bounding_boxes", [])]

        return OCRResponse(
            success=True,
            status="OCR_COMPLETED" if engine_used != "none" else "OCR_FAILED",
            traceId=trace_id,
            document_type=structured_details.type or "Unknown",
            confidence_score=ocr_result["confidence_score"],
            details=structured_details,
            raw_text=ocr_result["raw_text"],
            ocr_engine=engine_used,
            bounding_boxes=boxes,
            fallback=ocr_result["using_fallback"],
            message=f"OCR processed successfully via {engine_used}"
        )
    except HTTPException:
        raise
    except Exception as e:
        total_duration = int((time.time() - start_total) * 1000)
        log.error(f"[PIPELINE_ERROR] Exception in OCR processing: {e} Duration={total_duration}ms")
        return OCRResponse(
            success=False,
            status="OCR_FAILED",
            traceId=trace_id,
            document_type="Unknown",
            confidence_score=0.0,
            details=ExtractedDetails(type="Unknown", name="", number="", dob="", gender="", address=""),
            raw_text="",
            ocr_engine="none",
            bounding_boxes=[],
            fallback=True,
            message=f"OCR processing exception: {str(e)}"
        )
