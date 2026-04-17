# Knowledge Base v2 — 블로그형 Markdown 에디터 + 이미지 첨부 + RAG 우선순위

> **변경 유형**: 기능 개선
> **이전 버전**: v0.1

---

## 1. 요구사항 (원문)

현재 Knowledge-base에 글을 작성할 수 있는 모달은 너무 작습니다.
블로그에 글을 쓰듯이 md를 지원해주시고, 이미지 첨부도 할 수 있게끔 해주십시오.

제가 원하는 것은 블로그처럼 글을 쓰고, 해당 내용을 my-atlas의 senior (ai) 에게 질문 했을때 제 블로그의 내용을 우선적으로 찾게 하는것입니다.

---

## 2. Context (현재 상태 분석)

### 현재 KB 작성 UI
- `KbFormModal.tsx` — `max-w-lg`(512px) 크기의 작은 모달
- 4개 필드: Title(input), Content(textarea 6줄), Category(input), Tags(input)
- **Plain text만** 지원, Markdown 미지원, 이미지 첨부 불가

### 현재 데이터 흐름
- `KbRequest`: `{ title, content, category, tags }` (JSON)
- `KnowledgeBaseEntity.content`: `TEXT` 컬럼 (plain text 저장)
- 임베딩: `title + " " + content` 문자열로 OpenAI text-embedding-3-small 호출

### 현재 RAG 검색 (SeniorServiceImpl.buildRagContext)
- `KB_TOP_K = 3` — 코사인 유사도 상위 3개 반환
- **source 구분 없이** 동일 가중치로 검색 (수동 작성 vs PDF 청크 차이 없음)
- findSimilar 쿼리: `ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK`

### 현재 의존성
- Frontend: React 18 + Tailwind (markdown 에디터 없음)
- Backend: Spring Boot 3.3.1 (이미지 저장 기능 없음)
- 이미지 저장소: 없음

---

## 3. 변경 범위 요약

| 구분 | 변경 내용 |
|------|-----------|
| Frontend | 모달 → 전체 페이지 블로그형 에디터 (Markdown WYSIWYG) |
| Frontend | 이미지 첨부 기능 (에디터 내 인라인 이미지) |
| Frontend | Markdown 렌더링 (KB 목록 카드 미리보기 + 상세 보기) |
| Backend | 이미지 업로드 API (`/api/kb/images`) |
| Backend | 이미지 파일 저장 (로컬 디스크 or static resource) |
| DB | `kb_image` 테이블 신규 생성 (이미지 메타데이터) |
| RAG | 수동 작성 KB 우선 검색 (source IS NULL 가중치 상향) |

---

## 4. 설계

### 4-1. Frontend — Markdown 에디터

**라이브러리 선택: `@uiw/react-md-editor`**
- Markdown WYSIWYG 에디터 (편집 + 미리보기 동시)
- 툴바: Bold, Italic, Heading, List, Link, Image, Code, Quote
- 경량 (react-markdown 기반, 추가 의존성 적음)
- 이미지 삽입: `![alt](url)` 문법 자동 생성

**페이지 전환: 모달 → 전체 페이지**

| 기존 | 변경 |
|------|------|
| `KbFormModal.tsx` (모달, 512px) | `KbWritePage.tsx` (전체 페이지, `/kb/write`) |
| — | `KbEditPage.tsx` (전체 페이지, `/kb/edit/:id`) |
| — | `KbDetailPage.tsx` (상세 보기, `/kb/:id`) |

**라우팅 추가:**

| 라우트 | 컴포넌트 | 설명 |
|--------|----------|------|
| `/kb` | `KnowledgeBasePage.tsx` | 목록 (기존 유지) |
| `/kb/write` | `KbWritePage.tsx` | 새 글 작성 |
| `/kb/edit/:id` | `KbEditPage.tsx` | 글 수정 |
| `/kb/:id` | `KbDetailPage.tsx` | 글 상세 보기 (Markdown 렌더링) |

**목록 카드 변경:**
- 카드 클릭 → `/kb/:id` 상세 페이지 이동
- content 미리보기: Markdown → plain text 변환 후 150자 truncate

### 4-2. 이미지 첨부

**흐름:**
```
사용자: 에디터에서 이미지 붙여넣기 or 드래그 or 툴바 클릭
    ↓
Frontend: POST /api/kb/images (multipart: file) 
    ↓
Backend: 이미지 저장 → URL 반환 (/api/kb/images/{filename})
    ↓
Frontend: 에디터에 ![image](URL) 자동 삽입
    ↓
저장 시: content에 Markdown 이미지 문법 포함된 채 저장
```

**Backend 이미지 API:**

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/kb/images` | 이미지 업로드 → URL 반환 |
| GET | `/api/kb/images/{filename}` | 이미지 서빙 |

**이미지 저장 위치:** `backend/kb-images/` (로컬 디스크, .gitignore 등록)
- 파일명: `{UUID}.{확장자}` (충돌 방지)
- 허용 확장자: png, jpg, jpeg, gif, webp
- 최대 크기: 10MB per image

**DB 테이블 (선택적):** 이미지 메타데이터 관리가 필요하지 않다면 파일 시스템만 사용.
→ v2에서는 **파일 시스템만 사용** (별도 테이블 없음, 단순화)

### 4-3. RAG 수동 작성 우선 검색

**현재 문제:** `findSimilar()`는 source 구분 없이 코사인 유사도만으로 정렬.
PDF 청크가 수백 개이므로 수동 작성 글이 밀려날 수 있음.

**해결 방안: 2단계 검색 + 병합**

```
Step 1: 수동 작성 KB 검색 (source IS NULL, TOP 3)
Step 2: PDF 청크 검색 (source IS NOT NULL, TOP 2)
Step 3: 결과 병합 (수동 3개 우선 + PDF 2개 보충 = 최대 5개)
```

**Repository 변경:**
```java
// 기존
List<KnowledgeBaseEntity> findSimilar(String queryVector, int topK);

// 추가
List<KnowledgeBaseEntity> findSimilarManual(String queryVector, int topK);
// WHERE source IS NULL AND embedding IS NOT NULL ORDER BY embedding <=> ... LIMIT :topK

List<KnowledgeBaseEntity> findSimilarPdf(String queryVector, int topK);
// WHERE source IS NOT NULL AND embedding IS NOT NULL ORDER BY embedding <=> ... LIMIT :topK
```

**SeniorServiceImpl 변경:**
```
KB 컨텍스트 = findSimilarManual(vector, 3) + findSimilarPdf(vector, 2)
프롬프트: "=== QA Knowledge Base (직접 작성, 우선 참고) ===\n..." 
        + "=== QA Knowledge Base (도서 참고) ===\n..."
```

### 4-4. Markdown 임베딩 처리

Markdown 문법(`#`, `**`, `![](...)` 등)은 임베딩 품질에 영향을 줄 수 있음.

**방안:** 임베딩 생성 시 Markdown → plain text 변환 후 임베딩
- `#` heading → 텍스트만
- `**bold**` → bold만
- `![alt](url)` → alt 텍스트만 (이미지 URL 제외)
- 코드 블록 → 코드 텍스트만

Backend에서 간단한 정규식 기반 Markdown 스트리핑:
```java
private String stripMarkdown(String md) {
    return md
        .replaceAll("!\\[([^]]*)]\\([^)]*\\)", "$1")  // 이미지 → alt
        .replaceAll("\\[([^]]*)]\\([^)]*\\)", "$1")    // 링크 → 텍스트
        .replaceAll("[#*`>~_]", "")                     // 마크다운 기호 제거
        .replaceAll("\\n{2,}", "\n")                    // 연속 줄바꿈 정리
        .trim();
}
```

---

## 5. 구현 절차 (Steps)

### Step 1: Frontend — Markdown 에디터 의존성 추가 + KbWritePage 기본 구조 ✅
- [x] `@uiw/react-md-editor` 설치
- [x] `KbWritePage.tsx` 생성 — Markdown 에디터 + Title/Category/Tags 필드
- [x] `/kb/write` 라우트 추가 (App.tsx)
- [x] KnowledgeBasePage의 `[+ 직접 작성]` 버튼 → `/kb/write` 네비게이션으로 변경

### Step 2: Frontend — KbDetailPage + KbEditPage ✅
- [x] `KbDetailPage.tsx` 생성 — Markdown 렌더링 (MDEditor.Markdown)
- [x] `KbEditPage.tsx` 생성 — 기존 데이터 로드 + Markdown 에디터
- [x] `/kb/:id`, `/kb/edit/:id` 라우트 추가
- [x] 목록 카드 클릭 → `/kb/:id` 이동
- [x] 상세 페이지에서 수정/삭제 버튼

### Step 3: Backend — 이미지 업로드 API ✅
- [x] `KbImageController.java` 생성 — POST(업로드), GET(서빙)
- [x] 이미지 저장 경로 설정 (`application.yml`: `kb.image.upload-dir`)
- [x] 파일명 UUID 생성, 확장자 검증, 10MB 제한
- [x] `.gitignore`에 `kb-images/` 추가

### Step 4: Frontend — 이미지 첨부 연동 ✅
- [x] 에디터에 이미지 붙여넣기/드래그 핸들러 추가
- [x] POST `/api/kb/images` 호출 → 반환된 URL로 `![image](url)` 삽입
- [x] `useImageUpload.ts` 훅 + 이미지 첨부 버튼 + 파일 input

### Step 5: Backend — RAG 수동 작성 우선 검색 ✅
- [x] `KnowledgeBaseRepository`에 `findSimilarManual()`, `findSimilarPdf()` 추가
- [x] `SeniorServiceImpl.buildRagContext()` — 2단계 검색 + 병합 로직 (수동 3개 + PDF 2개)
- [x] 프롬프트에 수동 작성 / 도서 구분 표시

### Step 6: Backend — Markdown 스트리핑 (임베딩 품질) ✅
- [x] `KnowledgeBaseServiceImpl`에 `stripMarkdown()` 메서드 추가
- [x] create/update 시 `stripMarkdown(content)` 결과로 임베딩 생성
- [x] content 원본(Markdown)은 그대로 DB 저장

### Step 7: Frontend — 목록 카드 Markdown 미리보기 ✅
- [x] 카드에서 content → plain text 변환 + 150자 truncate
- [x] KnowledgeBasePage에서 KbFormModal 사용 제거 (KbWritePage/KbEditPage로 대체)

### Step 8: Bugfix — pgvector + Hibernate 타입 매핑 오류 수정 ✅
- [x] **원인:** Hibernate가 pgvector `VECTOR(1536)` 타입을 PostgreSQL 배열(`PgArray`)로 읽으려 하여 `PSQLException: No results were returned by the query` 500 에러 발생. `findAll()` 호출 시 embedding이 있는 row를 읽지 못함.
- [x] `KnowledgeBaseEntity.embedding`, `FaqEntity.embedding` — `@Column(columnDefinition = "VECTOR(1536)")` → `@Transient` 변경 (Hibernate가 이 컬럼을 매핑하지 않도록)
- [x] `KnowledgeBaseRepository`, `FaqRepository` — `updateEmbedding(id, vectorString)` 네이티브 `@Modifying @Query` 추가
- [x] `KnowledgeBaseServiceImpl.scheduleEmbeddingGeneration()` — `entity.setEmbedding()` + `save()` → `repository.updateEmbedding(id, vectorStr)` 로 전환
- [x] `SeniorServiceImpl.scheduleEmbeddingGeneration()` — 동일 패턴 전환
- [x] `PdfProcessingWorker.saveChunkWithRetry()` — `save()` 후 `updateEmbedding()` 로 분리
- [x] Integration 테스트(`KnowledgeBaseIntegrationTest`, `FaqIntegrationTest`) — 동일 패턴 수정
- [x] 전체 빌드 + 206 테스트 PASS, Docker 환경에서 `/api/kb`, `/api/senior/faq` 200 OK 확인

---

## 6. 파일 변경 목록 (예정)

### Frontend 신규
| 파일 | 설명 |
|------|------|
| `pages/KbWritePage.tsx` | 새 글 작성 페이지 (Markdown 에디터) |
| `pages/KbEditPage.tsx` | 글 수정 페이지 |
| `pages/KbDetailPage.tsx` | 글 상세 보기 (Markdown 렌더링) |

### Frontend 수정
| 파일 | 변경 |
|------|------|
| `App.tsx` | `/kb/write`, `/kb/edit/:id`, `/kb/:id` 라우트 추가 |
| `pages/KnowledgeBasePage.tsx` | `[+ 직접 작성]` → navigate('/kb/write'), 카드 클릭 → navigate |
| `hooks/useKnowledgeBase.ts` | 필요 시 단건 fetch 추가 |
| `api/senior.ts` | `kbApi.uploadImage()` 추가 |
| `types/senior.ts` | 이미지 응답 타입 추가 |
| `package.json` | `@uiw/react-md-editor` 추가 |

### Backend 신규
| 파일 | 설명 |
|------|------|
| `KbImageController.java` | 이미지 업로드/서빙 API |

### Backend 수정
| 파일 | 변경 |
|------|------|
| `KnowledgeBaseRepository.java` | `findSimilarManual()`, `findSimilarPdf()`, `updateEmbedding()` 추가 |
| `KnowledgeBaseServiceImpl.java` | `stripMarkdown()` 추가, 임베딩 시 적용 |
| `KnowledgeBaseEntity.java` | `embedding` 필드 `@Column` → `@Transient` (pgvector 타입 매핑 수정) |
| `FaqEntity.java` | `embedding` 필드 `@Column` → `@Transient` (동일 수정) |
| `FaqRepository.java` | `updateEmbedding()` 추가 |
| `SeniorServiceImpl.java` | RAG 2단계 검색 + 병합, FAQ 임베딩 네이티브 쿼리 전환 |
| `PdfProcessingWorker.java` | 임베딩 저장을 네이티브 쿼리로 전환 |
| `application.yml` | `kb.image.upload-dir` 설정 추가 |
| `.gitignore` | `kb-images/` 추가 |

---

## 7. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | `/kb`에서 `[+ 직접 작성]` 클릭 | `/kb/write` 페이지로 이동, Markdown 에디터 표시 |
| 2 | Markdown 문법으로 글 작성 (heading, bold, list, code) | 미리보기에서 렌더링 확인 |
| 3 | 에디터에서 이미지 붙여넣기 | 이미지 업로드 → `![image](url)` 삽입 → 미리보기에 이미지 표시 |
| 4 | 글 저장 | KB 목록에 새 항목 표시, content에 Markdown 원본 저장 |
| 5 | 목록에서 카드 클릭 | `/kb/:id` 상세 페이지, Markdown 렌더링 (이미지 포함) |
| 6 | 상세에서 수정 클릭 | `/kb/edit/:id`, 기존 Markdown 로드, 수정 후 저장 |
| 7 | My Senior Chat에서 수동 작성 KB 관련 질문 | **수동 작성 글이 PDF 청크보다 우선** 포함되어 답변 |
| 8 | DB 확인: embedding | Markdown 기호 제거된 텍스트로 임베딩 생성 확인 |
| 9 | 목록 카드 미리보기 | Markdown 기호 없이 plain text 150자 표시 |
| 10 | 10MB 초과 이미지 업로드 | 에러 메시지 표시 |
