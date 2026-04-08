# Knowledge Base — 현재 구현 요약 (v2)

## 개요

Knowledge Base는 QA 지식을 관리하는 시스템이다. **블로그형 Markdown 에디터**로 글을 작성하고, PDF 도서를 업로드하여 RAG 파이프라인에 활용한다. 수동 작성 글은 My Senior Chat에서 **PDF보다 우선** 검색된다.

- **수동 작성**: Markdown WYSIWYG 에디터로 글 작성 (이미지 첨부 가능)
- **PDF 업로드**: PDF 도서 업로드 → 자동 텍스트 추출 → 챕터 파싱 → 청킹 → 임베딩 생성
- **RAG 우선순위**: 수동 작성 3개(우선) + PDF 2개(보충) = 최대 5개

```
Knowledge Base 데이터 흐름:

[Markdown 에디터] → KB 항목 (source=null) → stripMarkdown → 비동기 임베딩 → pgvector 저장
[이미지 첨부]     → POST /api/kb/images → ![image](url) 에디터 삽입
[PDF 업로드]      → 텍스트 추출 → 챕터 파싱 → 청킹 → 임베딩 → KB 항목 (source=책 제목)
                                                                  ↓
                                    My Senior Chat RAG ← 2단계 pgvector 코사인 유사도 검색
                                                         (수동 3개 우선 + PDF 2개 보충)
```

---

## URL 라우팅

| 라우트 | 컴포넌트 | 설명 |
|--------|----------|------|
| `/kb` | `KnowledgeBasePage` | KB 목록 (소스 필터 탭 + 카드 목록) |
| `/kb/write` | `KbWritePage` | 새 글 작성 (Markdown 에디터) |
| `/kb/:id` | `KbDetailPage` | 글 상세 보기 (Markdown 렌더링) |
| `/kb/edit/:id` | `KbEditPage` | 글 수정 (Markdown 에디터) |

> My Senior는 Chat / FAQ 2뷰만 유지. KB는 `/kb` 독립 메뉴.

---

## 데이터베이스 스키마

### knowledge_base 테이블

| 컬럼 | 타입 | 수동 작성 | PDF 청크 | 설명 |
|------|------|-----------|----------|------|
| id | BIGSERIAL PK | — | — | |
| title | VARCHAR(200) NOT NULL | 사용자 입력 | `{책 제목} - {챕터명} - {순번}` | |
| content | TEXT NOT NULL | Markdown 원본 저장 | 청크 텍스트 | |
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

| 파일 | 내용 |
|------|------|
| `V4__create_senior_tables.sql` | knowledge_base 초기 스키마 |
| `V5__add_source_to_knowledge_base.sql` | source 컬럼 추가 |
| `V6__create_pdf_upload_job.sql` | pdf_upload_job 테이블 생성 |

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
| POST | `/api/kb` | 수동 항목 생성 (Markdown 원본 저장 + 비동기 임베딩) |
| PUT | `/api/kb/{id}` | 항목 수정 (+ 비동기 임베딩) |
| DELETE | `/api/kb/{id}` | 항목 삭제 |

### PDF 업로드 (`/api/kb`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/upload-pdf` | PDF 업로드 시작 (multipart: file, bookTitle) → jobId 반환 |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 (Polling용) |
| GET | `/api/kb/jobs` | 전체 Job 목록 |
| DELETE | `/api/kb/books/{source}` | 책 단위 전체 청크 + Job 삭제 |

### 이미지 업로드 (`/api/kb/images`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/images` | 이미지 업로드 (multipart: file) → URL 반환 |
| GET | `/api/kb/images/{filename}` | 이미지 서빙 |

- 허용 확장자: png, jpg, jpeg, gif, webp
- 최대 크기: 10MB
- 저장 경로: `kb-images/` (UUID 파일명, `.gitignore` 등록)

---

## Backend 파일 구조

```
backend/src/main/java/com/myqaweb/knowledgebase/
├── KnowledgeBaseController.java   # KB CRUD + PDF 업로드 엔드포인트
├── KbImageController.java         # 이미지 업로드/서빙 엔드포인트
├── KnowledgeBaseService.java      # KB CRUD 인터페이스
├── KnowledgeBaseServiceImpl.java  # KB CRUD 구현 (+ stripMarkdown + 비동기 임베딩)
├── KnowledgeBaseEntity.java       # JPA 엔티티 (embedding은 @Transient)
├── KnowledgeBaseRepository.java   # JpaRepository + findSimilar/Manual/Pdf + updateEmbedding
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
│   ├── KnowledgeBasePage.tsx       # KB 목록 (소스 필터 탭 + Markdown 미리보기 카드)
│   ├── KbWritePage.tsx             # 새 글 작성 (Markdown 에디터 + 이미지 첨부)
│   ├── KbDetailPage.tsx            # 글 상세 보기 (Markdown 렌더링)
│   └── KbEditPage.tsx              # 글 수정 (Markdown 에디터 + 이미지 첨부)
├── components/kb/
│   ├── PdfUploadModal.tsx          # PDF 업로드 모달 (제목 입력 + 파일 선택 + 진행 상태)
│   └── PdfJobStatusCard.tsx        # Job 상태 카드
├── components/senior/
│   └── KbFormModal.tsx             # (레거시, v2에서 사용 제거됨 — KbWritePage로 대체)
├── hooks/
│   ├── useKnowledgeBase.ts         # KB 상태 + CRUD + 소스 필터링
│   ├── usePdfUpload.ts             # PDF 업로드 + 3초 polling
│   └── useImageUpload.ts           # 이미지 업로드 (POST → URL 반환)
├── api/
│   └── senior.ts                   # kbApi (CRUD 5개 + PDF 3개 + deleteBook + uploadImage)
└── types/
    └── senior.ts                   # KbItem, KbRequest, PdfUploadJob 인터페이스
```

---

## 핵심 기능

### 1. Markdown 에디터 (v2)

- **라이브러리**: `@uiw/react-md-editor` (WYSIWYG + 라이브 미리보기)
- **글 작성 흐름**: `/kb` → `[+ 직접 작성]` → `/kb/write` → 저장 → `/kb/:id` 상세 보기
- **글 수정 흐름**: `/kb/:id` → `[수정]` → `/kb/edit/:id` → 저장 → `/kb/:id`
- **이미지 첨부**: 버튼 클릭 / 붙여넣기 / 드래그 → `POST /api/kb/images` → `![image](url)` 삽입
- **Markdown 렌더링**: `MDEditor.Markdown` 컴포넌트로 상세 페이지에서 렌더링

### 2. 수동 작성 CRUD

- 제목, 내용(Markdown), 카테고리, 태그(쉼표 구분) 입력
- 저장 시 KB 항목 생성 + virtual thread로 비동기 임베딩 생성
- **임베딩 시 `stripMarkdown()` 적용**: Markdown 문법 제거 후 plain text로 임베딩
- `[직접 작성]` 뱃지 (초록색) 표시, Edit/Delete 가능
- content에는 **Markdown 원본이 그대로 DB에 저장**됨

### 3. PDF 업로드 파이프라인

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
    6. knowledge_base에 INSERT (source = 책 제목) + updateEmbedding()
    ↓
완료: DONE + totalChunks 기록 / 실패: FAILED + errorMessage
    ↓
Frontend: 3초 polling으로 상태 감지 → 목록 자동 갱신
```

- `[도서]` 뱃지 (보라색) 표시, source명 표시
- 수정 불가 (읽기 전용), 삭제는 책 단위로만 가능

### 4. 소스 필터 탭

| 탭 | 조건 | 설명 |
|----|------|------|
| 전체 (N) | 모든 항목 | 기본 |
| 직접 작성 (N) | source IS NULL | 수동 작성 항목만 |
| PDF 도서 (N) | source IS NOT NULL | PDF 청크만 |

### 5. 카드 Markdown 미리보기

- 목록 카드에서 content → `stripMarkdown()` → 150자 truncate
- Markdown 기호(`#`, `**`, `![](...)` 등) 없이 plain text로 표시
- 카드 클릭 시 `/kb/:id` 상세 페이지로 이동

### 6. RAG 연동 (2단계 검색)

My Senior Chat에서 사용자 질문 시:

```
Step 1: embeddingService.embed(userMessage) → queryVector 생성
Step 2: findSimilarManual(queryVector, 3) → 수동 작성 KB 상위 3개 (우선)
Step 3: findSimilarPdf(queryVector, 2)    → PDF 청크 상위 2개 (보충)
Step 4: 프롬프트에 구분하여 포함:
        "=== QA Knowledge Base (직접 작성, 우선 참고) ===\n..."
        "=== QA Knowledge Base (도서 참고) ===\n..."
```

---

## pgvector + Hibernate 아키텍처 (중요)

### 문제

Hibernate가 pgvector `VECTOR(1536)` 타입을 PostgreSQL 배열(`PgArray`)로 읽으려 하여 `PSQLException: No results were returned by the query` 발생.

### 해결 (v2)

**embedding 필드를 `@Transient`로 선언하여 Hibernate가 매핑하지 않도록 하고, 임베딩 읽기/쓰기는 네이티브 쿼리로만 처리.**

```java
// Entity — Hibernate가 이 컬럼을 매핑하지 않음
@Transient
private float[] embedding;

// Repository — 임베딩 업데이트는 네이티브 쿼리
@Modifying
@Query(value = "UPDATE knowledge_base SET embedding = cast(:embedding as vector) WHERE id = :id",
        nativeQuery = true)
void updateEmbedding(@Param("id") Long id, @Param("embedding") String embedding);

// Repository — 임베딩 검색도 네이티브 쿼리
@Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NULL "
        + "ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
        nativeQuery = true)
List<KnowledgeBaseEntity> findSimilarManual(...);
```

**서비스에서의 임베딩 생성 패턴:**
```java
// 1. 엔티티 저장 (embedding 없이)
KnowledgeBaseEntity saved = repository.save(entity);

// 2. 비동기로 임베딩 생성 후 네이티브 쿼리로 업데이트
Thread.startVirtualThread(() -> {
    String text = title + " " + stripMarkdown(content);
    float[] embedding = embeddingService.embed(text);
    String vectorStr = embeddingService.toVectorString(embedding);
    repository.updateEmbedding(saved.getId(), vectorStr);
});
```

> **주의**: `entity.setEmbedding()` + `save()` 패턴은 절대 사용 불가. 반드시 `updateEmbedding()` 네이티브 쿼리 사용.
> FaqEntity도 동일 구조 (`@Transient` + `faqRepository.updateEmbedding()`).

---

## Markdown 스트리핑 (임베딩 품질)

수동 작성 KB는 Markdown으로 저장되므로, 임베딩 생성 시 Markdown 문법을 제거하여 품질을 높인다.

```java
// KnowledgeBaseServiceImpl.stripMarkdown() — 정규식 기반
static String stripMarkdown(String md) {
    return md
        .replaceAll("```[\\s\\S]*?```", " ")           // fenced code blocks
        .replaceAll("`[^`]*`", " ")                     // inline code
        .replaceAll("!\\[([^]]*)]\\([^)]*\\)", "$1")   // images → alt text
        .replaceAll("\\[([^]]*)]\\([^)]*\\)", "$1")     // links → text
        .replaceAll("^#{1,6}\\s+", "")                  // headings
        .replaceAll("(\\*{1,3}|_{1,3})", "")            // bold/italic
        // ... blockquotes, lists, horizontal rules, strikethrough
        .trim();
}
```

- **DB에는 Markdown 원본**이 저장됨 (content 컬럼)
- **임베딩에는 stripped text** 사용 (title + stripMarkdown(content))
- Frontend 카드 미리보기에서도 동일 로직으로 plain text 표시

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Markdown 에디터 | @uiw/react-md-editor (WYSIWYG + 라이브 미리보기) |
| PDF 파싱 | Apache PDFBox 3.0.1 |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| 벡터 검색 | pgvector (PostgreSQL 15) + IVFFlat 코사인 유사도 |
| 비동기 처리 | Spring @Async (PdfProcessingWorker), Java 21 Virtual Thread (KB/FAQ 임베딩) |
| 이미지 저장 | 로컬 디스크 (`kb-images/`, UUID 파일명) |
| Rate Limit | 청크 간 200ms sleep, 429 시 5초 retry 최대 3회 |
| Polling | Frontend setInterval 3초 (PDF 업로드 상태) |

---

## 테스트

### Backend 단위 테스트

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `KnowledgeBaseServiceImplTest.java` | KB CRUD + stripMarkdown | findAll, findById, create, update, delete, stripMarkdown 13가지 케이스 |
| `KnowledgeBaseControllerTest.java` | KB 컨트롤러 | CRUD 엔드포인트 + PDF 엔드포인트 + 유효성 검증 |
| `KbImageControllerTest.java` | 이미지 컨트롤러 | 업로드 (성공/빈파일/잘못된 확장자/크기 초과) + 서빙 (성공/404) |
| `PdfPipelineServiceImplTest.java` | 파이프라인 | getJob, getAllJobs, deleteBook, response 매핑 |
| `PdfProcessingWorkerTest.java` | Worker 로직 | parseSections (챕터 감지, fallback), chunkText (분할, 단일) |
| `SeniorServiceImplTest.java` | RAG + FAQ | 2단계 KB 검색, FAQ CRUD, 임베딩 생성 |

### Backend 통합 테스트

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `KnowledgeBaseIntegrationTest.java` | KB + pgvector | 코사인 유사도 검색, NULL 임베딩 제외, source 필터링, 책 단위 삭제 |
| `PdfPipelineIntegrationTest.java` | PDF 파이프라인 | 실제 PDF 파일로 텍스트 추출, 챕터 파싱, 청킹 |
| `FaqIntegrationTest.java` | FAQ + pgvector | 유사도 검색, NULL 임베딩 제외, 임베딩 저장 검증 |

### E2E 테스트 (Playwright)

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `qa/api/kb.spec.ts` | KB API | CRUD + 유효성 검증 + Job 목록 + 이미지 업로드/서빙/에러 |
| `qa/ui/kb.spec.ts` | KB UI | 페이지 이동, Markdown 에디터, 생성/수정 흐름, 카드 클릭, 미리보기 |

---

## application.yml 관련 설정

```yaml
# Multipart (PDF + 이미지)
spring.servlet.multipart:
  max-file-size: 500MB
  max-request-size: 500MB

# 임베딩
spring.ai.openai.embedding.options.model: text-embedding-3-small
spring.ai.vectorstore.pgvector:
  dimensions: 1536
  distance-type: COSINE_DISTANCE

# 이미지 저장 경로
kb.image.upload-dir: ${KB_IMAGE_UPLOAD_DIR:kb-images}
```

---

## v3 개발 시 참고사항

### 아키텍처 제약

1. **embedding 필드는 `@Transient`** — JPA `findAll()`, `findById()` 등에서 embedding 컬럼을 읽지 않음. 임베딩 관련 작업은 반드시 **네이티브 쿼리**로 처리.
2. **`entity.setEmbedding()` + `save()` 금지** — Hibernate가 `VECTOR` 타입을 쓸 수 없음. `updateEmbedding(id, vectorString)` 사용.
3. **content에 Markdown 원본 저장** — DB에는 `#`, `**`, `![](url)` 등이 포함된 원본이 저장됨. 표시/검색 시 적절히 처리 필요.
4. **이미지는 파일 시스템** — `kb-images/` 디렉토리에 UUID 파일명으로 저장. DB 테이블 없음. 이미지 관리(삭제, 용량 등)는 파일 시스템 직접 처리.

### 확장 포인트

1. **이미지 관리**: 현재 이미지 삭제 기능 없음. KB 항목 삭제 시 참조 이미지 정리 로직 필요할 수 있음.
2. **검색/필터**: 현재 카테고리/태그 기반 검색 미구현. 전문 검색(Full-text search) 추가 가능.
3. **RAG Top-K 튜닝**: 현재 수동 3 + PDF 2 고정. 데이터 규모에 따라 조정 필요할 수 있음.
4. **KbFormModal.tsx**: v2에서 사용 제거됨 (KbWritePage로 대체). 삭제 또는 다른 용도 검토 가능.
5. **이미지 URL**: 현재 상대 경로(`/api/kb/images/...`). 프로덕션 배포 시 절대 URL 또는 CDN 경로 필요할 수 있음.

---

## 버전 히스토리

| 버전 | 유형 | 주요 변경 | 문서 |
|------|------|----------|------|
| v0 | 기능 추가 | LNB 독립 메뉴 분리 + PDF 업로드 파이프라인 | `knowledge-base_v0.md` |
| v0.1 | 버그 수정 | @Async self-invocation 수정 + Rate Limit 대응 | `knowledge-base_v0.1.md` |
| v2 | 기능 개선 | Markdown 에디터 + 이미지 첨부 + RAG 우선순위 + pgvector 타입 수정 | `knowledge-base_v2.md` |

### 환경 개선 (ops)

| 버전 | 주요 변경 | 문서 |
|------|----------|------|
| upload-size-limit v1 | multipart 50MB → 500MB | `docs/ops/upload-size-limit_v1.md` |
| log-file-output v1 | backend.log 파일 자동 저장 | `docs/ops/log-file-output_v1.md` |
