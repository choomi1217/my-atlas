# my-atlas

QA(Quality Assurance) 지식 관리 웹 애플리케이션.
AI 시니어 QA 챗봇, 지식 베이스, 용어 컨벤션, 기능 레지스트리를 제공한다.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript 5.4 + Tailwind CSS 3.4 |
| Backend | Spring Boot 3.3.1 (Java 21) + Spring AI (Claude) |
| Database | PostgreSQL 15 + pgvector (1536 dims, cosine similarity) |
| Embedding | OpenAI text-embedding-3-small |
| E2E Test | Playwright (API 65 + UI 33 = 98 tests) |
| CI/CD | GitHub Actions (5 workflows) + Slack notification |
| Infra | AWS EC2 (t3.small) + S3 + CloudFront |

## Features

| Feature | Route | Description |
|---------|-------|-------------|
| My Senior | `/senior` | AI 시니어 QA 챗봇 (RAG + SSE 스트리밍), FAQ 관리 |
| Knowledge Base | `/kb` | QA 지식 관리 (수동 작성 + PDF 업로드 파이프라인) |
| Word Conventions | `/conventions` | 팀 용어 표준화 (CRUD) |
| Feature Registry | `/features` | 3단계 드릴다운 (Company > Product > TestCase), Segment 트리 |

## Project Structure

```
my-atlas/
├── backend/                  # Spring Boot REST API (Java 21, Gradle)
│   ├── src/main/java/com/myqaweb/
│   │   ├── senior/           # AI Chat + FAQ (SSE, RAG)
│   │   ├── knowledgebase/    # KB CRUD + PDF pipeline
│   │   ├── convention/       # 용어 컨벤션 CRUD
│   │   ├── feature/          # Company, Product, Segment, TestCase
│   │   └── common/           # EmbeddingService, GlobalExceptionHandler
│   ├── src/test/java/        # JUnit 5 + Mockito + Testcontainers (179 tests)
│   └── build.gradle
├── frontend/                 # React SPA (TypeScript, Vite, Tailwind)
│   ├── src/
│   │   ├── pages/            # SeniorPage, KnowledgeBasePage, ConventionsPage, features/
│   │   ├── components/       # senior/, kb/, features/
│   │   ├── hooks/            # useSeniorChat, useFaq, useKnowledgeBase
│   │   ├── api/              # senior.ts, features.ts
│   │   └── types/            # senior.ts, features.ts
│   └── package.json
├── qa/                       # Playwright E2E tests (98 tests)
│   ├── api/                  # API tests (65): company, product, segment, feature, kb, convention, senior-faq
│   ├── ui/                   # UI tests (33): company-panel, product-panel, feature-panel, kb, senior
│   ├── helpers/              # api-helpers.ts
│   └── pages/                # Page Object (features-page.ts)
├── docs/                     # 문서 기반 개발 (Doc-Driven Development)
│   ├── features/             # 기능별 명세서 + 버전 문서
│   │   ├── feature-registry/ # feature-registry.md (master) + v1~v10
│   │   ├── knowledge-base/   # knowledge-base.md (master) + v0, v0.1
│   │   └── senior/           # my-senior.md (master) + v0~v2
│   ├── ops/                  # 인프라/환경 문서: ops.md (master) + v1~v6
│   ├── qa/                   # 테스트 전략: qa_v1~v8, testcase_v1
│   └── ui/                   # UI 개선: ui_v1
├── .github/workflows/        # CI/CD (backend-ci, frontend-ci, e2e, deploy-backend, deploy-frontend)
├── docker-compose.yml        # DB + Backend + Frontend
├── CLAUDE.md                 # Claude Code 프로젝트 컨텍스트
└── .env                      # 환경 변수 (gitignored)
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 21 (backend local dev)
- Node.js 20+ (frontend local dev)

### Run Everything
```bash
docker compose up -d
# Backend:  http://localhost:8080
# Frontend: http://localhost:5173
# Postgres: localhost:5432
```

### Backend Only
```bash
cd backend && ./gradlew bootRun
```

### Frontend Only
```bash
cd frontend && npm install && npm run dev
```

### Run Tests
```bash
# Backend unit + integration tests
cd backend && ./gradlew test

# Frontend unit tests
cd frontend && npm test

# E2E tests (requires full stack running)
cd qa && npx playwright test
```

## Environment Variables

Create `.env` file at project root:

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

## AWS Deployment

| Component | Service | Endpoint |
|-----------|---------|----------|
| Frontend | S3 + CloudFront | `https://d1tr7ozyf0jrsl.cloudfront.net` |
| Backend | EC2 (t3.small) | `http://3.34.154.147:8080` |
| Database | EC2 Docker (pgvector:pg15) | Internal |

Deployment is automated via GitHub Actions on push to `main`.

## Git Branch Strategy

```
main (production) ← PR from develop
  develop (integration) ← PR from feature/*
    feature/* | bugfix/* | hotfix/*
```

## Documentation

모든 기능 변경은 `docs/` 디렉토리에 버전 문서로 기록한다.
상세 규칙은 `CLAUDE.md`의 "버전 문서화 규칙" 섹션 참조.
