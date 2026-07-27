# Automated KYC System — System Data Flow & Sequence Diagrams

This document illustrates the data flow sequences across system components for current and future features.

---

## 1. Step-Up KYC Verification Data Flow (Current Prototype)

Sequence chart detailing the data exchange between Customer Browser, Express API, OCR Engine, and Verification Controller.

```
Customer (Browser)          Express API Gateway               OCR / Sharp Engine             Verification Route
      │                              │                                │                              │
      │ 1. Fill Form & Select Files  │                                │                              │
      ├─────────────────────────────>│                                │                              │
      │    POST /api/verify          │                                │                              │
      │    (multipart/form-data)     │                                │                              │
      │                              │ 2. Multer Parses Memory Buffer │                              │
      │                              ├───────────────────────────────>│                              │
      │                              │                                │ 3. Sharp Resize & PNG Convert│
      │                              │                                ├──────────────┐               │
      │                              │                                │              │               │
      │                              │                                │ <────────────┘               │
      │                              │                                │ 4. Run Vision API / Fallback │
      │                              │                                ├──────────────┐               │
      │                              │                                │              │               │
      │                              │                                │ <────────────┘               │
      │                              │ 5. Return Extracted Details    │                              │
      │                              │ <──────────────────────────────┤                              │
      │                              │                                                               │
      │                              │ 6. Compare Form Attributes vs OCR Extracted Details           │
      │                              ├──────────────────────────────────────────────────────────────>│
      │                              │                                                               │
      │                              │ 7. Return 200 OK / 400 Mismatch JSON                          │
      │ <────────────────────────────┤                                                               │
      │                              │                                                               │
```

---

## 2. Advanced OCR & AI Service Integration Data Flow (Phase 2)

```
Express API Gateway               FastAPI AI Service               OpenCV Engine               PaddleOCR / Gemini
         │                                │                              │                              │
         │ 1. POST /ocr/process           │                              │                              │
         │    (File Binary Stream)        │                              │                              │
         ├───────────────────────────────>│                              │                              │
         │                                │ 2. Noise & Thresholding      │                              │
         │                                ├─────────────────────────────>│                              │
         │                                │                              │ 3. Enhanced Matrix           │
         │                                │ <────────────────────────────┤                              │
         │                                │                                                             │
         │                                │ 4. Extract Text Bounding Boxes                              │
         │                                ├────────────────────────────────────────────────────────────>│
         │                                │                                                             │
         │                                │ 5. Normalize Address/Fields with Gemini LLM                 │
         │                                ├────────────────────────────────────────────────────────────>│
         │                                │ 6. Return Structured JSON                                   │
         │                                │ <───────────────────────────────────────────────────────────┤
         │ 7. Return Verified Details JSON│                                                             │
         │ <──────────────────────────────┤                                                             │
```

---

## 3. Facial Verification & Passive Liveness Data Flow (Phase 3)

```
Customer Camera            Express API Gateway           FastAPI (InsightFace)         FastAPI (MediaPipe)
      │                             │                              │                             │
      │ 1. Capture Selfie Video     │                              │                             │
      ├────────────────────────────>│                              │                             │
      │    POST /api/verify/face    │                              │                             │
      │                             │ 2. Extract Document Face Crop│                             │
      │                             ├─────────────────────────────>│                             │
      │                             │ 3. Compute Cosine Vector     │                             │
      │                             │    Similarity Score          │                             │
      │                             │ <────────────────────────────┤                             │
      │                             │                                                            │
      │                             │ 4. Run Landmark Tracking (Blink/Smile)                     │
      │                             ├───────────────────────────────────────────────────────────>│
      │                             │ 5. Return Liveness Score                                   │
      │                             │ <──────────────────────────────────────────────────────────┤
      │                             │                                                            │
      │ 6. Return Composite Result  │                                                            │
      │ <───────────────────────────┤                                                            │
```

---

## 4. KYC Officer Review Queue Data Flow (Phase 7)

```
KYC Officer UI             Express API Gateway                 AWS S3                    MongoDB Atlas
      │                             │                            │                             │
      │ 1. GET /api/officer/queue   │                            │                             │
      ├────────────────────────────>│                            │                             │
      │                             │ 2. Query Pending Apps      │                             │
      │                             ├─────────────────────────────────────────────────────────>│
      │                             │ 3. Return Pending Records  │                             │
      │                             │ <────────────────────────────────────────────────────────┤
      │                             │                            │                             │
      │                             │ 4. Generate Pre-signed URLs│                             │
      │                             ├───────────────────────────>│                             │
      │                             │ 5. Temporary Image URLs    │                             │
      │                             │ <──────────────────────────┤                             │
      │ 6. Render Side-by-Side View │                            │                             │
      │ <───────────────────────────┤                            │                             │
```
