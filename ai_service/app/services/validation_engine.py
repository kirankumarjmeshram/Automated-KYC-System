import re
import logging
from app.models.ocr_schemas import ExtractedDetails

logger = logging.getLogger(__name__)

def is_fuzzy_number_match(extracted_num: str, raw_text: str) -> bool:
    """
    Checks if extracted document number matches raw OCR text allowing common OCR typo substitutions
    (5 <-> S, 0 <-> O/D/Q, 1 <-> I/L/|, B <-> 8, Z <-> 2).
    """
    clean_ext = re.sub(r"[^\w]", "", extracted_num).upper()
    raw_upper = raw_text.upper().replace("\n", " ")
    raw_alphanumeric = re.sub(r"[^\w]", "", raw_upper)

    if clean_ext in raw_alphanumeric:
        return True

    # Normalize both extracted number and raw text to fuzzy baseline
    # (replace S->5, O/D/Q->0, I/L/|->1, B->8, Z->2)
    def normalize_ocr_typos(text: str) -> str:
        res = ""
        for ch in text.upper():
            if ch in ("S", "G"): res += "5"
            elif ch in ("O", "D", "Q"): res += "0"
            elif ch in ("I", "L", "|"): res += "1"
            elif ch == "B": res += "8"
            elif ch == "Z": res += "2"
            else: res += ch
        return res

    fuzzy_ext = normalize_ocr_typos(clean_ext)
    fuzzy_raw = normalize_ocr_typos(raw_alphanumeric)

    if fuzzy_ext in fuzzy_raw:
        return True

    # Token check for 10-character / 12-character substrings
    ext_len = len(clean_ext)
    if ext_len > 0:
        for i in range(len(raw_alphanumeric) - ext_len + 1):
            sub = raw_alphanumeric[i:i + ext_len]
            fuzzy_sub = normalize_ocr_typos(sub)
            if fuzzy_ext == fuzzy_sub:
                return True

    return False

def validate_extracted_fields(gemini_details: ExtractedDetails, raw_ocr_text: str) -> tuple[ExtractedDetails, list]:
    """
    Validation Engine (Anti-Hallucination):
    Validates extracted fields against raw OCR text.
    Strips OCR punctuation noise and performs OCR typo-aware verification for numbers and names.
    """
    validated = ExtractedDetails(**gemini_details.dict())
    warnings = []
    raw_upper = raw_ocr_text.upper().replace("\n", " ")
    raw_alphanumeric = re.sub(r"[^\w]", "", raw_upper)

    if not raw_ocr_text or not raw_ocr_text.strip():
        return validated, warnings

    # 1. Validate Document Number
    if validated.number:
        if not is_fuzzy_number_match(validated.number, raw_ocr_text):
            warnings.append(f"Hallucinated document number '{validated.number}' rejected by Validation Engine.")
            validated.number = ""

    # 2. Validate Name
    if validated.name:
        name_words = validated.name.upper().split()
        match_count = sum(1 for word in name_words if len(word) >= 3 and (word in raw_upper or word in raw_alphanumeric))
        if match_count == 0 and len(name_words) > 0:
            warnings.append(f"Hallucinated name '{validated.name}' rejected by Validation Engine.")
            validated.name = ""

    # 3. Validate Date of Birth
    if validated.dob:
        dob_digits = re.sub(r"[^\d]", "", validated.dob)
        raw_digits = re.sub(r"[^\d]", "", raw_ocr_text)
        if dob_digits not in raw_digits and validated.dob not in raw_ocr_text:
            warnings.append(f"Hallucinated DOB '{validated.dob}' rejected by Validation Engine.")
            validated.dob = ""

    # 4. Validate Father Name
    if validated.father_name:
        f_words = validated.father_name.upper().split()
        f_match = sum(1 for word in f_words if len(word) >= 3 and (word in raw_upper or word in raw_alphanumeric))
        if f_match == 0 and len(f_words) > 0:
            warnings.append(f"Hallucinated father name '{validated.father_name}' rejected by Validation Engine.")
            validated.father_name = ""

    return validated, warnings
