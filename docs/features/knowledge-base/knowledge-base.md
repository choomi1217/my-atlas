# Knowledge Base — 현재 구현 요약 (v7)

## 개요

Knowledge Base는 **QA 팀의 지식을 체계적으로 축적하고, AI가 그 지식을 활용하여 답변하는 시스템**이다.

QA 엔지니어가 직접 작성한 테스트 노하우, 장애 대응 기록, 온보딩 가이드 등을 Markdown 블로그 형태로 작성하고,
QA 도서(ISTQB, 테스팅 교재 등)를 PDF로 업로드하면 자동으로 청킹·임베딩하여 RAG 파이프라인에 투입한다.

**핵심 가치: QA 시니어의 경험과 지식이 AI에게 전달되어, 주니어 QA가 "시니어에게 질문하듯" AI에게 질문할 수 있다.**

### QA 팀에게 이 기능이 중요한 이유

| 문제 | Knowledge Base가 해결하는 방법 |
|------|-------------------------------|
| 시니어 QA의 암묵지가 퇴사/이동 시 소실 | 직접 작성 KB로 **경험 기반 지식을 문서화** → AI가 영구 보존·활용 |
| QA 도서 내용을 매번 찾아보기 번거로움 | PDF 업로드 → 자동 청킹 → **AI가 도서 내용을 즉시 참조하여 답변** |
| 팀 내 QA 표준/프로세스가 구전으로만 전달 | KB에 표준 문서 작성 → **AI가 팀 표준을 기반으로 일관된 가이드 제공** |
| 주니어가 시니어에게 반복 질문 | KB + AI가 **24시간 시니어 역할** 수행, 시니어의 부담 경감 |
| 장애 대응 노하우가 Slack/메일에 흩어짐 | KB에 장애 사례 정리 → **AI가 유사 장애 시 과거 대응 방안 즉시 제안** |

### 데이터 흐름

```
[QA 시니어가 직접 작성]
   │  Markdown 에디터 + 이미지 첨부
   │  카테고리 분류
   ▼
KB 항목 (source=null) ──→ stripMarkdown ──→ 비동기 임베딩 ──→ pgvector 저장
                                                                    │
[QA 도서 PDF 업로드]                                                │
   │  책 제목 + 카테고리 입력                                       │
   ▼                                                                ▼
텍스트 추출 → 클리닝 → 챕터 파싱 → 청킹 → 임베딩 ──→ My Senior Chat RAG
                                                       ↕
                                              2단계 코사인 유사도 검색
                                              (직접 작성 3개 우선 + PDF 2개 보충)
```

**RAG 우선순위가 핵심이다**: QA 시니어가 직접 작성한 팀 고유의 지식(3개)이 **도서 내용(2개)보다 항상 우선** 참조된다.
이는 범용 이론보다 **우리 팀의 실전 경험**이 더 가치 있다는 QA 철학을 반영한다.

---

## URL 라우팅

| 라우트 | 컴포넌트 | 설명 |
|--------|----------|------|
| `/kb` | `KnowledgeBasePage` | KB 목록 (검색 + 정렬 + 소스 필터 탭 + 카드 목록) |
| `/kb/write` | `KbWritePage` | 새 글 작성 (Markdown 에디터 + 이미지 첨부) |
| `/kb/:id` | `KbDetailPage` | 글 상세 보기 (Markdown 렌더링) |
| `/kb/edit/:id` | `KbEditPage` | 글 수정 (Markdown 에디터 + 이미지 첨부) |

> My Senior는 Chat / FAQ 2뷰만 유지. KB는 `/kb` 독립 메뉴.

---

## 데이터베이스 스키마

### knowledge_base 테이블

| 컬럼 | 타입 | 수동 작성 | PDF 청크 | 설명 |
|------|------|-----------|----------|------|
| id | BIGSERIAL PK | — | — | |
| title | VARCHAR(200) NOT NULL | 사용자 입력 | `{책 제목} - {챕터명} - {순번}` | |
| content | TEXT NOT NULL | Markdown 원본 저장 | 청크 텍스트 | |
| category | VARCHAR(100) | 사용자 입력 (자동 완성) | PDF 업로드 시 선택 | |
| tags | VARCHAR(500) | (사용 중단, 컬럼 보존) | (사용 중단) | v6에서 코드 사용 중단 |
| source | VARCHAR(200) | null | 책 제목 | PDF 구분 기준 |
| embedding | VECTOR(1536) | 비동기 생성 | 청크별 생성 | pgvector |
| hit_count | INTEGER DEFAULT 0 | RAG 검색 시 자동 증가 | 동일 | FAQ 큐레이션 용 |
| pinned_at | TIMESTAMP | 고정 시 설정 | 동일 | FAQ 고정 항목 |
| created_at | TIMESTAMP | — | — | |
| updated_at | TIMESTAMP | — | — | |
| deleted_at | TIMESTAMP | null (Hard Delete) | Soft Delete 시 설정 | PDF만 Soft Delete |

### kb_category 테이블 (v6 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| name | VARCHAR(100) UNIQUE NOT NULL | 카테고리명 |
| created_at | TIMESTAMP | |

- KB 생성/수정 시 `ensureExists()`로 자동 등록 → 별도 관리 없이 자동 완성 제공
- 기존 `category` VARCHAR 컬럼은 그대로 사용 (FK 없이 문자열 매칭)

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
| `V17__kb_soft_delete_and_category.sql` | deleted_at 컬럼, kb_category 테이블, 인덱스 |

### 벡터 인덱스

```sql
CREATE INDEX idx_kb_embedding ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_kb_deleted_at ON knowledge_base (deleted_at)
  WHERE deleted_at IS NULL;
```

---

## Backend API

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### KB CRUD (`/api/kb`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb` | 전체 KB 항목 조회 (`?search=`, `?sort=newest\|oldest\|title`) |
| GET | `/api/kb/{id}` | 단건 조회 |
| POST | `/api/kb` | 수동 항목 생성 (Markdown 원본 저장 + 비동기 임베딩) |
| PUT | `/api/kb/{id}` | 항목 수정 (+ 비동기 임베딩) |
| DELETE | `/api/kb/{id}` | PDF→Soft Delete, 수동→Hard Delete |
| PATCH | `/api/kb/{id}/pin` | KB 항목 고정 (최대 15개) |
| PATCH | `/api/kb/{id}/unpin` | KB 항목 고정 해제 |

### PDF 업로드 (`/api/kb`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/upload-pdf` | PDF 업로드 시작 (multipart: file, bookTitle, category) → jobId 반환 |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 (Polling용) |
| GET | `/api/kb/jobs` | 전체 Job 목록 |
| DELETE | `/api/kb/books/{source}` | 책 단위 전체 청크 Soft Delete |

### 카테고리 (`/api/kb/categories`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb/categories` | 전체 카테고리 목록 |
| GET | `/api/kb/categories/search?q=` | 자동 완성 검색 |
| POST | `/api/kb/categories` | 카테고리 생성 |

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
├── KnowledgeBaseController.java   # KB CRUD + PDF 업로드 + Pin/Unpin 엔드포인트
├── KbImageController.java         # 이미지 업로드/서빙 엔드포인트
├── KbCategoryController.java      # 카테고리 CRUD + 자동 완성
├── KnowledgeBaseService.java      # KB CRUD 인터페이스
├── KnowledgeBaseServiceImpl.java  # KB CRUD 구현 (+ stripMarkdown + 비동기 임베딩 + Soft Delete 분기)
├── KnowledgeBaseEntity.java       # JPA 엔티티 (embedding은 @Transient, deletedAt 포함)
├── KnowledgeBaseRepository.java   # JpaRepository + findSimilar/Manual/Pdf + Soft Delete + 검색/정렬
├── KnowledgeBaseDto.java          # KbRequest / KbResponse 레코드
├── KbCategoryEntity.java          # 카테고리 엔티티
├── KbCategoryRepository.java      # 카테고리 리포지토리
├── KbCategoryService.java         # 카테고리 인터페이스
├── KbCategoryServiceImpl.java     # 카테고리 구현 (ensureExists 패턴)
├── KbCategoryDto.java             # CategoryRequest / CategoryResponse 레코드
├── PdfPipelineService.java        # PDF 파이프라인 인터페이스
├── PdfPipelineServiceImpl.java    # 파이프라인 오케스트레이션 (Job CRUD, Worker 위임)
├── PdfProcessingWorker.java       # @Async 비동기 PDF 처리 (클리닝, 파싱, v7 cleanup 또는 legacy 청킹, 임베딩)
├── KbContentCleanupService.java   # v7: Haiku 기반 섹션 → Markdown 청크 재구성 + AI 사용량 기록
├── PdfUploadJobEntity.java        # Job 엔티티
├── PdfUploadJobRepository.java    # Job 리포지토리
└── PdfUploadJobDto.java           # JobResponse 레코드
```

---

## Frontend 파일 구조

```
frontend/src/
├── pages/
│   ├── KnowledgeBasePage.tsx       # KB 목록 (검색 + 정렬 + 소스 필터 탭 + 카드 목록)
│   ├── KbWritePage.tsx             # 새 글 작성 (Markdown 에디터 + 이미지 첨부 + 카테고리 자동 완성)
│   ├── KbDetailPage.tsx            # 글 상세 보기 (Markdown 렌더링 + 수정/삭제)
│   └── KbEditPage.tsx              # 글 수정 (Markdown 에디터 + 이미지 첨부 + 카테고리 자동 완성)
├── components/kb/
│   ├── PdfUploadModal.tsx          # PDF 업로드 모달 (제목 + 카테고리 + 파일 선택 + 진행 상태)
│   ├── PdfJobStatusCard.tsx        # Job 상태 카드 (PENDING/PROCESSING/DONE/FAILED)
│   └── CategoryAutocomplete.tsx    # 카테고리 자동 완성 입력 컴포넌트
├── hooks/
│   ├── useKnowledgeBase.ts         # KB 상태 + CRUD + 소스 필터링 + 검색/정렬
│   ├── usePdfUpload.ts             # PDF 업로드 + 3초 polling
│   └── useImageUpload.ts           # 이미지 업로드 (POST → URL 반환)
├── api/
│   └── senior.ts                   # kbApi (CRUD + PDF + Pin + Image), kbCategoryApi (CRUD + 검색)
└── types/
    └── senior.ts                   # KbItem, KbRequest, KbCategory, PdfUploadJob 인터페이스
```

---

## 핵심 기능

### 1. Markdown 에디터 — QA 시니어의 지식 작성 도구

**왜 중요한가**: QA 시니어가 테스트 전략, 장애 분석, 체크리스트 등을 **구조화된 문서**로 작성할 수 있다.
코드 블록, 표, 이미지를 포함한 **실무 수준의 문서**가 곧바로 AI 학습 데이터가 된다.

- **라이브러리**: `@uiw/react-md-editor` (WYSIWYG + 라이브 미리보기)
- **글 작성 흐름**: `/kb` → `[+ 직접 작성]` → `/kb/write` → 저장 → `/kb/:id` 상세 보기
- **글 수정 흐름**: `/kb/:id` → `[수정]` → `/kb/edit/:id` → 저장 → `/kb/:id`
- **이미지 첨부**: 버튼 클릭 / 붙여넣기 / 드래그 → `POST /api/kb/images` → `![image](url)` 삽입
- **Markdown 렌더링**: `MDEditor.Markdown` 컴포넌트로 상세 페이지에서 렌더링
- content에는 **Markdown 원본이 그대로 DB에 저장**됨

### 2. 수동 작성 CRUD

- 제목, 내용(Markdown), 카테고리(자동 완성) 입력
- 저장 시 KB 항목 생성 + virtual thread로 비동기 임베딩 생성
- **임베딩 시 `stripMarkdown()` 적용**: Markdown 문법 제거 후 plain text로 임베딩
- `[직접 작성]` 뱃지 (초록색) 표시
- PDF 항목도 수정 가능 (v6에서 편집 기능 추가)

### 3. PDF 업로드 파이프라인 — QA 도서를 AI에게 가르치는 방법

**왜 중요한가**: ISTQB 실라버스, 테스팅 교재 등 **QA 필독서의 내용을 AI가 직접 참조**할 수 있다.
PDF를 업로드하면 자동으로 챕터를 인식하고, 적절한 크기로 분할하여 벡터 검색이 가능하게 만든다.

```
사용자: [PDF 업로드] 클릭 → 책 제목 + 카테고리 + PDF 선택 → 업로드
    ↓
Backend: Job 생성 (PENDING) → jobId 즉시 반환
    ↓
@Async Worker:
    1. PDFBox로 텍스트 추출
    2. [클리닝] 목차 dot-leaders 제거 → 반복 헤더/푸터 제거 → 페이지 번호 제거 → 공백 정규화
    3. [파싱] 챕터/섹션 헤더 파싱 (제N장, Chapter N, N.N Title, Section N)
    4. [병합] 200자 미만 소형 섹션을 인접 섹션에 병합
    5. [v7 정제] 각 섹션을 Claude Haiku 4.5에 1회 호출 →
         JSON 배열 { title, markdown, meaningful, reason } 반환받음
         - 깨진 한국어 어절 복원, 불릿/번호 리스트 복원, 핵심 용어 **볼드**
         - 의미 없는 청크(meaningful=false) 자동 필터링
         - max_tokens=8192, temperature=0, 재시도 3회, 70% 길이 검증
    6. [Safety rail] 3,000자 초과 청크 추가 분할 / 100자 미만 청크 병합
    7. [임베딩] stripMarkdown(청크) → 임베딩 생성 (200ms sleep + 429 시 5초 retry)
    8. knowledge_base에 INSERT (title/content=markdown/source/category)
    ↓
완료: DONE + totalChunks 기록 / 실패: FAILED + errorMessage
    ↓
Frontend: 3초 polling으로 상태 감지 → 목록 자동 갱신
```

**v7 정제 롤백**: `kb.pdf.cleanup.enabled=false` 설정 시 v6 경로(rule-based chunkText)로 동작.

**청킹 품질 기준** (v4에서 확립):

| 기준 | 합격 조건 | 설명 |
|------|-----------|------|
| 최소 크기 | 모든 청크 >= 200자 | 의미 없는 짧은 조각 방지 |
| 최대 크기 | 모든 청크 <= 3,000자 | 임베딩 품질 유지 |
| 이름 고유성 | 중복 이름 0개 | 전역 순번으로 보장 |
| 임베딩 누락 | NULL 0개 | retry 로직으로 보장 |

### 4. Soft Delete — PDF 원본 데이터 보존

**왜 중요한가**: PDF 청킹은 OpenAI API 비용과 처리 시간이 소요된다.
삭제 후 복구 가능성을 보장하여 **비용 낭비를 방지**한다.

| 항목 | 삭제 방식 | 이유 |
|------|-----------|------|
| 수동 작성 KB | Hard Delete | 사용자가 직접 재작성 가능 |
| PDF 청크 | Soft Delete (`deleted_at` 설정) | 재청킹 시 API 비용 발생, 원본 보존 |
| 책 단위 삭제 | 전체 청크 Soft Delete | Job 이력도 보존 |

- 모든 조회 쿼리에 `deleted_at IS NULL` 조건 포함
- 벡터 검색(RAG)에서도 삭제된 항목 자동 제외

### 5. 카테고리 관리 — QA 지식의 체계적 분류

**왜 중요한가**: QA 지식은 "테스트 설계", "장애 분석", "프로세스", "도구" 등 다양한 영역에 걸친다.
카테고리로 분류하면 **특정 영역의 지식을 빠르게 찾을 수 있다**.

- `kb_category` 테이블에 독립 저장 → 자동 완성 드롭다운 제공
- KB 생성/수정 시 `ensureExists()` 패턴으로 새 카테고리 자동 등록
- PDF 업로드 시에도 카테고리 선택 가능 → 도서별 분류
- 태그는 v6에서 사용 중단 (카테고리와 역할 중복)

### 6. 검색 + 정렬 — 대량 KB에서 빠른 탐색

| 기능 | 구현 방식 | 설명 |
|------|-----------|------|
| 검색 | 서버 사이드 (JPQL LIKE) | 제목 + 내용 부분 일치, debounce 300ms |
| 정렬 | 서버 사이드 (ORDER BY) | 최신순 (기본) / 오래된순 / 제목순 |
| 소스 필터 | 클라이언트 사이드 | 전체 / 직접 작성 / PDF 도서 탭 |

### 7. 소스 필터 탭

| 탭 | 조건 | 설명 |
|----|------|------|
| 전체 (N) | 모든 항목 | 기본 |
| 직접 작성 (N) | source IS NULL | 수동 작성 항목만 |
| PDF 도서 (N) | source IS NOT NULL | PDF 청크만 (도서별 그룹 뱃지 표시) |

- PDF 필터 활성화 시 도서별 뱃지로 그룹 표시 + 책 단위 삭제 버튼

### 8. RAG 연동 — AI가 QA 지식을 활용하는 방법

**왜 중요한가**: 이것이 Knowledge Base의 최종 목표다.
QA 시니어가 축적한 지식이 **My Senior Chat에서 실시간으로 AI 답변에 반영**된다.

```
사용자 질문: "API 테스트에서 인증 토큰이 만료되면 어떻게 처리해야 하나요?"
    ↓
Step 1: embeddingService.embed(질문) → queryVector 생성
    ↓
Step 2: findSimilarManual(queryVector, 3)
         → QA 시니어가 작성한 "토큰 갱신 전략" 글 등 상위 3개 (우선)
    ↓
Step 3: findSimilarPdf(queryVector, 2)
         → ISTQB "API 테스팅" 챕터 관련 청크 2개 (보충)
    ↓
Step 4: 프롬프트에 구분하여 포함:
         "=== QA Knowledge Base (직접 작성, 우선 참고) ===\n..."
         "=== QA Knowledge Base (도서 참고) ===\n..."
    ↓
Step 5: AI가 팀 고유 노하우 + 이론적 배경을 결합하여 답변 생성
    ↓
Step 6: 검색된 KB 항목의 hit_count 자동 증가 → FAQ 큐레이션에 반영
```

**RAG 우선순위 설계 의도**: 
- 직접 작성 3개가 **먼저** 프롬프트에 포함 → AI가 "우리 팀의 방식"을 우선 참고
- PDF 2개가 **보충** → 이론적 근거를 추가로 제공
- 이 구조 덕분에 AI 답변이 **범용 교과서적 답변이 아닌, 팀 맞춤형 답변**이 된다

### 9. FAQ 큐레이션 — 자주 참조되는 지식의 자동 부각

- **Hit Count**: RAG 검색 시 조회된 KB 항목의 `hit_count`가 자동 증가
- **Pin**: QA 시니어가 중요한 KB를 고정 (최대 15개)
- **큐레이션 로직**: 고정 항목(최대 15개) + 조회수 상위(최대 5개) = My Senior FAQ 탭에 노출
- 팀에서 가장 많이 참조하는 지식이 **자동으로 부각**되어 접근성이 높아진다

---

## pgvector + Hibernate 아키텍처 (중요)

### 문제

Hibernate가 pgvector `VECTOR(1536)` 타입을 PostgreSQL 배열(`PgArray`)로 읽으려 하여 `PSQLException: No results were returned by the query` 발생.

### 해결

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

// Repository — 임베딩 검색도 네이티브 쿼리 (deleted_at IS NULL 포함)
@Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND source IS NULL "
        + "AND deleted_at IS NULL ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK",
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

---

## PDF 텍스트 클리닝 파이프라인 (v5)

PDF에서 추출한 원시 텍스트를 청킹 전에 정제하는 3단계 후처리:

```
extractText(PDFBox) → cleanExtractedText → parseSections
                        ├── removeRepeatingHeaders  — 반복 출현 헤더/푸터 자동 감지 및 제거
                        ├── removePageNumbers       — 페이지 번호 패턴 제거
                        └── normalizeWhitespace     — 공백/빈 줄 정규화
```

**왜 필요한가**: PDF는 의미 구조가 없는 "보이는 그대로" 포맷이다.
목차와 본문의 "제 1장"을 구분할 수 없고, 헤더/푸터가 본문에 혼입된다.
클리닝 없이 청킹하면 **노이즈가 임베딩에 포함되어 RAG 검색 정확도가 떨어진다**.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Markdown 에디터 | @uiw/react-md-editor (WYSIWYG + 라이브 미리보기) |
| PDF 파싱 | Apache PDFBox 3.0.1 |
| **PDF 정제 (v7)** | **Claude Haiku 4.5 (Spring AI Anthropic, max_tokens=8192, temperature=0)** |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| 벡터 검색 | pgvector (PostgreSQL 15) + IVFFlat 코사인 유사도 |
| 비동기 처리 | Spring @Async (PdfProcessingWorker), Java 21 Virtual Thread (KB/FAQ 임베딩) |
| 이미지 저장 | 로컬 디스크 (`kb-images/`, UUID 파일명) |
| Rate Limit | 청크 간 200ms sleep, Haiku 429 시 5초 retry 최대 3회 |
| AI 사용량 모니터링 | `AiFeature.PDF_CLEANUP` — 섹션 호출별 `ai_usage_log` 기록 (토큰·비용·duration) |
| Polling | Frontend setInterval 3초 (PDF 업로드 상태) |

---

## 테스트

### Backend 단위 테스트

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `KnowledgeBaseServiceImplTest.java` | KB CRUD + stripMarkdown + Soft Delete | findAll, findById, create, update, delete 분기(PDF/수동), search/sort, stripMarkdown |
| `KnowledgeBaseControllerTest.java` | KB 컨트롤러 | CRUD + PDF + Pin/Unpin + 유효성 검증 |
| `KbImageControllerTest.java` | 이미지 컨트롤러 | 업로드 (성공/빈파일/잘못된 확장자/크기 초과) + 서빙 (성공/404) |
| `KbCategoryServiceImplTest.java` | 카테고리 서비스 | CRUD + 중복 검증 + ensureExists |
| `KbCategoryControllerTest.java` | 카테고리 컨트롤러 | 목록/검색/생성 엔드포인트 |
| `PdfPipelineServiceImplTest.java` | 파이프라인 | getJob, getAllJobs, deleteBook, response 매핑 |
| `PdfProcessingWorkerTest.java` | Worker 로직 | parseSections, chunkText, mergeSections, enforceMaxSize, 클리닝(removeTocLines, removeRepeatingHeaders, removePageNumbers, normalizeWhitespace) |
| `KbContentCleanupServiceTest.java` (v7) | Haiku 정제 서비스 | JSON 파싱 + 절단 복구 + safety rail(split/merge) + 모니터링 호출 + 재시도 |
| `SeniorServiceImplTest.java` | RAG + FAQ | 2단계 KB 검색, FAQ CRUD, 임베딩 생성 |

### Backend 통합 테스트

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `KnowledgeBaseIntegrationTest.java` | KB + pgvector | 코사인 유사도 검색, NULL 임베딩 제외, source 필터링, 책 단위 삭제 |
| `PdfPipelineIntegrationTest.java` | PDF 파이프라인 | 실제 PDF 파일로 텍스트 추출, 챕터 파싱, 청킹 + **v7: Haiku mock 기반 cleanup 시나리오 (RefinedChunk 저장 + ai_usage_log 기록 검증)** |
| `FaqIntegrationTest.java` | FAQ + pgvector | 유사도 검색, NULL 임베딩 제외, 임베딩 저장 검증 |

### E2E 테스트 (Playwright)

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `qa/api/kb.spec.ts` | KB API | CRUD + 유효성 검증 + Job 목록 + 이미지 + 검색/정렬 + 카테고리 |
| `qa/ui/kb.spec.ts` | KB UI | 페이지 이동, Markdown 에디터, 생성/수정 흐름, 검색/정렬 UI, 카테고리 자동 완성 |

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

# v7: PDF 청크 정제 (Haiku)
kb.pdf.cleanup.enabled: ${KB_PDF_CLEANUP_ENABLED:true}
```

---

## 다음 버전 개발 시 참고사항

### 아키텍처 제약

1. **embedding 필드는 `@Transient`** — JPA `findAll()`, `findById()` 등에서 embedding 컬럼을 읽지 않음. 임베딩 관련 작업은 반드시 **네이티브 쿼리**로 처리.
2. **`entity.setEmbedding()` + `save()` 금지** — Hibernate가 `VECTOR` 타입을 쓸 수 없음. `updateEmbedding(id, vectorString)` 사용.
3. **content에 Markdown 원본 저장** — DB에는 `#`, `**`, `![](url)` 등이 포함된 원본이 저장됨. 표시/검색 시 적절히 처리 필요.
4. **이미지는 파일 시스템** — `kb-images/` 디렉토리에 UUID 파일명으로 저장. DB 테이블 없음.
5. **모든 조회 쿼리에 `deleted_at IS NULL` 필수** — Soft Delete 항목이 검색/RAG에 포함되지 않도록.
6. **tags 컬럼은 DB에 존재하지만 코드에서 사용 중단** — v6에서 카테고리로 단일화.

### 확장 포인트

1. **이미지 관리**: 현재 이미지 삭제 기능 없음. KB 항목 삭제 시 참조 이미지 정리 로직 필요할 수 있음.
2. **전문 검색(Full-text search)**: 현재 LIKE 기반 검색 → GIN 인덱스 + 한국어 형태소 분석기 추가 가능.
3. **RAG Top-K 튜닝**: 현재 수동 3 + PDF 2 고정. 데이터 규모에 따라 조정 필요할 수 있음.
4. **Soft Delete 복원 UI**: 현재 삭제된 PDF 항목을 복원하는 UI가 없음.
5. **이미지 URL**: 현재 상대 경로(`/api/kb/images/...`). 프로덕션 배포 시 절대 URL 또는 CDN 경로 필요할 수 있음.

---

## 버전 히스토리

| 버전 | 유형 | 주요 변경 | 날짜 | 문서 |
|------|------|----------|------|------|
| v0 | 기능 추가 | LNB 독립 메뉴 분리 + PDF 업로드 파이프라인 | 2026-03-24 | `knowledge-base_v0.md` |
| v0.1 | 버그 수정 | @Async self-invocation 수정 + Rate Limit 대응 | 2026-03-25 | `knowledge-base_v0.1.md` |
| v1 | 기능 개선 | E2E 테스트 보강 (API 13개 + UI 9개) | 2026-04-06 | `knowledge-base_v1.md` |
| v2 | 기능 개선 | Markdown 에디터 + 이미지 첨부 + RAG 우선순위 + pgvector 타입 수정 | 2026-04-07 | `knowledge-base_v2.md` |
| v3 | 기능 개선 | 카드 UI 개선 (내용 미리보기/버튼 제거, 카드 간소화) | 2026-04-08 | `knowledge-base_v3.md` |
| v4 | 버그 수정 | PDF 청킹 파이프라인 개선 (목차 오인식, 번호 리스트 분리, 중복 이름, 크기 편차) | 2026-04-09 | `knowledge-base_v4.md` |
| v5 | 기능 개선 | PDF 텍스트 클리닝 레이어 추가 (헤더/푸터 제거, 페이지 번호 제거, 섹션 패턴 확장) | 2026-04-10 | `knowledge-base_v5.md` |
| v6 | 기능 추가 | Soft Delete + PDF 편집 + 카테고리 관리 + 정렬/검색 | 2026-04-10 | `knowledge-base_v6.md` |
| v7 | 기능 개선 | PDF 업스트림 정제 (Claude Haiku 4.5) — 한국어 어절 복원, Markdown 재구성, 의미 필터, 목차 dot-leader 제거, AI 사용량 모니터링 통합 | 2026-04-21 | `knowledge-base_v7.md` |

### 환경 개선 (ops)

| 버전 | 주요 변경 | 문서 |
|------|----------|------|
| upload-size-limit v1 | multipart 50MB → 500MB | `docs/ops/upload-size-limit_v1.md` |
| log-file-output v1 | backend.log 파일 자동 저장 | `docs/ops/log-file-output_v1.md` |
