# Automated KYC System — Project Architecture Document

## 1. Executive Summary & Architecture Overview

The **Automated KYC System** is a production-grade digital Know Your Customer (KYC) identity verification platform designed with a microservices-capable, multi-tier architecture. It automates customer document onboarding, OCR text extraction, document classification, face matching, liveness detection, and AI validation.

### Core Architecture Stack
* **Frontend**: React 19, React-Bootstrap, React Router DOM v7, Axios, JavaScript (ES6+)
* **Backend API Gateway**: Node.js, Express 4.x, Multer (memory storage), Winston Logger, Helmet, Rate Limiter, Zod, Mongoose (MongoDB)
* **AI & Computer Vision Service**: Python 3.10+, FastAPI, OpenCV, PaddleOCR / EasyOCR, InsightFace, MediaPipe, Google Generative AI (Gemini)
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
        MongoDB Driver   │                      │ HTTP Client (Axios/Fetch)
                         │                      │
   ┌─────────────────────▼──────┐   ┌───────────▼─────────────────────┐
   │       MongoDB Atlas        │   │        FastAPI AI Service       │
   │  (Document Persistence)    │   │      (Port 8000 / Render)       │
   └────────────────────────────┘   └─────────────────────────────────┘
                                    │ OpenCV / PaddleOCR / InsightFace
                                    │ MediaPipe / Gemini AI
```

---

## 2. Complete Project Directory Structure

```
Automated-KYC-System/
├── .gitignore
├── LICENSE
├── README.md
├── Technical_Solution_Document.md
├── IMPLEMENTATION_REPORT.md
├── CHANGELOG.md
├── PROJECT_ARCHITECTURE.md       <-- [NEW] Comprehensive Architecture Spec
├── PROJECT_FLOW.md               <-- [NEW] Application & Request Flow Spec
├── IMPLEMENTATION_PLAN.md        <-- [NEW] Phased Roadmap & Status
├── API_DOCUMENTATION.md          <-- [NEW] Complete API Reference
├── package.json                  <-- Root workspace orchestration
├── package-lock.json
│
├── frontend/                     <-- React Single Page Application (CRA)
│   ├── .env                      <-- Frontend environment config
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   └── src/
│       ├── App.css               <-- Layout styling
│       ├── App.js                <-- Root application component
│       ├── App.test.js
│       ├── index.css             <-- Global utility styles
│       ├── index.js              <-- Application entry point (ReactDOM)
│       ├── logo.svg
│       ├── reportWebVitals.js
│       ├── setupTests.js
│       ├── components/           <-- Reusable UI components
│       │   ├── AadhaarPanForm.js     <-- Single-file upload component (/api/process)
│       │   ├── KycStepupForm.js     <-- Dual-document verification component (/api/verify)
│       │   ├── Navbar.js             <-- Primary navigation bar
│       │   └── VerificationResult.js <-- Result rendering component
│       ├── pages/                <-- Page-level view components
│       │   ├── Home.js               <-- Landing view
│       │   └── Verify.js             <-- Verification page wrapper
│       ├── contexts/             <-- React contexts (Placeholder for Auth/KYC state)
│       ├── hooks/                <-- Custom React hooks
│       ├── services/             <-- Axios API client wrappers (Placeholder)
│       ├── utils/                <-- Client helper utilities
│       └── validators/           <-- Client-side form schemas
│
├── backend/                      <-- Express Node.js Backend API
│   ├── .env                      <-- Backend environment config
│   ├── .env.example
│   ├── logger.js                 <-- Winston logging module (Console + File)
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js                 <-- Express app initialization & route mounting
│   ├── config/                   <-- Centralized configuration handlers
│   │   ├── db.js                 <-- Mongoose MongoDB connection initializer
│   │   ├── env.js                <-- Zod env validation & parsing schema
│   │   └── googleVision.js       <-- GCP Vision Client setup script
│   ├── controllers/              <-- Express request handlers
│   │   └── documentController.js <-- OCR processing & extraction logic
│   ├── models/                   <-- Mongoose schemas & data models
│   │   └── Document.js           <-- Document record schema
│   ├── routes/                   <-- API endpoint definitions
│   │   └── documentRoutes.js     <-- Multer file upload & document endpoints
│   ├── middlewares/              <-- Express custom middleware
│   │   ├── errorHandler.js       <-- Centralized error response handler
│   │   └── validate.js           <-- Zod request payload validator
│   ├── services/                 <-- Service abstraction layer (Placeholder)
│   ├── utils/                    <-- Server-side helpers
│   │   ├── appError.js           <-- Custom operational error class
│   │   └── catchAsync.js         <-- Async controller wrapper
│   ├── validators/               <-- Zod validation schemas
│   └── logs/                     <-- Application runtime logs
│       └── application.log
│
└── ai_service/                   <-- FastAPI Python Microservice
    ├── .env                      <-- Python environment config
    ├── .env.example
    ├── requirements.txt          <-- Python package dependencies
    └── app/
        └── main.py               <-- FastAPI app instance & health endpoints
```

---

## 3. Layer Analysis & Folder Responsibilities

### 3.1 Root Workspace (`/`)
* **`package.json`**: Root orchestration configuration. Uses `concurrently` to spawn both the Express backend (`npm --prefix backend start`) and React frontend (`npm --prefix frontend start`) simultaneously, as well as python FastAPI service via `npm run dev:all`.
* **`Technical_Solution_Document.md`**: Product vision document outlining target personas, user roles, security compliance requirements, and business goals.

### 3.2 Frontend (`/frontend`)
Built with React 19 and React-Bootstrap to provide a responsive UI.
* **`src/index.js`**: Mounts `App` into the DOM root with `React.StrictMode` and imports Bootstrap styles.
* **`src/App.js`**: Main view container rendering header and `KycStepupForm`.
* **`src/components/KycStepupForm.js`**: Primary workflow component. Captures Customer Name, Aadhaar Number, PAN Number, Aadhaar document image, and PAN document image. Submits data as `multipart/form-data` to `POST /api/verify`.
* **`src/components/AadhaarPanForm.js`**: Single-document processing component. Uploads a single document image to `POST /api/process`.
* **`src/components/VerificationResult.js`**: Renders success/failure alert boxes and extracted document attributes (Name, Type, Number, DOB).
* **`src/components/Navbar.js`**: Top navigation header bar with React Router links.
* **`src/pages/Home.js` & `Verify.js`**: Page router entry components.

### 3.3 Backend (`/backend`)
Follows MVC pattern with thin controllers and modular middleware.
* **`server.js`**: Initializes Express, applies security headers (`helmet`), configures permissive development CORS, applies rate limiting (`express-rate-limit`), initializes request body parsers (`express.json`, `express.urlencoded`), mounts `/api` routes (`documentRoutes.js`), registers fallback 404 handler, and binds the global `errorHandler`.
* **`config/db.js`**: Connects to MongoDB Atlas using `mongoose.connect()`. Includes event listeners for errors and disconnects. Gracefully falls back to logging a warning if the database is unreachable, enabling non-database OCR endpoints to remain functional.
* **`config/env.js`**: Validates process environment variables at startup using Zod (`PORT`, `NODE_ENV`, `MONGODB_URI`, `CORS_ORIGIN`). Crashes fast with explicit field errors if variables are invalid.
* **`controllers/documentController.js`**: Contains `processImage` service function. Uses `sharp` to resize/convert image buffers to high-quality PNG. Attempts text extraction using `@google-cloud/vision`. If GCP credentials or vision calls fail, it defaults to a local regex parser with a `fallback: true` flag.
* **`routes/documentRoutes.js`**: Registers endpoints using `multer({ storage: memoryStorage() })`.
  * `POST /api/verify`: Accepts `aadhaarFile`, `panFile`, and `file` inputs alongside text inputs (`name`, `aadhaar`, `pan`). Evaluates extracted document details and handles mismatch checks.
  * `POST /api/process`: Processes single file uploads and returns extracted details.
* **`middlewares/errorHandler.js`**: Centralized operational & programming error handling middleware. Formats Mongoose `CastError`, duplicate key `11000`, Zod validation errors, and standard JS errors into structured JSON responses.
* **`middlewares/validate.js`**: Generic middleware generator executing Zod schemas against `req.body`, `req.query`, or `req.params`.
* **`logger.js`**: Winston logger emitting formatted timestamps and log levels to both console (colorized) and `backend/logs/application.log`.

### 3.4 AI Service (`/ai_service`)
FastAPI service engineered for low-latency computer vision & ML tasks.
* **`app/main.py`**: Initializes FastAPI app instance with CORS middleware allowing all origins (`*`) for cross-service RPC calls. Defines `/` root index and `/health` status check.
* **`requirements.txt`**: Specifies core ML and CV dependencies: `paddleocr`, `paddlepaddle`, `easyocr`, `insightface`, `mediapipe`, `opencv-python-headless`, `google-generativeai`, `pydantic`, `uvicorn`.

---

## 4. Dependencies Analysis

### 4.1 Root Workspace (`package.json`)
| Dependency | Type | Purpose | Status | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `concurrently` | `devDependency` | Runs multiple npm scripts concurrently in one terminal | Active | **Keep** — Essential for dev orchestration |

### 4.2 Backend (`backend/package.json`)
| Dependency | Version | Purpose | Status | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `@aws-sdk/client-s3` | `^3.700.0` | AWS S3 file upload integration | Planned | **Keep** — Required for Phase 5 |
| `@aws-sdk/s3-request-presigner` | `^3.700.0` | Generating pre-signed S3 URLs | Planned | **Keep** — Required for Phase 5 |
| `@clerk/express` | `^1.3.0` | Express authentication & session middleware | Planned | **Keep** — Required for Phase 6 |
| `@google-cloud/vision` | `^5.3.7` | Google Cloud Vision API OCR client | Active | **Keep** — Primary OCR engine fallback |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing control | Active | **Keep** — Essential for API access |
| `dotenv` | `^16.4.7` | Environment variable loader | Active | **Keep** — Essential |
| `express` | `^4.21.2` | Primary HTTP server framework | Active | **Keep** — Core framework |
| `express-rate-limit` | `^7.4.1` | DDoS & brute-force rate limiting | Active | **Keep** — Production security |
| `helmet` | `^8.0.0` | HTTP security header hardening | Active | **Keep** — Production security |
| `mongoose` | `^8.12.1` | MongoDB Object Data Modeling (ODM) | Active | **Keep** — Database layer |
| `multer` | `^1.4.5-lts.1` | Multipart form data file parsing | Active | **Keep** — Essential for image uploads |
| `sharp` | `^0.33.5` | High-performance image conversion & resizing | Active | **Keep** — Pre-processing image buffer |
| `winston` | `^3.17.0` | Application logging framework | Active | **Keep** — Production logging |
| `zod` | `^3.23.8` | Schema validation library | Active | **Keep** — Environment & API validation |
| `nodemon` | `^3.1.9` | Dev server hot-reloading | Active | **Keep** (dev) |

### 4.3 Frontend (`frontend/package.json`)
| Dependency | Version | Purpose | Status | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `axios` | `^1.8.1` | HTTP client for backend requests | Active | **Keep** — Core networking |
| `bootstrap` | `^5.3.3` | Bootstrap UI framework styles | Active | **Keep** — Styling library |
| `react` | `^19.0.0` | Core UI rendering engine | Active | **Keep** — Core framework |
| `react-bootstrap` | `^2.10.9` | React wrapper components for Bootstrap | Active | **Keep** — Core UI components |
| `react-dom` | `^19.0.0` | DOM rendering engine for React | Active | **Keep** — Core dependency |
| `react-router-dom` | `^7.2.0` | Client-side routing engine | Active | **Keep** — Page navigation |
| `react-scripts` | `5.0.1` | Create React App build pipeline | Active | **Keep** — Build scripts |
| `web-vitals` | `^2.1.4` | Performance metric measurement | Passive | **Optional** — Can retain for metrics |
| `frontend` | `file:` | Self-referencing link in package.json | Unused | **Remove** — Redundant package link |

### 4.4 AI Service (`ai_service/requirements.txt`)
| Dependency | Minimum Version | Purpose | Status | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `fastapi` | `0.115.0` | Python web framework | Active | **Keep** — Core AI server |
| `uvicorn` | `0.32.0` | ASGI web server | Active | **Keep** — Production server |
| `pydantic` | `2.10.0` | Data validation & settings management | Active | **Keep** — Request/Response schemas |
| `python-multipart`| `0.0.18` | Multipart file upload support for FastAPI | Planned | **Keep** — Image binary requests |
| `opencv-python-headless` | `4.10.0.84` | Image processing without GUI dependencies | Planned | **Keep** — Image deskew & thresholding |
| `paddleocr` | `2.9.0` | Deep learning OCR framework | Planned | **Keep** — Multi-lingual & document OCR |
| `paddlepaddle` | `2.6.0` | Deep learning backend for PaddleOCR | Planned | **Keep** — Framework requirement |
| `easyocr` | `1.7.2` | Lightweight OCR alternative | Planned | **Keep** — Secondary OCR fallback |
| `insightface` | `0.7.3` | Deep face analysis & verification | Planned | **Keep** — Face matching |
| `mediapipe` | `0.10.18` | Real-time liveness & facial landmark tracking | Planned | **Keep** — Passive liveness detection |
| `google-generativeai`| `0.8.0` | Gemini API client for LLM validation | Planned | **Keep** — Intelligent doc verification |
| `numpy` | `1.26.4` | Array processing for image matrix math | Planned | **Keep** — Core scientific library |
| `Pillow` | `11.0.0` | Python Imaging Library (PIL) | Planned | **Keep** — Image manipulation |

---

## 5. Environment Variable Matrix

| Variable | Scope | Target | Type | Required | Purpose / Default Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PORT` | Backend | `.env` | String | No | Port Express listens on. Default: `5000` |
| `NODE_ENV` | Backend | `.env` | Enum | No | Operating mode (`development`, `production`, `test`). Default: `development` |
| `MONGODB_URI` | Backend | `.env` | String | Yes | MongoDB Atlas connection string |
| `MONGO_URI` | Backend | `.env` | String | No | Alternative legacy alias for MongoDB URI |
| `CORS_ORIGIN` | Backend | `.env` | String | No | Allowed frontend client origin. Default: `http://localhost:3000` |
| `GOOGLE_APPLICATION_CREDENTIALS`| Backend | `.env` | String | No | File path to GCP service account key JSON for Google Vision |
| `VITE_API_URL` | Frontend | `.env` | String | No | Backend base URL reference (Legacy alias). Default: `http://localhost:5000/api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | `.env` | String | No | Clerk authentication publishable key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend | `.env` | String | No | Secondary publishable key alias |
| `AI_SERVICE_URL` | Backend | `.env` | String | Planned | URL to internal FastAPI AI Service (`http://localhost:8000`) |
| `AWS_ACCESS_KEY_ID` | Backend | `.env` | String | Planned | AWS IAM access key for S3 bucket access |
| `AWS_SECRET_ACCESS_KEY` | Backend | `.env` | String | Planned | AWS IAM secret key for S3 |
| `AWS_REGION` | Backend | `.env` | String | Planned | AWS Region hosting the S3 bucket |
| `AWS_S3_BUCKET_NAME` | Backend | `.env` | String | Planned | Name of S3 bucket storing uploaded documents |
| `GEMINI_API_KEY` | AI Service| `.env` | String | Planned | API Key for Google Gemini LLM API |

---

## 6. Database Architecture & Schemas

### 6.1 Current Schema (`backend/models/Document.js`)
```javascript
const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  type: String,          // Document classification (e.g. "Aadhaar", "PAN")
  name: String,          // Extracted individual's full name
  number: String,        // Extracted document identifier number
  dob: String,           // Extracted Date of Birth string
  extractedText: String, // Raw OCR text string extracted from image
  imagePath: String,     // Local file path or cloud URL to document image
});

module.exports = mongoose.model("Document", DocumentSchema);
```

### 6.2 Data Flow & Persistence Status
* **Current Persistence**: Transient in-memory extraction. The current controller parses form binary buffers in memory without invoking `Document.create()` to avoid database lockups when MongoDB Atlas is unwhitelisted.
* **Target Persistence Flow**:
  1. Image received by Express API Multer middleware.
  2. Uploaded to AWS S3 bucket under `kyc-documents/{userId}/{docType}_{timestamp}.png`.
  3. S3 URL passed to AI Service for OCR & validation.
  4. Extracted attributes saved to MongoDB `documents` collection linked to user ID.

---

## 7. Architecture Evaluation

### 7.1 Strengths
1. **Resilient Fallback Design**: The OCR controller gracefully degrades from Google Vision API to a local fallback when credentials or image transformations fail, allowing local testing without cloud dependencies.
2. **Decoupled Architecture**: Frontend, Backend API Gateway, and AI ML pipeline are isolated into distinct services, allowing independent scaling on Vercel, Render, and Python containers.
3. **Robust Security & Validation**: Backend uses Helmet for HTTP header security, Zod schema validation for strict type checks, Rate Limiting to prevent brute-force abuse, and Winston logging for file-based audit trails.
4. **Clean Error Handling**: Centralized Express error handling catches both operational errors and database edge-cases (duplicate keys, cast errors) uniformly.

### 7.2 Weaknesses & Technical Debt
1. **Frontend Direct Hardcoding**: `KycStepupForm.js` and `AadhaarPanForm.js` hardcode backend URLs (`http://localhost:5000/api/...`) instead of referencing centralized environment variables.
2. **Hardcoded Fallback Personas**: In fallback mode, `documentController.js` returns dummy details for "RAHUL SHARMA", which can cause validation mismatches if a user inputs their real name unless fallback logic is explicitly flagged.
3. **Database Bypass in Controller**: `documentController.js` currently executes in-memory transformations without persisting document verification history to MongoDB.
4. **Missing AI RPC Bridge**: Express backend does not yet execute HTTP calls to the Python FastAPI microservice (port 8000).

### 7.3 Scalability & Security Recommendations
1. **Centralize Frontend API Base URL**: Update Axios instances to pull from `process.env.REACT_APP_API_URL || "http://localhost:5000/api"`.
2. **Implement Async Job Queue**: Offload heavy PaddleOCR and InsightFace workloads from HTTP requests to Redis-backed Celery/BullMQ workers.
3. **Enforce Storage Encryption**: Move from local memory storage to AWS S3 pre-signed URLs with Server-Side Encryption (SSE-S3).
