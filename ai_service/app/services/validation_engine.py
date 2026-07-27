import re
import logging
from app.models.ocr_schemas import ExtractedDetails

logger = logging.getLogger(__name__)

def validate_extracted_fields(gemini_details: ExtractedDetails, raw_ocr_text: str) -> tuple[ExtractedDetails, list]:
    """
    Validation Engine:
    Validates every Gemini-extracted field against raw OCR text.
    If a field value does not exist or fuzzy match inside raw OCR text, it is rejected to prevent hallucinations.
    """
    validated = ExtractedDetails(**gemini_details.dict())
    warnings = []
    raw_upper = raw_ocr_text.upper().replace("\n", " ")

    # 1. Validate Document Number
    if validated.number:
        clean_num = validated.number.replace(" ", "").upper()
        if clean_num not in raw_ocr_text.replace(" ", "").upper():
            warnings.append(f"Hallucinated document number '{validated.number}' rejected by Validation Engine.")
            validated.number = ""

    # 2. Validate Name
    if validated.name:
        name_words = validated.name.upper().split()
        match_count = sum(1 for word in name_words if len(word) >= 3 and word in raw_upper)
        if match_count == 0 and len(name_words) > 0:
            warnings.append(f"Hallucinated name '{validated.name}' rejected by Validation Engine.")
            validated.name = ""

    # 3. Validate Date of Birth
    if validated.dob:
        if validated.dob not in raw_ocr_text:
            warnings.append(f"Hallucinated DOB '{validated.dob}' rejected by Validation Engine.")
            validated.dob = ""

    # 4. Validate Father Name
    if validated.father_name:
        f_words = validated.father_name.upper().split()
        f_match = sum(1 for word in f_words if len(word) >= 3 and word in raw_upper)
        if f_match == 0 and len(f_words) > 0:
            warnings.append(f"Hallucinated father name '{validated.father_name}' rejected by Validation Engine.")
            validated.father_name = ""

    return validated, warnings
