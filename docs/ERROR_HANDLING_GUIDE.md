# Automated KYC System — Error Handling, Fallback & Resilience Guide

This document defines the system-wide error handling taxonomy, fallback strategies, retry policies, logging standards, and recovery mechanisms for the platform.

---

## 1. Error Taxonomy & Classifications

The system categorizes errors into four major types:

| Category | HTTP Code | Internal Code / Exception | Description & Example | Handling Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Operational Validation Error** | `400` | `ZodError`, `AppError` | Invalid Aadhaar format, missing name, or document payload mismatch | Intercept in middleware (`validate.js`); return sanitized field error array |
| **Database Exception** | `400` / `500` | `CastError`, `MongoServerError (11000)` | Invalid MongoDB ObjectId cast or duplicate email record | Formatted in `errorHandler.js`; log error and return user-friendly message |
| **OCR / Vision Service Failure** | `200` (Fallback) | `Error: Input buffer contains unsupported image format` | Unsupported file format, unwhitelisted GCP credentials, or sharp processing exception | Catch in `documentController.js`; flag `fallback: true` and execute local metadata parser |
| **Programming / Fatal Error** | `500` | `ReferenceError`, `TypeError` | Bug in application code or unhandled promise rejection | Caught by `errorHandler.js` / `process.on('unhandledRejection')`; log stack trace silently; return 500 |

---

## 2. Centralized Error Handling Architecture

### 2.1 Custom Operational Error (`backend/utils/appError.js`)
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
```

### 2.2 Express Error Middleware (`backend/middlewares/errorHandler.js`)
* Logs all errors using Winston (`logger.error(...)`).
* Transforms raw database driver errors (`CastError`, `11000`, `ValidationError`) into standardized user messages.
* Hides sensitive internal stack traces from clients when `NODE_ENV === "production"`.

---

## 3. Fallback Strategies & Resiliency Patterns

### 3.1 Non-Fatal Database Connection Fallback (`backend/config/db.js`)
When MongoDB Atlas is unreachable (e.g., dev environment without whitelisted IP):
```javascript
} catch (error) {
  logger.error(`MongoDB initial connection error: ${error.message}`);
  logger.warn("Server will continue without database connection.");
}
```
*Result*: Non-database OCR routes (`POST /api/verify`, `POST /api/process`) remain operational.

### 3.2 OCR Controller Fallback Strategy (`backend/controllers/documentController.js`)
When `sharp` image transformation or `@google-cloud/vision` fails:
1. The inner try-catch catches the processing error and logs a warning.
2. The controller sets `usingFallback = true`.
3. A local regex parser executes against `file.originalname` to synthesize a test data structure.
4. `documentRoutes.js` detects `fallback === true` and skips strict string equality comparison.
5. The API returns a `200 OK` response explaining that document verification ran in fallback mode.

---

## 4. Logging & Monitoring Strategy

* **Framework**: Winston Logger (`backend/logger.js`).
* **Outputs**:
  * **Console**: Colorized timestamps and log levels (`info`, `warn`, `error`).
  * **File**: Persistent log files saved to `backend/logs/application.log`.
* **Unhandled Rejections**: `process.on('unhandledRejection')` in `server.js` logs error context via Winston before initiating a graceful server shutdown.
