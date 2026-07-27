# Automated KYC System — Developer Onboarding & Development Guide

## 1. Project Overview & Architecture

The **Automated KYC System** is a production-grade, multi-tier AI-assisted Digital Identity Verification Platform. It automates Know Your Customer (KYC) compliance for financial institutions and regulated entities by processing government identity documents (Aadhaar, PAN), extracting text data, validating attributes, performing facial matching, and executing passive liveness detection.

### Technical Stack
* **Frontend Single Page Application (SPA)**: React 19, React-Bootstrap, React Router DOM v7, Axios (`frontend/`)
* **Backend API Gateway**: Node.js, Express 4.x, Multer (Memory Storage), Winston Logger, Helmet, Express-Rate-Limit, Zod, Mongoose (`backend/`)
* **AI & Computer Vision Service**: Python 3.10+, FastAPI, OpenCV, PaddleOCR / EasyOCR, InsightFace, MediaPipe, Google Generative AI (Gemini) (`ai_service/`)
* **Database & Infrastructure**: MongoDB Atlas, AWS S3, Clerk Authentication

---

## 2. Local Environment Setup

### 2.1 Prerequisites & Required Software
Before setting up the repository, ensure your environment meets the following requirements:
* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **npm**: v9.0.0 or higher
* **Python**: v3.10.x or v3.11.x (Required for OpenCV, PaddleOCR, InsightFace)
* **Git**: v2.30.0 or higher
* **MongoDB**: Local MongoDB instance (v6.0+) OR a free MongoDB Atlas cluster URI
* **C++ Build Tools (Windows)**: Visual Studio Build Tools (C++ Desktop Workload) for compiling `sharp` and `insightface` native bindings.

---

### 2.2 Repository Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/kirankumarjmeshram/Automated-KYC-System.git
   cd Automated-KYC-System
   ```
2. Install all dependencies across root workspace, backend, and frontend with a single command:
   ```bash
   npm run install:all
   ```
   *Alternative manual installation:*
   ```bash
   npm install                    # Root orchestration dependencies
   cd backend && npm install       # Backend dependencies
   cd ../frontend && npm install   # Frontend dependencies
   cd ..
   ```
3. Set up Python virtual environment for `ai_service`:
   ```bash
   cd ai_service
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate

   pip install -r requirements.txt
   cd ..
   ```

---

### 2.3 Environment Variable Configuration

#### Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/kyc_db
CORS_ORIGIN=http://localhost:3000
GOOGLE_APPLICATION_CREDENTIALS=
AI_SERVICE_URL=http://localhost:8000
```

#### Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=
VITE_APP_NAME=AI Assisted Digital KYC Platform
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

#### AI Service Configuration (`ai_service/.env`)
Copy `ai_service/.env.example` to `ai_service/.env`:
```env
PORT=8000
ENVIRONMENT=development
GEMINI_API_KEY=
PADDLE_OCR_LANG=en
```

---

## 3. Running Applications Locally

### 3.1 Orchestrated Startup (All Services)
To start the Express Backend, React Frontend, and Python FastAPI AI Service concurrently in one terminal:
```bash
npm run dev:all
```

### 3.2 Individual Service Startup Commands

#### Running the Backend API Gateway (Port 5000)
```bash
npm run server
# OR
cd backend && npm run dev
```
*Health Check*: Open `http://localhost:5000/health` in your browser. Expected response: `{"status": "healthy", ...}`.

#### Running the React Frontend Client (Port 3000)
```bash
npm run frontend
# OR
cd frontend && npm start
```
*Access App*: Open `http://localhost:3000` in your browser.

#### Running the Python FastAPI AI Service (Port 8000)
```bash
npm run ai
# OR
cd ai_service && uvicorn app.main:app --reload --port 8000
```
*Health Check*: Open `http://localhost:8000/health` in your browser. Expected response: `{"status": "healthy", "service": "ai_service"}`.
*Interactive API Docs*: Open `http://localhost:8000/docs` (Swagger UI).

---

## 4. Debugging & Troubleshooting

### 4.1 Backend Debugging
* Log outputs are logged simultaneously to stdout and `backend/logs/application.log` via Winston.
* Common issue: `EADDRINUSE: address already in use :::5000`.
  * Fix: Clear port 5000: `npx kill-port 5000`.
* Common issue: MongoDB connection timeout.
  * `backend/config/db.js` logs a warning and allows non-database endpoints to continue running without crashing the server. Check your MongoDB URI or Atlas IP Whitelist.

### 4.2 Frontend Debugging
* Browser DevTools Console: Watch network tab for `POST http://localhost:5000/api/verify` requests.
* Ensure `Content-Type: multipart/form-data` is header-managed automatically by Axios when passing `FormData`.

---

## 5. Standard Operating Procedures (SOPs) for Adding Features

### 5.1 SOP: How to Add a New Backend API Endpoint
1. **Define Validation Schema**: Add Zod schema under `backend/validators/yourValidator.js`.
2. **Implement Service Logic**: Add business logic in `backend/services/yourService.js`.
3. **Implement Controller**: Create controller handler in `backend/controllers/yourController.js`.
4. **Register Route**: Mount the controller in `backend/routes/yourRoutes.js` with `validate()` middleware.
5. **Attach to Express Server**: Register the route file in `backend/server.js` under `/api`.

### 5.2 SOP: How to Create a New React Component
1. Create component file under `frontend/src/components/YourComponent.js`.
2. Use functional component syntax (`const YourComponent = () => { ... }`).
3. Import Bootstrap elements from `react-bootstrap`.
4. Use Axios for HTTP network calls to `http://localhost:5000/api/...`.
5. Embed state handling (`loading`, `error`, `data`) and render loading indicators during requests.

### 5.3 SOP: How to Add a New Endpoint in Python AI Service
1. Create or update endpoint handler in `ai_service/app/main.py` or sub-module under `ai_service/app/services/`.
2. Use Pydantic models for request/response payload validation.
3. Handle async file buffers with `UploadFile = File(...)`.
4. Register router in `app/main.py`.
