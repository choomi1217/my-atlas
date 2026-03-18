# my-atlas: Claude Code Project Context

## 📋 Project Overview

**my-atlas** is a full-stack QA (Quality Assurance) knowledge management application built with Spring Boot and React. It provides AI-powered assistance for QA professionals to manage testing conventions, feature documentation, knowledge bases, and automated ticket review using Claude AI.

### Key Features
- **AI Senior QA Chat** (`/`) — Conversational AI advisor powered by Claude
- **Knowledge Base** (`/kb`) — QA best practices and testing guidelines
- **Word Conventions** (`/conventions`) — Terminology standardization
- **Feature Registry** (`/features`) — Feature tracking and documentation
- **Ticket AI Reviewer** (`/ticket`) — Automated PR/ticket analysis

---

## 🏗️ Monorepo Structure

```
my-atlas/
├── backend/                  # Spring Boot REST API (Java 21, Gradle)
│   ├── src/main/java/com/myqaweb/
│   ├── src/test/java/
│   ├── build.gradle
│   └── gradle/
├── frontend/                 # React SPA (TypeScript, Vite, Tailwind)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml        # Postgres, backend, frontend orchestration
├── .github/workflows/        # CI/CD pipelines
├── .env                      # Environment variables
└── CLAUDE.md                 # This file
```

**Backend responsibilities:**
- RESTful API for CRUD operations (conventions, features, knowledge base, seniors, tickets)
- Integration with Claude API via Spring AI for AI-powered features
- Database management (PostgreSQL + pgvector for embeddings)
- Authentication & authorization (if applicable)

**Frontend responsibilities:**
- React UI for all five feature domains
- API client communication with backend
- State management and user interactions
- Responsive design with Tailwind CSS

---

## 🌿 Git Branch Strategy

```
main (production-ready)
  ↑
  │ PR (require 1+ reviewer)
  │
develop (integration branch)
  ↑
  ├─ feature/xyz (feature branches)
  ├─ bugfix/xyz
  └─ hotfix/xyz (emergency fixes to main)
```

**Rules:**
- `main` branch is **read-only** — no direct commits or pushes
- All work → `feature/*` or `bugfix/*` branches off `develop`
- Hotfixes branch from `main`, merged back to both `main` and `develop`
- `develop` is the default branch for pull requests
- All PRs require at least **1 code review** before merge

---

## 💬 Commit Message Format

Follow the Conventional Commits standard:

```
[type] subject

Optional body explaining why and what.

Optional footer (e.g., Closes #123)
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code restructuring (no feature/bug change)
- `test` — Test additions or fixes
- `docs` — Documentation only
- `chore` — Build, dependencies, tooling (no code change)

**Examples:**
```
[feat] Add email notification for ticket reviews

[fix] Resolve null pointer in knowledge base service
- Fixed NullPointerException when fetching KB with no tags

[refactor] Extract validation logic to separate utility class

[test] Increase service layer test coverage to 75%

[docs] Update backend API documentation
```

---

## 🔀 Pull Request Guidelines

### PR Direction
- **Only allowed:** `develop` → `main` (release PRs)
- **Feature/bugfix:** Always PR to `develop` first
- **Hotfixes:** PR to `main`, then cherry-pick or merge back to `develop`

### PR Requirements
1. ✅ At least 1 approval from a teammate
2. ✅ All CI/CD checks pass (`.github/workflows/`)
3. ✅ Meaningful description (what & why, not just what)
4. ✅ Commits follow the format above
5. ✅ No merge commits — prefer rebase or squash

---

## 🤖 Sub-agent Delegation for Claude Code

When working on **backend tasks**, reference `/my-atlas/backend/CLAUDE.md`:
```
backend/CLAUDE.md contains:
- Java 21 + Spring Boot 3.3.1 build/test commands (Gradle)
- Package structure & naming conventions
- Code style (interfaces, DTOs, exception handling)
- Security guidelines (SQL injection prevention, input validation)
- Test requirements (unit, integration, coverage)
```

When working on **frontend tasks**, reference `/my-atlas/frontend/CLAUDE.md`:
```
frontend/CLAUDE.md contains:
- React 18 + TypeScript + Vite commands
- Directory structure (components, pages, hooks, stores, api, types, utils)
- Code style (functional components, no any, Props interfaces)
- Security guidelines (dangerouslySetInnerHTML, .env.local)
- Test & build processes
```

---

## 🔄 Sub-agent Workflow for Feature Implementation

**For all feature requests**, Claude must execute the following 3-agent pipeline in order:

Each agent is defined in `.claude/agents/` with specific tool permissions:

### Agent 1 — Code Implementation
**File:** `.claude/agents/feature-implementor.md`
**Task:** Write feature code
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** Implement feature based on requirements, reference existing code patterns
**Success Criteria:** Code compiles, follows project conventions

### Agent 2 — Test Code Writing
**File:** `.claude/agents/test-writer.md`
**Task:** Write comprehensive tests for Agent 1's code
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** Unit tests + E2E test scenarios based on feature spec
**Success Criteria:** Test files exist with meaningful coverage

### Agent 3 — Build & Test Verification
**File:** `.claude/agents/build-verifier.md`
**Task:** Compile, run tests, verify all pass
**Tools:** Bash, Read, Glob, Grep (Write/Edit disabled)
**Commands:**
```bash
cd backend && ./gradlew clean build
./gradlew test
```
**Success Criteria:** Build succeeds, all tests pass (0 failures)
**On Failure:** Analyze error logs, notify Agent 1 or Agent 2 to fix, re-run Agent 3

**Absolute Rules:**
- ❌ **NEVER declare "complete"** without Agent 3 passing
- ❌ **NEVER skip** any agent in the pipeline
- ✅ **ALWAYS fix** build/test errors before final approval
- ✅ **ALWAYS capture** error context for debugging

---

## ⚠️ Critical Rules

### ❌ NEVER Do This
- **Direct push to `main`** — Always use feature → develop → main flow
- **Force push** to `main` or `develop` — Use regular commits & rebase
- **Commit sensitive data** — API keys, passwords go in `.env` (in .gitignore)
- **Skip pre-commit hooks** — They exist for a reason
- **Merge without review** — Every PR requires human approval

### ✅ Always Do This
- **Run tests locally** before pushing
- **Pull latest develop** before creating a feature branch
- **Check CI/CD status** in GitHub Actions
- **Write clear commit messages** following the format
- **Update .env** if new environment variables are added

---

## 📁 Environment Configuration

### Local Development (`.env` or `.env.local`)
Copy from `.env` and fill in:
```bash
# Database
POSTGRES_USER=qa_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=myatlas_db

# Backend Spring
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/myatlas_db
SPRING_DATASOURCE_USERNAME=qa_user
SPRING_DATASOURCE_PASSWORD=secure_password

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Frontend
VITE_API_BASE_URL=http://localhost:8080
```

- **Never commit `.env`** — it's in `.gitignore`
- Use `.env` as a template for new variables
- GitHub Actions securely access sensitive values via **GitHub Secrets** (see setup guide below)

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 21 (backend local dev)
- Node.js 18+ (frontend local dev)
- Git

### Run Everything
```bash
docker-compose up -d
# Backend at http://localhost:8080
# Frontend at http://localhost:5173 (or check console)
# Postgres at localhost:5432
```

### Backend Only
```bash
cd backend
./gradlew bootRun
```

### Frontend Only
```bash
cd frontend
npm install
npm run dev
```

---

## 📚 Further Reading

- **Backend details** → See `/my-atlas/backend/CLAUDE.md`
- **Frontend details** → See `/my-atlas/frontend/CLAUDE.md`
- **Docker setup** → See `docker-compose.yml`
- **Spring AI + Claude** → See `backend/src/main/resources/application.yml`
