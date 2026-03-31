# my-atlas: Claude Code Project Context

## 📋 Project Overview

**my-atlas** is a full-stack QA (Quality Assurance) knowledge management application built with Spring Boot and React. It provides AI-powered assistance for QA professionals to manage testing conventions, feature documentation, and knowledge bases using Claude AI.

### Key Features
- **AI Senior QA Chat** (`/senior`) — Conversational AI advisor powered by Claude
- **Knowledge Base** (`/kb`) — QA best practices and testing guidelines
- **Word Conventions** (`/conventions`) — Terminology standardization
- **Feature Registry** (`/features`) — Feature tracking and documentation

---

## 🏗️ Monorepo Structure

```
my-atlas/
├── backend/                  # Spring Boot REST API (Java 21, Gradle)
│   ├── src/main/java/com/myqaweb/
│   ├── src/test/java/
│   ├── build.gradle
│   └── gradle
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
- RESTful API for CRUD operations (conventions, features, knowledge base, seniors)
- Integration with Claude API via Spring AI for AI-powered features
- Database management (PostgreSQL + pgvector for embeddings)
- Authentication & authorization (if applicable)

**Frontend responsibilities:**
- React UI for all four feature domains
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
[feat] Add email notification for test case updates

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

**For all feature requests**, Claude must execute the following 4-agent pipeline in order:

Each agent is defined in `.claude/agents/` with specific tool permissions:

### Agent-A — Code Implementation
**File:** `.claude/agents/code-implementor.md`
**Task:** Write feature code
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** Implement feature based on requirements, reference existing code patterns
**Success Criteria:** Code compiles, follows project conventions

### Agent-B — Backend Unit & Integration Tests
**File:** `.claude/agents/unit-test-writer.md`
**Task:** Write JUnit 5 / Mockito tests for Agent-A's backend code
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** Unit tests and integration tests in `backend/src/test/java/`
**Success Criteria:** Test files exist with meaningful coverage of service and controller layers

### Agent-C — E2E Tests (Playwright)
**File:** `.claude/agents/e2e-test-writer.md`
**Task:** Write Playwright E2E tests (API + UI) for Agent-A's feature
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** E2E test specs in `qa/api/` and `qa/ui/`, plus page objects and helpers
**Success Criteria:** E2E test files exist covering the feature's API endpoints and UI flows

### Agent-D — Build & Test Verification
**File:** `.claude/agents/build-verifier.md`
**Task:** Compile, run all tests, verify full stack E2E passes
**Tools:** Bash, Read, Glob, Grep (Write/Edit disabled)
**Commands (must all pass in order):**
```bash
# Step 1: Backend build
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build

# Step 2: Unit tests
./gradlew test

# Step 3: Start full stack (from repo root)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d && sleep 10

# Step 4: E2E tests
cd /Users/yeongmi/dev/qa/my-atlas/qa && npx playwright test

# Teardown (always, unconditional)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose down
```
**Success Criteria:** ALL of the following must pass:
- `./gradlew clean build` exits 0
- `./gradlew test` exits 0 with 0 failures
- `docker compose up -d && sleep 10` succeeds, all containers running
- `npx playwright test` exits 0 with 0 E2E failures

**On Failure:** Analyze error logs, identify whether Agent-A (code fix), Agent-B (unit test fix), or Agent-C (E2E test fix) is responsible, return detailed error report, re-run Agent-D from Step 1 after fix is applied.

**Implementation is NOT complete until all four steps pass.**

**Absolute Rules:**
- ❌ **NEVER declare "complete"** without Agent-D passing ALL four steps (build + unit tests + docker stack + E2E)
- ❌ **NEVER skip** any agent in the pipeline
- ❌ **NEVER skip E2E** — "optional" does not apply to Agent-D's E2E step
- ❌ **NEVER let Agent-B write E2E tests or Agent-C write unit tests** — each agent has exclusive scope
- ✅ **ALWAYS fix** build/test errors before final approval
- ✅ **ALWAYS capture** error context for debugging
- ✅ **ALWAYS run `docker compose down`** after Agent-D finishes, regardless of outcome

---

## 📝 버전 문서화 규칙

### 메인 명세서
각 기능의 현재 구현 상태를 정리한 **버전 없는 md 파일**이 메인 명세서이다.
- 경로: `docs/features/{feature-name}/{feature-name}.md`
- 예시: `knowledge-base.md`, `feature-registry.md`, `my-senior.md`
- 기능의 전체 구조(스키마, API, 파일구조, 핵심기능, 테스트)를 한눈에 파악 가능

### 버전 문서
변경 시 반드시 버전 문서를 작성한다.

### 문서 경로 (유형별 분리)
| 변경 유형 | 경로 | 파일명 패턴 |
|-----------|------|-------------|
| 버그 수정 | `docs/features/{feature-name}/` | `{feature-name}_v{버전}.md` |
| 기능 추가 | `docs/features/{feature-name}/` | `{feature-name}_v{버전}.md` |
| 기능 개선 | `docs/features/{feature-name}/` | `{feature-name}_v{버전}.md` |
| 환경 개선 | `docs/ops/` | `{주제}_v{버전}.md` |

### 워크플로우
1. Plan 수립
2. 코드 개발
3. 버전 md 작성

### 버전 번호
- 기능 추가 / 기능 개선 → 메이저 증가 (v0 → v1)
- 버그 수정 / 환경 개선 → 패치 증가 (v0 → v0.1)

### 변경 유형 태그
| 태그 | 설명 |
|------|------|
| 버그 수정 | 기존 기능의 오류 수정 |
| 기능 추가 | 새로운 기능 개발 |
| 기능 개선 | 기존 기능의 UX/성능 개선 |
| 환경 개선 | 설정, 인프라, 빌드 환경 변경 |

---

## 📄 문서 기반 구현 워크플로우 (Doc-Driven Development)

`docs/**` 경로의 md 파일을 사양서로 사용하여 구현을 진행한다.

### 워크플로우 단계

| Step | 주체 | 행동 |
|------|------|------|
| 1 | User | `docs/**`에 md 파일로 요구사항 작성 |
| 2 | User | Claude에게 해당 파일을 지목하며 구현 요청 |
| 3 | Claude | 파일을 읽고, 해당 파일에 **context / 계획 / 구현 절차(Step 목록)** 를 채워 넣음 |
| 4 | User | 내용 확인 후, Step 별 진행 지시 |
| 5 | Claude | 각 Step 완료 시 해당 파일에 **✅ 체크 표시**로 완료 상태 표기 |
| 6 | Claude | 모든 Step 완료 후, 파일 최하단에 **[최종 요약]** 섹션 작성 |

### 규칙
- ❌ Claude가 임의로 Step을 건너뛰지 않는다
- ❌ User의 진행 지시 없이 다음 Step으로 넘어가지 않는다
- ✅ 각 Step 완료 시 반드시 md 파일을 업데이트한다
- ✅ 최종 요약은 모든 Step이 완료된 후에만 작성한다

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

## ⚠️ 데이터베이스 삭제 금지 (CRITICAL)

### knowledge_base 테이블 — 절대 삭제 금지
이 테이블에는 실제 PDF 도서를 청킹·임베딩하여 저장한 운영 데이터가 포함되어 있다.
재생성 시 OpenAI Embedding API 호출 비용과 수 분~수십 분의 처리 시간이 발생한다.

**Claude Code는 다음 명령을 절대로 실행해서는 안 된다:**
- ❌ `DELETE FROM knowledge_base` (어떤 WHERE 조건이든)
- ❌ `TRUNCATE knowledge_base`
- ❌ `DROP TABLE knowledge_base`
- ❌ `docker compose down -v` (DB 볼륨 삭제로 전체 데이터 소실)
- ❌ knowledge_base 행을 삭제하는 어떤 코드/쿼리 실행

특정 데이터 삭제가 필요한 경우, 사용자에게 직접 실행하도록 안내만 할 것.

### pdf_upload_job 테이블 — 절대 삭제 금지
업로드 이력 및 처리 상태를 관리한다.
- ❌ `DELETE FROM pdf_upload_job` (어떤 WHERE 조건이든)
- ❌ `TRUNCATE pdf_upload_job`
- ❌ `DROP TABLE pdf_upload_job`

---

## 📚 Further Reading

- **Backend details** → See `/my-atlas/backend/CLAUDE.md`
- **Frontend details** → See `/my-atlas/frontend/CLAUDE.md`
- **Docker setup** → See `docker-compose.yml`
- **Spring AI + Claude** → See `backend/src/main/resources/application.yml`
