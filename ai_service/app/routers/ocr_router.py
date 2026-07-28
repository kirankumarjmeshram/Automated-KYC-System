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
    AI Document Intelligence Pipeline with Complete OCR Debug Logging:
    1. Image Information & Metadata Extraction
    2. OpenCV Preprocessing & Step-by-Step Dimension Tracking
    3. Dual Engine OCR (PaddleOCR + EasyOCR) & Raw Unsummarized Objects
    4. Per-Line OCR Confidence & Bounding Box Extraction
    5. Modular Document Parser with Decision Reasoning
    6. Gemini Field Mapping
    7. Validation Engine (Anti-Hallucination)
    """
    start_total = time.time()
    trace_id = request.headers.get("x-trace-id") or request.headers.get("traceid") or str(uuid.uuid4())
    log = TraceAdapter(raw_logger, {"trace_id": trace_id})

    if not file or not file.filename:
        log.warning("Upload received with empty filename")
        raise HTTPException(status_code=400, detail="No file provided")

    log.info(f"[DOCUMENT_RECEIVED] Processing file '{file.filename}'")

    try:
        contents = await file.read()
        if not contents:
            log.warning("Upload received with zero bytes")
            raise HTTPException(status_code=400, detail="Empty file payload")

        # Step 1: OpenCV Preprocessing & Metadata
        start_cv = time.time()
        processed_img, cv_info = preprocess_image(contents)
        cv_duration = int((time.time() - start_cv) * 1000)
        img_meta = cv_info.get("metadata", {})
        cv_steps = cv_info.get("steps", [])

        log.info(f"[IMAGE_PREPROCESSING_COMPLETED] Duration={cv_duration}ms Format={img_meta.get('format')} Dimensions={img_meta.get('width')}x{img_meta.get('height')}")

        # Step 2: Dual Engine OCR & OCR Result Fusion
        start_ocr = time.time()
        log.info("[OCR_STARTED] Dispatches to PaddleOCR & EasyOCR")
        ocr_result = extract_ocr_text(processed_img, file.filename)
        ocr_duration = int((time.time() - start_ocr) * 1000)
        engine_used = ocr_result.get("ocr_engine", "none")
        raw_text = ocr_result.get("raw_text", "")
        log.info(f"[OCR_COMPLETED] Engine={engine_used} Duration={ocr_duration}ms Confidence={ocr_result['confidence_score']:.2f}")

        # Step 3: Modular Document Parser & Decision Reasoning
        log.info("[PARSER_STARTED] Dispatching to Modular Document Parsers")
        parsed_details, parser_decisions = parse_document(raw_text, ocr_result.get("bounding_boxes", []))
        log.info(f"[PARSER_COMPLETED] Type={parsed_details.type} Name='{parsed_details.name}' Number='{parsed_details.number}'")

        # Step 4: Gemini LLM Field Mapping
        start_gemini = time.time()
        log.info("[GEMINI_MAPPING_STARTED] Dispatching to Gemini LLM with Anti-Hallucination prompt")
        gemini_details = structure_text_with_gemini(raw_text)
        gemini_duration = int((time.time() - start_gemini) * 1000)
        log.info(f"[GEMINI_MAPPING_COMPLETED] Structuring completed in {gemini_duration}ms Type={gemini_details.type}")

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
        log.info("[VALIDATION_STARTED] Validating extracted fields against raw OCR text")
        validated_details, val_warnings = validate_extracted_fields(merged_details, raw_text)
        log.info(f"[VALIDATION_COMPLETED] Verified fields for Type={validated_details.type}")

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
            raw_paddle=ocr_result.get("raw_paddle", ""),
            raw_easy=ocr_result.get("raw_easy", ""),
            raw_easyocr_objects=ocr_result.get("raw_easyocr_objects", []),
            raw_paddle_objects=ocr_result.get("raw_paddle_objects", None),
            engine_info=ocr_result.get("engine_info", {}),
            per_line_confidence=ocr_result.get("per_line_confidence", []),
            parser_decisions=parser_decisions,
            cv_steps_detail=cv_steps,
            image_metadata=img_meta,
            ocr_engine=engine_used,
            bounding_boxes=boxes,
            fallback=ocr_result["using_fallback"],
            message=f"OCR processed successfully via {engine_used}"
        )
    except HTTPException:
        raise
    except Exception as e:
        total_duration = int((time.time() - start_total) * 1000)
        log.error(f"[PIPELINE_ERROR] Exception in OCR processing: {e} Duration={total_duration}ms", exc_info=True)
        return OCRResponse(
            success=False,
            status="OCR_FAILED",
            traceId=trace_id,
            document_type="Unknown",
            confidence_score=0.0,
            details=ExtractedDetails(type="Unknown", name="", number="", dob="", gender="", address=""),
            raw_text="",
            raw_paddle="",
            raw_easy="",
            raw_easyocr_objects=[],
            raw_paddle_objects=None,
            engine_info={},
            per_line_confidence=[],
            parser_decisions=[],
            cv_steps_detail=[],
            image_metadata={},
            ocr_engine="none",
            bounding_boxes=[],
            fallback=True,
            message=f"OCR processing exception: {str(e)}"
        )
