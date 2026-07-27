# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-27

### Added
- Root `package.json` with unified orchestration scripts (`npm start`, `npm run server`, `npm run frontend`, `npm run backend`, `npm run ai`, `npm run dev`, `npm run dev:all`, `npm run build`, `npm run install:all`).
- Express infrastructure middlewares: `helmet` for security headers, `express-rate-limit` for rate limiting, Zod schema environment validator (`backend/config/env.js`), and generic request validator (`backend/middlewares/validate.js`).
- Centralized Express error handler (`backend/middlewares/errorHandler.js`), custom operational error class (`backend/utils/appError.js`), and async function wrapper (`backend/utils/catchAsync.js`).
- Health check endpoints on Backend (`GET /health`) and AI Service (`GET /health`).
- Endpoint alias `POST /api/process` for single document processing in `backend/routes/documentRoutes.js`.
- Python FastAPI entry point `ai_service/app/main.py` and `ai_service/requirements.txt`.

### Modified
- `backend/server.js`: Mounted `documentRoutes` under `/api` prefix, configured Helmet, CORS whitelist, rate limiting, and global error handling.
- `backend/routes/documentRoutes.js`: Extended Multer file handling to accept `aadhaarFile`, `panFile`, and `file` fields flexibly.
- `backend/controllers/documentController.js`: Enhanced `processImage` with safe Google Vision client initialization and resilient fallback parsing for local development.
- `backend/config/db.js`: Upgraded Mongoose connection logic with Winston lifecycle logging and non-blocking fallback handling.

### Fixed
- Fixed 404 endpoint error `{"success":false,"error":"Cannot find endpoint /api/verify on this server"}` when submitting the KYC form from the React frontend.
- Fixed unhandled Google Vision credential exception during OCR image processing.
