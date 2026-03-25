# Knowledge Base — 현재 구현 요약 (v0)

## 개요

Knowledge Base는 QA 지식을 관리하는 시스템이다. 수동 작성(직접 작성)과 PDF 도서 업로드 두 가지 방식으로 데이터를 등록하며, pgvector 임베딩을 통해 My Senior Chat의 RAG 파이프라인에 활용된다.

- **수동 작성**: 사용자가 직접 제목/내용/카테고리/태그를 입력하여 KB 항목 등록
- **PDF 업로드**: PDF 도서를 업로드하면 자동으로 텍스트 추출 → 챕터 파싱 → 청킹 → 임베딩 생성

```
Knowledge Base 데이터 흐름:

[직접 작성] → KB 항목 (source=null) → 비동기 임베딩 → pgvector 저장
[PDF 업로드] → 텍스트 추출 → 챕터 파싱 → 청킹 → 임베딩 → KB 항목 (source=책 제목)
                                                                ↓
                                          My Senior Chat RAG ← pgvector 코사인 유사도 검색
```

---

## URL 라우팅

| 메뉴 | 라우트 | 설명 |
|------|--------|------|
| Knowledge Base | `/kb` | LNB 독립 메뉴 (My Senior에서 분리) |

> My Senior는 Chat / FAQ 2뷰만 유지. KB 탭은 v0에서 제거됨.

---

## 데이터베이스 스키마

### knowledge_base 테이블

| 컬럼 | 타입 | 수동 작성 | PDF 청크 | 설명 |
|------|------|-----------|----------|------|
| id | BIGSERIAL PK | — | — | |
| title | VARCHAR(200) NOT NULL | 사용자 입력 | `{책 제목} - {챕터명} - {순번}` | |
| content | TEXT NOT NULL | 사용자 입력 | 청크 텍스트 | |
| category | VARCHAR(100) | 사용자 입력 | null | |
| tags | VARCHAR(500) | 사용자 입력 | null | |
| source | VARCHAR(200) | null | 책 제목 | PDF 구분 기준 |
| embedding | VECTOR(1536) | 비동기 생성 | 청크별 생성 | pgvector |
| created_at | TIMESTAMP | — | — | |
| updated_at | TIMESTAMP | — | — | |

### pdf_upload_job 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| book_title | VARCHAR(200) NOT NULL | 책 제목 |
| original_filename | VARCHAR(300) NOT NULL | 업로드 파일명 |
| status | VARCHAR(20) | PENDING / PROCESSING / DONE / FAILED |
| total_chunks | INT | 생성된 청크 수 |
| error_message | TEXT | 실패 시 에러 메시지 |
| created_at | TIMESTAMP | |
| completed_at | TIMESTAMP | |

### Flyway 마이그레이션

- `V4__create_senior_tables.sql` — knowledge_base 초기 스키마 (FAQ, Convention 포함)
- `V5__add_source_to_knowledge_base.sql` — source 컬럼 추가
- `V6__create_pdf_upload_job.sql` — pdf_upload_job 테이블 생성

### 벡터 인덱스

```sql
CREATE INDEX idx_kb_embedding ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## Backend API

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### KB CRUD (`/api/kb`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb` | 전체 KB 항목 조회 |
| GET | `/api/kb/{id}` | 단건 조회 |
| POST | `/api/kb` | 수동 항목 생성 (+ 비동기 임베딩) |
| PUT | `/api/kb/{id}` | 항목 수정 (+ 비동기 임베딩) |
| DELETE | `/api/kb/{id}` | 항목 삭제 |

### PDF 업로드 (`/api/kb`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/upload-pdf` | PDF 업로드 시작 (multipart: file, bookTitle) → jobId 반환 |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 (Polling용) |
| GET | `/api/kb/jobs` | 전체 Job 목록 |
| DELETE | `/api/kb/books/{source}` | 책 단위 전체 청크 + Job 삭제 |

---

## Backend 파일 구조

```
backend/src/main/java/com/myqaweb/knowledgebase/
├── KnowledgeBaseController.java   # KB CRUD + PDF 업로드 엔드포인트
├── KnowledgeBaseService.java      # KB CRUD 인터페이스
├── KnowledgeBaseServiceImpl.java  # KB CRUD 구현 (+ 비동기 임베딩 via virtual thread)
├── KnowledgeBaseEntity.java       # JPA 엔티티 (source 포함)
├── KnowledgeBaseRepository.java   # JpaRepository + pgvector findSimilar + source 쿼리
├── KnowledgeBaseDto.java          # KbRequest / KbResponse 레코드
├── PdfPipelineService.java        # PDF 파이프라인 인터페이스
├── PdfPipelineServiceImpl.java    # 파이프라인 오케스트레이션 (Job CRUD, Worker 위임)
├── PdfProcessingWorker.java       # @Async 비동기 PDF 처리 (파싱, 청킹, 임베딩)
├── PdfUploadJobEntity.java        # Job 엔티티
├── PdfUploadJobRepository.java    # Job 리포지토리
└── PdfUploadJobDto.java           # JobResponse 레코드
```

---

## Frontend 파일 구조

```
frontend/src/
├── pages/
│   └── KnowledgeBasePage.tsx       # KB 메인 페이지 (소스 필터 탭 + 카드 목록)
├── components/kb/
│   ├── PdfUploadModal.tsx          # PDF 업로드 모달 (제목 입력 + 파일 선택 + 진행 상태)
│   └── PdfJobStatusCard.tsx        # Job 상태 카드 (PENDING/PROCESSING/DONE/FAILED)
├── components/senior/
│   ├── KbFormModal.tsx             # KB 수동 작성/수정 모달 (재사용)
│   └── KbManagementView.tsx        # (기존, My Senior에서 사용 → KB 페이지로 기능 이전)
├── hooks/
│   ├── useKnowledgeBase.ts         # KB 상태 + CRUD + 소스 필터링
│   └── usePdfUpload.ts             # PDF 업로드 + 3초 polling
├── api/
│   └── senior.ts                   # kbApi (CRUD + PDF 4개 메서드)
└── types/
    └── senior.ts                   # KbItem, KbRequest, PdfUploadJob 인터페이스
```

---

## 핵심 기능

### 1. 수동 작성 CRUD

- `[+ 직접 작성]` 버튼 → KbFormModal 오픈
- 제목, 내용 (필수), 카테고리, 태그 (쉼표 구분) 입력
- 저장 시 KB 항목 생성 + virtual thread로 비동기 임베딩 생성
- `[직접 작성]` 뱃지 (초록색) 표시, Edit/Delete 가능

### 2. PDF 업로드 파이프라인

```
사용자: [PDF 업로드] 클릭 → 책 제목 입력 + PDF 선택 → 업로드
    ↓
Backend: Job 생성 (PENDING) → jobId 즉시 반환
    ↓
@Async Worker: PROCESSING 상태 전환
    1. PDFBox로 텍스트 추출
    2. 챕터/섹션 헤더 파싱 (정규식: 제N장, Chapter N, Part N 등)
    3. 500~800 토큰 단위 청킹 (50 토큰 overlap)
    4. 청크별 title: "{책 제목} - {챕터명} - {3자리 순번}"
    5. 청크별 임베딩 생성 (200ms sleep + 429 시 5초 retry)
    6. knowledge_base에 INSERT (source = 책 제목)
    ↓
완료: DONE + totalChunks 기록 / 실패: FAILED + errorMessage
    ↓
Frontend: 3초 polling으로 상태 감지 → 목록 자동 갱신
```

- `[도서]` 뱃지 (보라색) 표시, source명 표시
- 수정 불가 (읽기 전용), 삭제는 책 단위로만 가능

### 3. 소스 필터 탭

| 탭 | 조건 | 설명 |
|----|------|------|
| 전체 (N) | 모든 항목 | 기본 |
| 직접 작성 (N) | source IS NULL | 수동 작성 항목만 |
| PDF 도서 (N) | source IS NOT NULL | PDF 청크만 |

### 4. RAG 연동

My Senior Chat에서 사용자 질문 시 `KnowledgeBaseRepository.findSimilar()` 로 pgvector 코사인 유사도 검색하여 컨텍스트로 활용.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| PDF 파싱 | Apache PDFBox 3.0.1 |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| 벡터 검색 | pgvector (PostgreSQL 15) + IVFFlat 코사인 유사도 |
| 비동기 처리 | Spring @Async (PdfProcessingWorker 별도 빈) |
| 수동 임베딩 | Java 21 Virtual Thread |
| Rate Limit | 청크 간 200ms sleep, 429 시 5초 retry 최대 3회 |
| Polling | Frontend setInterval 3초 |

---

## 테스트

### Backend 단위 테스트

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `KnowledgeBaseServiceImplTest.java` | KB CRUD | findAll, findById, create, update, delete, response 매핑 |
| `PdfPipelineServiceImplTest.java` | 파이프라인 | getJob, getAllJobs, deleteBook, response 매핑 |
| `PdfProcessingWorkerTest.java` | Worker 로직 | parseSections (챕터 감지, fallback), chunkText (분할, 단일) |

---

## 버전 히스토리

| 버전 | 유형 | 주요 변경 | 문서 |
|------|------|----------|------|
| v0 | 기능 추가 | LNB 독립 메뉴 분리 + PDF 업로드 파이프라인 | `knowledge-base_v0.md` |
| v0.1 | 버그 수정 | @Async self-invocation 수정 + Rate Limit 대응 | `knowledge-base_v0.1.md` |

### 환경 개선 (ops)

| 버전 | 주요 변경 | 문서 |
|------|----------|------|
| upload-size-limit v1 | multipart 50MB → 500MB | `docs/ops/upload-size-limit_v1.md` |
| log-file-output v1 | backend.log 파일 자동 저장 | `docs/ops/log-file-output_v1.md` |
