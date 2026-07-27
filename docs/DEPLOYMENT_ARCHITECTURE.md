# Automated KYC System — Deployment & Infrastructure Architecture

This document describes the production deployment architecture, cloud infrastructure, containerization strategy, SSL/TLS configuration, secrets management, monitoring, and CI/CD pipeline for the platform.

---

## 1. Production Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 DNS / Cloudflare             │
                  │             (SSL/TLS + DDoS Protection)      │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         │ HTTPS / WSS
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
┌────────────────────────────────┐             ┌────────────────────────────────┐
│        Vercel Edge Network     │             │        Render Web Service      │
│    (Frontend React SPA Hosting)│             │     (Express Backend API)      │
└────────────────────────────────┘             └────────────────┬───────────────┘
                                                                │
                                                                │ Internal VPC / HTTP RPC
                                                                │
                                               ┌────────────────▼───────────────┐
                                               │        Render Docker Container │
                                               │     (FastAPI Python AI Service)│
                                               └────────────────┬───────────────┘
                                                                │
                                   ┌────────────────────────────┴────────────────────────────┐
                                   │                                                         │
                                   ▼                                                         ▼
                    ┌────────────────────────────┐                            ┌────────────────────────────┐
                    │       MongoDB Atlas        │                            │         AWS S3             │
                    │   (Persistent DB Cluster)  │                            │ (Encrypted Doc Bucket)     │
                    └────────────────────────────┘                            └────────────────────────────┘
```

---

## 2. Infrastructure Component Allocation

| Component | Target Platform | Runtime / Container | Config / Env Secrets |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | Vercel | Node.js Build Engine / Static CDN | `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY` |
| **Backend API Gateway** | Render Web Service | Node.js v20 LTS | `PORT`, `NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGIN`, `AI_SERVICE_URL`, `AWS_*` |
| **AI Microservice** | Render Web Service | Python 3.10 Docker Container | `PORT=8000`, `GEMINI_API_KEY`, `PADDLE_OCR_LANG` |
| **Database** | MongoDB Atlas | M10 Cluster (Multi-AZ) | TLS connection string, Whitelisted Render IP Range |
| **Storage** | AWS S3 | S3 Standard (SSE-S3 Encrypted) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME` |

---

## 3. Containerization Strategy (Docker)

### 3.1 Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
```

### 3.2 AI Service Dockerfile (`ai_service/Dockerfile`)
```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. Security, SSL & Secrets Management

1. **HTTPS Enforcement**: All external endpoints require HTTPS (TLS 1.3). Cloudflare / Vercel automatically redirect HTTP to HTTPS.
2. **Secrets Storage**: Production credentials (`MONGODB_URI`, `AWS_SECRET_ACCESS_KEY`, `GEMINI_API_KEY`) must never be committed to Git. Inject via Render & Vercel Dashboard Environment Secret Managers.
3. **CORS Hardening**: Restrict `CORS_ORIGIN` in backend production to the exact Vercel frontend domain (e.g. `https://kyc.yourdomain.com`).

---

## 5. CI/CD Pipeline (GitHub Actions)

Workflow defined in `.github/workflows/deploy.yml`:
1. **Trigger**: Push to `main` branch.
2. **Build & Test Stage**:
   * Install dependencies (`npm run install:all`).
   * Run linter & test suites (`npm test`).
3. **Deploy Stage**:
   * Deploy React SPA to Vercel via Vercel CLI.
   * Trigger Render Web Service deploy hook for Express backend.
   * Build & push Python Docker image to Render container registry for AI service.
