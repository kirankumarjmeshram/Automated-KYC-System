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

## 2. Enterprise Name Matching Engine (`backend/utils/nameMatcher.js`)

The **Enterprise Name Matching Engine** serves as the single source of truth for comparing person names across all KYC documents (Aadhaar, PAN, Passport, Driving Licence, Voter ID, and future documents).

### 2.1 Normalization & Tokenization Pipeline
1. **Normalization**: Converts to uppercase, strips accents/Unicode diacritics, removes dots (`J.` ➔ `J`), commas, dashes, and collapses multiple spaces.
2. **Tokenization**: Extracts `firstName`, `middleNames` (array), `lastName`, and `tokens` array.

### 2.2 Decision Rules & Logic
* **Rule 1**: First name matches, Last name matches, Middle differs ➔ `VERIFIED` (Warning: "Middle name mismatch.")
* **Rule 2**: First matches, Last matches, Middle initial (`J` vs `JAGESHWAR`) ➔ `VERIFIED` (Reason: "Middle name abbreviated on document.")
* **Rule 3**: First matches, Last matches, Middle missing on OCR ➔ `VERIFIED` (Reason: "Middle name omitted on document.")
* **Rule 4**: First matches, Last missing on OCR ➔ `MANUAL_REVIEW`
* **Rule 5**: Only surname matches ➔ `REJECTED`
* **Rule 6**: Only first name matches ➔ `MANUAL_REVIEW`
* **Rule 7**: Nothing matches ➔ `REJECTED`

---

## 3. Directory Structure

```
Automated-KYC-System/
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
├── backend/
│   ├── utils/
│   │   ├── nameMatcher.js                 <-- Reusable Enterprise Name Engine
│   │   └── verificationReportBuilder.js   <-- Enterprise Verification Report Generator
│   ├── logger/                            <-- Centralized Winston Logging Stack
│   └── logs/                              <-- Multi-file runtime log targets
└── ai_service/
    └── app/
        ├── utils/
        │   └── logger.py
        └── routers/
            └── ocr_router.py
```
