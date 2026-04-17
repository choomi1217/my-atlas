# my-atlas

> AI 기반 QA(Quality Assurance) 지식 관리 플랫폼

QA 엔지니어의 업무 효율을 높이기 위한 풀스택 웹 애플리케이션입니다.
RAG 기반 AI 챗봇, PDF 자동 파싱·임베딩 파이프라인, 테스트 케이스 관리, 용어 표준화 기능을 제공합니다.

---

## 핵심 기능

### My Senior — AI 시니어 QA 챗봇
- **RAG(Retrieval-Augmented Generation)** 파이프라인으로 팀 맥락에 맞는 답변 생성
- **SSE(Server-Sent Events)** 스트리밍으로 실시간 응답 전달
- KB 기반 큐레이션 FAQ (Pin 15건 + 조회수 Top 5건, 최대 20건)
- FAQ → Chat 컨텍스트 자동 전달 + 채팅 세션 영구 저장
- RAG 우선순위: FAQ Context > KB 수동 작성 Top 3 > KB PDF Top 2
- Chat에서 유용한 AI 답변을 "KB에 저장" → 지식 선순환

### Knowledge Base — QA 지식 관리
- Markdown WYSIWYG 에디터로 지식 수동 작성 + 이미지 첨부
- **PDF 업로드 → 텍스트 추출 → 클리닝 → 챕터 파싱 → 청킹 → 벡터 임베딩** 자동 파이프라인
- 비동기 임베딩 생성 + Job 상태 추적 (PENDING → PROCESSING → DONE/FAILED)
- pgvector 코사인 유사도 검색 (1536차원 벡터)
- 소스별 필터 탭 (수동 작성 vs PDF 청크) + 카테고리 관리 + 검색/정렬
- KB Pin + Hit Count 기반 FAQ 큐레이션 + PDF 소프트 삭제

### Feature Registry — QA 테스트 관리 플랫폼
- **Company → Product → TestCase** 3단계 드릴다운 구조
- Segment 트리 (Adjacency List, DnD 재배치, 순환 참조 검증)
- AI 기반 테스트 케이스 드래프트 자동 생성 + 이미지 첨부
- **Version → Phase → TestResult** 테스트 실행·이력 관리
- **Jira 연동** (FAIL 시 자동 티켓 생성 + 상태 동기화)
- Release Readiness Go/No-Go 판단 + Daily Snapshot + Trend 차트

### Word Conventions — 용어 표준화
- 팀 내 QA 용어 통일을 위한 CRUD + 이미지 첨부
- 카드 UI (검색, 정렬, 그리드)

### Platform — 인증/보안/공통 UX
- JWT 기반 로그인 (HMAC-SHA256, 24h 만료) + ProtectedRoute
- Spring Security + Role 기반 접근 제어 (ADMIN: 전체 CRUD / USER: 읽기 전용)
- Resume 페이지 (경력기술서/자기소개서)

---

## 기술 스택

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Java | 21 | 언어 |
| Spring Boot | 3.3.1 | 웹 프레임워크 |
| Spring AI | 1.0.0-M1 | Claude API + OpenAI 임베딩 통합 |
| PostgreSQL | 15 + pgvector | RDB + 벡터 검색 |
| Flyway | - | DB 마이그레이션 (V1~V17 순차 + 타임스탬프) |
| PDFBox | 3.0.1 | PDF 텍스트 추출 |
| JWT (jjwt) | 0.12.6 | 인증 토큰 |
| Testcontainers | - | 통합 테스트 (pgvector Docker) |

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 18.3.1 | UI 프레임워크 |
| TypeScript | 5.4.5 | 타입 안전성 |
| Vite | 5.3.1 | 빌드 도구 + HMR |
| Tailwind CSS | 3.4.4 | 유틸리티 기반 스타일링 |
| Zustand | 4.5.7 | 전역 상태 관리 |
| React Router | 6.23.1 | SPA 라우팅 |
| React Markdown | 10.1.0 | 마크다운 렌더링 |

### Infra & DevOps
| 기술 | 용도 |
|------|------|
| AWS EC2 (t3.small) | 백엔드 + DB 호스팅 |
| AWS S3 + CloudFront | 프론트엔드 정적 배포 + CDN |
| Docker Compose | 로컬/운영 컨테이너 오케스트레이션 |
| GitHub Actions | CI/CD 파이프라인 (3 workflows) |
| Playwright | E2E 테스트 자동화 |
| Slack Webhook | 파이프라인 알림 |

---

## 아키텍처

### 시스템 구성

```
[사용자]
   │
   ├─ Frontend ──→ Route 53 (youngmi.works)
   │                ──→ CloudFront (CDN + HTTPS)
   │                      ├── /* ──→ S3 (my-atlas-frontend)
   │                      └── /images/* ──→ S3 (my-atlas-images, OAC)
   │
   └─ API 요청 ──→ Route 53 (api.youngmi.works)
                    ──→ ALB (HTTPS:443 + HTTP→HTTPS 리다이렉트)
                         ──→ EC2 (t3.small)
                              ├── Spring Boot Container (port 8080)
                              │    ├── REST API (Feature, KB, Senior, Convention, Auth, Statistics)
                              │    ├── SSE Streaming (AI Chat)
                              │    ├── Spring AI (Claude + OpenAI Embedding)
                              │    └── S3 Image Upload (my-atlas-images)
                              │
                              └── PostgreSQL + pgvector Container (port 5432)
                                   ├── 관계형 데이터 (15+ 테이블)
                                   └── 벡터 인덱스 (Knowledge Base 임베딩)
```

### RAG 파이프라인

```
[사용자 질문] + (optional) faqContext
     │
     ▼
 쿼리 임베딩 생성 (OpenAI text-embedding-3-small)
     │
     ▼
 pgvector 코사인 유사도 검색 (2단계)
     │  ┌─ [0순위] FAQ Context (사용자가 선택한 FAQ, 있을 때만)
     │  ├─ [1순위] KB 수동 작성 Top 3 (팀 고유 지식, 우선)
     │  └─ [2순위] KB PDF 청크 Top 2 (도서 참고, 보충)
     │
     ▼
 조회된 KB의 hit_count +1 증가 (FAQ 큐레이션 자동 반영)
     │
     ▼
 컨텍스트 조합 → Claude API 프롬프트 생성
     │
     ▼
 SSE 스트리밍 응답 → Markdown 렌더링 → 세션 DB 저장
```

### PDF 업로드 파이프라인

```
[PDF 파일 업로드]
     │
     ▼
 Job 생성 (PENDING) → 비동기 처리 시작
     │
     ▼
 PDFBox 텍스트 추출 → 챕터 파싱 → 청크 분할
     │
     ▼
 각 청크별 OpenAI 임베딩 생성 (1536차원)
     │
     ▼
 knowledge_base 테이블 저장 (source = 도서명)
     │
     ▼
 Job 상태 업데이트 (DONE / FAILED)
```

---

## 프로젝트 구조

```
my-atlas/
├── backend/                     # Spring Boot REST API
│   ├── src/main/java/com/myqaweb/
│   │   ├── senior/              # AI Chat (SSE) + KB 큐레이션 FAQ + RAG + 세션
│   │   ├── knowledgebase/       # KB CRUD + PDF 파이프라인 + Pin/Unpin
│   │   ├── convention/          # 용어 컨벤션 CRUD + 이미지
│   │   ├── feature/             # Company, Product, Segment, TestCase, Version, Phase, TestResult, Ticket
│   │   ├── statistics/          # DailyTestSnapshot, Release Readiness, Trend
│   │   ├── auth/                # JWT 인증 + Spring Security
│   │   └── common/              # EmbeddingService, VectorType, GlobalExceptionHandler
│   ├── src/test/java/           # Unit + Integration Tests (43 files)
│   └── src/main/resources/
│       └── db/migration/        # Flyway V1~V17 (순차) + 타임스탬프
│
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── pages/               # 라우트별 페이지 컴포넌트
│   │   ├── components/          # 도메인별 UI 컴포넌트
│   │   ├── hooks/               # Custom Hooks (useSeniorChat, useCuratedFaq, useChatSessions, ...)
│   │   ├── api/                 # Axios 기반 API 클라이언트
│   │   ├── context/             # AuthContext, ActiveCompanyContext
│   │   └── stores/              # Zustand 전역 스토어
│   └── vitest.config.ts
│
├── qa/                          # Playwright E2E Tests
│   ├── api/                     # API 테스트 (7개 도메인)
│   ├── ui/                      # UI 테스트 (Chromium)
│   ├── helpers/                 # 테스트 유틸리티
│   └── pages/                   # Page Object Model
│
├── docs/                        # Doc-Driven Development
│   ├── features/                # 기능별 명세서 + 버전 히스토리
│   │   ├── registry/            # Feature Registry (v1~v17)
│   │   ├── knowledge-base/      # Knowledge Base (v0~v6)
│   │   ├── senior/              # My Senior (v0~v6.1)
│   │   ├── words-convention/    # Words Convention (v1~v2)
│   │   └── platform/            # Platform (v1~v7)
│   ├── ops/                     # 인프라·환경 문서 (v1~v21)
│   └── qa/                      # 테스트 전략 문서
│
├── .github/workflows/           # CI/CD 파이프라인 (3 workflows)
├── docker-compose.db.yml        # DB 전용 (독립 라이프사이클)
├── docker-compose.yml           # Backend + Frontend (App)
└── .env                         # 환경 변수 (gitignored)
```

---

## 테스트 전략

### 3-Layer 테스트 피라미드

| 레이어 | 도구 | 테스트 파일 | 대상 |
|--------|------|-------------|------|
| Unit | JUnit 5 + Mockito | 43개 | Service, Controller 전 도메인 |
| Integration | Testcontainers (pgvector) | 포함 | 벡터 검색, PDF 파이프라인, Company activation |
| E2E | Playwright | 27 spec | API 16 + UI 11 (Chromium) |
| Frontend Unit | Vitest + Testing Library | 22개 | Hooks, Components, Pages |

### E2E 테스트 커버리지

| 도메인 | API | UI |
|--------|-----|-----|
| Company | ✅ | ✅ |
| Product | ✅ | ✅ |
| Segment | ✅ | ✅ (DnD) |
| Feature (TestCase) | ✅ | ✅ |
| Knowledge Base | ✅ (+ Pin) | ✅ |
| Convention | ✅ | ✅ |
| Senior (FAQ + Session) | ✅ | ✅ |
| Auth (Login) | ✅ | ✅ |
| Version | ✅ | ✅ |
| Version Phase | ✅ | - |
| Test Run | ✅ | ✅ |
| Test Result | ✅ | - |
| Test Result Comment | ✅ | - |
| Ticket (Jira) | ✅ | - |
| Resume | - | ✅ |

---

## CI/CD 파이프라인

```
feature/* → develop (PR) → main (PR)
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              backend-ci   frontend-ci    e2e
              (build+test  (lint+test)   (Playwright
               JaCoCo 70%)               + deploy-gate
                                          + deploy-backend
                                          + deploy-frontend
                                          + Slack 알림)
```

- **통합 파이프라인**: E2E 통과 → deploy-gate → 자동 배포 (main push 시)
- 모든 파이프라인에 **Slack 알림** 연동 (Block Kit 포맷, 성공/실패 모두)
- Backend CI: **JaCoCo 70% 커버리지 강제** (미달 시 빌드 실패)
- Frontend CI: **ESLint + Vitest 실패 시 빌드 차단** (continue-on-error 제거)
- E2E: Docker Compose로 풀스택 구성 후 Playwright 실행

---

## 개발 환경

### Quick Start

```bash
# 1. DB 실행
docker compose -f docker-compose.db.yml up -d

# 2. App 실행
docker compose up -d
# Backend:  http://localhost:8080
# Frontend: http://localhost:5173
```

### 환경 변수 (`.env`)

```bash
POSTGRES_DB=myqaweb
POSTGRES_USER=myqaweb
POSTGRES_PASSWORD=<password>

SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb
SPRING_DATASOURCE_USERNAME=myqaweb
SPRING_DATASOURCE_PASSWORD=<password>

ANTHROPIC_API_KEY=sk-ant-...    # Claude API
OPENAI_API_KEY=sk-...           # Embedding API

VITE_API_BASE_URL=http://localhost:8080
```

### 테스트 실행

```bash
# Backend (Unit + Integration)
cd backend && ./gradlew test

# Frontend (Unit)
cd frontend && npm test

# E2E (풀스택 필요)
cd qa && npx playwright test
```

---

## DB 스키마

### PostgreSQL 15 + pgvector

```
=== QA 지식 관리 ===
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ knowledge_base   │     │ kb_category  │     │  convention  │
│ (embedding 1536d,│     │ (자동완성)   │     │ (이미지 URL) │
│  hit_count, pin, │     └──────────────┘     └──────────────┘
│  soft delete)    │
└─────────────────┘
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ pdf_upload_job   │     │ chat_session │────▶│ chat_message │
│ (상태 추적)      │     │ (세션 관리)  │     │ (대화 이력)  │
└─────────────────┘     └──────────────┘     └──────────────┘

=== 테스트 자산 관리 ===
┌──────────┐  ┌─────────┐  ┌───────────┐  ┌──────────────┐
│ company  │─▶│ product │─▶│ test_case │  │ test_case    │
│          │  │         │  │ (path[],  │  │ _image (S3)  │
└──────────┘  │         │  │  steps)   │  └──────────────┘
              │         │  └───────────┘
              │         │─▶┌───────────┐
              │         │  │  segment  │◀─┐ (self-ref)
              │         │  └───────────┘──┘
              │         │
              │         │─▶┌───────────┐  ┌──────────────┐  ┌──────────────┐
              │         │  │  version  │─▶│version_phase │─▶│ test_result  │
              └─────────┘  └───────────┘  │ (TC/TR 연결) │  │ (PASS/FAIL)  │
                                          └──────────────┘  └──────┬───────┘
              ┌───────────┐                                        │
              │ test_run  │←─── version_phase (N:M 연결)           ▼
              │ (TC 묶음) │                                 ┌──────────────┐
              └───────────┘                                 │   ticket     │
                                                            │ (Jira 연동)  │
=== 인증 + 통계 ===                                         └──────────────┘
┌─────────────────┐     ┌──────────────────────┐
│    app_user     │     │ daily_test_snapshot   │
│ (JWT, Role)     │     │ (일일 통계 스냅샷)    │
└─────────────────┘     └──────────────────────┘
```

- **Flyway** 마이그레이션 V1~V17 (순차) + V20260415~ (타임스탬프)
- **pgvector** IVFFlat 인덱스로 벡터 유사도 검색 최적화

---

## API 설계

모든 엔드포인트는 `ApiResponse<T>` 래퍼로 응답합니다.

```json
{
  "success": true,
  "message": "조회 성공",
  "data": { ... }
}
```

### 주요 엔드포인트

| 도메인 | Method | Endpoint | 설명 |
|--------|--------|----------|------|
| **Senior** | POST | `/api/senior/chat` | SSE 스트리밍 AI 채팅 (sessionId 포함) |
| | GET | `/api/senior/faq` | 큐레이션 FAQ (Pin 15 + Hit Top 5) |
| | GET/POST/PATCH/DELETE | `/api/senior/sessions` | 채팅 세션 CRUD |
| **KB** | PATCH | `/api/kb/{id}/pin` | KB 항목 고정 (FAQ 노출) |
| | POST | `/api/kb/upload-pdf` | PDF 업로드 → 자동 파이프라인 |
| | DELETE | `/api/kb/books/{source}` | 도서 단위 삭제 |
| **Feature** | PATCH | `/api/segments/{id}/parent` | DnD 세그먼트 이동 (순환 참조 검증) |
| | POST | `/api/test-cases/generate-draft` | AI 테스트 케이스 드래프트 |
| **Version** | CRUD | `/api/versions`, `/api/version-phases` | 버전·페이즈 관리 |
| **TestResult** | CRUD | `/api/test-results` | 테스트 실행 결과 (PASS/FAIL/BLOCKED) |
| **Ticket** | CRUD | `/api/tickets` | Jira 연동 티켓 (FAIL 시 자동 생성) |
| **Statistics** | GET | `/api/statistics/*` | Release Readiness, Daily Trend |
| **Auth** | POST | `/api/auth/login` | JWT 토큰 발급 |

---

## 개발 방법론

### Doc-Driven Development
모든 기능 변경은 `docs/` 디렉토리에 버전 문서로 먼저 기록한 후 구현합니다.
- 메인 명세서 (feature-registry.md, knowledge-base.md, my-senior.md)
- 버전 문서 (v1, v2, ... 변경 이력 추적)
- Ops 문서 21건으로 인프라 변경 이력 관리

### Git 브랜치 전략
```
main (production) ← PR from develop
  develop (integration) ← PR from feature/*
    feature/* | bugfix/* | hotfix/*
```

---

## 기술적 의사결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 벡터 DB | pgvector (PostgreSQL 확장) | 별도 벡터 DB 없이 단일 DB로 관계형 + 벡터 검색 통합 |
| AI 스트리밍 | SSE (Server-Sent Events) | WebSocket 대비 단방향 스트리밍에 적합, 구현 단순성 |
| 세그먼트 트리 | Adjacency List | 무한 깊이 계층 지원, DnD 이동 시 parent_id만 변경 |
| 테스트 케이스 steps | JSONB | 유연한 스키마, 단계별 구조가 케이스마다 다름 |
| PDF 처리 | 비동기 Job | 대용량 PDF의 임베딩 생성에 수 분 소요, UX 블로킹 방지 |
| 프론트엔드 배포 | S3 + CloudFront | EC2 부하 분리, CDN 캐싱으로 응답 속도 최적화 |
| DB 마이그레이션 | Flyway | 버전 관리 가능한 스키마 변경, validate 모드로 안전성 확보 |
| 상태 관리 | Zustand + Context | Redux 대비 보일러플레이트 최소화, 도메인별 분리 용이 |
