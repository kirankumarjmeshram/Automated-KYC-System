# Automated KYC System — Project Architecture Document

## 1. Executive Summary & Architecture Overview

The **Automated KYC System** is a production-grade digital Know Your Customer (KYC) identity verification platform designed with a microservices-capable, multi-tier architecture. It automates customer document onboarding, OCR text extraction, document classification, face matching, liveness detection, and AI validation.

### Core Architecture Stack
* **Frontend**: React 19, React-Bootstrap, React Router DOM v7, Axios (`frontend/`)
* **Backend API Gateway**: Node.js, Express 4.x, Multer (memory storage), Winston Logger, Helmet, Rate Limiter, Zod, Mongoose (`backend/`)
* **AI & Computer Vision Service**: Python 3.10+, FastAPI 0.140+, OpenCV, PaddleOCR / EasyOCR, Google Generative AI (Gemini 1.5 Flash), Pydantic (`ai_service/`)
* **Database**: MongoDB Atlas (Mongoose ODM)
* **Cloud Storage & Auth (Target Architecture)**: AWS S3, Clerk Authentication

```
               ┌──────────────────────────────────────────┐
               │           React Frontend Client          │
               │            (Port 3000 / Vercel)          │
               └────────────────────┬─────────────────────┘
                                    │
                         HTTP REST / Multipart
                                    │
               ┌────────────────────▼─────────────────────┐
               │           Express Backend API            │
               │            (Port 5000 / Render)          │
               └─────────┬──────────────────────┬─────────┘
                         │                      │
        MongoDB Driver   │                      │ HTTP Client (Axios Multipart)
                         │                      │ POST http://localhost:8000/ocr/process
   ┌─────────────────────▼──────┐   ┌───────────▼─────────────────────┐
   │       MongoDB Atlas        │   │        FastAPI AI Service       │
   │  (Document Persistence)    │   │      (Port 8000 / Render)       │
   └────────────────────────────┘   └──────────────────┬──────────────┘
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    │ OpenCV Preprocessing & Deskew       │
                                    │ Dual Engine (PaddleOCR / EasyOCR)   │
                                    │ Gemini LLM Entity Extraction Engine │
                                    └─────────────────────────────────────┘
```

---

## 2. Complete Project Directory Structure

```
Automated-KYC-System/
├── docs/                         <-- System Architecture & Standards Documentation
│   ├── API_DOCUMENTATION.md
│   ├── CODING_STANDARDS.md
│   ├── CONTRIBUTING.md
│   ├── DATA_FLOW.md
│   ├── DEPLOYMENT_ARCHITECTURE.md
│   ├── DESIGN_DECISIONS.md
│   ├── DEVELOPMENT_GUIDE.md
│   ├── ERROR_HANDLING_GUIDE.md
│   ├── FOLDER_STRUCTURE_GUIDE.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PROJECT_ARCHITECTURE.md
│   ├── PROJECT_FLOW.md
│   ├── TESTING_STRATEGY.md
│   └── Technical_Solution_Document.md
├── package.json                  <-- Root workspace orchestration
├── package-lock.json
│
├── frontend/                     <-- React Single Page Application (CRA)
│   ├── .env                      <-- Frontend environment config
│   ├── package.json
│   └── src/
│       ├── App.js                <-- Root application component
│       ├── components/           <-- Reusable UI components
│       │   ├── AadhaarPanForm.js     <-- Single-file upload component (/api/process)
│       │   ├── KycStepupForm.js     <-- Dual-document verification component (/api/verify)
│       │   ├── Navbar.js             <-- Primary navigation bar
│       │   └── VerificationResult.js <-- Result rendering component
│       └── pages/                <-- Page-level view components
│           ├── Home.js
│           └── Verify.js
│
├── backend/                      <-- Express Node.js Backend API
│   ├── .env                      <-- Backend environment config
│   ├── logger.js                 <-- Winston logging module (Console + File)
│   ├── package.json
│   ├── server.js                 <-- Express app initialization & route mounting
│   ├── config/                   <-- Centralized configuration handlers
│   │   ├── db.js                 <-- Mongoose MongoDB connection initializer
│   │   └── env.js                <-- Zod env validation (includes AI_SERVICE_URL)
│   ├── controllers/              <-- Express request handlers
│   │   └── documentController.js <-- Invokes aiService.js with local fallback safety
│   ├── models/                   <-- Mongoose schemas & data models
│   │   └── Document.js           <-- Document record schema
│   ├── routes/                   <-- API endpoint definitions
│   │   └── documentRoutes.js     <-- Multer file upload & document endpoints
│   ├── services/                 <-- Service abstraction layer
│   │   └── aiService.js          <-- [PHASE 2] Express-to-FastAPI HTTP RPC client
│   ├── middlewares/              <-- Express custom middleware
│   │   ├── errorHandler.js       <-- Centralized error response handler
│   │   └── validate.js           <-- Zod request payload validator
│   └── logs/                     <-- Application runtime logs
│       └── application.log
│
└── ai_service/                   <-- [PHASE 2] FastAPI Python Microservice
    ├── .env                      <-- Python environment config
    ├── requirements.txt          <-- Python package dependencies
    └── app/
        ├── main.py               <-- FastAPI app instance & health endpoints
        ├── config/
        │   └── settings.py       <-- Centralized Pydantic settings
        ├── models/
        │   └── ocr_schemas.py    <-- Pydantic request/response schemas
        ├── services/
        │   ├── cv_service.py     <-- OpenCV pre-processing & deskewing
        │   ├── ocr_service.py    <-- PaddleOCR & EasyOCR dual-engine pipeline
        │   └── gemini_service.py <-- Gemini LLM text structuring
        └── routers/
            └── ocr_router.py     <-- POST /ocr/process endpoint
```

---

## 3. Layer Analysis & Phase 2 Architecture

### 3.1 AI Service (`/ai_service`)
FastAPI service engineered for low-latency computer vision & ML tasks.
* **`app/main.py`**: Initializes FastAPI app instance with CORS middleware, health endpoints (`GET /`, `GET /health`), and mounts `ocr_router`.
* **`app/config/settings.py`**: Parses `PORT`, `GEMINI_API_KEY`, `ENVIRONMENT`, `PADDLE_OCR_LANG` with Pydantic field validators.
* **`app/models/ocr_schemas.py`**: Pydantic models for structured document output (`ExtractedDetails`, `OCRResponse`, `BoundingBox`).
* **`app/services/cv_service.py`**: OpenCV pre-processing pipeline (resizing, grayscale conversion, Gaussian blur noise reduction, adaptive thresholding, deskew transformation).
* **`app/services/ocr_service.py`**: Dual-engine extraction (`PaddleOCR` primary, `EasyOCR` fallback, `FallbackParser` metadata parser fallback).
* **`app/services/gemini_service.py`**: Dispatches extracted OCR text to `gemini-1.5-flash` for JSON normalization with deterministic regex fallback.
* **`app/routers/ocr_router.py`**: Exposes `POST /ocr/process` accepting `multipart/form-data` image stream payloads.

### 3.2 Backend Service Bridge (`backend/services/aiService.js`)
* **`aiService.js`**: Express-side HTTP client using `axios` and `form-data` to post binary buffers to `http://localhost:8000/ocr/process`. Includes a 12-second timeout and catches connection errors cleanly.
* **`documentController.js`**: Tries `aiService.processImageWithAI(file)`. If the Python AI microservice returns extracted details, uses them; if unconfigured or offline, seamlessly degrades to local processing without throwing server errors.
