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

* **URL Path**: `/api/verify`
* **Method**: `POST`
* **Authentication**: Optional / Public
* **Request Headers**: `Content-Type: multipart/form-data`, `x-trace-id: <UUID>`

#### Form Parameters (`multipart/form-data`)
| Parameter Name | Data Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | Yes | Full Name of the applicant |
| `aadhaar` | String | No | 12-digit Aadhaar card number |
| `pan` | String | No | 10-character alphanumeric PAN number |
| `aadhaarFile` | File (Image)| Optional | Binary image file of Aadhaar Card (JPG/PNG) |
| `panFile` | File (Image)| Optional | Binary image file of PAN Card (JPG/PNG) |

#### Response (200 OK - Verified)
```json
{
  "success": true,
  "status": "VERIFIED",
  "traceId": "8e7d4d74-b8dd-4cf2-9dd4-b0b51f5ef6af",
  "message": "KYC Successfully Verified",
  "verified": true,
  "details": {
    "aadhaar": {
      "type": "Aadhaar",
      "name": "KIRANKUMAR JAGESHWAR MESHRAM",
      "number": "763661022387",
      "dob": "12/05/1990"
    },
    "pan": {
      "type": "PAN",
      "name": "KIRANKUMAR JAGESHWAR MESHRAM",
      "father_name": "JAGESHWAR MESHRAM",
      "number": "CPMPM3715F",
      "dob": "21/08/1995"
    }
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

#### Response (200 OK - PAN Card JSON)
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
