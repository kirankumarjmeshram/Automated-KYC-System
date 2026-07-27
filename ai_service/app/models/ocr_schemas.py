from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ExtractedDetails(BaseModel):
    type: str = Field(default="", description="Document type, e.g., Aadhaar or PAN")
    name: str = Field(default="", description="Extracted individual's full name")
    father_name: Optional[str] = Field(default="", description="Extracted father's name")
    number: str = Field(default="", description="Extracted document identification number")
    dob: str = Field(default="", description="Extracted Date of Birth string (DD/MM/YYYY)")
    gender: Optional[str] = Field(default="", description="Extracted gender if available")
    address: Optional[str] = Field(default="", description="Extracted address if available")

class BoundingBox(BaseModel):
    text: str
    confidence: float
    box: Optional[List[List[float]]] = None

class OCRResponse(BaseModel):
    success: bool
    status: Optional[str] = Field(default="OCR_COMPLETED")
    traceId: Optional[str] = Field(default=None)
    document_type: str = Field(default="Unknown")
    confidence_score: float = Field(default=0.0)
    details: ExtractedDetails
    raw_text: str = Field(default="")
    ocr_engine: str = Field(default="none")
    bounding_boxes: List[BoundingBox] = Field(default_factory=list)
    fallback: bool = Field(default=False)
    message: Optional[str] = None
