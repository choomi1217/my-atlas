# Test Studio — v1: 문서 기반 AI 테스트 케이스 자동 생성

> 변경 유형: 기능 추가
> 작성일: 2026-04-17
> 버전: v1
> 상태: 완료

---

## 개요 — QA에게 이 기능이 왜 필요한가

IT 회사에서 다음 버전을 준비할 때 QA는 디자인 문서(Figma), PRD(Notion), 스펙 MD 등을 읽고 테스트 케이스와 시나리오를 수동으로 작성한다. 문서를 해석 → TC 초안 작성 → Segment 분류 → 등록까지 수 시간~수 일이 소요되며, 팀의 기존 테스트 컨벤션(Words Convention), 도메인 지식(Knowledge Base), 이미 쌓인 TC 패턴(Feature Registry)이 일관되게 반영되지 않는다.

**Test Studio**는 사용자가 디자인/스펙 문서를 투입하면, Knowledge Base + Words Convention + Feature Registry(기존 TC)를 RAG 컨텍스트로 참조하여 **해당 Company의 Product에 TestCase 초안(DRAFT)을 자동 생성**하는 기능이다.

---

## Current Project State

- Monorepo 구조 완성 (backend/, frontend/, qa/)
- Backend 패키지: `com.myqaweb.senior / .knowledgebase / .convention / .feature / .common`
- DB: PostgreSQL 15 + pgvector, `knowledge_base` / `faq` / `convention` / `company` / `product` / `segment` / `test_case` 테이블 운영 중
- Frontend 라우팅: `/features/companies/:cid/products/:pid` 드릴다운 구축 완료
- 기존 API: `POST /api/test-cases/generate-draft` — 단일 Segment 경로 기반 AI 초안 생성 (이번 기능의 확장 기반)
- Spring AI Claude(`claude-3-5-sonnet-20241022`) + OpenAI Embedding(`text-embedding-3-small`, 1536 dims) 연동 완료

## Prerequisite

- `spring.ai.anthropic.api-key`, `spring.ai.openai.api-key` 가 `.env` / `application.yml`에 설정되어 있어야 한다
- `FEATURE_EMBEDDING_ENABLED=true` (RAG 컨텍스트 구축에 KB/TC 벡터 검색 사용)
- 대상 Product에 Segment 트리가 최소 1개 이상 존재해야 한다 (TC의 `path` 할당용)

## Goal

문서 → TestCase 초안의 End-to-End 파이프라인 완성 (Backend + Frontend + E2E 테스트).

**v1 범위:**
- ✅ Markdown 텍스트 직접 붙여넣기 입력
- ✅ MD / PDF 파일 업로드 입력
- ✅ 비동기 Job 기반 생성 (PDF Upload Pipeline 패턴 재사용)
- ✅ RAG 컨텍스트: Knowledge Base + Convention + 기존 TestCase (임베딩 유사도)
- ✅ 생성된 TC는 `status=DRAFT`로 저장 → 사용자가 TestCasePage에서 검토 후 ACTIVE 전환
- ✅ Job 상태 추적 + 실패 시 에러 메시지 노출

**v2+ 범위 (본 문서 제외):**
- ❌ Figma REST API 연동 (디자인 URL → 프레임/스크린 자동 추출)
- ❌ Notion API 연동 (페이지 URL → MD 자동 추출)
- ❌ PDF 이미지 / 스크린샷 멀티모달 해석
- ❌ Diff / 재생성 UI
- ❌ 생성된 TC에 Segment 자동 매핑 자동화(v1에서는 LLM 제안 + 사용자 확인)

---

## Database Design

### 신규 테이블

**Flyway 파일:** `V{YYYYMMDD}{HHmm}__create_test_studio_job.sql`

#### `test_studio_job`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | Job ID |
| product_id | BIGINT FK → product.id | 대상 Product (CASCADE) |
| source_type | VARCHAR(20) NOT NULL | MARKDOWN / PDF (v2: FIGMA_URL / NOTION_URL) |
| source_title | VARCHAR(200) NOT NULL | 사용자 입력 제목 (예: "v2.1 로그인 리뉴얼 PRD") |
| source_content | TEXT | MARKDOWN 타입일 때 원문 텍스트 |
| source_file_path | VARCHAR(500) | PDF 타입일 때 업로드된 파일 경로 |
| status | VARCHAR(20) NOT NULL DEFAULT 'PENDING' | PENDING / PROCESSING / DONE / FAILED |
| error_message | TEXT | 실패 시 원인 |
| generated_count | INT DEFAULT 0 | 생성된 DRAFT TC 수 |
| created_at | TIMESTAMP DEFAULT NOW() | Job 생성 시각 |
| completed_at | TIMESTAMP | 완료 시각 |

**Index:** `(product_id, created_at DESC)` — Product별 Job 목록 정렬

#### `test_case` 컬럼 추가 (선택)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| test_studio_job_id | BIGINT FK → test_studio_job.id NULL | DRAFT TC가 어느 Job에서 생성됐는지 추적 |

**목적:** Job 삭제 시 관련 DRAFT TC만 선택적으로 함께 삭제할 수 있도록 (기존 TC는 보존).
**Nullable:** 수동 작성 TC는 `NULL`.

### Enum

- **SourceType**: `MARKDOWN`, `PDF` (v2에서 `FIGMA_URL`, `NOTION_URL` 추가)
- **TestStudioJobStatus**: `PENDING`, `PROCESSING`, `DONE`, `FAILED`

### Critical Rules

- ❌ `test_studio_job` 삭제 시 관련 DRAFT TC 자동 삭제하지 않는다 (사용자가 이미 ACTIVE로 전환했을 수 있음)
- ✅ DRAFT TC는 `test_case.status=DRAFT` + `test_studio_job_id` 로 필터링 가능
- ✅ `knowledge_base`, `pdf_upload_job` 테이블 데이터는 절대 수정하지 않는다 (CLAUDE.md Critical Rules)

---

## Backend Implementation

### 패키지 구조

```
backend/src/main/java/com/myqaweb/teststudio/
├── TestStudioJobEntity.java
├── TestStudioJobRepository.java
├── TestStudioJobDto.java
├── SourceType.java                 # enum
├── TestStudioJobStatus.java        # enum
├── TestStudioService.java          # interface
├── TestStudioServiceImpl.java      # async orchestration
├── TestStudioGenerator.java        # RAG 컨텍스트 구성 + Claude 호출 + JSON 파싱
├── TestStudioController.java       # REST endpoints
└── DraftTestCaseDto.java           # Claude 응답 파싱용 record
```

### REST API

모든 응답은 `ApiResponse<T>` 래퍼를 사용한다.

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/test-studio/jobs` | Job 생성 (multipart: productId, sourceType, title, content?, file?) → jobId |
| GET | `/api/test-studio/jobs?productId={id}` | Product별 Job 목록 (최신순) |
| GET | `/api/test-studio/jobs/{id}` | Job 단건 조회 (상태 + 생성 결과 요약) |
| DELETE | `/api/test-studio/jobs/{id}` | Job 삭제 (DRAFT TC는 보존) |

### 생성 파이프라인 (TestStudioGenerator)

1. **Source 추출**
   - MARKDOWN: `source_content` 그대로 사용
   - PDF: Apache PDFBox로 텍스트 추출 (Knowledge Base PDF 파이프라인에서 이미 사용 중인 라이브러리 재사용)

2. **RAG 컨텍스트 구축** (임베딩 유사도 top-K 검색)
   - Knowledge Base: `knowledge_base.embedding` 기반 top-5 (도메인 지식)
   - Convention: 전체 `convention` 목록 (용어 수가 많지 않으므로 전량 포함)
   - Feature Registry: 대상 Product의 기존 `test_case` 중 유사도 top-5 (패턴 참조)

3. **Prompt 구성**
   ```
   [System]
   당신은 시니어 QA이다. 주어진 문서를 바탕으로 테스트 케이스를 JSON 배열로 생성한다.
   팀의 용어 컨벤션과 기존 TC 패턴을 반영하라.

   [Context]
   - Domain Knowledge (KB): {top-5 chunks}
   - Word Convention: {term: definition 목록}
   - Existing TC Patterns: {top-5 TC의 title / steps / expected_result}

   [Input Document]
   {source text}

   [Output Schema (JSON array)]
   [{ "title": string, "preconditions": string, "steps": [{order, action, expected}],
      "expectedResult": string, "priority": "HIGH|MEDIUM|LOW",
      "testType": "SMOKE|FUNCTIONAL|REGRESSION|E2E",
      "suggestedSegmentPath": string[] }]
   ```

4. **Claude 호출 + JSON 파싱**
   - Spring AI `ChatClient` 사용
   - 응답에서 JSON 블록 추출 → `List<DraftTestCaseDto>`로 역직렬화
   - 파싱 실패 시 `status=FAILED`, `error_message` 기록

5. **TC 저장 (DRAFT 상태)**
   - `suggestedSegmentPath`는 v1에서는 문자열 배열로 보존만 하고, `path`는 빈 배열(`{}`)로 저장 → 사용자가 Frontend에서 Segment 선택
   - `status=DRAFT`, `test_studio_job_id=jobId`
   - 저장 성공 수를 `generated_count`로 기록

6. **Job 완료** (`status=DONE`, `completed_at=NOW()`)

### 비동기 처리

- `TestStudioServiceImpl#submitJob` → Job row 저장 → `@Async`로 생성 파이프라인 실행
- `@EnableAsync` + 전용 `ThreadPoolTaskExecutor` (PDF 업로드 파이프라인과 동일 패턴)
- 실패 시 `status=FAILED` + 예외 메시지 기록

### 입력 검증

- `source_content` 최대 길이: 100,000자 (약 25K 토큰) — 초과 시 400
- PDF 파일 크기: 20MB 이하 (KB의 500MB보다 엄격, MVP 안정성 우선)
- `productId`는 존재해야 함 (404)

---

## Frontend Implementation

### 라우팅

드릴다운 규칙(CLAUDE.md Frontend 레이아웃 규칙)을 따라 Product 하위에 배치한다.

| URL | 페이지 |
|-----|--------|
| `/features/companies/:cid/products/:pid/test-studio` | `TestStudioPage` |

Breadcrumb: `Company › Product › Test Studio`

### 페이지 구성 (`TestStudioPage.tsx`)

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb: {Company} › {Product} › Test Studio          │
├──────────────────────────────────────────────────────────┤
│ [새 Job 생성]                                             │
│                                                          │
│  제목: [__________________________]                       │
│  소스 타입: ( ) Markdown  ( ) PDF 파일                     │
│  내용:                                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ (Markdown 선택 시 textarea)                        │  │
│  │ (PDF 선택 시 파일 업로드 버튼)                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                   [생성 요청] 버튼         │
├──────────────────────────────────────────────────────────┤
│ [Job 히스토리]                                            │
│                                                          │
│  📝 v2.1 로그인 리뉴얼 PRD    ✅ DONE   12개 생성         │
│      2026-04-17 15:30      [DRAFT TC 보기] [삭제]         │
│                                                          │
│  📄 결제 플로우 스펙.pdf      ⏳ PROCESSING               │
│      2026-04-17 16:10        (진행 중…)                   │
│                                                          │
│  📝 회원가입 폼 수정안        ❌ FAILED                   │
│      2026-04-17 14:00      JSON 파싱 실패                 │
└──────────────────────────────────────────────────────────┘
```

### 컴포넌트 구조

```
frontend/src/
├── pages/features/
│   └── TestStudioPage.tsx                  # 라우트 페이지
├── components/test-studio/
│   ├── TestStudioJobForm.tsx               # 새 Job 생성 폼
│   ├── TestStudioJobList.tsx               # Job 히스토리 리스트
│   └── TestStudioJobStatusBadge.tsx        # PENDING/PROCESSING/DONE/FAILED 배지
├── hooks/
│   └── useTestStudio.ts                    # Job 생성/조회/폴링 커스텀 훅
├── api/
│   └── test-studio.ts                      # API 모듈
└── types/
    └── test-studio.ts                      # TypeScript 인터페이스
```

### 핵심 UX

- **Job 생성**: 폼 제출 즉시 `jobId` 반환 → 하단 Job 리스트 상단에 `PENDING`으로 즉시 표시
- **폴링**: `PROCESSING` Job은 2초 간격으로 상태 재조회 (완료 시 폴링 중단)
- **결과 확인**: `DONE` Job의 "DRAFT TC 보기" 클릭 → TestCasePage로 이동하며 `?status=DRAFT&jobId={jobId}` 쿼리 파라미터로 필터
- **기존 TestCasePage 영향 최소화**: 필터 쿼리파라미터는 옵션. 미지정 시 기존 동작 유지.

### State 관리

- `ActiveCompanyContext`로 Company 컨텍스트 사용 (기존)
- Job 리스트는 페이지 로컬 state + polling
- Zustand 사용하지 않음 (v1 규모에서 불필요)

---

## 사용자 시나리오 (User Scenarios)

각 시나리오는 QA 실무자의 관점에서 Test Studio를 어떻게 사용하는지 서술한다. 구현·E2E 테스트·UX 결정의 공통 참조점이 된다.

### 시나리오 1: 신규 기능 PRD 붙여넣기 (Golden Path)

**상황**
- QA 김유진은 다음 스프린트에 추가될 "결제 단말기 NFC 결제" 기능의 PRD(Notion 페이지)를 PM에게 공유받았다.
- PRD 내용은 약 2,000자의 Markdown 텍스트이며, UX 흐름·예외 케이스·성공 조건이 기술되어 있다.
- 김유진은 회사: `my-atlas`, 제품: `결제 단말기`를 사용 중이다.

**흐름**
1. `/features` → `my-atlas` 선택 → `결제 단말기` 진입
2. 상단 메뉴에서 "Test Studio" 클릭 → `/features/companies/:cid/products/:pid/test-studio` 이동
3. "새 Job 생성" 폼:
   - 제목: `v2.1 NFC 결제 PRD`
   - 소스 타입: `Markdown` 선택
   - 내용: Notion에서 복사한 PRD 본문 붙여넣기
4. "생성 요청" 클릭
5. 하단 Job 히스토리 최상단에 `PENDING` 배지로 즉시 표시 → 수 초 내 `PROCESSING`
6. 약 20~40초 후 `DONE` 전환, `12개 생성` 카운트 표시
7. "DRAFT TC 보기" 버튼 클릭 → `/features/.../products/:pid?status=DRAFT&jobId=42` 이동
8. TestCasePage에 DRAFT TC 12개가 필터링되어 표시
9. 각 TC를 열어 검토 → Segment를 `결제 > NFC` 하위로 지정 → `status=ACTIVE` 저장

**기대 결과**
- 12개 TC 모두 `test_case.status=DRAFT`, `test_studio_job_id=42`로 저장
- 제목은 기존 TC 스타일(예: `[Card] NFC 결제 …`)을 따름
- 예외 케이스(카드 인식 실패, 중간 제거 등)가 최소 1건 포함

**검증 포인트 (E2E)**
- 폼 제출 → Job row 생성 (201)
- 폴링 2초 간격으로 상태 반영
- DONE 후 `GET /api/test-cases?productId={pid}&status=DRAFT&jobId=42` 응답에 12건 포함

---

### 시나리오 2: 디자인 스펙서 PDF 업로드

**상황**
- 디자이너가 Figma에서 "결제 실패 화면 리뉴얼" 디자인 스펙을 PDF로 export해서 전달.
- 6페이지, 각 페이지에 화면 이미지 + 설명 텍스트 포함.
- QA는 텍스트 위주로 TC를 뽑고 싶다 (이미지 멀티모달은 v2).

**흐름**
1. Test Studio 페이지에서 "새 Job 생성" 폼
2. 제목: `결제 실패 화면 리뉴얼 스펙`
3. 소스 타입: `PDF 파일` 선택 → 파일 선택 다이얼로그에서 PDF 업로드
4. "생성 요청" 클릭 → Job `PENDING`
5. Backend가 PDFBox로 텍스트 추출 → RAG → Claude 호출
6. `DONE` 전환, 7개 TC 생성

**기대 결과**
- PDF 텍스트 콘텐츠가 `source_content` 대신 `source_file_path`로 저장됨
- 생성된 TC에 "네트워크 오류", "결제 거부", "타임아웃" 같은 실패 시나리오가 포함

**검증 포인트 (E2E)**
- `multipart/form-data`로 파일 업로드 성공
- PDF 텍스트 추출 실패 시 `FAILED` 상태 + `error_message` 기록

---

### 시나리오 3: 생성 실패 처리 (FAILED)

**상황**
- QA 박지훈이 실수로 빈 제목 + 한 줄짜리 "로그인 버튼 만들기"만 붙여넣고 생성 요청.
- Claude가 충분한 컨텍스트 없이 의미 없는 응답을 반환 → JSON 파싱 실패 또는 빈 배열.

**흐름**
1. Job이 `PROCESSING` 후 `FAILED` 전환
2. Job 히스토리에 `❌ FAILED` 배지 + `error_message: JSON 배열 파싱 실패 — 생성된 TC 없음`
3. 박지훈은 Job을 삭제하고 더 자세한 내용으로 재시도

**기대 결과**
- `FAILED` 상태에서도 기존 DRAFT TC가 없으므로 DB는 깨끗
- `error_message` 필드로 원인이 Frontend에 노출됨

**검증 포인트 (E2E)**
- Claude Mock이 비정상 응답 반환 시 `FAILED` 기록
- 실패 Job 삭제 → 404 후속 조회

---

### 시나리오 4: 기존 TC 패턴 반영 확인

**상황**
- `결제 단말기` Product에는 이미 22개의 ACTIVE TC가 있다 (초기 시드 데이터).
- 기존 TC 제목 패턴: `[Card] IC카드 정상 결제`, `[Card] QR 결제 (토스페이)` 등 prefix `[Card]` 사용.
- QA 이서연이 새로운 카드 결제 기능 PRD를 붙여넣고 Job 생성.

**기대 결과**
- 생성된 DRAFT TC 제목에 prefix `[Card]`가 자동 포함 (RAG로 기존 top-5 TC가 프롬프트에 주입되어 LLM이 스타일을 모방)
- Steps 구조도 기존 TC의 `order / action / expected` 형식 유지

**검증 포인트 (Unit)**
- `TestStudioGeneratorTest`: RAG 컨텍스트에 기존 TC top-5가 포함되는지
- 프롬프트 렌더링 결과에 기존 TC 제목·Steps가 포함되는지

---

### 시나리오 5: Convention 용어 자동 반영

**상황**
- 디자이너가 스펙에서 "POS", "단말기", "카드 리더기"를 섞어 썼다.
- 팀의 Words Convention은 `"결제 단말기"`로 통일되어 있다 (`convention` 테이블에 등록됨).

**기대 결과**
- 생성된 DRAFT TC에서는 모두 `결제 단말기`로 표준화되어 표기됨
- 프롬프트의 `[Context] Word Convention` 섹션에 `POS → 결제 단말기` 같은 매핑이 포함되어 LLM이 치환 반영

**검증 포인트 (Unit)**
- `TestStudioGeneratorTest`: Convention 전체 목록이 프롬프트에 주입되는지
- (Integration) Convention이 없는 Product에서는 생성이 계속 동작하는지 (null safe)

---

### 시나리오 6: 문서 크기 초과 방지

**상황**
- QA가 150,000자짜리 PRD 전체를 통째로 붙여넣고 제출.
- v1 제약: `source_content` 최대 100,000자.

**기대 결과**
- Backend가 400 응답 + `message: "문서 길이가 100,000자를 초과했습니다"`
- Frontend 폼이 제출 전 length check로 사전 경고 (UX)

**검증 포인트 (E2E)**
- `POST /api/test-studio/jobs` with 100,001자 content → 400

---

### 시나리오 범위 밖 (v2 이후)

다음은 v1에서 **의도적으로 지원하지 않는** 시나리오이다. 사용자가 요청 시 "v2 예정" 안내만 한다.

- Figma URL 붙여넣기 → 프레임 자동 추출
- Notion 페이지 URL 연동
- PDF 내 이미지 스크린샷 해석 (멀티모달)
- 동일 문서 재투입 시 diff 기반 TC 업데이트
- Segment 자동 매핑 (v1은 문자열 제안 → 사용자 수동 선택)

---

## E2E 테스트 (`qa/`)

### API 테스트 (`qa/api/test-studio.spec.ts`)

| 시나리오 | 설명 |
|---------|------|
| POST /api/test-studio/jobs - MARKDOWN 생성 | `source_type=MARKDOWN` + content 포함 → 201 + jobId |
| POST /api/test-studio/jobs - PDF 업로드 | multipart 파일 → 201 + jobId |
| POST /api/test-studio/jobs - 필수값 누락 400 | productId / title 누락 시 400 |
| GET /api/test-studio/jobs - Product별 목록 | 생성 순 내림차순 확인 |
| GET /api/test-studio/jobs/{id} - 상태 조회 | status 필드 확인 |
| DELETE /api/test-studio/jobs/{id} | Job 삭제 후 404 확인 |
| DRAFT TC 생성 검증 | Job DONE 대기 후 `test_case?status=DRAFT` 에 결과 포함 확인 |

테스트 데이터 규칙 (`qa/CLAUDE.md`): 제목에 "E2E" 또는 "Test" 포함.

### UI 테스트 (`qa/ui/test-studio.spec.ts`)

| 시나리오 | 설명 |
|---------|------|
| 페이지 진입 + Breadcrumb 표시 | URL 직접 접근 |
| Markdown Job 생성 | 폼 입력 → "생성 요청" → Job 리스트에 추가 |
| Job 상태 배지 표시 | PENDING/PROCESSING/DONE/FAILED 색상 확인 |
| DRAFT TC 보기 이동 | DONE Job 클릭 → TestCasePage 이동 |

**셀렉터 규칙**: 실제 TSX 파일을 읽고 `data-testid` / className / 태그를 확인한 뒤 작성 (CLAUDE.md Agent-C 규칙).

### Unit 테스트 (Backend, `backend/src/test/java/com/myqaweb/teststudio/`)

| 클래스 | 커버리지 |
|--------|---------|
| `TestStudioServiceImplTest` | Job 생성 / 상태 전이 / 실패 처리 (Mock Repository + Mock Generator) |
| `TestStudioGeneratorTest` | RAG 컨텍스트 구성, Prompt 렌더링, JSON 파싱 성공/실패 (Mock ChatClient) |
| `TestStudioControllerTest` | `@WebMvcTest` — 요청 검증, 400/404 처리 |
| Integration (`TestStudioIntegrationTest`) | Testcontainers pgvector — Job 생성 → DRAFT TC 저장까지 (ChatClient는 Mock) |

---

## 구현 절차 (Doc-Driven Development Steps)

각 Step 완료 시 본 문서 상단 체크 표시(✅) 업데이트. **User 진행 지시 없이 다음 Step으로 진행하지 않는다.**

- [x] **Step 1**: Flyway 마이그레이션 `V202604171800__create_test_studio_job.sql` + `test_case.test_studio_job_id` FK 추가
- [x] **Step 2**: Backend — Entity / Repository / Enum / DTO (`com.myqaweb.teststudio`)
- [x] **Step 3**: Backend — `TestStudioGenerator` (RAG + Claude + JSON 파싱, @Async)
- [x] **Step 4**: Backend — `TestStudioService` + `TestStudioController` (POST/GET/DELETE 4개 엔드포인트)
- [x] **Step 5**: Frontend — `api/test-studio.ts`, `types/test-studio.ts`, `hooks/useTestStudio.ts` (2초 폴링)
- [x] **Step 6**: Frontend — `TestStudioPage` + Form / List / StatusBadge 컴포넌트 (드릴다운 레이아웃)
- [x] **Step 7**: `App.tsx` 라우트 등록 + TestCasePage `?status=DRAFT&jobId=` 필터 + "Test Studio" 네비게이션 링크
- [x] **Step 8**: Backend 테스트 — 35건 (Service 18 + Generator 7 + Controller 8 + Integration 2) 전부 통과
- [x] **Step 9**: E2E 테스트 — 14건 (API 9 + UI 5) 전부 통과
- [x] **Step 10**: Agent-D 검증 — 백엔드 472개 테스트 + Docker 스택 기동 + 전체 E2E 완주 + 컨테이너 정리 완료

---

## Notes

- **RAG 토큰 비용**: KB top-5 + Convention 전량 + TC top-5 로 컨텍스트를 제한한다. 문서가 길면 Claude 입력 토큰이 커지므로 `source_content` 100K자 제한으로 방어.
- **JSON 파싱 견고성**: Claude가 마크다운 코드블록(```json ... ```)로 감쌀 수 있으므로, 응답에서 JSON 배열만 추출하는 헬퍼 사용.
- **Segment 매핑**: v1은 `suggestedSegmentPath`를 문자열 배열로만 저장. 사용자가 TestCasePage에서 검토 시 수동으로 Segment 선택 → v2에서 이름 매칭으로 자동 매핑 추가.
- **실패 정책**: 일부 TC만 파싱 성공해도 성공분은 저장하고 Job은 DONE 처리. 전체 실패 시에만 FAILED.
- **OpenAI API 비용 보호**: 동일 `source_content`로 중복 Job 생성 방지는 v1 범위 외. 사용자 판단에 맡김.
- **권한**: v1은 인증 없음 (프로젝트 전체 정책 동일).

---

## 최종 요약

### 산출물

**Backend (`com.myqaweb.teststudio`) — 10개 파일**
- `SourceType.java`, `TestStudioJobStatus.java` (enum)
- `TestStudioJobEntity.java`, `TestStudioJobRepository.java`, `TestStudioJobDto.java`, `DraftTestCaseDto.java`
- `TestStudioService.java` (interface), `TestStudioServiceImpl.java`
- `TestStudioGenerator.java` (@Component @Async — RAG 컨텍스트 + Claude 호출 + JSON 파싱)
- `TestStudioController.java` (REST 4 endpoints)
- Flyway: `V202604171800__create_test_studio_job.sql` (신규 테이블 + `test_case.test_studio_job_id` FK, ON DELETE SET NULL)
- 기존 파일 수정: `TestCaseEntity.java` (컬럼 1개 추가), `TestCaseDto.java` (레코드 필드 1개 추가), `TestCaseServiceImpl.java` (toResponse 매핑 1줄)

**Frontend — 8개 파일**
- `types/test-studio.ts`, `api/test-studio.ts`, `hooks/useTestStudio.ts`
- `components/test-studio/TestStudioJobForm.tsx`, `TestStudioJobList.tsx`, `TestStudioJobStatusBadge.tsx`
- `pages/features/TestStudioPage.tsx`
- 기존 파일 수정: `App.tsx` (라우트), `TestCasePage.tsx` (DRAFT 필터 + 네비게이션 링크), `types/features.ts` (`testStudioJobId?` 추가)

**테스트 — 6개 신규 파일 (총 49건 테스트)**
- `backend/src/test/java/com/myqaweb/teststudio/` — 4개 클래스 · 35건
  - TestStudioServiceImplTest (18건: 입력 검증 + 비동기 위임 + DTO 매핑)
  - TestStudioGeneratorTest (7건: happy path, 마크다운 펜스 처리, 빈 배열/잘못된 JSON/예외 시 FAILED, RAG 컨텍스트 빌드 검증)
  - TestStudioControllerTest (8건: multipart POST/GET/DELETE + 400 경로)
  - TestStudioIntegrationTest (2건: Testcontainers pgvector — 엔드투엔드 DRAFT 생성, Job 삭제 시 DRAFT TC 보존)
- `qa/api/test-studio.spec.ts` — 9건 (생성 → 검증 실패 경로 4건 → 조회/삭제)
- `qa/ui/test-studio.spec.ts` — 5건 (폼 렌더링, Job 제출, 길이 제한, TC 페이지 네비게이션, 삭제 플로우)

### 검증 결과 (Agent-D)

| 항목 | 결과 |
|------|------|
| Backend `./gradlew clean build` | **472개 테스트 전부 통과** (Test Studio 35건 포함) |
| Docker 스택 기동 (Backend 8086 / Frontend 5179) | Backend 40s · Frontend 1s 이내 ready |
| Full E2E 스위트 실행 | test-studio 14/14 **모두 통과** |
| 기존 E2E | 기존 실패 3건(convention-image, kb-image, test-run UI)은 Test Studio와 무관한 선행 이슈 |
| 컨테이너 정리 | `docker compose down` OK (DB 볼륨 보존) |

### 구현 하이라이트

- **비동기 Job 패턴**: PDF 업로드 파이프라인의 `@Component + @Async` 분리 방식을 그대로 답습하여 Spring 프록시 정상 동작 보장
- **RAG 컨텍스트**: KB top-5(임베딩 유사도) + Convention 전량 + 제품의 기존 TC top-5 를 프롬프트에 주입 → 팀 컨벤션/도메인 지식/기존 스타일을 자동 반영
- **보수적 실패 정책**: JSON 파싱 실패/빈 배열 → `FAILED` + error_message. 일부 TC만 파싱 성공한 경우에도 `DONE` + `generated_count` 기록
- **비용 보호**: E2E는 Claude/OpenAI 호출이 필요한 테스트를 최소화(총 ~3건)하고, 나머지는 검증 실패 경로로 구성하여 API 비용을 통제
- **FK 보존 전략**: `test_case.test_studio_job_id` 는 `ON DELETE SET NULL` — Job을 삭제해도 이미 ACTIVE로 승격된 DRAFT TC는 보존됨
- **DRAFT 검토 UX**: TestCasePage 에서 `?status=DRAFT&jobId=…` 쿼리로 필터링되어 생성된 초안만 모아볼 수 있음. 필터 적용 시 상단에 배너 + "필터 해제" 링크 표시

### v2 이후 Roadmap (본 버전 제외)

- Figma REST API / Notion API 연동 (URL 투입 → 자동 추출)
- PDF 멀티모달 해석 (이미지/스크린샷)
- `suggestedSegmentPath` 문자열을 Segment ID 배열로 자동 매핑
- Diff 기반 재생성 (동일 문서 업데이트 시 변경분만 반영)
- 동일 `source_content` 중복 Job 감지 및 경고

## 버전 히스토리

| 버전 | 날짜 | 유형 | 요약 |
|------|------|------|------|
| v1 | 2026-04-17 | 기능 추가 | Test Studio 초기 구현: MD/PDF 입력 기반 DRAFT TC 자동 생성 파이프라인 |
