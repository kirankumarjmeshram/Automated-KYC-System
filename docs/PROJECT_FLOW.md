# Automated KYC System — Application & Request Flow Document

## 1. High-Level End-to-End Application Flow (Phase 2 Implemented)

The diagram and step-by-step description below detail the complete execution lifecycle when a customer submits documents through the platform.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. User UI  │ ──> │ 2. React Form│ ──> │3. Axios HTTP │ ──> │4. Express API│ ──> │ 5. Security  │
│  Navigation  │     │ Form Data    │     │ Multipart    │     │  Middleware  │     │  Middlewares │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                                           │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│ 11. React UI │ <── │10. Frontend  │ <── │ 9. Express   │ <── │ 8. Controller│ <──────────┘
│  Render      │     │ Response State│    │ JSON Response│     │ Result Match │
└──────────────┘     └──────────────┘     └──────────────┘     └──────▲───────┘
                                                                      │
                                                HTTP RPC Stream       │ 7. Structured JSON
                                                POST /ocr/process     │    Response
                                                              ┌───────┴──────────────┐
                                                              │ 6. FastAPI AI        │
                                                              │    Microservice      │
                                                              │    OpenCV / OCR      │
                                                              │    Gemini Engine     │
                                                              └──────────────────────┘
```

### Execution Steps
1. **User Landing & Navigation**: Customer loads the web app at `http://localhost:3000`. `React Router DOM` renders `App.js` containing `KycStepupForm` or `AadhaarPanForm`.
2. **Form Interaction & Local Validation**: User inputs Full Name, Aadhaar Number, and PAN Number, and attaches image files (`aadhaarFile`, `panFile`).
3. **FormData Payload Assembly**: The frontend constructs a native JavaScript `FormData` object containing text fields and binary file blobs (`Blob`/`File`).
4. **Axios HTTP Request**: An asynchronous HTTP `POST` request with `Content-Type: multipart/form-data` is dispatched to `http://localhost:5000/api/verify`.
5. **Express Security & Body Parsing**:
   * `helmet()` adds HTTP security headers.
   * `cors()` validates request origin.
   * `express-rate-limit` enforces rate quotas.
   * `multer({ storage: memoryStorage() })` intercepts the multipart request and attaches file buffers to `req.files`.
6. **FastAPI Microservice RPC Call (`aiService.js`)**:
   * Express calls `processImageWithAI(file)` which dispatches the image buffer stream to `http://localhost:8000/ocr/process`.
   * FastAPI runs OpenCV preprocessing (resize, grayscale, noise reduction, deskewing).
   * Dual-engine OCR runs (`PaddleOCR` primary -> `EasyOCR` fallback).
   * Gemini LLM (`google-generativeai`) formats raw text into a structured Pydantic `ExtractedDetails` JSON schema.
7. **FastAPI Response**: FastAPI returns `200 OK` JSON with `success: true`, `details: { type, name, number, dob }`, and `fallback` flag.
8. **Express Mismatch Evaluation & Business Logic**:
   * Express compares user-entered `name`, `aadhaar`, `pan` against returned document attributes.
   * If both extractions used fallback data (unconfigured AI key/offline), Express skips strict string equality to avoid false-positive mismatches.
9. **Express Response Formatting**: Express returns `200 OK` JSON to React UI.
10. **Frontend State & UI Rendering**: React updates component state (`setVerificationResult`), disabling loading spinners and rendering `VerificationResult.js` alert boxes displaying extracted identity fields.

---

## 2. Microservice Request Bridge (Express ↔ FastAPI)

```
[Express API Gateway] ── POST /ocr/process (Multipart Image Stream) ──> [FastAPI AI Service]
                                                                               │
                                                                     1. OpenCV Noise Filter & Deskew
                                                                     2. PaddleOCR / EasyOCR Engine
                                                                     3. Gemini LLM Entity Structuring
                                                                               │
[Express API Gateway] <── 200 OK (Structured Extracted JSON) ──────────────────┘
```
