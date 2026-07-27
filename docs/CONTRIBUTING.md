# Automated KYC System — Contributor & Pull Request Guide

Thank you for contributing to the **Automated KYC System**. This guide defines the workflow, branching standards, pull request rules, code review expectations, and testing checklists for all developers and AI pair programmers.

---

## 1. Git Branching Strategy

We follow the **GitHub Flow** branching model:

```
main (Production Ready Code)
  │
  ├── feature/ocr-paddle-integration
  ├── fix/sharp-try-catch-resiliency
  └── docs/developer-guides
```

### Branch Naming Conventions

* `feature/<feature-description>`: Adding new functionality (e.g. `feature/clerk-auth-middleware`).
* `fix/<bug-description>`: Resolving an error or unexpected behavior (e.g. `fix/db-connection-retry`).
* `docs/<doc-description>`: Documentation additions or updates (e.g. `docs/api-specification`).
* `refactor/<refactor-description>`: Internal code refactoring without external API changes.

---

## 2. Pull Request (PR) Submission Workflow

1. **Create Topic Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Implement Changes & Verify Locally**:
   * Run local health checks and dev servers (`npm run dev:all`).
   * Ensure code formatting matches [CODING_STANDARDS.md](file:///c:/Users/kiran/Documents/GitHub/Automated-KYC-System/docs/CODING_STANDARDS.md).
3. **Commit with Conventional Commit Syntax**:
   ```bash
   git commit -m "feat(backend): implement Zod schema validation for KYC form"
   ```
4. **Push & Open Pull Request**:
   * Target `main` branch.
   * Provide a clear PR title and description outlining the goal, changes, and testing performed.

---

## 3. Code Review & PR Verification Checklist

Before approving or merging any PR, verify the following:

### Architectural Compliance

- [ ] Preserves existing project directory boundaries ([FOLDER_STRUCTURE_GUIDE.md](file:///c:/Users/kiran/Documents/GitHub/Automated-KYC-System/docs/FOLDER_STRUCTURE_GUIDE.md)).
- [ ] No direct hardcoded environment URLs or secret keys.
- [ ] Follows thin controller / service layer design.

### Code Quality & Standards

- [ ] No `var` usage; strict equality (`===`) enforced.
- [ ] Errors caught and logged via Winston (`logger.error`) rather than swallowed.
- [ ] No raw `console.log()` statements left in production backend logic.

### Runtime Verification

- [ ] Backend boots cleanly on port 5000 without startup crashes.
- [ ] `GET /health` returns `200 OK`.
- [ ] `POST /api/verify` handles valid and invalid input formats correctly.
- [ ] Frontend builds cleanly without Webpack or ESLint compilation errors.
