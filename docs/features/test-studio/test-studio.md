# Test Studio — 문서 기반 AI 테스트 케이스 자동 생성

> 최종 업데이트: 2026-04-20 | 현재 버전: v1.1 (구현 완료)

---

## 개요 — QA에게 이 도구가 왜 필요한가

### 문제: 반복되는 문서 해석 노동

IT 회사에서 다음 버전을 준비할 때, QA는 디자인 문서(Figma), PRD(Notion), 스펙 MD 등을 일일이 읽어가며 테스트 케이스와 시나리오를 수동으로 작성한다. 이 과정은 매 릴리즈마다 반복되며,

- 문서 해석 → TC 초안 작성 → Segment 분류 → 등록까지 **수 시간~수 일** 소요
- 팀의 **Words Convention**(용어 표준), **Knowledge Base**(도메인 지식), 기존 **Feature Registry**(누적된 TC 패턴)이 일관되게 반영되지 않음
- 신입 QA는 컨벤션을 익히는 데만 수 주가 걸리고, 시니어 QA는 매번 비슷한 TC를 반복 작성함

### 해결: 문서 투입 → DRAFT 자동 생성

Test Studio는 사용자가 **디자인/스펙 문서를 투입하면**, Knowledge Base + Words Convention + Feature Registry(기존 TC)를 RAG 컨텍스트로 참조하여 **해당 Company의 Product에 TestCase 초안(DRAFT)을 자동 생성**한다.

생성된 DRAFT는 기존 Feature Registry의 TestCasePage에서 QA가 검토·편집 후 ACTIVE 상태로 전환된다.

### 핵심 가치

| 가치 | 의미 | 대응 기능 |
|------|------|-----------|
| **문서 해석 자동화** | 스펙 → TC 초안 변환을 AI가 수행 | Claude 기반 Job 파이프라인 |
| **팀 자산 일관성** | KB + Convention + 기존 TC 패턴을 반영한 결과물 | RAG 컨텍스트 빌더 |
| **QA 생산성** | 반복적 초안 작성 → 검토·검증에 집중 | DRAFT 상태 저장 + TestCasePage 연동 |
| **운영 가시성** | Job 상태·실패 사유 추적 | 비동기 Job + 상태 필드 (PENDING/PROCESSING/DONE/FAILED) |

### QA 일상 업무 Before/After

| QA 업무 | 기존 방식 | Test Studio |
|---------|-----------|-------------|
| PRD → TC 작성 | 문서 정독 → 수동 TC 타이핑 | 문서 투입 → DRAFT 자동 생성 |
| 컨벤션 일관성 | 수시로 Words Convention 참고 | 생성 시 자동으로 컨벤션 반영 |
| 유사 기능 TC 참고 | 이전 버전 스프레드시트 검색 | RAG로 자동 유사 TC 검색·반영 |
| 검토 흐름 | 처음부터 작성 | 초안 검토 → 수정 → ACTIVE 전환 |

---

## 시스템 아키텍처 한눈에 보기

```
[사용자]
   │  1. 문서 투입 (Markdown 텍스트 / PDF 파일)
   ▼
┌────────────────────────────────────────────────────────────┐
│  Test Studio Page                                          │
│  /features/companies/:cid/products/:pid/test-studio        │
└─────────────────────────┬──────────────────────────────────┘
                          │ POST /api/test-studio/jobs
                          ▼
┌────────────────────────────────────────────────────────────┐
│  TestStudioService (@Async)                                │
│                                                            │
│  ①  Source 추출 (PDFBox / Markdown 원문)                    │
│       │                                                    │
│  ②  RAG 컨텍스트 빌드                                        │
│       ├── Knowledge Base (pgvector top-5)                  │
│       ├── Convention (전량)                                 │
│       └── Feature Registry TC (pgvector top-5, Product별)   │
│       │                                                    │
│  ③  Claude 호출 (Spring AI ChatClient)                      │
│       │  → JSON 배열 응답 파싱                               │
│       │                                                    │
│  ④  DRAFT TestCase 저장                                     │
│       (status=DRAFT, test_studio_job_id=jobId)             │
│       │                                                    │
│  ⑤  Job status=DONE, generated_count 기록                   │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Feature Registry — TestCasePage                           │
│  ?status=DRAFT&jobId={jobId} 필터로 검토 → ACTIVE 전환       │
└────────────────────────────────────────────────────────────┘
```

**관계도:**

```
Company (1) ──→ Product (N)
                 │
                 ├── TestStudioJob (N) ──┐
                 │                       │
                 └── TestCase (N) ◄──────┘   (test_studio_job_id FK, nullable)
                                              │
                                              └─ status=DRAFT일 때 Test Studio 산출물
```

**참조 도메인 (읽기 전용):**
- Knowledge Base (`knowledge_base`, pgvector)
- Word Convention (`convention`)
- 기존 TestCase 패턴 (`test_case`, Product 단위)

---

## 핵심 기능

### 1. 문서 투입 (Source Input)

**v1 지원 타입**

| SourceType | 설명 | 입력 방식 |
|------------|------|-----------|
| `MARKDOWN` | Markdown 원문 붙여넣기 | textarea |
| `PDF` | PDF 파일 업로드 | multipart |

**v2+ 계획 (본 문서 미포함)**
- `FIGMA_URL` — Figma REST API로 프레임/스크린 자동 추출
- `NOTION_URL` — Notion API로 페이지 MD 자동 추출
- PDF 멀티모달 (이미지/스크린샷 해석)

**입력 제약**
- `source_content` 최대 100,000자 (~25K 토큰) — Claude 입력 토큰 보호
- PDF 파일 크기 20MB 이하 (KB 파이프라인 500MB와 달리 MVP 안정성 우선)

---

### 2. 비동기 Job 파이프라인

PDF Upload Pipeline과 동일한 패턴을 따른다.

| 상태 | 의미 |
|------|------|
| `PENDING` | Job 접수 직후, 파이프라인 시작 전 |
| `PROCESSING` | Source 추출 / RAG / Claude 호출 중 |
| `DONE` | DRAFT TC 저장 완료, `generated_count` 확정 |
| `FAILED` | 파이프라인 실패, `error_message`에 원인 기록 |

**실패 정책**
- 일부 TC만 파싱 성공 → 성공분은 저장하고 Job은 `DONE` 처리
- 전체 파싱 실패 / Claude 오류 → `FAILED`
- 타임아웃 / 네트워크 오류 → `FAILED` + 재시도 없음 (v1)

---

### 3. RAG 컨텍스트 빌더

문서만으로는 팀 맥락을 반영할 수 없다. 생성 파이프라인은 다음 세 소스를 조합한다.

| 소스 | 검색 방식 | 포함 규모 | 목적 |
|------|-----------|-----------|------|
| **Knowledge Base** | pgvector cosine top-K | top-5 청크 | 도메인 지식 (예: 결제 플로우 규칙) |
| **Word Convention** | 전량 로드 | 전체 용어 | 용어 표준화 (예: "결제 단말기" vs "POS") |
| **Feature Registry TC** | pgvector top-K (Product 단위) | top-5 TC | 기존 작성 패턴 (제목 / Steps 스타일) |

**프롬프트 골자**
```
[System] 시니어 QA로서 주어진 문서를 바탕으로 JSON 배열로 TC를 생성한다.
         팀 컨벤션과 기존 TC 패턴을 반영하라.
[Context] KB top-5 | Convention 전량 | 유사 TC top-5
[Input] Source 문서
[Output Schema] title / preconditions / steps[] / expectedResult /
               priority / testType / suggestedSegmentPath[]
```

---

### 4. DRAFT TestCase 저장 & 검토 워크플로우

Test Studio는 TC를 직접 ACTIVE로 만들지 않는다. QA의 검토가 반드시 필요하다.

- 생성된 TC는 `test_case.status=DRAFT` + `test_studio_job_id=jobId`로 저장
- Frontend는 Job 완료 시 "DRAFT TC 보기" 링크를 제공
- 링크는 기존 TestCasePage로 이동하며 `?status=DRAFT&jobId={jobId}` 필터 적용
- QA가 TC를 수정하고 `status=ACTIVE`로 저장하면 일반 TC와 동일하게 테스트 실행에 참여 가능

**Segment 매핑 (v1)**
- Claude는 `suggestedSegmentPath`(문자열 배열)만 제안
- 실제 `test_case.path`(Segment ID 배열)는 빈 상태로 저장
- 사용자가 TestCasePage에서 Segment를 직접 선택
- v2에서 이름 기반 자동 매핑 계획

---

## 데이터베이스 스키마

### 신규 테이블 (1) + 기존 테이블 컬럼 추가 (1)

#### `test_studio_job` (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | Job ID |
| product_id | BIGINT FK → product.id (CASCADE) | 대상 Product |
| source_type | VARCHAR(20) NOT NULL | MARKDOWN / PDF |
| source_title | VARCHAR(200) NOT NULL | 사용자 입력 제목 |
| source_content | TEXT | MARKDOWN일 때 원문 텍스트 |
| source_file_path | VARCHAR(500) | PDF일 때 업로드 파일 경로 |
| status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | PENDING / PROCESSING / DONE / FAILED |
| error_message | TEXT | 실패 시 원인 |
| generated_count | INT DEFAULT 0 | 생성된 DRAFT TC 수 |
| created_at | TIMESTAMP DEFAULT NOW() | 생성 시각 |
| completed_at | TIMESTAMP | 완료 시각 |

**Index:** `(product_id, created_at DESC)` — Product별 최신순 목록

#### `test_case` (컬럼 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| test_studio_job_id | BIGINT FK → test_studio_job.id NULL | Test Studio 산출물 추적 (수동 작성 TC는 NULL) |

### Enum

| Enum | 값 | 사용처 |
|------|----|--------|
| **SourceType** | MARKDOWN, PDF | `test_studio_job.source_type` |
| **TestStudioJobStatus** | PENDING, PROCESSING, DONE, FAILED | `test_studio_job.status` |

### Flyway 마이그레이션

| 버전 | 설명 |
|------|------|
| `V{YYYYMMDD}{HHmm}__create_test_studio_job.sql` | `test_studio_job` 생성 + `test_case.test_studio_job_id` 추가 |

파일명은 구현 시점의 타임스탬프(`YYYYMMDD` + `HHmm`)로 확정한다. CLAUDE.md의 타임스탬프 버전 규칙 준수.

### Critical Rules

- ❌ `test_studio_job` 삭제 시 관련 DRAFT TC 자동 삭제 금지 (사용자가 이미 ACTIVE로 전환했을 수 있음)
- ❌ `knowledge_base`, `pdf_upload_job` 데이터 수정/삭제 금지 (프로젝트 전역 Critical Rule)
- ✅ DRAFT TC는 `test_case.status=DRAFT` + `test_studio_job_id`로만 식별

---

## Backend API 엔드포인트

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### Test Studio (`/api/test-studio`) — 4개

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/test-studio/jobs` | Job 생성 (multipart: productId, sourceType, title, content?, file?) |
| GET | `/api/test-studio/jobs?productId={id}` | Product별 Job 목록 (최신순) |
| GET | `/api/test-studio/jobs/{id}` | Job 단건 조회 |
| DELETE | `/api/test-studio/jobs/{id}` | Job 삭제 (DRAFT TC는 보존) |

**참고:** DRAFT TC 조회/수정/활성화는 기존 Feature Registry API(`/api/test-cases`)로 처리한다. Test Studio는 생성 파이프라인만 담당.

---

## URL 라우팅

| 단계 | URL | 페이지 |
|------|-----|--------|
| 1 | `/features` | CompanyListPage (기존) |
| 2 | `/features/companies/:cid` | ProductListPage (기존) |
| 3 | `/features/companies/:cid/products/:pid/test-studio` | **TestStudioPage (신규)** |
| 4 (연계) | `/features/companies/:cid/products/:pid?status=DRAFT&jobId={id}` | TestCasePage (DRAFT 검토) |

드릴다운 규칙(CLAUDE.md Frontend 레이아웃 규칙) 준수 — 한 번에 하나의 뷰.

---

## Backend 파일 구조 (계획)

```
backend/src/main/java/com/myqaweb/teststudio/
├── TestStudioJobEntity.java           # @Entity
├── TestStudioJobRepository.java       # JpaRepository
├── TestStudioJobDto.java              # 응답 DTO
├── SourceType.java                    # enum
├── TestStudioJobStatus.java           # enum
├── TestStudioService.java             # interface
├── TestStudioServiceImpl.java         # @Async 오케스트레이션
├── TestStudioGenerator.java           # RAG 빌더 + Claude 호출 + JSON 파싱
├── TestStudioController.java          # REST
└── DraftTestCaseDto.java              # Claude 응답 파싱용 record

backend/src/main/resources/db/migration/
└── V{timestamp}__create_test_studio_job.sql
```

**의존 도메인 (읽기):** `com.myqaweb.knowledgebase`, `com.myqaweb.convention`, `com.myqaweb.feature` (TestCaseRepository)

---

## Frontend 파일 구조 (계획)

```
frontend/src/
├── pages/features/
│   └── TestStudioPage.tsx                  # 라우트 페이지
├── components/test-studio/
│   ├── TestStudioJobForm.tsx               # 새 Job 생성 폼
│   ├── TestStudioJobList.tsx               # Job 히스토리
│   └── TestStudioJobStatusBadge.tsx        # 상태 배지
├── hooks/
│   └── useTestStudio.ts                    # Job 생성/조회/폴링
├── api/
│   └── test-studio.ts                      # API 모듈
└── types/
    └── test-studio.ts                      # 인터페이스
```

**기존 파일 수정:**
- `App.tsx` — 라우트 등록
- `pages/features/TestCasePage.tsx` — `?status=DRAFT&jobId=` 쿼리 파라미터 필터 지원

---

## 테스트 전략 (계획)

### Backend Unit & Integration (`backend/src/test/java/com/myqaweb/teststudio/`)

| 클래스 | 범위 |
|--------|------|
| `TestStudioServiceImplTest` | Job 생성 / 상태 전이 / 실패 처리 (Mock) |
| `TestStudioGeneratorTest` | RAG 컨텍스트 구성, Prompt 렌더링, JSON 파싱 성공/실패 |
| `TestStudioControllerTest` | `@WebMvcTest` — 요청 검증, 400/404 |
| `TestStudioIntegrationTest` | Testcontainers pgvector — Job 생성 → DRAFT TC 저장 (ChatClient Mock) |

### E2E API (`qa/api/test-studio.spec.ts`)

- Job 생성 (MARKDOWN / PDF), 필수값 누락 400
- Product별 목록 조회, 단건 조회
- Job 삭제 후 404
- Job DONE 대기 후 `test_case?status=DRAFT` 결과 포함 확인

### E2E UI (`qa/ui/test-studio.spec.ts`)

- 페이지 진입 + Breadcrumb
- Markdown Job 생성 플로우
- 상태 배지 표시
- DONE → TestCasePage 이동

셀렉터는 CLAUDE.md Agent-C 규칙 준수 (TSX Read 후 실제 DOM 기반 작성).

---

## 구현 현황

**v1.1: 구현 완료 (2026-04-20)**

- ✅ v1 기능 설계 및 구현 — [test-studio_v1.md](./test-studio_v1.md)
- ✅ Backend 10개 파일 + Flyway 마이그레이션 + 기존 3개 파일 소규모 수정
- ✅ Frontend 8개 파일 + 기존 3개 파일 소규모 수정
- ✅ 테스트 **50건 전부 통과** (Backend 36 + E2E 14, v1.1에서 회귀 테스트 1건 추가)
- ✅ v1.1 버그 3건 수정 — [test-studio_v1.1.md](./test-studio_v1.1.md)
  - 트랜잭션 가시성 이슈 (`@Transactional` 제거)
  - Claude 응답 truncation (max_tokens 8192 per-call + 부분 복구 파서)
  - DRAFT TC rendering (TestCasePage 📦 Segment 미지정 섹션)

**참고 문서**
- 상세 구현 계획: [test-studio_v1.md](./test-studio_v1.md)
- 연동 도메인 명세:
  - Feature Registry — [../registry/registry.md](../registry/registry.md)
  - Knowledge Base — [../knowledge-base/knowledge-base.md](../knowledge-base/knowledge-base.md)
  - Words Convention — [../words-convention/](../words-convention/)
  - My Senior — [../senior/my-senior.md](../senior/my-senior.md)

---

## 버전 히스토리

| 버전 | 날짜 | 유형 | 요약 | 상태 |
|------|------|------|------|------|
| v1 | 2026-04-17 | 기능 추가 | Test Studio 초기 구현: MD/PDF 입력 기반 DRAFT TC 자동 생성 파이프라인 (RAG + Claude). 비동기 Job, Convention/KB/기존 TC RAG 주입, DRAFT 상태 저장 → TestCasePage 검토 플로우 | 완료 |
| v1.1 | 2026-04-20 | 버그 수정 | 초기 검증 3건: ① `@Transactional` 제거로 async 가시성 복구 ② Anthropic max_tokens=8192 per-call + 잘린 JSON 부분 복구 ③ TestCasePage 에 "Segment 미지정" 섹션 추가 (DRAFT TC 가시화) | 완료 |
