import time
import uuid
import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from app.models.ocr_schemas import OCRResponse, ExtractedDetails, BoundingBox
from app.services.cv_service import preprocess_image
from app.services.ocr_service import extract_ocr_text
from app.services.document_parsers import parse_document
from app.services.gemini_service import structure_text_with_gemini
from app.services.validation_engine import validate_extracted_fields
from app.utils.logger import setup_logger, TraceAdapter

raw_logger = setup_logger("ai_service")
router = APIRouter(prefix="/ocr", tags=["OCR Processing"])

@router.post("/process", response_model=OCRResponse)
async def process_document_ocr(request: Request, file: UploadFile = File(...)):
    """
    AI Document Intelligence Pipeline:
    1. OpenCV Preprocessing & Enhancement
    2. Dual Engine OCR (PaddleOCR + EasyOCR)
    3. OCR Result Fusion
    4. Modular Document Parser (PANParser, AadhaarParser, PassportParser, DrivingLicenceParser)
    5. Gemini Field Mapping (with anti-hallucination prompts)
    6. Validation Engine (validates fields against raw OCR text)
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

        # Step 1: OpenCV Preprocessing & Enhancement
        start_cv = time.time()
        processed_img, cv_status = preprocess_image(contents)
        cv_duration = int((time.time() - start_cv) * 1000)
        log.info(f"[IMAGE_PREPROCESSING] OpenCV completed in {cv_duration}ms ({cv_status})")

        # Step 2: Dual Engine OCR & OCR Result Fusion
        start_ocr = time.time()
        ocr_result = extract_ocr_text(processed_img, file.filename)
        ocr_duration = int((time.time() - start_ocr) * 1000)
        engine_used = ocr_result.get("ocr_engine", "none")
        raw_text = ocr_result.get("raw_text", "")
        log.info(f"[OCR_COMPLETED] Engine={engine_used} Duration={ocr_duration}ms Confidence={ocr_result['confidence_score']:.2f}")

        # Step 3: Modular Document Parser
        parsed_details = parse_document(raw_text, ocr_result.get("bounding_boxes", []))
        log.info(f"[DOCUMENT_PARSER] Type={parsed_details.type} Name='{parsed_details.name}' Number='{parsed_details.number}'")

        # Step 4: Gemini LLM Field Mapping
        start_gemini = time.time()
        gemini_details = structure_text_with_gemini(raw_text)
        gemini_duration = int((time.time() - start_gemini) * 1000)
        log.info(f"[GEMINI_COMPLETED] Structuring completed in {gemini_duration}ms Type={gemini_details.type}")

        # Merge Parsed & Gemini extractions
        merged_details = ExtractedDetails(
            type=gemini_details.type if gemini_details.type != "Unknown" else parsed_details.type,
            name=gemini_details.name or parsed_details.name,
            father_name=gemini_details.father_name or parsed_details.father_name,
            number=gemini_details.number or parsed_details.number,
            dob=gemini_details.dob or parsed_details.dob,
            gender=gemini_details.gender or parsed_details.gender,
            address=gemini_details.address or parsed_details.address
        )

        # Step 5: Validation Engine (Anti-Hallucination)
        validated_details, val_warnings = validate_extracted_fields(merged_details, raw_text)
        if val_warnings:
            log.warning(f"[VALIDATION_ENGINE] Warnings: {val_warnings}")

        total_duration = int((time.time() - start_total) * 1000)
        log.info(f"[PIPELINE_COMPLETE] TotalDuration={total_duration}ms (Preprocess={cv_duration}ms, OCR={ocr_duration}ms, Gemini={gemini_duration}ms)")

        boxes = [BoundingBox(**b) for b in ocr_result.get("bounding_boxes", [])]

        return OCRResponse(
            success=True,
            status="OCR_COMPLETED" if engine_used != "none" and validated_details.type != "Unknown" else "OCR_FAILED",
            traceId=trace_id,
            document_type=validated_details.type or "Unknown",
            confidence_score=ocr_result["confidence_score"],
            details=validated_details,
            raw_text=raw_text,
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
