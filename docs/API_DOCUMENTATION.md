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
Primary KYC submission endpoint. Accepts user details and document images (`aadhaarFile`, `panFile`), processes images through the OCR pipeline, and validates entered attributes against document data.

* **URL Path**: `/api/verify`
* **Method**: `POST`
* **Authentication**: Optional / Public (Target: Clerk Auth required)
* **Request Headers**: `Content-Type: multipart/form-data`

#### Form Parameters (`multipart/form-data`)
| Parameter Name | Data Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | Yes | Full Name of the applicant |
| `aadhaar` | String | No | 12-digit Aadhaar card number |
| `pan` | String | No | 10-character alphanumeric PAN number |
| `aadhaarFile` | File (Image)| Optional | Binary image file of Aadhaar Card (JPG/PNG) |
| `panFile` | File (Image)| Optional | Binary image file of PAN Card (JPG/PNG) |
| `file` | File (Image)| Optional | Legacy generic single file parameter |

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
      "fallback": false
    },
    "pan": {
      "type": "PAN",
      "name": "RAHUL SHARMA",
      "number": "ABCDE1234F",
      "dob": "",
      "fallback": false
    },
    "ocrConfigured": true
  }
}
```

#### Response (200 OK - Verification in Fallback Mode)
```json
{
  "success": true,
  "message": "KYC documents received. OCR verification will be available when AI service is configured.",
  "details": {
    "aadhaar": {
      "type": "Aadhaar",
      "name": "RAHUL SHARMA",
      "number": "123456789012",
      "dob": "12/05/1990",
      "fallback": true
    },
    "pan": {
      "type": "PAN",
      "name": "RAHUL SHARMA",
      "number": "ABCDE1234F",
      "dob": "",
      "fallback": true
    },
    "ocrConfigured": false
  }
}
```

#### Response (400 Bad Request - Validation Error)
```json
{
  "success": false,
  "error": "Aadhaar number mismatch. PAN number mismatch."
}
```

#### Response (400 Bad Request - Missing Parameters)
```json
{
  "success": false,
  "error": "Missing form data"
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

#### Example `cURL` Command
```bash
curl -X POST http://localhost:5000/api/process \
  -F "file=@/path/to/document.jpg"
```

#### Response (200 OK)
```json
{
  "success": true,
  "details": {
    "type": "Aadhaar",
    "name": "RAHUL SHARMA",
    "number": "123456789012",
    "dob": "12/05/1990",
    "fallback": false
  }
}
```

#### Response (400 Bad Request)
```json
{
  "success": false,
  "message": "No file uploaded"
}
```

---

## 3. FastAPI AI Microservice API Reference

### 3.1 Service Health Status

#### `GET /health`
Returns the status of the Python FastAPI AI service.

* **URL Path**: `/health`
* **Method**: `GET`
* **Authentication**: None

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "service": "ai_service"
}
```

---

### 3.2 Planned AI Service Endpoints (Phase 2 & 3)

#### `POST /ocr/process` [PLANNED]
Extracts structured OCR data using PaddleOCR / EasyOCR and Gemini LLM.

* **URL Path**: `/ocr/process`
* **Method**: `POST`
* **Request Format**: `multipart/form-data` (file: `document`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "document_type": "Aadhaar",
    "confidence_score": 0.96,
    "extracted_fields": {
      "name": "RAHUL SHARMA",
      "number": "123456789012",
      "dob": "12/05/1990",
      "gender": "Male",
      "address": "123 Main Street, New Delhi 110001"
    }
  }
  ```

#### `POST /facial/match` [PLANNED]
Compares document photo crop against selfie image using InsightFace vector embeddings.

* **URL Path**: `/facial/match`
* **Method**: `POST`
* **Request Format**: `multipart/form-data` (`document_photo`, `selfie`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "similarity_score": 0.89,
    "match_decision": "MATCH",
    "confidence": "HIGH"
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

### HTTP Status Code Index
* **`200 OK`**: Request executed successfully.
* **`400 Bad Request`**: Validation error, missing parameters, or invalid format.
* **`404 Not Found`**: Endpoint or requested resource does not exist.
* **`429 Too Many Requests`**: Rate limit exceeded (Max 100 requests per 15 minutes).
* **`500 Internal Server Error`**: Unexpected backend failure or unhandled exception.
