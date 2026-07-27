import logging
import re
import json
import base64
import urllib.request
from app.config.settings import settings
from app.models.ocr_schemas import ExtractedDetails

logger = logging.getLogger(__name__)

# Common PAN Header Blacklist to exclude from Name parsing
PAN_HEADER_BLACKLIST = [
    "INCOME TAX DEPARTMENT",
    "INCOMETAX",
    "TAX DEPARTMENT",
    "GOVT OF INDIA",
    "GOVERNMENT OF INDIA",
    "COVTOFINDIA",
    "GOVTOFINDIA",
    "GOVT OF",
    "GOVERNMENT OF",
    "BHARAT SARKAR",
    "PERMANENT ACCOUNT NUMBER",
    "PERMANENT ACCOUNT",
    "ACCOUNT NUMBER",
    "CARD",
    "SIGNATURE",
    "DEPARTMENT",
    "INDIA",
    "भारत सरकार",
    "आयकर विभाग",
    "संख्या",
    "खाता",
    "नाम",
    "पिता",
]

def is_header_line(line_text: str) -> bool:
    """Checks if text line contains common government headers or logos."""
    upper = line_text.upper().strip()
    if not upper:
        return True
    for header in PAN_HEADER_BLACKLIST:
        if header in upper or upper in header:
            return True
    return False

def structure_text_with_gemini(raw_text: str) -> ExtractedDetails:
    """
    Dispatches extracted OCR text to Gemini REST API.
    Uses structural reasoning to extract name, father_name, number, dob.
    Falls back to spatial regex parser if Gemini is unconfigured or rate limited.
    """
    if not raw_text or not raw_text.strip():
        return ExtractedDetails(type="Unknown", name="", father_name="", number="", dob="", gender="", address="")

    if settings.GEMINI_API_KEY:
        try:
            models_to_try = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-pro"]
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                prompt = f"""
                You are a senior Indian KYC document extraction AI.
                Analyze the following OCR text extracted from an Indian KYC Identity Document (Aadhaar or PAN Card):
                ---
                {raw_text}
                ---
                RULES FOR PAN CARDS:
                - IGNORE headers: "INCOME TAX DEPARTMENT", "GOVT OF INDIA", "GOVERNMENT OF INDIA", "PERMANENT ACCOUNT NUMBER".
                - DO NOT mistake "GOVT OF INDIA" or "INCOME TAX" for the person's name!
                - Card Holder Name is the individual's full name printed below the header.
                - Father's Name is printed below the Holder's Name.
                - PAN Number strictly matches [A-Z]{{5}}[0-9]{{4}}[A-Z].

                Return ONLY a valid JSON object matching this exact schema:
                {{
                    "type": "Aadhaar" or "PAN" or "Unknown",
                    "name": "Card Holder Full Name in Uppercase",
                    "father_name": "Father's Full Name in Uppercase or empty string",
                    "number": "Document Number without spaces",
                    "dob": "Date of Birth in DD/MM/YYYY format or empty string",
                    "gender": "Male or Female or empty string",
                    "address": "Full address or empty string"
                }}
                Do not include markdown code block formatting (```json), only return raw JSON.
                """
                payload = {"contents": [{"parts": [{"text": prompt}]}]}
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )

                try:
                    with urllib.request.urlopen(req, timeout=8) as response:
                        res_body = response.read().decode("utf-8")
                        res_json = json.loads(res_body)
                        candidates = res_json.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                text_out = parts[0]["text"].strip()
                                clean_text = text_out.replace("```json", "").replace("```", "").strip()
                                parsed = json.loads(clean_text)
                                return ExtractedDetails(
                                    type=parsed.get("type", "Unknown"),
                                    name=parsed.get("name", ""),
                                    father_name=parsed.get("father_name", ""),
                                    number=parsed.get("number", ""),
                                    dob=parsed.get("dob", ""),
                                    gender=parsed.get("gender", ""),
                                    address=parsed.get("address", "")
                                )
                except Exception as model_err:
                    logger.warn(f"Gemini REST model {model_name} failed: {model_err}")
                    continue
        except Exception as e:
            logger.warning(f"Gemini API structuring failed: {e}. Falling back to spatial regex parser.")

    return parse_details_regex(raw_text)

def parse_details_regex(raw_text: str) -> ExtractedDetails:
    """
    Robust spatial regex entity extractor for PAN & Aadhaar cards.
    Excludes header noise (GOVT OF INDIA, INCOME TAX) and parses Holder Name & Father's Name.
    """
    doc_type = "Unknown"
    name = ""
    father_name = ""
    number = ""
    dob = ""
    gender = ""
    address = ""

    if not raw_text:
        return ExtractedDetails(type="Unknown", name="", father_name="", number="", dob="", gender="", address="")

    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    # 1. Evaluate PAN Document
    is_pan = "INCOME TAX" in raw_text.upper() or "PERMANENT ACCOUNT" in raw_text.upper() or re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text)
    if is_pan:
        doc_type = "PAN"
        pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text)
        if pan_match:
            number = pan_match.group(0)

        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", raw_text)
        if dob_match:
            dob = dob_match.group(0)

        name_candidates = []
        for line in lines:
            line_upper = line.upper().strip()
            # Ignore headers, logos, numbers, and dates
            if is_header_line(line_upper):
                continue
            if number and number in line_upper:
                continue
            if dob and dob in line_upper:
                continue

            # Candidate name lines contain 3 to 35 uppercase letters and spaces
            if re.match(r"^[A-Z\s\.]{3,35}$", line_upper) and len(line_upper) >= 3:
                name_candidates.append(line_upper)

        if len(name_candidates) >= 1:
            name = name_candidates[0]
        if len(name_candidates) >= 2:
            father_name = name_candidates[1]

    # 2. Evaluate Aadhaar Document
    elif "आधार" in raw_text or "Aadhaar" in raw_text or re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text):
        doc_type = "Aadhaar"
        aadhaar_match = re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text)
        if aadhaar_match:
            number = aadhaar_match.group(0).replace(" ", "")

        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", raw_text)
        if dob_match:
            dob = dob_match.group(0)

        for line in lines:
            if "DOB" in line or "Birth" in line or "DATE OF BIRTH" in line:
                continue
            line_upper = line.upper().strip()
            if is_header_line(line_upper):
                continue
            if re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z]+)+$", line) or re.match(r"^[A-Z\s]{4,30}$", line_upper):
                name = line_upper
                break

    return ExtractedDetails(
        type=doc_type,
        name=name,
        father_name=father_name,
        number=number,
        dob=dob,
        gender=gender,
        address=address
    )
