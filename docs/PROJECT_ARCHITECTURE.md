# Automated KYC System — Project Architecture Document

## 1. Executive Summary & Architecture Overview

The **Automated KYC System** is a production-grade digital Know Your Customer (KYC) identity verification platform designed with a microservices-capable, multi-tier architecture. It automates customer document onboarding, OCR text extraction, document classification, face matching, liveness detection, and AI validation.

### Core Architecture Stack
* **Frontend**: React 19, React-Bootstrap, React Router DOM v7, Axios (`frontend/`)
* **Backend API Gateway**: Node.js, Express 4.x, Multer (memory storage), Winston Logger, Helmet, Rate Limiter, Zod, Mongoose (`backend/`)
* **AI & Computer Vision Service**: Python 3.10+, FastAPI 0.140+, OpenCV, PaddleOCR / EasyOCR, Google Generative AI (Gemini Flash), Pydantic (`ai_service/`)
* **Database**: MongoDB Atlas (Mongoose ODM)
* **Cloud Storage & Auth (Target Architecture)**: AWS S3, Clerk Authentication

```
               ┌──────────────────────────────────────────┐
               │           React Frontend Client          │
               │            (Port 3000 / Vercel)          │
               └────────────────────┬─────────────────────┘
                                    │
                         HTTP REST / Multipart (x-trace-id)
                                    │
               ┌────────────────────▼─────────────────────┐
               │           Express Backend API            │
               │            (Port 5000 / Render)          │
               └─────────┬──────────────────────┬─────────┘
                         │                      │
        MongoDB Driver   │                      │ HTTP RPC Stream (x-trace-id)
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

## 2. Centralized Logging Architecture & Trace ID Flow (Phase 2.1)

### 2.1 Trace ID Lifecycle Across Service Boundaries
Every KYC submission is assigned a unique UUID `traceId` (`8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af`) that propagates across all service tiers:

```
[React Frontend] ── x-trace-id: UUID ──> [Express API Gateway] ── x-trace-id: UUID ──> [FastAPI AI Service]
       ▲                                         │                                            │
       │                                         ▼                                            ▼
       └──────── traceId in JSON Response ───────┴────── Logged in backend/logs/ ─────────────┘
```

### 2.2 Backend Multi-File Winston Logger Hierarchy (`backend/logs/`)
1. **`requests.log`**: HTTP request duration, method, path, IP, user-agent, status code, and `TraceID`.
2. **`audit.log`**: Status transition timeline events (`UPLOADED` -> `OCR_PROCESSING` -> `OCR_COMPLETED` -> `VERIFIED` / `REJECTED`).
3. **`ocr.log`**: Granular OCR extraction steps (`PADDLE_SUCCESS`, `EASYOCR_SUCCESS`, `GEMINI_COMPLETED`, `FIELD_EXTRACTION`).
4. **`performance.log`**: Timing metrics for OpenCV preprocessing, AI RPC call, data matching, and total duration.
5. **`application.log`**: General application execution logs.
6. **`error.log`**: Formatted error stack traces and failure metadata.

---

## 3. Directory Structure

```
Automated-KYC-System/
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── IMPLEMENTATION_PLAN.md
├── backend/
│   ├── logger.js                 <-- Root logger export
│   ├── logger/                   <-- Centralized Winston Logging Stack
│   │   ├── logger.js             <-- Core Winston configuration
│   │   ├── requestLogger.js      <-- Express HTTP request middleware
│   │   ├── auditLogger.js        <-- Verification status audit logger
│   │   ├── performanceLogger.js  <-- Component performance timer
│   │   └── ocrLogger.js          <-- Granular OCR step logger
│   ├── logs/                     <-- Multi-file runtime log targets
│   │   ├── application.log
│   │   ├── audit.log
│   │   ├── error.log
│   │   ├── ocr.log
│   │   ├── performance.log
│   │   └── requests.log
│   └── services/
│       └── aiService.js          <-- Forwards x-trace-id header to FastAPI
└── ai_service/
    └── app/
        ├── utils/
        │   └── logger.py         <-- Python logging adapter with traceId context
        └── routers/
            └── ocr_router.py     <-- Logs request execution times & returns traceId
```
