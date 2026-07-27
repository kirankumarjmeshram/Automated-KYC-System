import logging
import re
import json
import base64
import urllib.request
from app.config.settings import settings
from app.models.ocr_schemas import ExtractedDetails

logger = logging.getLogger(__name__)

def structure_text_with_gemini(raw_text: str) -> ExtractedDetails:
    """
    Dispatches extracted OCR text to Gemini REST API.
    Falls back to regex parser if Gemini is unconfigured or rate limited.
    Never fabricates dummy fields.
    """
    if not raw_text or not raw_text.strip():
        return ExtractedDetails(type="Unknown", name="", number="", dob="", gender="", address="")

    if settings.GEMINI_API_KEY:
        try:
            models_to_try = ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-pro"]
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                prompt = f"""
                Analyze the following extracted text from an Indian KYC Identity Document (Aadhaar or PAN Card):
                ---
                {raw_text}
                ---
                Return ONLY a valid JSON object matching this exact schema:
                {{
                    "type": "Aadhaar" or "PAN" or "Unknown",
                    "name": "Full Name in Uppercase",
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
                                    number=parsed.get("number", ""),
                                    dob=parsed.get("dob", ""),
                                    gender=parsed.get("gender", ""),
                                    address=parsed.get("address", "")
                                )
                except Exception as model_err:
                    logger.warn(f"Gemini REST model {model_name} failed: {model_err}")
                    continue
        except Exception as e:
            logger.warning(f"Gemini API structuring failed: {e}. Falling back to regex parser.")

    return parse_details_regex(raw_text)

def parse_details_regex(raw_text: str) -> ExtractedDetails:
    """Deterministic regex entity extractor."""
    doc_type = "Unknown"
    name = ""
    number = ""
    dob = ""
    gender = ""
    address = ""

    if not raw_text:
        return ExtractedDetails(type="Unknown", name="", number="", dob="", gender="", address="")

    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    # Check Aadhaar indicators
    if "आधार" in raw_text or "Aadhaar" in raw_text or re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text):
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
            if re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z]+)+$", line) or re.match(r"^[A-Z\s]{4,30}$", line):
                if line not in ["GOVERNMENT OF INDIA", "INDIA", "AADHAAR"]:
                    name = line.upper()
                    break

    # Check PAN indicators
    elif "INCOME TAX" in raw_text or re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text):
        doc_type = "PAN"
        pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text)
        if pan_match:
            number = pan_match.group(0)

        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", raw_text)
        if dob_match:
            dob = dob_match.group(0)

        for line in lines:
            if line not in ["INCOME TAX DEPARTMENT", "GOVT OF INDIA", "PERMANENT ACCOUNT NUMBER"]:
                if re.match(r"^[A-Z\s]{4,30}$", line):
                    name = line.strip()
                    break

    return ExtractedDetails(
        type=doc_type,
        name=name,
        number=number,
        dob=dob,
        gender=gender,
        address=address
    )
