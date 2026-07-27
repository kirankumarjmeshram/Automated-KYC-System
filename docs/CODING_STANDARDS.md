# Automated KYC System — Coding Standards & Engineering Guidelines

## 1. JavaScript / Node.js Conventions (Backend & Frontend)

### 1.1 Language Standard & Syntax Rules
* **ES6+ Features**: Use modern ECMAScript standard features (`const`/`let`, arrow functions, async/await, template literals, destructuring).
* **Var Prohibition**: Never use `var`. Use `const` by default; use `let` only if variable reassignment is required.
* **Module Systems**:
  * **Backend**: CommonJS (`require()` / `module.exports`) to remain consistent with existing Express architecture.
  * **Frontend**: ES Modules (`import` / `export default`) to align with React SPA standards.
* **Strict Equality**: Always use triple equals (`===` / `!==`). Never use double equals (`==` / `!=`).
* **Semicolons**: Use semicolons explicitly at the end of every statement.

### 1.2 Naming Conventions
* **Variables & Functions**: `camelCase` (e.g., `processImage`, `extractedAadhaar`, `formDataObj`).
* **Classes & React Components**: `PascalCase` (e.g., `KycStepupForm`, `VerificationResult`, `AppError`).
* **Database Models**: Singular `PascalCase` (e.g., `Document.js`, `User.js`).
* **Constant Globals**: `UPPER_SNAKE_CASE` (e.g., `CORS_ORIGIN`, `PORT`, `MAX_FILE_SIZE`).
* **File Names**:
  * Frontend Components/Pages: `PascalCase.js` (e.g., `KycStepupForm.js`, `Home.js`).
  * Backend Controllers/Routes/Middlewares: `camelCase.js` (e.g., `documentController.js`, `documentRoutes.js`, `errorHandler.js`).

---

## 2. Python Conventions (AI Service)

### 2.1 PEP 8 Standards
* **Style Compliance**: Follow PEP 8 guidelines strictly.
* **Naming**:
  * Functions & Variables: `snake_case` (e.g., `extract_ocr_text`, `image_buffer`).
  * Classes & Pydantic Models: `PascalCase` (e.g., `OCRRequest`, `FacialMatchResponse`).
  * Global Constants: `UPPER_SNAKE_CASE` (e.g., `GEMINI_MODEL_NAME`, `MAX_PREFILTER_DIM`).
* **Type Hinting**: All Python function parameters and return values must specify type annotations:
  ```python
  def process_document_buffer(file_bytes: bytes, file_name: str) -> dict[str, Any]:
  ```

---

## 3. Directory & File Organization Standards

* **Thin Controllers, Rich Services**: Controllers (`backend/controllers`) must only handle request extraction, call business services, and format responses. Logic belongs in `backend/services/`.
* **No Inline Anonymous Route Logic**: Endpoints in `routes/` should delegate directly to controller functions rather than nesting inline business logic.
* **Single Responsibility Principle**: Every file must fulfill a single clear responsibility. Do not combine database models, route registrations, and image transformations in one file.

---

## 4. Error Handling & Logging Rules

### 4.1 Error Handling
* **Operational Errors**: Throw custom `AppError` instances with explicit HTTP status codes (`400`, `404`, `500`).
* **Async Error Wrapping**: Wrap async backend controllers using `catchAsync` or explicitly pass errors to `next(err)`. Never leave an unhandled rejected promise.
* **No Silent Exception Swallowing**: Catch blocks must log errors via Winston or Python `logger` before recovering or re-throwing.

### 4.2 Logging Standards
* **Use Centralized Winston Logger**: Never use raw `console.log()` in production backend code. Use `logger.info()`, `logger.warn()`, `logger.error()`.
* **Structured Context**: Include request attributes, status codes, and error stacks in log metadata:
  ```javascript
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, { stack: err.stack });
  ```

---

## 5. API Response Format Standard

All API endpoints must return a consistent JSON wrapper structure:

### 5.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Human-readable operational confirmation",
  "details": { ... }
}
```

### 5.2 Error Response (`400 Bad Request`, `404 Not Found`, `500 Internal Server Error`)
```json
{
  "success": false,
  "error": "Short readable error summary message",
  "details": [ "Optional array of specific field validation error strings" ]
}
```

---

## 6. Git Commit Message Standard

Follow the **Conventional Commits** specification:

### Syntax Format
```
<type>(<scope>): <short summary>

[optional detailed description]
```

### Types
* `feat`: A new feature added to frontend, backend, or AI service
* `fix`: A bug fix in existing code
* `docs`: Documentation changes only (`docs/`, `README.md`)
* `refactor`: Code change that neither fixes a bug nor adds a feature
* `test`: Adding missing tests or correcting existing tests
* `chore`: Maintenance tasks, dependency updates, package.json updates

### Examples
* `feat(backend): add Zod validation schema for step-up KYC submission`
* `fix(controller): wrap sharp image processing in try-catch for fallback resiliency`
* `docs(architecture): create developer onboarding and coding standards guide`
