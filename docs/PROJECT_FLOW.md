# Automated KYC System — Application & Request Flow Document

## 1. High-Level End-to-End Application Flow

The diagram and step-by-step description below detail the complete execution lifecycle when a customer submits documents through the platform.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. User UI  │ ──> │ 2. React Form│ ──> │3. Axios HTTP │ ──> │4. Express API│ ──> │ 5. Security  │
│  Navigation  │     │ Form Data    │     │ Multipart    │     │  Middleware  │     │  Middlewares │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                                           │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│ 10. React UI │ <── │9. Frontend   │ <── │ 8. Express   │ <── │ 7. Controller│ <──────────┘
│  Render      │     │ Response State│    │ JSON Response│     │ OCR / Vision │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Execution Steps
1. **User Landing & Navigation**: Customer loads the web app at `http://localhost:3000`. `React Router DOM` renders `App.js` containing `KycStepupForm` or `AadhaarPanForm`.
2. **Form Interaction & Local Validation**: User inputs Full Name, Aadhaar Number, and PAN Number, and attaches image files (`aadhaarFile`, `panFile`). Client-side state checks confirm that mandatory files are selected.
3. **FormData Payload Assembly**: The frontend constructs a native JavaScript `FormData` object containing text fields and binary file blobs (`Blob`/`File`).
4. **Axios HTTP Request**: An asynchronous HTTP `POST` request with `Content-Type: multipart/form-data` is dispatched to `http://localhost:5000/api/verify`.
5. **Express Security & Body Parsing**:
   * `helmet()` adds HTTP security headers.
   * `cors()` validates request origin.
   * `express-rate-limit` enforces rate quotas.
   * `multer({ storage: memoryStorage() })` intercepts the multipart request, parses text fields into `req.body`, and converts binary file streams into `Buffer` instances attached to `req.files`.
6. **Route Selection & Controller Dispatch**: Express routes request to `/api/verify` handler in `documentRoutes.js`, which invokes `processImage` in `documentController.js`.
7. **Image Pre-processing & OCR Execution**:
   * `sharp` resizes the image buffer to 1000px width and converts it to PNG.
   * `processImage` attempts OCR via Google Cloud Vision API (`@google-cloud/vision`).
   * If Vision API is unconfigured/fails, `processImage` executes a regex-based fallback parser on file metadata and marks `fallback: true`.
8. **Attribute Verification & Business Logic**:
   * If real OCR ran, extracted attributes (Name, Aadhaar Number, PAN Number) are matched against user input `req.body`.
   * If fallback OCR ran, strict string equality checks are bypassed to prevent false-positive rejection of valid user documents.
9. **Express Response Formatting**: The route controller returns a `200 OK` JSON object:
   `{"success": true, "message": "KYC Verified Successfully!", "details": {...}}`.
10. **Frontend State & UI Rendering**: React updates component state (`setVerificationResult`), disabling loading spinners and rendering `VerificationResult.js` alert boxes displaying extracted identity fields.

---

## 2. Detailed Request Lifecycle by Component

### Component 1: React Frontend UI (`KycStepupForm.js`)
* **Trigger**: User clicks "Submit Verification" button.
* **State Updates**: Sets `loading = true`, clears existing `error` state.
* **Payload Construction**:
  ```javascript
  const formDataObj = new FormData();
  formDataObj.append("name", formData.name.trim());
  formDataObj.append("aadhaar", formData.aadhaar.trim());
  formDataObj.append("pan", formData.pan.trim());
  formDataObj.append("aadhaarFile", files.aadhaarFile);
  formDataObj.append("panFile", files.panFile);
  ```
* **Network Call**: `axios.post("http://localhost:5000/api/verify", formDataObj, ...)`

### Component 2: Express Server & Middleware Stack (`server.js`)
* **Step 2.1 (Helmet)**: Security headers applied.
* **Step 2.2 (CORS)**: Verifies origin `http://localhost:3000`.
* **Step 2.3 (Rate Limiter)**: Checks IP bucket (max 100 requests / 15 minutes).
* **Step 2.4 (Multer Parser)**: Converts HTTP binary stream to in-memory buffers:
  * `req.files.aadhaarFile[0].buffer`
  * `req.files.panFile[0].buffer`

### Component 3: Route Handler (`documentRoutes.js`)
* **Input Validation**: Checks presence of `name` and `aadhaar`/`pan` fields in `req.body`.
* **Async Dispatch**:
  ```javascript
  const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile) : null;
  const extractedPAN = panFile ? await processImage(panFile) : null;
  ```
* **Mismatch Analysis**:
  * Extracts name, DOB, and document numbers.
  * Compares user-entered `aadhaar` against `extractedAadhaar.details.number`.
  * Compares user-entered `pan` against `extractedPAN.details.number`.
  * Compares user-entered `name` against extracted document text using case-insensitive substring matching.

### Component 4: Image Processor & OCR Engine (`documentController.js`)
* **Buffer Normalization**: Passes raw file buffer to `sharp(file.buffer).resize(1000).png().toBuffer()`.
* **OCR Call**: Invokes Google Vision `client.textDetection({ image: { content: base64Image } })`.
* **Fallback Execution**: If vision fails, checks `file.originalname` for keyword hints (`AADHAAR`, `PAN`) and returns test data structures with `fallback: true`.

---

## 3. Endpoint Execution Matrix

### 3.1 `POST /api/verify` (Express Backend)
* **Description**: Primary dual-document verification endpoint.
* **Request Format**: `multipart/form-data`
* **Fields**:
  * `name` (string, required)
  * `aadhaar` (string, optional)
  * `pan` (string, optional)
  * `aadhaarFile` (file stream, optional)
  * `panFile` (file stream, optional)
* **Response (Success - 200 OK)**:
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
* **Response (Validation Error - 400 Bad Request)**:
  ```json
  {
    "success": false,
    "error": "Aadhaar number mismatch. PAN number mismatch."
  }
  ```

### 3.2 `POST /api/process` (Express Backend)
* **Description**: Single-file upload endpoint for processing individual Aadhaar or PAN card documents.
* **Request Format**: `multipart/form-data`
* **Fields**:
  * `file` (file stream, required)
* **Response (Success - 200 OK)**:
  ```json
  {
    "success": true,
    "details": {
      "type": "Aadhaar",
      "name": "RAHUL SHARMA",
      "number": "123456789012",
      "dob": "12/05/1990",
      "fallback": true
    }
  }
  ```

### 3.3 `GET /health` (Express Backend)
* **Description**: Backend service liveness & uptime status check.
* **Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "uptime": 218.16,
    "timestamp": "2026-07-27T11:50:52.793Z"
  }
  ```

### 3.4 `GET /health` (FastAPI AI Service)
* **Description**: AI microservice liveness status check.
* **Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "service": "ai_service"
  }
  ```

---

## 4. Planned Microservice Request Bridge (Express ↔ FastAPI)

When the Python FastAPI AI service is connected in Phase 2, the HTTP request bridge will execute as follows:

```
[Express API Gateway] ── POST /ai/ocr (Multipart Image) ──> [FastAPI AI Service]
                                                                  │
                                                        1. OpenCV Noise Filter
                                                        2. PaddleOCR / EasyOCR
                                                        3. Gemini LLM Correction
                                                                  │
[Express API Gateway] <── 200 OK (Structured Text JSON) ──────────┘
```
