# Automated KYC System — Folder Structure & Responsibility Guide

## 1. Top-Level Directory Breakdown

```
Automated-KYC-System/
├── docs/                 <-- System architecture & developer documentation
├── frontend/             <-- React Single Page Application
├── backend/              <-- Express API Gateway
├── ai_service/           <-- Python FastAPI AI Microservice
├── node_modules/         <-- Root workspace dependencies
├── package.json          <-- Root npm script orchestrator
└── README.md             <-- Repository landing overview
```

---

## 2. Directory Responsibilities & Boundary Rules

### 2.1 Documentation (`docs/`)
* **Purpose**: Houses system design specifications, application flow diagrams, API specs, developer guides, and architectural decision records.
* **Allowed Responsibilities**: Markdown documentation files describing system architecture, deployment, AI pipelines, testing, and contribution rules.
* **What Belongs Here**: `.md` documentation files.
* **What MUST NOT Go Here**: Executable code, temporary scripts, binary upload samples, secret keys, or `.env` files.

---

### 2.2 Frontend Application (`frontend/`)

#### `frontend/src/components/`
* **Purpose**: Reusable React UI components rendering form fields, navigation, and result views.
* **Allowed Responsibilities**: Component JSX rendering, local state management (`useState`), DOM event handlers, client-side HTTP calls via Axios.
* **What Belongs Here**: Components such as `KycStepupForm.js`, `AadhaarPanForm.js`, `Navbar.js`, `VerificationResult.js`.
* **What MUST NOT Go Here**: Express route definitions, direct database code, server-side secret keys.

#### `frontend/src/pages/`
* **Purpose**: Page-level components bound to client-side routes.
* **Allowed Responsibilities**: View layout composition, assembling multiple UI components into page views (`Home.js`, `Verify.js`).
* **What Belongs Here**: Route views mounted by React Router DOM.
* **What MUST NOT Go Here**: Raw OCR text parsing logic or deep binary file manipulation.

#### `frontend/src/services/`
* **Purpose**: Modular Axios API client wrapper services for communicating with the Express backend.
* **What Belongs Here**: `apiClient.js`, `kycService.js` (abstracting backend REST endpoints).

---

### 2.3 Backend API Gateway (`backend/`)

#### `backend/config/`
* **Purpose**: Centralized application configuration initializers.
* **What Belongs Here**: `db.js` (Mongoose connection), `env.js` (Zod environment variable schema validation), `googleVision.js` (GCP client setup).
* **What MUST NOT Go Here**: HTTP route definitions, HTML/JSX templates.

#### `backend/controllers/`
* **Purpose**: Express HTTP request handlers.
* **Allowed Responsibilities**: Extracting parameters from `req.body` and `req.files`, invoking business services, returning standard JSON HTTP responses.
* **What Belongs Here**: `documentController.js`.
* **What MUST NOT Go Here**: Raw SQL/Mongoose schema queries (belong in services/models), direct UI rendering logic.

#### `backend/middlewares/`
* **Purpose**: Interceptor functions in the Express request execution chain.
* **What Belongs Here**: `errorHandler.js` (centralized error formatting), `validate.js` (Zod request validation runner), future auth middlewares.

#### `backend/models/`
* **Purpose**: Database schema definitions and Mongoose ODM models.
* **What Belongs Here**: `Document.js` (Schema representing processed identity document records).
* **What MUST NOT Go Here**: Express route mounting or multipart file stream parsing.

#### `backend/routes/`
* **Purpose**: HTTP route endpoint declarations and middleware binding.
* **What Belongs Here**: `documentRoutes.js` (binding Multer file upload hooks and controllers to `/verify` and `/process`).

#### `backend/utils/`
* **Purpose**: Reusable server-side utility helper modules.
* **What Belongs Here**: `appError.js` (Custom operational error class), `catchAsync.js` (Async controller wrapper).

---

### 2.4 AI Microservice (`ai_service/`)

#### `ai_service/app/`
* **Purpose**: Core Python FastAPI application codebase.
* **Allowed Responsibilities**: Exposing high-performance ML endpoints, running computer vision pre-processing (OpenCV), executing deep learning OCR models (PaddleOCR / EasyOCR), performing facial embedding matching (InsightFace), landmark liveness tracking (MediaPipe), and LLM text validation (Gemini).
* **What Belongs Here**: `main.py`, OCR pipelines, model loader utilities.
* **What MUST NOT Go Here**: Direct user HTTP sessions, HTML rendering, or frontend state management.

---

## 3. Inter-Folder Dependencies & Flow Boundaries

```
[ frontend/src/components ]
            │
            │ HTTP (multipart/form-data)
            ▼
[ backend/routes ] ──> [ backend/middlewares ]
            │
            ▼
[ backend/controllers ] ──> [ backend/config & models ]
            │
            │ HTTP RPC (Buffer stream)
            ▼
[ ai_service/app/main.py ]
```

1. **Frontend (`frontend/`)** depends ONLY on **Backend (`backend/`)** via public HTTP endpoints (`/api/...`).
2. **Backend (`backend/`)** delegates heavy AI workloads to **AI Service (`ai_service/`)** via internal microservice RPC calls (`http://localhost:8000/...`).
3. **AI Service (`ai_service/`)** operates statelessly and returns structured JSON extraction models back to the Backend.
