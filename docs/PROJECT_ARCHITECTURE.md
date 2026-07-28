# Automated KYC System — Project Architecture Document

## 1. Executive Summary & Architecture Overview

The **Automated KYC System** is a production-grade digital Know Your Customer (KYC) identity verification platform designed with a microservices-capable, multi-tier architecture. It automates customer document onboarding, OCR text extraction, document classification, face matching, liveness detection, and AI validation.

### Core Architecture Stack
* **Frontend**: React 19, React-Bootstrap, React Router DOM v7, Axios (`frontend/`)
* **Backend API Gateway**: Node.js, Express 4.x, Multer (memory storage), Winston Logger, Helmet, Rate Limiter, Zod, Mongoose (`backend/`)
* **AI & Computer Vision Service**: Python 3.10+, FastAPI 0.140+, OpenCV, PaddleOCR / EasyOCR, Google Generative AI (Gemini Flash), Pydantic (`ai_service/`)
* **Database**: MongoDB Atlas (Mongoose ODM)
* **Cloud Storage & Auth (Target Architecture)**: AWS S3, Clerk Authentication

---

## 2. Unsummarized OCR Debug Pipeline Logging (`backend/logs/ocr.log`)

Every KYC document upload (Aadhaar and PAN) records 8 dedicated debug blocks tagged with the request `TraceID`:

1. **IMAGE INFORMATION**: Filename, size (bytes), mime type, width (px), height (px), image format (PNG, JPEG).
2. **IMAGE PREPROCESSING STAGES**: Image dimensions tracked after every computer vision step (Original ➔ Resize ➔ Grayscale ➔ CLAHE ➔ Denoise ➔ Sharpen ➔ Adaptive Threshold ➔ Deskew ➔ Final).
3. **OCR ENGINE INFORMATION**: Engine name, EasyOCR version (`1.7.x`), language (`['en']`), GPU enabled status, model path, config parameters.
4. **RAW OCR RESPONSE OBJECTS**: Complete unsummarized raw JSON response array returned by EasyOCR / PaddleOCR (e.g. `[ [[[x1,y1...], "INCOME TAX DEPARTMENT", 0.99]], ... ]`).
5. **PER-LINE OCR CONFIDENCE & BOUNDING BOXES**: Text, confidence score, and 4-point coordinate bounding boxes for every detected text line.
6. **PARSER INPUT**: Raw OCR text stream provided to document parsers.
7. **PARSER DECISIONS & REASONING**: Field-level selection rationale, matched regexes, line indices (`L0`, `L1`...), and blacklisted header exclusion reasons.
8. **OCR FAILURE**: Exception reason, engine response, raw response, exception name, stack trace.

---

## 3. Directory Structure

```
Automated-KYC-System/
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
├── backend/
│   ├── logger/
│   │   └── ocrLogger.js                   <-- Unsummarized OCR Debug Logger
│   ├── logs/
│   │   ├── ocr.log                        <-- Formatted Debug & Raw OCR Log Target
│   │   ├── requests.log
│   │   ├── audit.log
│   │   └── performance.log
│   └── services/
│       └── aiService.js
└── ai_service/
    └── app/
        ├── services/
        │   ├── cv_service.py              <-- Preprocessing Dimension Tracker
        │   ├── ocr_service.py             <-- Unsummarized EasyOCR/PaddleOCR Object Extractor
        │   └── document_parsers.py        <-- Decision Reasoning Parser
        └── routers/
            └── ocr_router.py
```
