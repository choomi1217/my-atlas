# Notion 문서 vs 실제 코드 Gap Analysis

- **분석일**: 2026-03-23
- **기준 문서**: `docs/notion/overview.md`, `docs/notion/architecture.md`
- **비교 대상**: 실제 프로젝트 코드 (develop 브랜치)

---

## 1. overview.md 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| 프로젝트 목표 | 어떤 회사를 가서도 사용할 수 있는 나만의 QA 웹 | — | 확인 불가 (비즈니스 방향) |
| ~~기능 1: Ticket Reviewer~~ | ~~기능 목록에 포함~~ | ~~삭제됨 (2026-03-23)~~ | ~~삭제~~ |
| 기능 2: Senior (중요도: 최상) | 기능 목록에 포함 | 백엔드: `SeniorController` (`POST /api/senior/chat`), 프론트엔드: `SeniorPage` "Coming soon" | 노션에만 존재 (백엔드 엔드포인트는 있으나 프론트엔드 미구현) |
| 기능 3: Knowledge Base (중요도: 하) | 기능 목록에 포함 | 백엔드: `KnowledgeBaseController` (`GET /api/kb`), 프론트엔드: `KnowledgeBasePage` "Coming soon" | 노션에만 존재 (백엔드 엔드포인트는 있으나 프론트엔드 미구현) |
| 기능 4: Words Conventions (중요도: 중상) | 기능 목록에 포함 | 백엔드: `ConventionController` (`GET /api/conventions`), 프론트엔드: `ConventionsPage` "Coming soon" | 노션에만 존재 (백엔드 엔드포인트는 있으나 프론트엔드 미구현) |
| 기능 5: Company Features (중요도: 최상) | 기능 목록에 포함 | 백엔드: Company/Product/Segment/TestCase 풀 CRUD, 프론트엔드: 드릴다운 UI 완성 | 일치 (유일하게 완전 구현됨) |
| 포트폴리오 집중 기능 | 개발→Playwright→CI/CD→배포, PM으로 Claude 자동화, QA로 AI 업무 효율 | CI/CD 파이프라인 3개 존재, E2E Playwright 테스트 존재, 배포는 미완성 (deploy-gate placeholder) | 불일치 — 배포(AWS) 미완성 |

---

## 2. architecture.md — 핵심 기능 목록 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| 핵심 기능 수 | 4개 (Senior, KB, Conventions, Product Test Suite) | 4개 도메인 패키지 존재 (senior, knowledgebase, convention, feature) | 일치 (ticket 삭제 후 동기화됨) |
| My Senior (최우선) | AI 기반 QA 시니어 챗봇 | `SeniorController` + `SeniorService` + `SeniorRepository` 존재 | 일치 (구조 존재) |
| Knowledge Base | 지식 저장소 | `KnowledgeBaseController` + Service + Repository 존재 | 일치 (구조 존재) |
| Words Conventions | 팀 용어 컨벤션 DB | `ConventionController` + Service + Repository 존재 | 일치 (구조 존재) |
| Product Test Suite (최우선) | Test Case | Company → Product → TestCase 계층 + **Segment 계층 추가** | 불일치 — 노션에 Segment 계층 미기재. 실제 코드는 Company → Product → Segment → TestCase 4단계 |
| ~~Ticket Reviewer~~ | ~~overview.md에 있었음~~ | ~~삭제됨 (2026-03-23)~~ | ~~삭제~~ |

---

## 3. architecture.md — 기술 스택 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| Frontend | React 18 + Vite + TypeScript | React 18.3.1 + Vite 5.3.1 + TypeScript 5.4.5 | 일치 |
| Backend | Spring Boot 3.x (Java 21) + Spring AI | Spring Boot 3.3.1, Java 21, Spring AI 1.0.0-M1 | 일치 |
| DB | PostgreSQL 15 + pgvector 확장 | PostgreSQL 15 (pgvector/pgvector:pg15 이미지) + pgvector 0.1.4 | 일치 |
| 인프라 | Docker Compose (로컬), AWS (추후 배포) | Docker Compose 구성 완료, AWS deploy-gate는 placeholder만 존재 | 불일치 — AWS 배포 미구현 (CI/CD에 stub만 있음) |
| 빌드 | Gradle | Gradle 사용 확인 (`build.gradle` 존재) | 일치 |
| OpenAI Embedding | 미기재 | `spring-ai-openai-spring-boot-starter` 의존성, `text-embedding-3-small` 모델 사용 | 코드에만 존재 — 노션에 OpenAI 의존성 미기재 |
| Zustand | 미기재 | `zustand@4.5.7` 설치됨 (실제 사용은 Context API) | 코드에만 존재 |

---

## 4. architecture.md — 디렉토리 구조 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| docs 하위 구조 | `feature-registry/`, `my-senior/`, `knowlege-base/`, `word-conventions/` 4개 폴더 | `feature-registry/` 1개만 존재 | 불일치 — my-senior/, knowlege-base/, word-conventions/ 폴더 미생성 |
| 모노레포 구조 | `frontend/`, `backend/`, `docker-compose.yml`, `README.md` | 모두 존재 | 일치 |

---

## 5. architecture.md — docker-compose 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| PostgreSQL 이미지 | postgres:15 | `pgvector/pgvector:pg15` | 불일치 — 실제는 pgvector 내장 이미지 사용 |
| pgvector 활성화 | init.sql 포함 | init.sql 없음. Docker 이미지에 pgvector 내장 + Flyway V1에서 `CREATE EXTENSION IF NOT EXISTS vector` 실행 | 불일치 — init.sql 방식이 아닌 이미지 + Flyway 방식 |
| 포트 - PostgreSQL | 5432 | 5432:5432 | 일치 |
| 포트 - Backend | 8080 | 8080:8080 | 일치 |
| 포트 - Frontend | 5173 | 5173:5173 | 일치 |

---

## 6. architecture.md — 백엔드 초기 세팅 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| Spring Boot 3.x, Java 21, Gradle | 명시됨 | Spring Boot 3.3.1, Java 21, Gradle | 일치 |
| 의존성: Spring Web | 명시됨 | `spring-boot-starter-web` | 일치 |
| 의존성: Spring Data JPA | 명시됨 | `spring-boot-starter-data-jpa` | 일치 |
| 의존성: Spring AI (anthropic) | 명시됨 | `spring-ai-anthropic-spring-boot-starter` | 일치 |
| 의존성: PostgreSQL Driver | 명시됨 | `postgresql` | 일치 |
| 의존성: Flyway | 명시됨 | `flyway-core` + `flyway-database-postgresql` | 일치 |
| 의존성: Lombok | 명시됨 | `projectlombok:lombok` | 일치 |
| 의존성: Spring AI (OpenAI) | 미기재 | `spring-ai-openai-spring-boot-starter` | 코드에만 존재 |
| 의존성: Validation | 미기재 | `spring-boot-starter-validation` | 코드에만 존재 |
| 의존성: Actuator | 미기재 | `spring-boot-starter-actuator` | 코드에만 존재 |
| 의존성: H2 (테스트) | 미기재 | `h2:1.4.200` (testImplementation) | 코드에만 존재 |
| 환경변수: SPRING_DATASOURCE_URL | 명시됨 | `application.yml`에서 사용 | 일치 |
| 환경변수: ANTHROPIC_API_KEY | 명시됨 | `application.yml`에서 사용 | 일치 |
| 환경변수: OPENAI_API_KEY | 미기재 | `application.yml`에서 사용 | 코드에만 존재 |
| 패키지: senior/ | 명시됨 | 존재 | 일치 |
| 패키지: knowledgebase/ | 명시됨 | 존재 | 일치 |
| 패키지: convention/ | 명시됨 | 존재 | 일치 |
| 패키지: feature/ | 명시됨 | 존재 (내부 구조 대폭 변경: Segment 추가, Feature 제거) | 불일치 — 패키지명은 동일하나 내부에 Feature 대신 Segment 도메인 |
| ~~패키지: ticket/~~ | ~~명시됨~~ | ~~삭제됨 (2026-03-23)~~ | ~~삭제~~ |
| 패키지: common/ | 명시됨 | 존재 | 일치 |
| 패키지: config/ | 미기재 | `AiConfig.java`, `WebConfig.java` 존재 | 코드에만 존재 |

---

## 7. architecture.md — 프론트엔드 초기 세팅 비교

| 항목 | 노션 내용 | 실제 코드 | 상태 |
|------|-----------|-----------|------|
| React 18 + Vite + TypeScript | 명시됨 | React 18.3.1, Vite 5.3.1, TS 5.4.5 | 일치 |
| 의존성: react-router-dom | 명시됨 | v6.23.1 | 일치 |
| 의존성: axios | 명시됨 | v1.6.8 | 일치 |
| 의존성: tailwindcss | 명시됨 | v3.4.4 | 일치 |
| 라우트: /senior → My Senior (Chat) | 명시됨 | `/senior` → `SeniorPage` | 일치 |
| 라우트: /kb → Knowledge Base | 명시됨 | `/kb` → `KnowledgeBasePage` | 일치 |
| 라우트: /conventions → Words Conventions | 명시됨 | `/conventions` → `ConventionsPage` | 일치 |
| 라우트: /features → Product Test Suite | 명시됨 | `/features` → `CompanyListPage` (드릴다운 진입점) | 일치 |
| ~~라우트: /ticket~~ | ~~명시됨~~ | ~~삭제됨 (2026-03-23)~~ | ~~삭제~~ |
| 라우트: / (루트) | 미기재 | 루트 `/` 라우트 미정의 (redirect 없음) | 코드에만 존재 (미비 사항) |
| 하위 라우트: /features/companies/:companyId | 미기재 | `ProductListPage` | 코드에만 존재 |
| 하위 라우트: /features/companies/:companyId/products/:productId | 미기재 | `TestCasePage` | 코드에만 존재 |
| 컴포넌트: SegmentTreeView | 미기재 | `frontend/src/components/features/SegmentTreeView.tsx` | 코드에만 존재 |
| 컴포넌트: CascadingPathInput | 미기재 | `frontend/src/components/features/CascadingPathInput.tsx` | 코드에만 존재 |
| 컴포넌트: PathViewToggle | 미기재 | `frontend/src/components/features/PathViewToggle.tsx` | 코드에만 존재 |

---

## 8. 요약

### 주요 불일치 사항
1. **Segment 계층 미반영** — 코드는 Company → Product → Segment → TestCase 4단계이나, 노션은 Segment 없이 기술
2. ~~**노션 문서 간 불일치** — Ticket Reviewer 관련 (삭제로 해소됨)~~
3. **docker-compose 이미지** — 노션은 `postgres:15` + init.sql, 실제는 `pgvector/pgvector:pg15`
4. **AWS 배포** — 노션은 "추후 배포" 명시, 실제 CI/CD에 stub만 있음

### 코드에만 존재하는 주요 항목
1. OpenAI embedding 의존성 및 환경변수 (`OPENAI_API_KEY`)
2. `config/` 패키지 (`AiConfig`, `WebConfig`)
3. Segment 도메인 전체 (Controller, Entity, Dto, Repository, Service, ServiceImpl)
4. 프론트엔드 드릴다운 하위 라우트 및 관련 컴포넌트
5. `spring-boot-starter-validation`, `spring-boot-starter-actuator`, H2 테스트 DB

### 노션에만 존재하는 항목
1. `docs/features/` 하위 폴더 3개 (`my-senior/`, `knowlege-base/`, `word-conventions/`)
2. `init.sql` 파일 (pgvector 활성화용)
