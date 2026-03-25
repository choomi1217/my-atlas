# Knowledge Base — 기능 명세 (v0)

---

## 1. 개요

1. Knowledge Base(이하 KB)를 My Senior 탭 내부에서 분리하여 LNB 독립 메뉴로 승격한다.
2. 또한 PDF 파일을 업로드하면 자동으로 청킹·임베딩하여 RAG에 활용할 수 있는 파이프라인을 추가한다.

---

## 2. 변경 범위 요약

| 구분 | 변경 내용 |
|------|-----------|
| My Senior | KB 버튼 제거 |
| KB 화면 | 수동 작성 CRUD + PDF 업로드 기능 통합 |
| DB | `knowledge_base` 테이블에 `source` 컬럼 추가 |
| DB | `pdf_upload_job` 테이블 신규 생성 |
| Backend | PDF 파싱·청킹·임베딩 파이프라인 추가 |
| CLAUDE.md | KB 데이터 보존 경고 등록 |

---

## 3. Topic 1 — LNB 독립 메뉴 분리

### 3-1. LNB 라우팅 변경

| 메뉴 | 라우트 | 변경 구분 |
|------|--------|-----------|
| My Senior | `/senior` | 유지 |
| **Knowledge Base** | `/kb` | **LNB에 항목 추가** |
| Words Conventions | `/conventions` | 유지 |
| Product Test Suite | `/features` | 유지 |

### 3-2. My Senior에서 제거되는 항목

- `KbManagementView.tsx` — KB 목록 서브뷰 제거
- `KbFormModal.tsx` — KB 생성/수정 모달 (KB 페이지로 이동)
- `useKnowledgeBase.ts` — hook을 `/kb` 페이지로 이동
- `SeniorTabBar.tsx` — "KB Management" 탭 제거, Chat / FAQ 2탭으로 축소

> My Senior의 RAG 파이프라인은 변경 없음. KB 데이터를 참조하는 로직은 그대로 유지되며,
> 단지 KB를 관리하는 UI 진입점이 My Senior에서 독립 메뉴로 이동하는 것이다.

### 3-3. KB 페이지 구성 (`/kb`)

```
┌─────────────────────────────────────────┐
│  Knowledge Base              [+ 직접 작성] [PDF 업로드] │  ← Header
├─────────────────────────────────────────┤
│  전체 (32)   직접 작성 (18)   PDF 도서 (14)           │  ← 소스 필터 탭
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ [도서] 소프트웨어 테스팅          │   │
│  │ source: 소프트웨어 테스팅         │   │
│  │ 3장. 경계값 분석 - 001           │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ [직접 작성] QA 온보딩 체크리스트  │   │
│  │ category: 프로세스 / tags: #온보딩 │  │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- source가 있는 항목: `[도서]` 뱃지 + source명 표시, 수정 불가(읽기 전용), 삭제는 책 단위로만 가능
- source가 null인 항목: `[직접 작성]` 뱃지, 수정/삭제 가능

---

## 4. Topic 2 — PDF 업로드 파이프라인

### 4-1. DB 스키마 변경

#### knowledge_base 테이블 — `source` 컬럼 추가

```sql
-- Flyway: V5__add_source_to_knowledge_base.sql
ALTER TABLE knowledge_base
  ADD COLUMN source VARCHAR(200) DEFAULT NULL;

COMMENT ON COLUMN knowledge_base.source IS
  'PDF 업로드로 생성된 청크의 경우 책 제목을 저장. 수동 작성 항목은 NULL.';
```

| 컬럼 | 타입 | 수동 작성 | PDF 청크 |
|------|------|-----------|----------|
| id | BIGSERIAL PK | — | — |
| title | VARCHAR(200) | 사용자 입력 | `"{책 제목} - {챕터명} - {순번}"` |
| content | TEXT | 사용자 입력 | 청크 텍스트 |
| category | VARCHAR(100) | 사용자 입력 | null |
| tags | VARCHAR(500) | 사용자 입력 | null |
| embedding | VECTOR(1536) | 자동 생성 | 청크별 자동 생성 |
| created_at | TIMESTAMP | — | — |
| updated_at | TIMESTAMP | — | — |
| **source** | **VARCHAR(200)** | **null** | **책 제목** |

#### title 생성 규칙 (PDF 청크)

```
{책 제목} - {챕터/섹션명} - {3자리 순번}

예시)
소프트웨어 테스팅 - 3장. 경계값 분석 - 001
소프트웨어 테스팅 - 3장. 경계값 분석 - 002
소프트웨어 테스팅 - 4장. 동등 분할 - 001
```

- 챕터/섹션명 파싱 불가 시: `{책 제목} - chunk - {순번}` 으로 fallback
- 동일 챕터명 내 순번은 1부터 시작하여 독립적으로 부여

#### pdf_upload_job 테이블 — 신규 생성

```sql
-- Flyway: V6__create_pdf_upload_job.sql
CREATE TABLE pdf_upload_job (
    id                BIGSERIAL PRIMARY KEY,
    book_title        VARCHAR(200) NOT NULL,
    original_filename VARCHAR(300) NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
                      -- PENDING / PROCESSING / DONE / FAILED
    total_chunks      INT          DEFAULT NULL,
    error_message     TEXT         DEFAULT NULL,
    created_at        TIMESTAMP    DEFAULT NOW(),
    completed_at      TIMESTAMP    DEFAULT NULL
);
```

### 4-2. 청킹 전략

| 항목 | 값 | 비고 |
|------|-----|------|
| 청크 크기 | 500~800 토큰 | 문장 단위로 자르되 최대치 초과 시 분할 |
| Overlap | 50 토큰 | 청크 경계에서 문맥 유지 |
| 예상 청크 수 | 400~600개 / 300p | 책 밀도에 따라 차이 있음 |
| RAG 검색 시 Top-K | 5 | 기존 수동 KB Top-3에서 상향 (책 포함 시) |

### 4-3. Backend 설계

#### 파일 구조 추가/변경

```
backend/src/main/java/com/myqaweb/knowledgebase/
├── (기존 파일 유지)
├── PdfUploadJobEntity.java        # 신규
├── PdfUploadJobRepository.java    # 신규
├── PdfUploadJobDto.java           # 신규 — JobResponse(id, status, bookTitle, totalChunks, errorMessage, createdAt, completedAt)
├── PdfPipelineService.java        # 신규 — 인터페이스
└── PdfPipelineServiceImpl.java    # 신규 — 파싱·청킹·임베딩 @Async 처리
```

#### 의존성 추가 (`build.gradle`)

```groovy
implementation 'org.apache.pdfbox:pdfbox:3.0.1'
```

#### PdfPipelineServiceImpl 처리 흐름

```
1. pdf_upload_job 생성 (status = PENDING)
2. jobId 즉시 반환 (Controller에서 응답)
3. @Async 비동기 시작 (status = PROCESSING)
   a. PDFBox로 텍스트 추출
   b. 챕터/섹션 헤더 파싱 (정규식 기반, 실패 시 fallback)
   c. 500~800 토큰 단위 청킹 (50 토큰 overlap)
   d. 청크별 title 생성 (규칙 4-1 적용)
   e. 청크별 임베딩 생성 (OpenAI text-embedding-3-small)
   f. knowledge_base 테이블에 일괄 INSERT (source = book_title)
4. 완료: status = DONE, total_chunks 기록, completed_at 기록
5. 실패: status = FAILED, error_message 기록
```

#### REST API 추가

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/upload-pdf` | PDF 업로드 (multipart/form-data: file, bookTitle) → jobId 반환 |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 (Polling용) |
| GET | `/api/kb/jobs` | 전체 Job 목록 조회 |
| DELETE | `/api/kb/books/{source}` | 특정 책의 전체 청크 일괄 삭제 |

> 기존 `/api/kb` CRUD 엔드포인트는 변경 없이 유지.
> `DELETE /api/kb/books/{source}` 는 `knowledge_base` 테이블에서 `source = :source` 인 row를 전체 삭제하고, 연관 `pdf_upload_job`도 함께 삭제한다.

### 4-4. Frontend 설계

#### 신규/변경 컴포넌트

| 컴포넌트 | 변경 구분 | 설명 |
|----------|-----------|------|
| `KnowledgeBasePage.tsx` | 수정 | 소스 필터 탭 + PDF 업로드 버튼 추가 |
| `PdfUploadModal.tsx` | 신규 | 책 제목 입력 + 파일 선택 + 업로드 진행 상태 |
| `PdfJobStatusCard.tsx` | 신규 | PENDING / PROCESSING / DONE / FAILED 상태 표시 |
| `KbItemCard.tsx` | 수정 | source 유무에 따라 [도서] / [직접 작성] 뱃지, 수정/삭제 버튼 조건부 표시 |

#### Polling 전략

```typescript
// PdfUploadModal or usePdfUpload hook
const pollJob = async (jobId: number) => {
  const interval = setInterval(async () => {
    const job = await kbApi.getJob(jobId);
    if (job.status === 'DONE') {
      clearInterval(interval);
      refetchKbList();       // KB 목록 자동 갱신
      showToast('업로드 완료');
    } else if (job.status === 'FAILED') {
      clearInterval(interval);
      showToast(`업로드 실패: ${job.errorMessage}`, 'error');
    }
  }, 3000); // 3초 간격
};
```

- PROCESSING 상태: Progress bar indeterminate 애니메이션 표시
- 완료 후: `total_chunks`개 청크 생성 완료 메시지 표시

---

## 5. 데이터 보존 주의사항 (CLAUDE.md 등록)

PDF 업로드를 통해 생성된 KB 데이터는 대용량이며 재생성 비용(시간 + OpenAI API 비용)이 크다.
아래 내용을 `CLAUDE.md` 또는 프로젝트 루트 `README.md`의 주의사항 섹션에 반드시 등록한다.

```markdown
## ⚠️ 데이터베이스 초기화 금지

### knowledge_base 테이블
이 테이블에는 PDF 도서를 청킹·임베딩하여 저장한 데이터가 포함되어 있다.
source IS NOT NULL 인 row는 PDF 업로드 파이프라인으로 생성된 청크이며,
재생성 시 OpenAI Embedding API 호출 비용과 수 분의 처리 시간이 발생한다.

**절대로 `TRUNCATE` 또는 `DROP` 하지 말 것.**
개발 중 데이터 초기화가 필요한 경우 아래 쿼리로 수동 작성 항목만 삭제할 것:

  DELETE FROM knowledge_base WHERE source IS NULL;

특정 도서를 제거해야 할 경우:

  DELETE FROM knowledge_base WHERE source = '책 제목';
  DELETE FROM pdf_upload_job WHERE book_title = '책 제목';

### pdf_upload_job 테이블
업로드 이력 및 처리 상태를 관리한다. knowledge_base와 함께 보존할 것.
```

---

## 6. Flyway 마이그레이션 순서

| 파일명 | 내용 |
|--------|------|
| `V5__add_source_to_knowledge_base.sql` | `knowledge_base.source` 컬럼 추가 |
| `V6__create_pdf_upload_job.sql` | `pdf_upload_job` 테이블 생성 |

---

## 7. 구현 순서

| Phase | 작업 | 파일 |
|-------|------|------|
| 1 | Flyway V5, V6 마이그레이션 작성 | `V5__...sql`, `V6__...sql` |
| 2 | PdfUploadJobEntity / Repository / Dto | 신규 3개 파일 |
| 3 | PdfPipelineServiceImpl (@Async 파이프라인) | `PdfPipelineServiceImpl.java` |
| 4 | KnowledgeBaseController에 PDF 관련 엔드포인트 추가 | `KnowledgeBaseController.java` |
| 5 | LNB에 KB 메뉴 항목 추가 | `Sidebar.tsx` 또는 `LNB.tsx` |
| 6 | My Senior에서 KB 서브뷰 제거, 탭 2개로 축소 | `SeniorTabBar.tsx`, `SeniorPage.tsx` |
| 7 | KnowledgeBasePage 소스 필터 탭 + 카드 뱃지 추가 | `KnowledgeBasePage.tsx`, `KbItemCard.tsx` |
| 8 | PdfUploadModal + Polling 로직 | `PdfUploadModal.tsx`, `usePdfUpload.ts` |
| 9 | PdfJobStatusCard | `PdfJobStatusCard.tsx` |
| 10 | CLAUDE.md 주의사항 등록 | `CLAUDE.md` |

---

## 8. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | LNB에서 Knowledge Base 클릭 | `/kb` 페이지 진입, 독립 화면 노출 |
| 2 | My Senior 진입 | KB 탭 없음. Chat / FAQ 2탭만 존재 |
| 3 | KB 페이지 — [직접 작성] 클릭 | 기존 폼 모달 오픈, 저장 시 [직접 작성] 뱃지로 목록에 노출 |
| 4 | KB 페이지 — [PDF 업로드] 클릭 | 책 제목 입력 + 파일 선택 모달 오픈 |
| 5 | PDF 업로드 시작 | jobId 반환, PROCESSING 상태 카드 노출, Progress bar 표시 |
| 6 | 업로드 완료 | DONE 상태로 전환, KB 목록에 [도서] 뱃지 청크 자동 노출 |
| 7 | 업로드 실패 | FAILED 상태 + error_message 표시 |
| 8 | 소스 필터 탭 — "PDF 도서" 선택 | source IS NOT NULL 항목만 표시 |
| 9 | [도서] 뱃지 항목 | 수정 버튼 없음, 삭제는 책 단위로만 가능 |
| 10 | 책 단위 삭제 | 해당 source의 전체 청크 삭제, pdf_upload_job도 함께 삭제 |
| 11 | Chat에서 질문 | PDF 청크 내용이 RAG 답변에 반영되는지 확인 |
| 12 | DB 조회 | `SELECT source, COUNT(*) FROM knowledge_base GROUP BY source` 로 청크 수 확인 |