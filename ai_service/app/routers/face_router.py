import logging
from fastapi import APIRouter, File, UploadFile, HTTPException
from app.services.face_verifier import verify_faces

logger = logging.getLogger("ai_service")
router = APIRouter(prefix="/face", tags=["Face Verification"])

@router.post("/verify")
async def verify_face_endpoint(
    documentFile: UploadFile = File(...),
    selfieFile: UploadFile = File(...)
):
    """
    POST /face/verify
    Compares cardholder photo from document image against applicant selfie.
    Returns facial similarity score, threshold (75%), and verification status.
    """
    if not documentFile or not selfieFile:
        raise HTTPException(status_code=400, detail="Both documentFile and selfieFile parameters are required.")

    doc_bytes = await documentFile.read()
    selfie_bytes = await selfieFile.read()

    if not doc_bytes or not selfie_bytes:
        raise HTTPException(status_code=400, detail="Empty documentFile or selfieFile payload.")

    result = verify_faces(doc_bytes, selfie_bytes)
    return {
        "faceVerification": result
    }
