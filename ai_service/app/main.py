from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ocr_router, face_router
from app.config.settings import settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ai_service")

app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI service for OpenCV Preprocessing, Dual-Engine OCR (PaddleOCR/EasyOCR), Gemini LLM Document Verification, and Face Matching Engine",
    version="1.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(ocr_router.router)
app.include_router(face_router.router)

@app.get("/")
def read_root():
    return {
        "message": f"{settings.APP_NAME} is running",
        "version": "1.2.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ai_service",
        "version": "1.2.0",
        "environment": settings.ENVIRONMENT
    }
