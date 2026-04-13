# my-atlas

> AI 기반 QA(Quality Assurance) 지식 관리 플랫폼

QA 엔지니어의 업무 효율을 높이기 위한 풀스택 웹 애플리케이션입니다.
RAG 기반 AI 챗봇, PDF 자동 파싱·임베딩 파이프라인, 테스트 케이스 관리, 용어 표준화 기능을 제공합니다.

---

## 핵심 기능

### My Senior — AI 시니어 QA 챗봇
- **RAG(Retrieval-Augmented Generation)** 파이프라인으로 프로젝트 맥락에 맞는 답변 생성
- **SSE(Server-Sent Events)** 스트리밍으로 실시간 응답 전달
- FAQ 카드뷰 + FAQ→Chat 컨텍스트 자동 전달
- 채팅 세션 관리 (대화 이력 저장·조회)
- 검색 우선순위: FAQ Context > Company Features > Knowledge Base > FAQ > Conventions

### Knowledge Base — QA 지식 관리
- Markdown WYSIWYG 에디터로 지식 수동 작성
- **PDF 업로드 → 텍스트 추출 → 챕터 파싱 → 청킹 → 벡터 임베딩** 자동 파이프라인
- 비동기 임베딩 생성 + Job 상태 추적 (PENDING → PROCESSING → DONE/FAILED)
- pgvector 코사인 유사도 검색 (1536차원 벡터)
- 소스별 필터 탭 (수동 작성 vs PDF 청크)

### Feature Registry — 테스트 케이스 관리
- **Company → Product → TestCase** 3단계 드릴다운 구조
- Segment 트리 (Adjacency List 패턴, 자기 참조 계층)
- Drag & Drop 세그먼트 이동 + 순환 참조 검증
- AI 기반 테스트 케이스 드래프트 자동 생성
- 테스트 실행(Test Run) 이력 관리 + 버전 관리

### Word Conventions — 용어 표준화
- 팀 내 QA 용어 통일을 위한 CRUD
- 이미지 업로드 지원

### 인증/보안
- JWT 기반 로그인 + ProtectedRoute
- Spring Security + 역할 기반 접근 제어

---

## 기술 스택

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Java | 21 | 언어 |
| Spring Boot | 3.3.1 | 웹 프레임워크 |
| Spring AI | 1.0.0-M1 | Claude API + OpenAI 임베딩 통합 |
| PostgreSQL | 15 + pgvector | RDB + 벡터 검색 |
| Flyway | - | DB 마이그레이션 (V1~V16) |
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
   ├─ Frontend ──→ CloudFront (CDN) ──→ S3 (정적 호스팅)
   │                HTTPS
   │
   └─ API 요청 ──→ EC2 (t3.small)
                    ├── Spring Boot Container (port 8080)
                    │    ├── REST API (Convention, KB, Feature, Senior)
                    │    ├── SSE Streaming (AI Chat)
                    │    └── Spring AI (Claude + OpenAI Embedding)
                    │
                    └── PostgreSQL + pgvector Container (port 5432)
                         ├── 관계형 데이터 (Company, Product, TestCase, ...)
                         └── 벡터 인덱스 (Knowledge Base, FAQ 임베딩)
```

### RAG 파이프라인

```
[사용자 질문]
     │
     ▼
 쿼리 임베딩 생성 (OpenAI text-embedding-3-small)
     │
     ▼
 pgvector 코사인 유사도 검색
     │  ┌─ FAQ Context (사용자가 선택한 FAQ)
     │  ├─ Knowledge Base (수동 작성 + PDF 청크)
     │  ├─ FAQ (임베딩 기반 유사 FAQ)
     │  └─ Conventions (용어 사전)
     │
     ▼
 컨텍스트 조합 → Claude API 프롬프트 생성
     │
     ▼
 SSE 스트리밍 응답 → 프론트엔드 실시간 렌더링
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
│   │   ├── senior/              # AI Chat (SSE) + FAQ + RAG
│   │   ├── knowledgebase/       # KB CRUD + PDF 파이프라인
│   │   ├── convention/          # 용어 컨벤션 CRUD + 이미지
│   │   ├── feature/             # Company, Product, Segment, TestCase
│   │   ├── auth/                # JWT 인증 + Spring Security
│   │   └── common/              # EmbeddingService, GlobalExceptionHandler
│   ├── src/test/java/           # Unit + Integration Tests
│   └── src/main/resources/
│       └── db/migration/        # Flyway V1~V16
│
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── pages/               # 라우트별 페이지 컴포넌트
│   │   ├── components/          # 도메인별 UI 컴포넌트
│   │   ├── hooks/               # Custom Hooks (useSeniorChat, useFaq, ...)
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
│   ├── ops/                     # 인프라·환경 문서 (v1~v11)
│   └── qa/                      # 테스트 전략 문서
│
├── .github/workflows/           # CI/CD 파이프라인
├── docker-compose.db.yml        # DB 전용 (독립 라이프사이클)
├── docker-compose.yml           # Backend + Frontend (App)
└── .env                         # 환경 변수 (gitignored)
```

---

## 테스트 전략

### 3-Layer 테스트 피라미드

| 레이어 | 도구 | 대상 |
|--------|------|------|
| Unit | JUnit 5 + Mockito | Service, Controller 전 도메인 |
| Integration | Testcontainers (pgvector) | 벡터 검색, PDF 파이프라인, FAQ 검색 |
| E2E | Playwright | API 65 + UI 33 (Chromium) |
| Frontend Unit | Vitest + Testing Library | Hooks, Components |

### E2E 테스트 커버리지

| 도메인 | API | UI |
|--------|-----|-----|
| Company | 6 | 7 |
| Product | 10 | 4 |
| Segment | 11 | - |
| Feature (TestCase) | 19 | 5 |
| Knowledge Base | 7 | 5 |
| Convention | 6 | - |
| Senior (FAQ + Chat) | 6 | 12 |

---

## CI/CD 파이프라인

```
feature/* → develop (PR) → main (PR)
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              backend-ci   frontend-ci    e2e
              (build+test) (lint+test)  (Playwright)
                    │           │           │
                    └───────────┼───────────┘
                                │ (main push)
                    ┌───────────┼───────────┐
                    ▼                       ▼
            deploy-backend          deploy-frontend
            (SSH → EC2              (S3 sync →
             docker rebuild)         CloudFront invalidation)
```

- 모든 파이프라인에 **Slack 알림** 연동 (Block Kit 포맷, 성공/실패 모두)
- Frontend CI: ESLint + Vitest 실패 시 빌드 차단
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
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│    company       │────▶│   product    │────▶│  test_case   │
│  (partial unique │     │ (company FK) │     │ (product FK, │
│   is_active=1)   │     │              │     │  path[], steps│
└─────────────────┘     └──────┬───────┘     │  jsonb)      │
                               │              └──────────────┘
                               ▼
                        ┌──────────────┐
                        │   segment    │
                        │ (self-ref    │
                        │  parent_id,  │◀──┐
                        │  Adjacency   │───┘
                        │  List)       │
                        └──────────────┘

┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ knowledge_base   │     │     faq      │     │  convention  │
│ (embedding 1536d,│     │ (embedding   │     │ (이미지 URL) │
│  source 필터)    │     │  1536d)      │     │              │
└─────────────────┘     └──────────────┘     └──────────────┘

┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ pdf_upload_job   │     │ chat_session │     │    users     │
│ (PENDING →       │     │ (메시지 이력,│     │ (JWT 인증,   │
│  PROCESSING →    │     │  사용자 연결)│     │  역할 관리)  │
│  DONE/FAILED)    │     │              │     │              │
└─────────────────┘     └──────────────┘     └──────────────┘
```

- **Flyway** 마이그레이션 V1~V16으로 스키마 버전 관리
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
| **Senior** | POST | `/api/senior/chat` | SSE 스트리밍 AI 채팅 |
| | GET/POST/PUT/DELETE | `/api/senior/faq` | FAQ CRUD + 비동기 임베딩 |
| **KB** | POST | `/api/kb/upload-pdf` | PDF 업로드 → 자동 파이프라인 |
| | GET | `/api/kb/jobs/{jobId}` | Job 상태 폴링 |
| | DELETE | `/api/kb/books/{source}` | 도서 단위 삭제 |
| **Feature** | PATCH | `/api/segments/{id}/parent` | DnD 세그먼트 이동 (순환 참조 검증) |
| | POST | `/api/test-cases/generate-draft` | AI 테스트 케이스 드래프트 |
| **Auth** | POST | `/api/auth/login` | JWT 토큰 발급 |

---

## 개발 방법론

### Doc-Driven Development
모든 기능 변경은 `docs/` 디렉토리에 버전 문서로 먼저 기록한 후 구현합니다.
- 메인 명세서 (feature-registry.md, knowledge-base.md, my-senior.md)
- 버전 문서 (v1, v2, ... 변경 이력 추적)
- Ops 문서 11건으로 인프라 변경 이력 관리

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
