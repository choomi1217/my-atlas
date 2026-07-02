# my-atlas: Claude Code Project Context

## Project Overview

**my-atlas**는 Spring Boot + React 기반 QA 지식 관리 애플리케이션이다.
Claude AI와 OpenAI 임베딩을 활용하여 QA 전문가의 테스트 컨벤션, 기능 문서, 지식 베이스를 관리한다.

> 기능 개요·기술 스택·아키텍처는 [README.md](./README.md)가 소유. 파일 구조는 레포 트리를, 스키마·API는 각 기능 명세서(`docs/features/**`)와 코드를 참조한다. **CLAUDE.md에는 사실(구조·스키마·API·인프라 현황)을 중복 기재하지 않는다 — 규칙·워크플로만 둔다.**

---

## Database Schema

### 보호 대상 (CRITICAL — 아래 [Critical Rules]와 연동)

| 테이블 | 용도 | 보호 |
|--------|------|------|
| `knowledge_base` | QA 지식 (수동 작성 + PDF 청킹, embedding 1536 dims) | **삭제 절대 금지** |
| `pdf_upload_job` | PDF 업로드 이력/상태 | **삭제 절대 금지** |

> 전체 테이블·컬럼 스키마는 Flyway 마이그레이션(`backend/src/main/resources/db/migration/`)과 각 기능 명세서가 소유한다.

### 신규 마이그레이션: 타임스탬프 버전 (CRITICAL)

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

---

## Test Infrastructure

> 테스트 수·도메인별 내역은 시간에 따라 변하므로 여기 하드코딩하지 않는다. 최신 수치는 각 CI(JaCoCo 리포트, Playwright 결과)와 `docs/ops/ops.md`가 소유한다.

### Backend
- **Unit**: JUnit 5 + Mockito (Service + Controller 전 도메인) — `cd backend && ./gradlew test`
- **Integration**: Testcontainers (pgvector) — KB/FAQ vector search, PDF pipeline, Company activation mutex

### Frontend
- **Unit**: Vitest + React Testing Library — `cd frontend && npm test`

### E2E
- **Playwright** (API + UI, Chromium) — `cd qa && npx playwright test`

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

### 변경 유형 태그

| 태그 | 설명 |
|------|------|
| 버그 수정 | 기존 기능의 오류 수정 |
| 기능 추가 | 새로운 기능 개발 |
| 기능 개선 | 기존 기능의 UX/성능 개선 |
| 환경 개선 | 설정, 인프라, 빌드 환경 변경 |
| 테스트 보강 | 테스트 커버리지 확대 |

### 워크플로우
1. Plan 수립 (버전 md 파일을 통해 유저의 컨펌)
2. 코드 개발 (유저 컨펌 후, 코드 개발 시작)
3. 버전 md 재작성 (Header 포함)
  - 버전 히스토리 업데이트
  - 테스트 결과 작성

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
| Hibernate ddl-auto | **none** — Flyway가 schema 단독 소유, Hibernate는 ORM만 담당 (다중 worktree 공유 DB 환경에서 entity drift로 인한 boot 실패 방지) |
| Flyway | enabled, classpath:db/migration |
| AI 모델 | Spring AI (Anthropic) — 모델명은 application.yml 참조 |
| 임베딩 모델 | text-embedding-3-small (OpenAI, 1536 dims) |
| pgvector | COSINE_DISTANCE |
| Multipart | max 500MB (PDF 업로드 대응) |
| Actuator | health, info 노출 |
| 로깅 | Console + File (./logs/backend_{session}.log) |

- `FEATURE_EMBEDDING_ENABLED` (application.yml, default: false) — 임베딩 기능 토글
- Test 환경(`test/resources/application.yml`): H2 인메모리 DB, Flyway 비활성, 더미 API 키
- 로컬 `.env`(gitignored) 예시는 [README.md](./README.md) Quick Start 참조.

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

- **프로젝트 개요·기술 스택·아키텍처** → [README.md](./README.md)
- **Backend details** → `backend/CLAUDE.md`
- **Frontend details** → `frontend/CLAUDE.md`
- **E2E test details** → `qa/CLAUDE.md`
- **Ops 현황 종합 (인프라·AWS·CI/CD)** → `docs/ops/ops.md`
- **Feature Registry 명세** → `docs/features/feature-registry/feature-registry.md`
- **Knowledge Base 명세** → `docs/features/knowledge-base/knowledge-base.md`
- **My Senior 명세** → `docs/features/senior/my-senior.md`
- **테스트 전략** → `docs/qa/qa_v1.md` (종합 플랜)
- **Spring AI config** → `backend/src/main/resources/application.yml`

### PR ↔ Notion 연동 규칙
- 모든 PR 생성 시 본문에 `Notion: <이 작업의 Notion 항목 URL>`을 반드시 포함한다.
- 이 링크가 있어야 머지 시 해당 항목이 자동 Done + 완료일 처리된다 (notion-sync.yml).
- 사용자가 URL을 안 주면, PR 만들기 전에 "이 작업의 Notion 항목 URL을 알려달라"고 먼저 물어본다.
- notion.so / app.notion.com 형식 모두 허용.
