from fastapi import APIRouter, File, UploadFile, HTTPException
from app.models.ocr_schemas import OCRResponse, ExtractedDetails, BoundingBox
from app.services.cv_service import preprocess_image
from app.services.ocr_service import extract_ocr_text
from app.services.gemini_service import structure_text_with_gemini
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ocr", tags=["OCR Processing"])

@router.post("/process", response_model=OCRResponse)
async def process_document_ocr(file: UploadFile = File(...)):
    """
    Complete AI OCR Pipeline:
    1. Receive image binary upload stream
    2. Run OpenCV Preprocessing (Resize, Grayscale, Blur, Thresholding, Deskew)
    3. Run Dual-Engine OCR (PaddleOCR primary -> EasyOCR secondary)
    4. Run Gemini LLM entity structuring (or regex fallback)
    5. Return clean structured JSON response schema
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    logger.info(f"Processing OCR request for file: {file.filename}")

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file payload")

        # Step 1: OpenCV Preprocessing
        processed_img, cv_status = preprocess_image(contents)

        # Step 2: OCR Extraction
        ocr_result = extract_ocr_text(processed_img, file.filename)

        # Step 3: Gemini Structuring
        structured_details = structure_text_with_gemini(ocr_result["raw_text"])

        boxes = [BoundingBox(**b) for b in ocr_result.get("bounding_boxes", [])]

        return OCRResponse(
            success=True,
            document_type=structured_details.type or "Unknown",
            confidence_score=ocr_result["confidence_score"],
            details=structured_details,
            raw_text=ocr_result["raw_text"],
            ocr_engine=ocr_result["ocr_engine"],
            bounding_boxes=boxes,
            fallback=ocr_result["using_fallback"],
            message=f"OCR processed successfully via {ocr_result['ocr_engine']}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing OCR file {file.filename}: {e}", exc_info=True)
        # Return graceful failure fallback response
        return OCRResponse(
            success=False,
            document_type="Unknown",
            confidence_score=0.0,
            details=ExtractedDetails(type="Unknown", name="", number="", dob="", gender="", address=""),
            raw_text="",
            ocr_engine="none",
            bounding_boxes=[],
            fallback=True,
            message=f"OCR processing exception: {str(e)}"
        )
