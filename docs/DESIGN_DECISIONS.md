# Automated KYC System — Architectural Design Decisions (ADR)

This document records the architectural decisions, tech stack selections, design trade-offs, and rationale behind the **Automated KYC System**.

---

## ADR 1: Microservice Separation (React SPA + Express API + Python FastAPI)

### Decision
Separate the platform into three decoupled applications: React SPA frontend, Node.js Express API gateway, and Python FastAPI AI microservice.

### Rationale & Trade-offs
* **Why Node.js/Express for API Gateway**: High I/O throughput, non-blocking asynchronous event loop ideal for routing, authentication, rate limiting, and multipart form handling.
* **Why Python/FastAPI for AI Service**: Python is the industry standard for ML/CV frameworks (`opencv`, `paddleocr`, `insightface`, `mediapipe`, `numpy`). FastAPI provides high performance (ASGI), automatic OpenAPI validation, and async execution.
* **Trade-off**: Increases operational deployment complexity (three running containers instead of a monolith), but allows independent scaling (e.g., auto-scaling Python ML workers on GPU instances while running Node.js lightweight instances).

---

## ADR 2: Multer In-Memory Storage for File Uploads

### Decision
Configure Multer to use `multer.memoryStorage()` instead of `multer.diskStorage()`.

### Rationale & Trade-offs
* **Rationale**: Eliminates local disk I/O latency and security risks associated with storing unencrypted identity document images on temporary server disks. Buffers are processed directly in RAM (`req.files[0].buffer`) and passed to `sharp` or uploaded to AWS S3.
* **Trade-off**: Increases Node.js RAM usage under heavy concurrent load. Mitigated by enforcing strict file size caps (`10MB` limit in `express.json` / Multer) and rate limiting.

---

## ADR 3: Dual-Engine OCR Strategy with Resilient Fallback

### Decision
Implement Google Cloud Vision API / PaddleOCR as primary extraction engines, accompanied by a resilient regex-based local fallback parser (`fallback: true`).

### Rationale & Trade-offs
* **Rationale**: In local development or prototype testing, GCP credentials or GPU model weights may be unconfigured. If OCR fails or is missing, throwing a fatal 500 error breaks developer workflow. The fallback parser extracts structured details and flags `fallback: true`, instructing the route controller to bypass strict string equality checks.
* **Trade-off**: Requires careful boundary checks in route logic so fallback dummy data isn't accidentally compared against real user input.

---

## ADR 4: Zod for Environment Variable and Schema Validation

### Decision
Use Zod in `backend/config/env.js` and `backend/middlewares/validate.js` for runtime validation.

### Rationale & Trade-offs
* **Rationale**: Enforces strict typing at system startup ("fail-fast" principle). If `PORT`, `NODE_ENV`, or `MONGODB_URI` are invalid or missing, the process terminates immediately with explicit field-level error output instead of failing obscurely at runtime.
* **Trade-off**: Requires defining explicit schemas for all incoming payloads.

---

## ADR 5: Non-Fatal Database Connection Design

### Decision
Modify `backend/config/db.js` so that MongoDB connection failure logs an error/warning without calling `process.exit(1)`.

### Rationale & Trade-offs
* **Rationale**: Document OCR verification is fundamentally an in-memory computational workflow. If MongoDB Atlas is temporarily unreachable (e.g., unwhitelisted dev IP), users can still execute image verification endpoints (`POST /api/verify`, `POST /api/process`).
* **Trade-off**: Features requiring database persistence (user profiles, audit records) will fail if DB is unreachable.

---

## ADR 6: AWS S3 & Presigned URLs for Document Storage (Target Architecture)

### Decision
Store uploaded documents in AWS S3 with server-side encryption and access documents via short-lived pre-signed URLs.

### Rationale & Trade-offs
* **Rationale**: Identity documents contain sensitive Personal Identifiable Information (PII). Public S3 buckets expose security risks. Pre-signed URLs grant temporary access (e.g., 15-minute expiration) to authorized KYC Officers without exposing raw S3 storage credentials.
* **Trade-off**: Requires managing S3 lifecycle rules and signing URL generation latency.
