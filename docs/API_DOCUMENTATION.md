# Automated KYC System — API Documentation

## 1. Overview & Service Base URLs

The Automated KYC Platform exposes RESTful API endpoints across two services:

* **Express API Gateway**: `http://localhost:5000/api` (Production: `https://api.yourdomain.com/api`)
* **FastAPI AI Service**: `http://localhost:8000` (Production: `https://ai.yourdomain.com`)

### Protocols & Content Types
* Data Exchange Format: `application/json`
* File Upload Format: `multipart/form-data`
* Character Encoding: `UTF-8`

---

## 2. Express Backend API Reference

### 2.1 Health & System Status

#### `GET /health`
Returns the operational health and uptime of the Express backend server.

* **URL Path**: `/health` (Mounted at root)
* **Method**: `GET`
* **Authentication**: None (Public)
* **Request Headers**: None

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "uptime": 218.16,
  "timestamp": "2026-07-27T11:50:52.793Z"
}
```

---

### 2.2 Dual-Document Verification Endpoint

#### `POST /api/verify`
Primary KYC submission endpoint. Accepts user details and document images (`aadhaarFile`, `panFile`), dispatches images to the Python FastAPI microservice (`POST /ocr/process`), and validates entered attributes against document data.

* **URL Path**: `/api/verify`
* **Method**: `POST`
* **Authentication**: Optional / Public
* **Request Headers**: `Content-Type: multipart/form-data`

#### Form Parameters (`multipart/form-data`)
| Parameter Name | Data Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | Yes | Full Name of the applicant |
| `aadhaar` | String | No | 12-digit Aadhaar card number |
| `pan` | String | No | 10-character alphanumeric PAN number |
| `aadhaarFile` | File (Image)| Optional | Binary image file of Aadhaar Card (JPG/PNG) |
| `panFile` | File (Image)| Optional | Binary image file of PAN Card (JPG/PNG) |

#### Example `cURL` Command
```bash
curl -X POST http://localhost:5000/api/verify \
  -F "name=Rahul Sharma" \
  -F "aadhaar=123456789012" \
  -F "pan=ABCDE1234F" \
  -F "aadhaarFile=@/path/to/aadhaar.png" \
  -F "panFile=@/path/to/pan.png"
```

#### Response (200 OK - Successful Verification)
```json
{
  "success": true,
  "message": "KYC Verified Successfully!",
  "details": {
    "aadhaar": {
      "type": "Aadhaar",
      "name": "RAHUL SHARMA",
      "number": "123456789012",
      "dob": "12/05/1990",
      "gender": "",
      "address": ""
    },
    "pan": {
      "type": "PAN",
      "name": "RAHUL SHARMA",
      "number": "ABCDE1234F",
      "dob": "12/05/1990",
      "gender": "",
      "address": ""
    },
    "ocrConfigured": true
  }
}
```

---

### 2.3 Single Document Process Endpoint

#### `POST /api/process`
Single-file endpoint for extracting text attributes from an individual Aadhaar or PAN card image.

* **URL Path**: `/api/process`
* **Method**: `POST`
* **Authentication**: Optional / Public
* **Request Headers**: `Content-Type: multipart/form-data`

#### Form Parameters (`multipart/form-data`)
| Parameter Name | Data Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | File (Image)| Yes | Binary image file of document (JPG/PNG) |

#### Response (200 OK)
```json
{
  "success": true,
  "details": {
    "type": "Aadhaar",
    "name": "RAHUL SHARMA",
    "number": "123456789012",
    "dob": "12/05/1990"
  }
}
```

---

## 3. FastAPI AI Microservice API Reference

### 3.1 Service Health Status

#### `GET /health`
Returns the operational health and environment configuration of the Python FastAPI AI service.

* **URL Path**: `/health`
* **Method**: `GET`
* **Authentication**: None

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "service": "ai_service",
  "version": "1.2.0",
  "environment": "development"
}
```

---

### 3.2 AI OCR Processing Endpoint (Phase 2 Implemented)

#### `POST /ocr/process`
Pre-processes document image via OpenCV, executes dual-engine OCR (PaddleOCR primary -> EasyOCR fallback), and structures output via Gemini LLM / Pydantic schemas.

* **URL Path**: `/ocr/process`
* **Method**: `POST`
* **Authentication**: None (Internal RPC)
* **Request Headers**: `Content-Type: multipart/form-data`
* **Form Parameter**: `file` (File stream)

#### Example `cURL` Command
```bash
curl -X POST http://localhost:8000/ocr/process \
  -F "file=@/path/to/document.png"
```

#### Response (200 OK - Structured Identity JSON)
```json
{
  "success": true,
  "document_type": "Aadhaar",
  "confidence_score": 0.94,
  "details": {
    "type": "Aadhaar",
    "name": "RAHUL SHARMA",
    "number": "123456789012",
    "dob": "12/05/1990",
    "gender": "Male",
    "address": "New Delhi"
  },
  "raw_text": "GOVERNMENT OF INDIA Aadhaar 1234 5678 9012 DOB: 12/05/1990 Rahul Sharma",
  "ocr_engine": "PaddleOCR",
  "bounding_boxes": [],
  "fallback": false,
  "message": "OCR processed successfully via PaddleOCR"
}
```

---

## 4. Centralized Error Standards

All API responses returning HTTP status codes `400`, `404`, or `500` strictly conform to the unified error schema handled by `backend/middlewares/errorHandler.js`:

```json
{
  "success": false,
  "error": "Human-readable error description message",
  "details": [
    "Optional array of detailed validation field errors"
  ]
}
```
