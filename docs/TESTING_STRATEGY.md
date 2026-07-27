# Automated KYC System — Testing Strategy & Quality Assurance Guide

This document outlines the testing methodology, automated test suites, manual verification checklists, and regression protocols for the platform.

---

## 1. Testing Pyramid Overview

```
                  / \
                 / QA\         Manual Acceptance Checklist
                /-----\
               /  E2E  \       Cypress / Playwright E2E Flow Tests
              /---------\
             /Integration\     Supertest API Endpoint Tests
            /-------------\
           /   Unit Tests  \   Jest (Backend/Frontend) & PyTest (AI Service)
          /-----------------\
```

---

## 2. Unit Testing Strategy

### 2.1 Backend Unit Tests (Jest)
* **Scope**: Custom utility functions (`appError.js`), Zod request schemas (`validate.js`), and fallback text parsers (`documentController.js`).
* **Execution Command**:
  ```bash
  cd backend && npm test
  ```
* **Sample Test Case (`backend/tests/extractDetails.test.js`)**:
  * Verify regex extraction of 12-digit Aadhaar numbers (`\b\d{4}\s?\d{4}\s?\d{4}\b`).
  * Verify regex extraction of 10-character PAN strings (`\b[A-Z]{5}[0-9]{4}[A-Z]\b`).

### 2.2 AI Service Unit Tests (PyTest)
* **Scope**: Pydantic models, OpenCV matrix transformations, and fallback response serializers.
* **Execution Command**:
  ```bash
  cd ai_service && pytest
  ```

---

## 3. Integration & API Endpoint Testing

### 3.1 HTTP Endpoint Verification (Supertest / Node Fetch)
* **Scope**: Validate HTTP status codes, CORS headers, rate limiters, and error handling middleware.
* **Verification Matrix**:
  * `GET /health` → Must return `200 OK` with `status: "healthy"`.
  * `POST /api/verify` (Empty Body) → Must return `400 Bad Request` with `{"error": "Missing form data"}`.
  * `POST /api/verify` (Multipart Form) → Must return `200 OK` with `success: true`.

---

## 4. Manual QA Verification Checklist

Execute this checklist after any major pull request or release candidate build:

- [ ] **1. Server Startup**: Run `npm run dev:all` and verify all 3 services boot without errors.
- [ ] **2. Health Endpoints**:
  - `http://localhost:5000/health` returns `200 OK`.
  - `http://localhost:8000/health` returns `200 OK`.
- [ ] **3. Step-Up KYC Submission**:
  - Load `http://localhost:3000`.
  - Enter Name: `Rahul Sharma`, Aadhaar: `123456789012`, PAN: `ABCDE1234F`.
  - Attach valid image files for Aadhaar and PAN.
  - Click "Submit Verification".
  - Verify success alert box appears displaying extracted attributes.
- [ ] **4. Validation Error Handling**:
  - Leave files empty and click Submit → Verify client validation alert triggers.
  - Enter mismatched details under real OCR mode → Verify `400 Bad Request` mismatch message is rendered.
- [ ] **5. Logging Verification**:
  - Inspect `backend/logs/application.log` and verify structured log entries are written for requests.
