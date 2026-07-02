# my-atlas

> AI 기반 QA 지식 관리 플랫폼 — RAG 챗봇 · PDF 임베딩 파이프라인 · 테스트 관리 · 용어 표준화
>
> 📋 기획·이력: [Notion](https://www.notion.so/MyAtlas-3d4107b270e88220b23781a50e6eae8a)

QA 엔지니어의 업무 효율을 높이기 위한 풀스택 웹 애플리케이션. 기획·개발·QA를 1인이 담당합니다.

---

## 핵심 기능

- **My Senior** — RAG + SSE 스트리밍 AI 시니어 QA 챗봇. KB 기반 FAQ 큐레이션(Pin + 조회수), FAQ→Chat 컨텍스트 전달, 채팅 세션 영구 저장.
- **Knowledge Base** — PDF 업로드 → 텍스트 추출 → 청킹 → 벡터 임베딩 자동 파이프라인(비동기 Job). pgvector 코사인 유사도 검색, 소스 필터, Pin/Hit 기반 FAQ 선순환.
- **Feature Registry** — Company → Product → TestCase 3단계 드릴다운. Segment 트리(Adjacency List, DnD, 순환 참조 검증), AI 테스트 케이스 드래프트, Version → Phase → TestResult 실행·이력 관리, Jira 연동(FAIL 시 자동 티켓), Release Go/No-Go 판단.
- **Word Conventions** — 팀 QA 용어 표준화.
- **Platform** — JWT 인증(HMAC-SHA256) + Role 기반 접근 제어(ADMIN / USER).

---

## 기술 스택

- **Backend** — Java 21 · Spring Boot 4 · Spring AI 2.0(Claude + OpenAI 임베딩) · PostgreSQL 15 + pgvector · Flyway · PDFBox
- **Frontend** — React 18 · TypeScript · Vite · Tailwind CSS · Zustand · React Router
- **Infra / DevOps** — AWS(EC2 · S3 · CloudFront · ALB · Route 53) · Docker Compose · GitHub Actions · Playwright · Slack Webhook

---

## 아키텍처

```
[사용자]
  ├─ Frontend ─→ Route 53 → CloudFront(HTTPS) → S3 (SPA + 이미지 CDN)
  └─ API      ─→ Route 53 → ALB(HTTPS) → EC2
                                          ├─ Spring Boot (REST + SSE, Spring AI)
                                          └─ PostgreSQL + pgvector
```

### RAG 파이프라인

```
[질문] + (optional) FAQ Context
   → 쿼리 임베딩 (OpenAI text-embedding-3-small)
   → pgvector 코사인 검색  ─ 0순위: FAQ Context
                           ─ 1순위: KB 수동 작성 Top 3
                           ─ 2순위: KB PDF 청크 Top 2
   → 컨텍스트 조합 → Claude 프롬프트
   → SSE 스트리밍 → Markdown 렌더 → 세션 DB 저장
```

### PDF 업로드 파이프라인

```
[PDF 업로드] → Job(PENDING) 비동기 시작
   → PDFBox 텍스트 추출 → 청킹 → OpenAI 임베딩(1536차원)
   → knowledge_base 저장(source = 도서명) → Job(DONE / FAILED)
```

---

## 기술적 의사결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 벡터 DB | pgvector (PostgreSQL 확장) | 별도 벡터 DB 없이 단일 DB로 관계형 + 벡터 검색 통합 |
| AI 스트리밍 | SSE (Server-Sent Events) | WebSocket 대비 단방향 스트리밍에 적합, 구현 단순 |
| 세그먼트 트리 | Adjacency List | 무한 깊이 계층 지원, DnD 이동 시 parent_id만 변경 |
| 테스트 케이스 steps | JSONB | 유연한 스키마, 단계별 구조가 케이스마다 다름 |
| PDF 처리 | 비동기 Job | 대용량 PDF 임베딩에 수 분 소요, UX 블로킹 방지 |
| 프론트엔드 배포 | S3 + CloudFront | EC2 부하 분리, CDN 캐싱으로 응답 속도 최적화 |
| DB 마이그레이션 | Flyway | 버전 관리 가능한 스키마 변경, Hibernate `ddl-auto=none`으로 Flyway가 스키마 단독 소유 |
| 상태 관리 | Zustand + Context | Redux 대비 보일러플레이트 최소화, 도메인별 분리 용이 |

---

## Quick Start

```bash
docker compose -f docker-compose.db.yml up -d   # DB (pgvector)
docker compose up -d                             # Backend :8080 / Frontend :5173
```

환경 변수는 `.env`(gitignored) — DB 접속 정보 + `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`.

---

## 개발 방법론

- **Doc-Driven Development** — 기능 변경을 `docs/`에 버전 문서로 먼저 기록한 뒤 구현.
- **Git 흐름** — `feature/* → develop → main` (PR 기반, 리뷰 필수).
