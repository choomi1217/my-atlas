# my-atlas: Claude Code Project Context

## Project Overview

**my-atlas**는 Spring Boot + React 기반 QA 지식 관리 애플리케이션이다.
Claude AI와 OpenAI 임베딩을 활용하여 QA 전문가의 테스트 컨벤션, 기능 문서, 지식 베이스를 관리한다.

### 핵심 기능 (구현 완료)

| 기능 | 라우트 | 설명 | 상태 |
|------|--------|------|------|
| My Senior | `/senior` | AI 시니어 QA 챗봇 (RAG + SSE 스트리밍), FAQ 카드뷰, FAQ→Chat 컨텍스트 전달 | 구현 완료 |
| Knowledge Base | `/kb` | QA 지식 CRUD + PDF 업로드 파이프라인 (청킹, 임베딩), 소스 필터 탭 | 구현 완료 |
| Word Conventions | `/conventions` | 팀 용어 표준화 CRUD | 구현 완료 |
| Feature Registry | `/features` | Company → Product → TestCase 3단계 드릴다운, Segment 트리, DnD | 구현 완료 |

---

## Monorepo Structure

```
my-atlas/
├── backend/                  # Spring Boot REST API (Java 21, Gradle)
│   ├── src/main/java/com/myqaweb/
│   │   ├── MyQaWebApplication.java
│   │   ├── senior/           # AI Chat (SSE) + FAQ CRUD + RAG pipeline
│   │   ├── knowledgebase/    # KB CRUD + PDF upload pipeline
│   │   ├── convention/       # Convention CRUD
│   │   ├── feature/          # Company, Product, Segment, TestCase
│   │   └── common/           # EmbeddingService, GlobalExceptionHandler, ApiResponse
│   ├── src/test/java/        # 179 tests (Unit + Integration via Testcontainers)
│   ├── src/main/resources/
│   │   ├── application.yml   # Spring config (Flyway, Spring AI, pgvector)
│   │   ├── logback-spring.xml
│   │   └── db/migration/     # Flyway V1~V7
│   ├── build.gradle
│   └── CLAUDE.md             # Backend 전용 가이드
├── frontend/                 # React SPA (TypeScript, Vite, Tailwind)
│   ├── src/
│   │   ├── pages/            # SeniorPage, KnowledgeBasePage, ConventionsPage, features/*
│   │   ├── components/       # senior/ (ChatView, FaqView, FaqCard, FaqFormModal)
│   │   │                     # kb/ (PdfUploadModal, PdfJobStatusCard)
│   │   │                     # features/ (TestCaseFormModal, SegmentTreeView, ConfirmDialog, etc.)
│   │   ├── hooks/            # useSeniorChat, useFaq, useKnowledgeBase, usePdfUpload
│   │   ├── api/              # senior.ts (chatApi, faqApi, kbApi), features.ts
│   │   ├── types/            # senior.ts, features.ts
│   │   ├── context/          # ActiveCompanyContext.tsx
│   │   └── stores/           # featureStore.ts (Zustand)
│   ├── package.json
│   ├── vitest.config.ts      # Frontend unit test config
│   └── CLAUDE.md             # Frontend 전용 가이드
├── qa/                       # Playwright E2E Tests (98 tests: API 65 + UI 33)
│   ├── api/                  # company, product, segment, feature, kb, convention, senior-faq
│   ├── ui/                   # company-panel, product-panel, feature-panel, kb, senior, segment-dnd
│   ├── helpers/api-helpers.ts
│   ├── pages/features-page.ts
│   ├── playwright.config.ts
│   └── CLAUDE.md             # E2E 테스트 가이드
├── docs/                     # Doc-Driven Development 문서
│   ├── features/
│   │   ├── feature-registry/ # feature-registry.md + v1~v8, v10, backlog
│   │   ├── knowledge-base/   # knowledge-base.md + v0, v0.1
│   │   └── senior/           # my-senior.md + v0~v2
│   ├── ops/                  # ops.md + v1~v6
│   ├── qa/                   # qa_v1~v8, testcase_v1
│   └── ui/                   # ui_v1
├── .github/workflows/        # CI/CD (5 workflows)
├── .claude/agents/           # Sub-agent definitions (4 agents)
├── docker-compose.db.yml     # DB 전용 (항상 실행)
├── docker-compose.yml        # Backend + Frontend (App 전용)
├── .env                      # 환경 변수 (gitignored)
└── CLAUDE.md                 # 이 파일
```

---

## Database Schema

### PostgreSQL 15 + pgvector

| 테이블 | 용도 | 벡터 컬럼 | 보호 |
|--------|------|-----------|------|
| `knowledge_base` | QA 지식 (수동 작성 + PDF 청킹) | embedding (1536 dims) | **삭제 절대 금지** |
| `pdf_upload_job` | PDF 업로드 이력/상태 | 없음 | **삭제 절대 금지** |
| `faq` | 시니어 QA FAQ | embedding (1536 dims) | - |
| `convention` | 용어 컨벤션 | 없음 | - |
| `company` | 회사 (partial unique: is_active=true 1개) | 없음 | - |
| `product` | 제품 (company_id FK) | 없음 | - |
| `segment` | 세그먼트 계층 (self-ref parent_id, Adjacency List) | 없음 | - |
| `test_case` | 테스트 케이스 (path: bigint[], steps: jsonb) | 없음 | - |

### Flyway Migrations

#### 레거시 (V1~V13): 순차 번호
| 버전 | 설명 |
|------|------|
| V1 | Company, Product 생성 |
| V2 | TestCase 생성 |
| V3 | Feature 제거, Segment 추가, TestCase에 product_id/path 이전 |
| V4 | Senior 테이블 (faq, knowledge_base, convention) |
| V5 | knowledge_base에 source 컬럼 추가 |
| V6 | pdf_upload_job 테이블 생성 |
| V7 | 초기 데이터 시드 (my-atlas company, Product Test Suite, 22 TestCases) |
| V8~V13 | test_run, kb 개선, convention 확장, test_case 이미지 등 |

#### 신규 마이그레이션: 타임스탬프 버전 (CRITICAL)

V14부터는 **타임스탬프 기반 버전**을 사용한다. 여러 Worktree/Agent가 동시에 마이그레이션을 생성해도 충돌하지 않는다.

**파일명 형식:**
```
V{YYYYMMDD}{HHmm}__{설명}.sql
```

**예시:**
```
V202604131430__add_convention_image.sql
V202604131545__create_app_user.sql
V202604140900__add_chat_session.sql
```

**규칙:**
- ❌ 순차 번호 (V14, V15, V16...) 절대 사용 금지
- ✅ 현재 날짜+시간을 버전으로 사용 (`YYYYMMDD` + `HHmm`)
- ✅ 같은 날 여러 마이그레이션 → 시간(HHmm)으로 구분
- ✅ `out-of-order: true` 설정 완료 — 순서 무관하게 적용됨
- ✅ 마이그레이션 생성 전 기존 파일과 중복되지 않는지 확인

### Enum Values

- **Platform**: WEB, DESKTOP, MOBILE, ETC
- **Priority**: HIGH, MEDIUM, LOW
- **TestType**: SMOKE, FUNCTIONAL, REGRESSION, E2E
- **TestStatus**: DRAFT, ACTIVE, DEPRECATED
- **PdfJobStatus**: PENDING, PROCESSING, DONE, FAILED

---

## Backend API Endpoints

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### Senior (채팅 + FAQ)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/senior/chat` | SSE 스트리밍 AI 채팅 (body: `{ message, faqContext? }`) |
| GET | `/api/senior/faq` | FAQ 전체 조회 |
| GET | `/api/senior/faq/{id}` | FAQ 단건 조회 |
| POST | `/api/senior/faq` | FAQ 생성 (+ 비동기 임베딩) |
| PUT | `/api/senior/faq/{id}` | FAQ 수정 (+ 비동기 임베딩) |
| DELETE | `/api/senior/faq/{id}` | FAQ 삭제 |

### Knowledge Base

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb` | KB 전체 조회 |
| GET | `/api/kb/{id}` | KB 단건 조회 |
| POST | `/api/kb` | KB 생성 (+ 비동기 임베딩) |
| PUT | `/api/kb/{id}` | KB 수정 |
| DELETE | `/api/kb/{id}` | KB 삭제 |
| POST | `/api/kb/upload-pdf` | PDF 업로드 (multipart: file, bookTitle) → jobId |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 |
| GET | `/api/kb/jobs` | 전체 Job 목록 |
| DELETE | `/api/kb/books/{source}` | 책 단위 전체 청크 + Job 삭제 |

### Convention

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/conventions` | Convention 전체 조회 |
| GET | `/api/conventions/{id}` | 단건 조회 |
| POST | `/api/conventions` | Convention 생성 |
| PUT | `/api/conventions/{id}` | 수정 |
| DELETE | `/api/conventions/{id}` | 삭제 |

### Feature Registry

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/companies` | 회사 목록 |
| POST | `/api/companies` | 회사 생성 |
| PATCH | `/api/companies/{id}/activate` | 회사 활성화 (1개만) |
| DELETE | `/api/companies/{id}` | 회사 삭제 (CASCADE) |
| GET | `/api/products?companyId={id}` | 제품 목록 |
| POST | `/api/products` | 제품 생성 |
| PUT | `/api/products/{id}` | 제품 수정 |
| DELETE | `/api/products/{id}` | 제품 삭제 (CASCADE) |
| GET | `/api/segments?productId={id}` | 세그먼트 조회 |
| POST | `/api/segments` | 세그먼트 생성 |
| PUT | `/api/segments/{id}` | 이름 수정 |
| PATCH | `/api/segments/{id}/parent` | 부모 변경 (DnD, 순환 참조 검증) |
| DELETE | `/api/segments/{id}` | 삭제 (CASCADE) |
| GET | `/api/test-cases?productId={id}` | 테스트 케이스 목록 |
| POST | `/api/test-cases` | 테스트 케이스 생성 |
| PUT | `/api/test-cases/{id}` | 수정 |
| DELETE | `/api/test-cases/{id}` | 삭제 |
| POST | `/api/test-cases/generate-draft` | AI 드래프트 생성 |

---

## AWS Infrastructure (Production)

```
[사용자]
   ├─ Frontend ──→ CloudFront (EVMWQ4ZH85AXV) ──→ S3 (my-atlas-frontend)
   │                d1tr7ozyf0jrsl.cloudfront.net
   └─ API 요청 ──→ EC2 (3.34.154.147:8080)
                    t3.small / Amazon Linux
                    ├── Backend Container (Spring Boot, port 8080)
                    └── PostgreSQL Container (pgvector:pg15, port 5432)
                        └── pgdata volume
```

### AWS Resources

| Resource | Type | ID |
|----------|------|----|
| VPC | Network | vpc-0dd2d80dcf32b9926 |
| Public Subnet | Network | subnet-0a65868480a1cd1f0 (ap-northeast-2a) |
| Internet Gateway | Network | igw-07bc7f096f422f570 |
| Security Group | Network | sg-0c9c6e4934a014ce7 |
| EC2 | Compute | i-0242a794b86668829 (t3.small) |
| Elastic IP | Network | 3.34.154.147 |
| S3 | Storage | my-atlas-frontend |
| CloudFront | CDN | EVMWQ4ZH85AXV |
| Key Pair | Auth | my-atlas-key (~/.ssh/my-atlas-key.pem) |

### 미구성 항목
- ALB/NLB (로드밸런서 없음), 백엔드 HTTPS 미적용 (HTTP 8080 직접 노출)
- Auto Scaling, 커스텀 도메인, Staging 환경 없음

---

## CI/CD Pipelines

| Workflow | Trigger | Status |
|----------|---------|--------|
| `backend-ci.yml` | Push/PR (main, develop) | 정상 (JaCoCo 비활성) |
| `frontend-ci.yml` | Push/PR (main, develop) | 부분 동작 (continue-on-error) |
| `e2e.yml` | Push/PR + manual | 정상 (98개 전부 통과) |
| `deploy-backend.yml` | Push to main (backend/**) | SSH → git pull → docker compose rebuild |
| `deploy-frontend.yml` | Push to main (frontend/**) | npm build → S3 sync → CloudFront invalidation |

### 배포 흐름

```
feature/* → develop (PR) → main (PR)
                                │
                    ┌───────────┼───────────┐
                    ▼                       ▼
            deploy-backend          deploy-frontend
            (SSH → EC2)             (S3 + CloudFront)
```

모든 워크플로우에 Slack 알림 연동 완료 (Block Kit 포맷, 성공/실패 모두 `always()` 조건).

### GitHub Secrets (필요)

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `EC2_HOST`, `EC2_SSH_KEY`, `EC2_USER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SLACK_WEBHOOK_URL`

---

## Test Infrastructure

### Backend (179 tests)
- **Unit Tests**: JUnit 5 + Mockito (Service + Controller 전 도메인)
- **Integration Tests**: Testcontainers (pgvector:pg15) — KB vector search, FAQ vector search, PDF pipeline, Company activation mutex
- **Test DB**: H2 인메모리 (unit), pgvector Docker (integration)
- **실행**: `cd backend && ./gradlew test`

### Frontend (33 tests)
- **Unit Tests**: Vitest + React Testing Library
- **대상**: useSeniorChat hook, FaqCard, ChatView, SeniorPage
- **실행**: `cd frontend && npm test`

### E2E (98 tests)
- **API Tests** (65): company(6), product(10), segment(11), feature(19), kb(7), convention(6), senior-faq(6)
- **UI Tests** (33): company-panel(7), product-panel(4), feature-panel(5), kb(5), senior(12)
- **실행**: `cd qa && npx playwright test`

---

## Worktree Git 생명주기

이 프로젝트의 worktree는 기능 도메인별 **영구 작업 공간**이다 (일회성이 아님).

### 작업 사이클
1. **시작**: `./scripts/wt.sh sync <name>` — develop 최신 상태로 동기화
2. **작업**: 코드 수정, 커밋
3. **PR**: push → PR(→develop) 생성
4. **머지 후**: 반드시 `./scripts/wt.sh sync <name>` 실행 — develop으로 리셋

### 규칙
- ❌ 머지 후 리셋 없이 다음 작업 시작 금지 (유령 커밋 누적)
- ❌ develop에서 3일 이상 뒤처진 상태로 작업 금지
- ✅ 작업 시작 전 반드시 sync
- ✅ Claude 세션 시작 시 자동으로 sync 상태 확인
- ✅ PR 머지 후 즉시 sync

### develop → main
- 기능이 완전히 완료되면 develop → main PR 생성
- main PR은 유저가 직접 판단

### Claude 세션 시작 시 자동 검증

Claude가 worktree에서 세션을 시작할 때:
1. `git fetch origin && git log --oneline origin/develop..HEAD`로 ahead 확인
2. ahead > 0이면 "이 worktree에 미머지 커밋이 있습니다. sync 먼저 할까요?" 안내
3. `git log --oneline HEAD..origin/develop`로 behind 확인
4. behind > 3이면 "develop보다 N커밋 뒤처져 있습니다. sync 권장" 안내

### 상태 확인 명령
```bash
./scripts/wt.sh status              # 전체 worktree 동기화 상태 표시
./scripts/wt.sh sync <name>         # 특정 worktree 동기화
./scripts/wt.sh sync --all          # 전체 worktree 동기화
```

---

## Git Branch Strategy

```
main (production-ready, AWS 배포 대상)
  ↑
  │ PR (require 1+ reviewer)
  │
develop (integration branch, localhost 개발)
  ↑
  ├─ feature/xyz (feature branches, Claude WorkTree로 분리)
  ├─ bugfix/xyz
  └─ hotfix/xyz (emergency fixes to main)
```

**Rules:**
- `main` branch는 **read-only** — direct commit/push 금지
- 모든 작업 → `feature/*` or `bugfix/*` from `develop`
- Hotfix는 `main`에서 분기 → `main` + `develop` 양쪽 머지
- PR은 최소 **1 code review** 필수

---

## Commit Message Format

```
[type] subject

Optional body explaining why and what.
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Examples:**
```
[feat] Add email notification for test case updates
[fix] Resolve null pointer in knowledge base service
[test] Increase service layer test coverage to 75%
```

---

## Pull Request Guidelines

- **Feature/bugfix:** feature/* → develop (PR)
- **Release:** develop → main (PR)
- **Hotfix:** hotfix/* → main (PR) + cherry-pick to develop
- No merge commits — prefer rebase or squash
- ❌ **Claude는 PR merge 절대 금지** — PR 생성까지만 수행하고, merge는 반드시 User가 직접 확인·승인 후 실행한다
- ✅ `gh pr create` → User에게 PR URL 전달 → User가 리뷰 후 merge

---

## Sub-agent Delegation

When working on **backend tasks**, reference `backend/CLAUDE.md`.
When working on **frontend tasks**, reference `frontend/CLAUDE.md`.
When working on **E2E tests**, reference `qa/CLAUDE.md`.

---

## 4-Agent Pipeline for Feature Implementation

**모든 기능 구현 요청**에 대해 아래 4단계를 순서대로 실행한다.
각 Agent는 `.claude/agents/`에 정의되어 있다.

### Agent-A — Code Implementation
**File:** `.claude/agents/code-implementor.md`
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** 요구사항에 따라 코드 구현

### Agent-B — Backend Unit & Integration Tests
**File:** `.claude/agents/unit-test-writer.md`
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** `backend/src/test/java/`에 JUnit 5 / Mockito 테스트 작성

### Agent-C — E2E Tests (Playwright)
**File:** `.claude/agents/e2e-test-writer.md`
**Tools:** Read, Write, Edit, Glob, Grep
**Scope:** `qa/api/`, `qa/ui/`에 Playwright E2E 테스트 작성

**셀렉터 작성 규칙:**
- ❌ 추측으로 HTML 태그(tr, li, table 등)를 사용하지 않는다
- ✅ 테스트 대상 TSX 파일을 반드시 Read하여 실제 DOM 구조(태그, className, data-testid) 확인 후 셀렉터 작성
- ✅ Agent-C에 위임 시 대상 컴포넌트의 JSX 구조를 프롬프트에 포함

### Agent-D — Build & Test Verification
**File:** `.claude/agents/build-verifier.md`
**Tools:** Bash, Read, Glob, Grep (Write/Edit disabled)
**Commands (must all pass in order):**
```bash
# Step 1: Backend build + tests
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build

# Step 2: Start full stack with rebuild (from repo root)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 10

# Step 3: E2E tests
cd /Users/yeongmi/dev/qa/my-atlas/qa && npx playwright test

# Teardown (always, unconditional)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose down
```

**E2E 결과 검증 규칙:**
- ❌ "0 failed"만 확인하고 성공 선언 금지
- ✅ "did not run" 테스트가 있으면 반드시 원인 조사
- ✅ 새로 추가한 테스트는 개별 지정 실행하여 실제 동작 확인 (`npx playwright test ui/specific.spec.ts`)
- ✅ 예상 테스트 수와 실제 실행 수 비교

**Absolute Rules:**
- ❌ **NEVER declare "complete"** without Agent-D passing ALL three steps
- ❌ **NEVER skip** any agent in the pipeline
- ❌ **NEVER skip E2E** — "optional" does not apply
- ❌ **NEVER let Agent-B write E2E tests or Agent-C write unit tests** — exclusive scope
- ✅ **ALWAYS fix** build/test errors before final approval
- ✅ **ALWAYS run `docker compose down`** after Agent-D finishes, regardless of outcome
- ✅ Agent-C/D는 User 승인 없이 자동 진행
- ❌ **NEVER write E2E selectors by guessing** — Agent-C must read the target TSX file first
- ❌ **NEVER ignore "did not run" tests** — Agent-D must investigate and ensure new tests actually executed

---

## 버전 문서화 규칙

### 메인 명세서 (Master)
각 기능의 현재 구현 상태를 정리한 **버전 없는 md 파일**이 메인 명세서이다.
- 경로: `docs/features/{feature-name}/{feature-name}.md`
- 예시: `knowledge-base.md`, `feature-registry.md`, `my-senior.md`
- 기능의 전체 구조(스키마, API, 파일구조, 핵심기능, 테스트)를 한눈에 파악 가능
- 메인 명세서 하단에 **버전 히스토리 타임라인 테이블**을 유지한다

### 버전 문서
변경 시 반드시 버전 문서를 작성한다.

### 문서 경로 (유형별 분리)

| 변경 유형 | 경로 | 파일명 패턴 |
|-----------|------|-------------|
| 버그 수정 / 기능 추가 / 기능 개선 | `docs/features/{feature-name}/` | `{feature-name}_v{버전}.md` |
| 환경 개선 | `docs/ops/` | `v{버전}.md` |
| 테스트 전략 | `docs/qa/` | `qa_v{버전}.md` |

### 버전 문서 Header 양식

모든 버전 문서의 상단에 아래 형식의 Header를 반드시 포함한다:

```
> 변경 유형: {기능 추가 | 기능 개선 | 버그 수정 | 환경 개선 | 테스트 보강}  
> 작성일: {YYYY-MM-DD}  
> 버전: {v1 | v0.1 | ...}  
> 상태: {진행 중 | 완료}

---
```

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
| 테스트 보강 | 테스트 커버리지 확대 |

### 워크플로우
1. Plan 수립
2. 코드 개발
3. 버전 md 작성 (Header 포함)
4. 메인 명세서 버전 히스토리 업데이트

### Worktree 환경에서의 파일 작성 규칙

Worktree에서 작업할 때, **공용 파일**의 읽기/쓰기는 반드시 **메인 레포 경로**를 우선 사용한다.

**메인 레포 경로:** `/Users/yeongmi/dev/qa/my-atlas/`

#### 양쪽 작성 대상 (공용 파일)

| 경로 | 이유 |
|------|------|
| `docs/**` | 유저가 Cursor IDE(develop)에서 문서를 확인 |
| `scripts/**` | 유저가 메인 레포에서 즉시 실행 가능해야 함 |
| `CLAUDE.md` | 모든 worktree Claude가 동일 규칙을 공유해야 함 |
| `.claude/agents/**` | Sub-agent 정의가 모든 worktree에서 동일해야 함 |

#### 읽기
- 위 경로의 파일을 읽을 때는 메인 레포 절대경로를 사용한다
- 예: `/Users/yeongmi/dev/qa/my-atlas/docs/ops/v11.md`
- 유저가 develop 브랜치에서 작성한 요구사항을 확인할 수 있다

#### 쓰기 (2곳에 작성)
1. **메인 레포 절대경로**에 먼저 작성 (유저가 즉시 확인/사용 가능)
2. **자기 worktree**에도 동일 파일 작성 (PR 커밋용)

예시 (ops-env worktree에서 작업 시):
```
# docs
1. /Users/yeongmi/dev/qa/my-atlas/docs/ops/v11.md  ← 메인 레포 (유저 확인용)
2. docs/ops/v11.md                                   ← worktree (git 커밋용)

# scripts
1. /Users/yeongmi/dev/qa/my-atlas/scripts/wt.sh     ← 메인 레포 (유저 실행용)
2. scripts/wt.sh                                      ← worktree (git 커밋용)
```

#### 양쪽 작성 불필요 (worktree 전용)

| 경로 | 이유 |
|------|------|
| `backend/src/**` | 소스 코드는 feature 브랜치에서만 변경, PR 머지로 반영 |
| `frontend/src/**` | 동일 |
| `qa/**` | 동일 |
| `.env` | 환경별 다름 |
| `docker-compose.yml` | worktree별 포트/컨테이너 이름이 다름 |
| `docker-compose.override.yml` | worktree 전용 설정 |

**예외:** `docker-compose.db.yml`은 공용 파일 — DB 설정은 모든 환경에서 동일하므로 양쪽 작성

#### 규칙
- ❌ worktree에만 작성하지 않는다 (유저가 못 봄/못 씀)
- ❌ 메인 레포에만 작성하지 않는다 (PR에 포함 안됨)
- ✅ 공용 파일은 반드시 양쪽 모두에 작성한다
- ✅ 소스 코드(`src/**`)는 worktree에만 작성한다

---

## 문서 기반 구현 워크플로우 (Doc-Driven Development)

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

## Session Summary (Slack 알림)

세션이 종료되면 Stop hook이 `.claude/session-summary.txt`를 읽어 Slack에 전송한다.
Claude는 **세션 중 의미 있는 작업을 마칠 때마다** 이 파일을 갱신해야 한다.

```bash
# .claude/session-summary.txt 예시
CI/CD 파이프라인 통합
- e2e.yml에 배포 job 추가 (deploy-gate 이후)
- deploy-backend.yml, deploy-frontend.yml 삭제
- Slack 알림 5개→1개 정리

Claude Slack Hook 개선
- scripts/claude-slack-notify.sh 생성
- .claude/settings.json 변경
```

**규칙:**
- 파일 경로: `.claude/session-summary.txt` (프로젝트 루트 기준)
- 내용: 이번 세션에서 수행한 작업 요약 (한글, 간결하게)
- 작업이 진행될수록 **덮어쓰기**로 최신 상태 유지
- Stop hook이 파일을 읽은 후 자동 삭제함

---

## Critical Rules

### 데이터베이스 삭제 금지 (CRITICAL)

#### knowledge_base 테이블 — 절대 삭제 금지
이 테이블에는 실제 PDF 도서를 청킹·임베딩하여 저장한 운영 데이터가 포함되어 있다.
재생성 시 OpenAI Embedding API 호출 비용과 수 분~수십 분의 처리 시간이 발생한다.

**Claude Code는 다음 명령을 절대로 실행해서는 안 된다:**
- ❌ `DELETE FROM knowledge_base` (어떤 WHERE 조건이든)
- ❌ `TRUNCATE knowledge_base`
- ❌ `DROP TABLE knowledge_base`
- ❌ `docker compose down -v` (DB 볼륨 삭제로 전체 데이터 소실)
- ❌ knowledge_base 행을 삭제하는 어떤 코드/쿼리 실행

특정 데이터 삭제가 필요한 경우, 사용자에게 직접 실행하도록 안내만 할 것.

#### pdf_upload_job 테이블 — 절대 삭제 금지
- ❌ `DELETE FROM pdf_upload_job`, `TRUNCATE`, `DROP TABLE` 금지

#### 일반 규칙
- 스키마 변경 없는 작업에서 DB 데이터 삭제 금지 — 기존 데이터 항상 보존
- E2E 테스트에서 seed 데이터 (my-atlas company 등) 삭제 금지

### OpenAI API 비용 보호
- 불필요한 임베딩 API 호출 금지
- 실패 시 성공분 보존 (이미 생성된 임베딩 재생성 금지)
- 중복 임베딩 생성 금지

### Git 안전 규칙
- ❌ `main` 또는 `develop`에 Direct push 금지
- ❌ Force push 금지
- ❌ Sensitive data commit 금지 (API keys → `.env`)
- ❌ Pre-commit hooks skip 금지
- ❌ Review 없이 merge 금지
- ✅ 로컬 테스트 통과 후 push
- ✅ feature branch 생성 전 latest develop pull

### Frontend 레이아웃 규칙
- 모든 Frontend 개발 시 **드릴다운 방식** 사용
- 다중 패널 나란히 표시 금지 — 한 번에 하나의 뷰가 전체 콘텐츠 영역을 차지

### 테스트 전용 유틸리티 금지
- 테스트 전용 유틸리티 클래스 작성 금지
- 테스트 리소스는 실제 파일로 `src/test/resources/`에 배치

---

## Spring Configuration Summary

### application.yml (주요 설정)

| 항목 | 설정값 |
|------|--------|
| Hibernate ddl-auto | validate (Flyway가 스키마 관리) |
| Flyway | enabled, classpath:db/migration |
| AI 모델 | claude-3-5-sonnet-20241022 (Spring AI Anthropic) |
| 임베딩 모델 | text-embedding-3-small (OpenAI, 1536 dims) |
| pgvector | COSINE_DISTANCE |
| Multipart | max 500MB (PDF 업로드 대응) |
| Actuator | health, info 노출 |
| 로깅 | Console + File (./logs/backend_{session}.log) |

### Test 환경 (`test/resources/application.yml`)
- H2 인메모리 DB, Flyway 비활성, 더미 API 키

---

## Environment Configuration

### Local Development (`.env`)
```bash
POSTGRES_DB=myqaweb
POSTGRES_USER=myqaweb
POSTGRES_PASSWORD=<password>

SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb
SPRING_DATASOURCE_USERNAME=myqaweb
SPRING_DATASOURCE_PASSWORD=<password>

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
VITE_API_BASE_URL=http://localhost:8080
```

### Feature Toggle
- `FEATURE_EMBEDDING_ENABLED=false` (application.yml, default: false) — 임베딩 기능 토글

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 21 (backend local dev)
- Node.js 20+ (frontend local dev)

### Run Everything
```bash
# 1. DB 띄우기 (최초 1회 또는 재부팅 후)
docker compose -f docker-compose.db.yml up -d
# Postgres: localhost:5432

# 2. App 띄우기
docker compose up -d
# Backend:  http://localhost:8080
# Frontend: http://localhost:5173
```

### Docker 운영 규칙
- DB는 `docker-compose.db.yml`로 독립 실행 — `docker compose down` 해도 DB는 유지됨
- App(backend + frontend)은 `docker-compose.yml`로 자유롭게 올림/내림
- Worktree에서는 메인 DB가 떠있는 상태에서 `docker compose up -d` 실행
- **시작 순서**: DB(`docker-compose.db.yml`) → 메인 App → Worktree App
- **종료 순서**: Worktree App → 메인 App → DB(드물게)
- `docker compose -f docker-compose.db.yml down -v` **절대 금지** (볼륨 삭제 방지)

### Backend Only
```bash
cd backend && ./gradlew bootRun
```

### Frontend Only
```bash
cd frontend && npm install && npm run dev
```

---

## Further Reading

- **Backend details** → `backend/CLAUDE.md`
- **Frontend details** → `frontend/CLAUDE.md`
- **E2E test details** → `qa/CLAUDE.md`
- **Ops 현황 종합** → `docs/ops/ops.md`
- **Feature Registry 명세** → `docs/features/feature-registry/feature-registry.md`
- **Knowledge Base 명세** → `docs/features/knowledge-base/knowledge-base.md`
- **My Senior 명세** → `docs/features/senior/my-senior.md`
- **테스트 전략** → `docs/qa/qa_v1.md` (종합 플랜)
- **Docker DB setup** → `docker-compose.db.yml`
- **Docker App setup** → `docker-compose.yml`
- **Spring AI config** → `backend/src/main/resources/application.yml`
