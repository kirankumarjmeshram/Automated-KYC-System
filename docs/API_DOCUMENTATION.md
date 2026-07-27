# Automated KYC System — API Documentation

## 1. Overview & Service Base URLs

The Automated KYC Platform exposes RESTful API endpoints across two services:

* **Express API Gateway**: `http://localhost:5000/api` (Production: `https://api.yourdomain.com/api`)
* **FastAPI AI Service**: `http://localhost:8000` (Production: `https://ai.yourdomain.com`)

### Protocols, Trace ID & Content Types
* Data Exchange Format: `application/json`
* File Upload Format: `multipart/form-data`
* Request Tracing: `x-trace-id` (UUID header, e.g. `8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af`)
* Response Parameter: `"traceId": "8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af"`
* Character Encoding: `UTF-8`

---

## 2. Express Backend API Reference

### 2.1 Dual-Document Verification Endpoint

#### `POST /api/verify`
Primary KYC submission endpoint. Accepts user details and document images (`aadhaarFile`, `panFile`), dispatches images to the Python FastAPI microservice (`POST /ocr/process`), and validates entered attributes against document data.

Returns an **Enterprise Verification Report** payload containing detailed metadata for UI, Officer Dashboards, Audit Logs, and Future APIs.

* **URL Path**: `/api/verify`
* **Method**: `POST`
* **Authentication**: Optional / Public
* **Request Headers**: `Content-Type: multipart/form-data`, `x-trace-id: <UUID>`

#### Enterprise Verification Report Payload Schema (`200 OK` / `400 Bad Request`)
```json
{
  "success": true,
  "traceId": "8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af",
  "status": "VERIFIED",
  "verified": true,
  "message": "KYC Successfully Verified",
  "verificationTime": "2026-07-27T18:41:52.000Z",
  "processingTimeMs": 2450,
  "summary": {
    "overallVerified": true,
    "aadhaarVerified": true,
    "panVerified": true,
    "faceVerified": false,
    "livenessVerified": false,
    "manualReviewRequired": false
  },
  "submittedData": {
    "name": "Kirankumar Jageshwar Meshram",
    "aadhaar": "763661022387",
    "pan": "CPMPM3715F"
  },
  "ocrData": {
    "aadhaar": {
      "type": "Aadhaar",
      "name": "KIRANKUMAR JAGESHWAR MESHRAM",
      "number": "763661022387",
      "dob": "12/05/1990",
      "confidence": 98.5
    },
    "pan": {
      "type": "PAN",
      "name": "KIRANKUMAR JAGESHWAR MESHRAM",
      "father_name": "JAGESHWAR MESHRAM",
      "number": "CPMPM3715F",
      "dob": "21/08/1995",
      "confidence": 96.7
    }
  },
  "comparison": {
    "aadhaar": {
      "name": {
        "submitted": "Kirankumar Jageshwar Meshram",
        "ocr": "KIRANKUMAR JAGESHWAR MESHRAM",
        "matched": true,
        "similarity": 100
      },
      "number": {
        "submitted": "763661022387",
        "ocr": "763661022387",
        "matched": true,
        "similarity": 100
      }
    },
    "pan": {
      "name": {
        "submitted": "Kirankumar Jageshwar Meshram",
        "ocr": "KIRANKUMAR JAGESHWAR MESHRAM",
        "matched": true,
        "similarity": 100
      },
      "number": {
        "submitted": "CPMPM3715F",
        "ocr": "CPMPM3715F",
        "matched": true,
        "similarity": 100
      }
    }
  },
  "confidence": {
    "overall": 97.6,
    "aadhaar": 98.5,
    "pan": 96.7
  },
  "documents": {
    "aadhaar": { "status": "VERIFIED", "reason": "Matched" },
    "pan": { "status": "VERIFIED", "reason": "Matched" }
  },
  "pipeline": {
    "imageValidation": "SUCCESS",
    "ocr": "SUCCESS",
    "gemini": "SUCCESS",
    "dataMatching": "SUCCESS",
    "faceVerification": "PENDING",
    "liveness": "PENDING"
  },
  "errors": [],
  "warnings": [],
  "recommendations": [],
  "timeline": [
    { "status": "UPLOADED", "timestamp": "2026-07-27T18:41:50.000Z" },
    { "status": "OCR_PROCESSING", "timestamp": "2026-07-27T18:41:50.100Z" },
    { "status": "OCR_COMPLETED", "timestamp": "2026-07-27T18:41:51.800Z" },
    { "status": "DATA_MATCHING", "timestamp": "2026-07-27T18:41:51.900Z" },
    { "status": "VERIFIED", "timestamp": "2026-07-27T18:41:52.000Z" }
  ],
  "futureCompatibility": {
    "riskScore": 0,
    "fraudScore": 0,
    "faceVerification": null,
    "liveness": null,
    "reviewer": null,
    "approvalDate": null,
    "officerComments": null
  }
}
```

---

## 3. FastAPI AI Microservice API Reference

### 3.1 AI OCR Processing Endpoint

#### `POST /ocr/process`
Pre-processes document image via OpenCV, executes dual-engine OCR (PaddleOCR primary -> EasyOCR fallback), and structures output via Gemini LLM / Pydantic schemas.

* **URL Path**: `/ocr/process`
* **Method**: `POST`
* **Request Headers**: `Content-Type: multipart/form-data`, `x-trace-id: <UUID>`
* **Form Parameter**: `file` (File stream)

#### Response (200 OK)
```json
{
  "success": true,
  "status": "OCR_COMPLETED",
  "traceId": "8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af",
  "document_type": "PAN",
  "confidence_score": 0.94,
  "details": {
    "type": "PAN",
    "name": "KIRANKUMAR JAGESHWAR MESHRAM",
    "father_name": "JAGESHWAR MESHRAM",
    "number": "CPMPM3715F",
    "dob": "21/08/1995"
  },
  "raw_text": "INCOME TAX DEPARTMENT\nGOVT OF INDIA\nPERMANENT ACCOUNT NUMBER CARD\nKIRANKUMAR JAGESHWAR MESHRAM\nJAGESHWAR MESHRAM\n21/08/1995\nCPMPM3715F",
  "ocr_engine": "EasyOCR",
  "bounding_boxes": [],
  "fallback": false,
  "message": "OCR processed successfully via EasyOCR"
}
```
