from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="AI KYC Service",
    description="FastAPI service for OCR, Face Verification, and Liveness Detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AI KYC Service is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai_service"}
