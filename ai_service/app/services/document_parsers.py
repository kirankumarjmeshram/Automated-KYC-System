import re
import logging
from app.models.ocr_schemas import ExtractedDetails

logger = logging.getLogger(__name__)

PAN_HEADER_BLACKLIST = [
    "INCOME TAX DEPARTMENT", "INCOMETAX", "TAX DEPARTMENT", "GOVT OF INDIA",
    "GOVERNMENT OF INDIA", "COVTOFINDIA", "GOVTOFINDIA", "GOVT OF", "GOVERNMENT OF",
    "BHARAT SARKAR", "PERMANENT ACCOUNT NUMBER", "PERMANENT ACCOUNT", "ACCOUNT NUMBER",
    "CARD", "SIGNATURE", "DEPARTMENT", "INDIA", "भारत सरकार", "आयकर विभाग"
]

def is_header_text(text: str) -> bool:
    upper = text.upper().strip()
    if not upper:
        return True
    for header in PAN_HEADER_BLACKLIST:
        if header in upper or upper in header:
            return True
    return False

class PANParser:
    @staticmethod
    def parse(raw_text: str, bounding_boxes: list) -> ExtractedDetails:
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        number = ""
        dob = ""
        name = ""
        father_name = ""

        pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text)
        if pan_match:
            number = pan_match.group(0)

        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", raw_text)
        if dob_match:
            dob = dob_match.group(0)

        name_candidates = []
        for line in lines:
            upper = line.upper().strip()
            if is_header_text(upper):
                continue
            if number and number in upper:
                continue
            if dob and dob in upper:
                continue
            if re.match(r"^[A-Z\s\.]{3,35}$", upper) and len(upper) >= 3:
                name_candidates.append(upper)

        if len(name_candidates) >= 1:
            name = name_candidates[0]
        if len(name_candidates) >= 2:
            father_name = name_candidates[1]

        return ExtractedDetails(type="PAN", name=name, father_name=father_name, number=number, dob=dob)

class AadhaarParser:
    @staticmethod
    def parse(raw_text: str, bounding_boxes: list) -> ExtractedDetails:
        number = ""
        dob = ""
        name = ""
        gender = ""

        aadhaar_match = re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text)
        if aadhaar_match:
            number = aadhaar_match.group(0).replace(" ", "")

        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", raw_text)
        if dob_match:
            dob = dob_match.group(0)

        if "MALE" in raw_text.upper():
            gender = "Male"
        elif "FEMALE" in raw_text.upper():
            gender = "Female"

        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        for line in lines:
            upper = line.upper()
            if "DOB" in upper or "BIRTH" in upper or is_header_text(upper):
                continue
            if re.match(r"^[A-Z][a-z]+(\s[A-Z][a-z]+)+$", line) or re.match(r"^[A-Z\s]{4,30}$", upper):
                name = upper
                break

        return ExtractedDetails(type="Aadhaar", name=name, number=number, dob=dob, gender=gender)

class PassportParser:
    @staticmethod
    def parse(raw_text: str, bounding_boxes: list) -> ExtractedDetails:
        pass_match = re.search(r"\b[A-Z][0-9]{7}\b", raw_text)
        number = pass_match.group(0) if pass_match else ""
        return ExtractedDetails(type="Passport", name="", number=number)

class DrivingLicenceParser:
    @staticmethod
    def parse(raw_text: str, bounding_boxes: list) -> ExtractedDetails:
        dl_match = re.search(r"\b[A-Z]{2}[0-9]{13,15}\b", raw_text.replace(" ", ""))
        number = dl_match.group(0) if dl_match else ""
        return ExtractedDetails(type="DrivingLicence", name="", number=number)

def parse_document(raw_text: str, bounding_boxes: list) -> ExtractedDetails:
    """
    Detects document type and dispatches to specific modular document parser.
    """
    if not raw_text:
        return ExtractedDetails(type="Unknown")

    upper = raw_text.upper()
    if "INCOME TAX" in upper or "PERMANENT ACCOUNT" in upper or re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text):
        return PANParser.parse(raw_text, bounding_boxes)
    elif " आधार" in raw_text or "AADHAAR" in upper or re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text):
        return AadhaarParser.parse(raw_text, bounding_boxes)
    elif "PASSPORT" in upper or re.search(r"\b[A-Z][0-9]{7}\b", raw_text):
        return PassportParser.parse(raw_text, bounding_boxes)
    elif "DRIVING" in upper or "LICENCE" in upper or "LICENSE" in upper:
        return DrivingLicenceParser.parse(raw_text, bounding_boxes)

    return ExtractedDetails(type="Unknown")
