# Automated KYC System — Implementation Plan & Technical Roadmap

## 1. Current Implementation Audit & Status

### 1.1 Summary Matrix

| Feature / Component | Status | Implementation Type | Notes |
| :--- | :--- | :--- | :--- |
| **Backend Core Architecture** | Completed | Production Foundation | Express, Security (Helmet), CORS, Rate Limiter, Error Handling, Winston Logging |
| **Document Upload Pipeline** | Completed | Production Foundation | Multer memory storage supporting single & multi-file form streams |
| **OCR Processing Pipeline** | Completed (Dual-Mode) | Production / Fallback Hybrid | Google Vision API integration with automatic local fallback parser when unconfigured |
| **Form Input Verification** | Completed | Functional Prototype | Form vs OCR attribute matching (Name, Aadhaar, PAN) with fallback safety hooks |
| **Frontend UI Forms** | Completed | Production Foundation | React 19, React-Bootstrap, responsive document upload interfaces |
| **AI Service Container** | Partially Completed | Service Scaffolding | FastAPI app structure configured with CORS middleware and health checks |
| **Database Integration** | Partially Completed | Model Defined | Mongoose schema defined (`Document.js`); connection fallback configured to allow offline execution |
| **FastAPI ↔ Express RPC** | Missing | Integration Point | Backend currently processes OCR locally; needs HTTP bridge to Python AI service |
| **AWS S3 Storage Integration** | Missing | Cloud Feature | AWS S3 SDK packages installed; pre-signed URL upload pipeline pending |
| **Clerk Authentication** | Missing | Auth Feature | Clerk Express & React packages installed/configured in env; auth middleware pending |
| **Face Match & Liveness** | Missing | AI Feature | Python dependencies defined (`insightface`, `mediapipe`); endpoints pending |
| **Officer & Admin Dashboard** | Missing | Business Feature | UI views and role-based access control (RBAC) pending |

---

## 2. Phased Implementation Roadmap

```
Phase 1: Backend & Frontend Foundation (COMPLETED)
        │
        ▼
Phase 2: Advanced OCR & AI Service Integration
        │
        ▼
Phase 3: Face Verification & Liveness Detection
        │
        ▼
Phase 4: Database Persistence & Document History
        │
        ▼
Phase 5: Cloud Storage Pipeline (AWS S3)
        │
        ▼
Phase 6: Authentication & Role-Based Access Control (Clerk)
        │
        ▼
Phase 7: Reviewer Dashboard & Admin Analytics
        │
        ▼
Phase 8: Security Hardening & Production Deployment
```

---

### Phase 1: Core KYC Workflow & Server Foundation (COMPLETED)
* **Goal**: Establish a production-ready Express backend foundation and restore working dual-document verification workflow.
* **Features**:
  * Express API server setup with Helmet, CORS, Rate Limiting, and Winston logger.
  * Multer memory storage for handling `aadhaarFile`, `panFile`, and `file` uploads.
  * Centralized error middleware handling operational errors and validation exceptions cleanly.
  * React frontend supporting step-up KYC form and single document parsing.
* **Status**: **DONE** ✅

---

### Phase 2: Advanced OCR & AI Service Integration
* **Goal**: Connect Express backend to Python FastAPI service running PaddleOCR/EasyOCR and Gemini LLM for structured data extraction and verification.
* **Features**:
  * Build `/ocr/process` endpoint in FastAPI `ai_service`.
  * Pre-process images in Python using OpenCV (grayscale, thresholding, deskew).
  * Run PaddleOCR/EasyOCR to extract text bounding boxes.
  * Send raw text to Gemini LLM (`google-generativeai`) to parse messy OCR output into verified JSON schemas (Name, Document Number, DOB, Address).
  * Create HTTP service client in Express (`backend/services/aiService.js`) to forward document buffers to FastAPI.
* **Files Likely to Change**:
  * `ai_service/app/main.py`
  * `ai_service/app/ocr_service.py` [NEW]
  * `ai_service/app/gemini_service.py` [NEW]
  * `backend/services/aiService.js` [NEW]
  * `backend/controllers/documentController.js`
* **Dependencies**: `paddleocr`, `easyocr`, `opencv-python-headless`, `google-generativeai`, `axios`
* **Estimated Complexity**: Medium-High
* **Potential Risks**: Model loading latency on cold start; Gemini API rate limits.
* **Testing Strategy**: Unit tests with test document images; mock Gemini API responses.
* **Suggested Git Milestone**: `v1.2.0-ai-ocr-integration`

---

### Phase 3: Face Verification & Passive Liveness Detection
* **Goal**: Validate customer selfie against document photo and confirm physical presence.
* **Features**:
  * Build `/facial/match` endpoint in FastAPI using InsightFace to compare document facial crops against selfie uploads and compute vector cosine similarity scores.
  * Build `/facial/liveness` endpoint using MediaPipe for facial landmark tracking (blink detection, head pose estimation).
  * Generate composite facial verification confidence score (0 - 100%).
* **Files Likely to Change**:
  * `ai_service/app/main.py`
  * `ai_service/app/face_service.py` [NEW]
  * `ai_service/app/liveness_service.py` [NEW]
  * `backend/controllers/documentController.js`
  * `frontend/src/components/KycStepupForm.js` (Add selfie capture/upload field)
* **Dependencies**: `insightface`, `mediapipe`, `numpy`, `Pillow`
* **Estimated Complexity**: High
* **Potential Risks**: High memory usage by InsightFace model; false negatives due to poor lighting.
* **Testing Strategy**: Test face pairs with varying similarity thresholds; camera feed mock tests.
* **Suggested Git Milestone**: `v1.3.0-face-verification`

---

### Phase 4: Database Persistence & History Tracking
* **Goal**: Persist complete verification applications, OCR extraction outputs, and audit logs to MongoDB Atlas.
* **Features**:
  * Update `backend/models/Document.js` and introduce `Application.js` and `User.js` Mongoose schemas.
  * Store verification status (`APPROVED`, `REJECTED`, `PENDING_REVIEW`).
  * Implement pagination and query APIs for fetching past verification submissions.
* **Files Likely to Change**:
  * `backend/models/Document.js`
  * `backend/models/Application.js` [NEW]
  * `backend/models/User.js` [NEW]
  * `backend/controllers/documentController.js`
  * `backend/routes/documentRoutes.js`
* **Dependencies**: `mongoose`
* **Estimated Complexity**: Low-Medium
* **Potential Risks**: Database connection bottlenecks if index optimizations are missing.
* **Testing Strategy**: Integration tests with local MongoDB container / Atlas test cluster.
* **Suggested Git Milestone**: `v1.4.0-database-persistence`

---

### Phase 5: Cloud Storage Pipeline (AWS S3)
* **Goal**: Securely store uploaded document images and selfies in AWS S3 instead of local disk or memory buffers.
* **Features**:
  * Create AWS S3 utility module (`backend/services/s3Service.js`) using `@aws-sdk/client-s3`.
  * Support secure upload of document files with unique UUID object keys.
  * Generate short-lived pre-signed URLs (`@aws-sdk/s3-request-presigner`) for private document viewing.
* **Files Likely to Change**:
  * `backend/services/s3Service.js` [NEW]
  * `backend/controllers/documentController.js`
  * `backend/config/env.js`
* **Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
* **Estimated Complexity**: Medium
* **Potential Risks**: Exposing S3 access keys or uploading without server-side validation.
* **Testing Strategy**: Upload/download integration tests with AWS S3 mock/LocalStack.
* **Suggested Git Milestone**: `v1.5.0-aws-s3-storage`

---

### Phase 6: Authentication & Role-Based Access Control (Clerk)
* **Goal**: Enforce authentication and secure API endpoints using Clerk across React and Express.
* **Features**:
  * Integrate Clerk React components (`<SignedIn>`, `<SignedOut>`, `<UserButton>`, `<SignIn>`) in frontend navigation.
  * Add `@clerk/express` middleware (`clerkMiddleware()`, `requireAuth()`) to backend routes.
  * Enforce Role-Based Access Control (RBAC): `Customer`, `KYC_Officer`, `Admin`.
* **Files Likely to Change**:
  * `frontend/src/index.js`
  * `frontend/src/App.js`
  * `frontend/src/components/Navbar.js`
  * `backend/server.js`
  * `backend/middlewares/auth.js` [NEW]
* **Dependencies**: `@clerk/express`, `@clerk/clerk-react`
* **Estimated Complexity**: Medium
* **Potential Risks**: Unauthenticated API route leakage if middleware order is misconfigured.
* **Testing Strategy**: Mock JWT token validation tests for restricted endpoints.
* **Suggested Git Milestone**: `v1.6.0-clerk-auth`

---

### Phase 7: KYC Reviewer Dashboard & Admin Portal
* **Goal**: Provide web dashboards for KYC Officers to review flagged submissions and Administrators to track system metrics.
* **Features**:
  * Build Officer Review Queue page with side-by-side document and selfie viewer.
  * Allow manual Approve/Reject/Re-upload triggers with review comments.
  * Build Admin Analytics page displaying total submissions, approval rates, and OCR confidence metrics.
* **Files Likely to Change**:
  * `frontend/src/pages/Dashboard.js` [NEW]
  * `frontend/src/pages/AdminAnalytics.js` [NEW]
  * `frontend/src/components/OfficerReviewQueue.js` [NEW]
  * `backend/routes/adminRoutes.js` [NEW]
  * `backend/controllers/adminController.js` [NEW]
* **Dependencies**: `react-router-dom`, `recharts` / `chart.js`
* **Estimated Complexity**: High
* **Potential Risks**: Complex state synchronization across multi-tab officer reviews.
* **Testing Strategy**: React component render testing and end-to-end user flow tests.
* **Suggested Git Milestone**: `v1.7.0-officer-dashboard`

---

### Phase 8: Production Hardening, CI/CD & Cloud Deployment
* **Goal**: Prepare application components for production containerization and automated cloud deployment.
* **Features**:
  * Write Dockerfiles for `backend` and `ai_service`.
  * Set up GitHub Actions CI/CD workflow for automated linting, testing, and deployment.
  * Deploy Frontend to Vercel, Backend to Render, AI Service to Render (Python environment), Database to MongoDB Atlas.
  * Set up domain SSL and production CORS policies.
* **Files Likely to Change**:
  * `Dockerfile.backend` [NEW]
  * `Dockerfile.ai` [NEW]
  * `.github/workflows/deploy.yml` [NEW]
  * `render.yaml` [NEW]
  * `vercel.json` [NEW]
* **Dependencies**: Docker, GitHub Actions
* **Estimated Complexity**: Medium-High
* **Potential Risks**: Deployment timeouts on Render for Python ML package builds.
* **Testing Strategy**: Load testing using `k6` / `artillery`; automated health check monitors.
* **Suggested Git Milestone**: `v2.0.0-production-release`
