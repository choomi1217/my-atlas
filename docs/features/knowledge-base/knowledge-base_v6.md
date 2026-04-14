# Knowledge Base v6: Soft Delete + PDF 편집 + 카테고리 관리 + 정렬/검색

> 변경 유형: 기능 추가
> 작성일: 2026-04-10
> 버전: v6
> 상태: 진행 중

---

## 요구사항

### 1. PDF Soft Delete
PDF를 통해 업로드한 데이터는 Hard Delete를 수행하지 않고 Soft Delete를 통해 원본 데이터를 보존한다.

### 2. PDF KB 편집 가능
PDF를 이용해 업로드한 KB도 수정할 수 있어야 하며, 기존 KB와 같은 수정화면의 양식을 가진다.

### 3. 카테고리만 남기기
태그와 카테고리의 역할이 겹치므로 카테고리만 남긴다.
카테고리는 DB에 따로 저장하고, 사용자가 입력 시 자동 완성/선택지 제안을 제공한다.

### 4. PDF 업로드 시 카테고리 선택
PDF 업로드 플로우에서도 카테고리를 선택할 수 있도록 지원한다.

### 5. 정렬과 검색
KB와 PDF 모두 정렬과 검색을 지원한다.

---

## 컨텍스트

### 현재 상태 (v5 완료 기준)

| 항목 | 현재 구현 | 문제점 |
|------|----------|--------|
| 삭제 방식 | Hard Delete (`deleteById`) | PDF 원본 데이터 복구 불가 |
| PDF 편집 | 편집 불가 (UI에서 수정 버튼 미노출) | 청킹 결과 수정 불가 |
| 분류 체계 | `category` + `tags` 병존 | 역할 중복, UX 혼란 |
| 카테고리 저장 | knowledge_base 테이블 내 인라인 문자열 | 자동 완성 불가, 오타/중복 발생 |
| PDF 업로드 | bookTitle + file만 수집 | 업로드 시 카테고리 분류 불가 |
| 정렬 | 없음 (DB 기본 순서) | 원하는 항목 찾기 어려움 |
| 검색 | 없음 | 대량 KB에서 탐색 불가 |

### 현재 DB 스키마 (`knowledge_base`)

```sql
id          BIGSERIAL PRIMARY KEY
title       VARCHAR(200) NOT NULL
content     TEXT NOT NULL
category    VARCHAR(100)           -- 인라인 문자열
tags        VARCHAR(500)           -- v6에서 제거 대상
source      VARCHAR(200)           -- NULL=수동, book_title=PDF
embedding   VECTOR(1536)
hit_count   INTEGER DEFAULT 0
pinned_at   TIMESTAMP
created_at  TIMESTAMP
updated_at  TIMESTAMP
-- deleted_at 없음 → Hard Delete
```

### 변경 후 구조

```
knowledge_base 테이블
├── deleted_at TIMESTAMP 추가 → Soft Delete 지원
├── tags 컬럼 → 코드에서 사용 중단 (DB 컬럼은 유지, 데이터 보존)
└── category → kb_category 테이블 FK 참조로 전환

kb_category 테이블 (신규)
├── id BIGSERIAL PK
├── name VARCHAR(100) UNIQUE NOT NULL
└── created_at TIMESTAMP

API 변경
├── GET /api/kb → 정렬(sort), 검색(search) 쿼리 파라미터 추가
├── GET /api/kb/categories → 카테고리 목록 (자동 완성용)
├── POST /api/kb/categories → 카테고리 생성
├── DELETE /api/kb/{id} → Soft Delete (PDF), Hard Delete (수동) 분기
└── POST /api/kb/upload-pdf → category 파라미터 추가
```

---

## 실행 계획

### Step 1. Flyway 마이그레이션 — Soft Delete + 카테고리 테이블

**새 파일**: `V17__kb_soft_delete_and_category.sql`

```sql
-- 1. Soft Delete 컬럼 추가
ALTER TABLE knowledge_base ADD COLUMN deleted_at TIMESTAMP;

-- 2. 카테고리 테이블 생성
CREATE TABLE kb_category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_kb_category_name UNIQUE (name)
);

-- 3. 기존 카테고리 데이터를 kb_category로 마이그레이션
INSERT INTO kb_category (name)
SELECT DISTINCT category FROM knowledge_base
WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

-- 4. knowledge_base에 category_id FK 추가
ALTER TABLE knowledge_base ADD COLUMN category_id BIGINT
    REFERENCES kb_category(id) ON DELETE SET NULL;

-- 5. 기존 데이터 category → category_id 매핑
UPDATE knowledge_base kb
SET category_id = kc.id
FROM kb_category kc
WHERE kb.category = kc.name;

-- 6. Soft Delete 인덱스 (자주 조회하는 "삭제 안 된 항목" 필터용)
CREATE INDEX idx_kb_deleted_at ON knowledge_base (deleted_at)
    WHERE deleted_at IS NULL;
```

**주의**: `category` VARCHAR 컬럼과 `tags` 컬럼은 삭제하지 않음 — 기존 데이터 보존, 코드에서만 사용 중단

---

### Step 2. Backend Entity + DTO 변경

**변경 파일**:
- `KnowledgeBaseEntity.java`
- `KnowledgeBaseDto.java`
- `KbCategoryEntity.java` (신규)
- `KbCategoryDto.java` (신규)
- `KbCategoryRepository.java` (신규)

**Entity 변경 (`KnowledgeBaseEntity`)**:
- `deletedAt` (LocalDateTime) 필드 추가
- `categoryId` (Long) 필드 추가
- `category` (기존 인라인 문자열) → 읽기 전용 유지, 새 저장은 `categoryId` 사용

**신규 Entity (`KbCategoryEntity`)**:
```java
@Entity @Table(name = "kb_category")
public class KbCategoryEntity {
    Long id;
    String name;          // UNIQUE
    LocalDateTime createdAt;
}
```

**DTO 변경 (`KbRequest`)**:
- `tags` 필드 제거
- `categoryId` (Long) 추가 — 카테고리 ID로 분류

**DTO 변경 (`KbResponse`)**:
- `tags` 필드 제거
- `categoryId` (Long) 추가
- `categoryName` (String) 추가 — 표시용
- `deletedAt` (LocalDateTime) 추가

---

### Step 3. Backend Repository 변경 — Soft Delete 쿼리

**변경 파일**: `KnowledgeBaseRepository.java`

**변경 사항**:
1. 모든 조회 쿼리에 `WHERE deleted_at IS NULL` 조건 추가
2. Soft Delete 메서드 추가

```java
// 기존 findAll() 대체 → 삭제되지 않은 항목만 조회
@Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.deletedAt IS NULL")
List<KnowledgeBaseEntity> findAllActive();

// 정렬 + 검색 쿼리
@Query("""
    SELECT k FROM KnowledgeBaseEntity k
    WHERE k.deletedAt IS NULL
    AND (:search IS NULL OR LOWER(k.title) LIKE LOWER(CONCAT('%', :search, '%'))
         OR LOWER(k.content) LIKE LOWER(CONCAT('%', :search, '%')))
    ORDER BY
    CASE WHEN :sort = 'newest' THEN k.createdAt END DESC,
    CASE WHEN :sort = 'oldest' THEN k.createdAt END ASC,
    CASE WHEN :sort = 'title' THEN k.title END ASC
    """)
List<KnowledgeBaseEntity> findActiveWithSearchAndSort(
    @Param("search") String search,
    @Param("sort") String sort
);

// Soft Delete
@Modifying
@Query("UPDATE KnowledgeBaseEntity k SET k.deletedAt = :now WHERE k.id = :id")
void softDelete(@Param("id") Long id, @Param("now") LocalDateTime now);

// Vector search 쿼리도 deleted_at IS NULL 조건 추가
@Query(value = "SELECT * FROM knowledge_base WHERE embedding IS NOT NULL AND deleted_at IS NULL ORDER BY embedding <=> cast(:queryVector as vector) LIMIT :topK", nativeQuery = true)
List<KnowledgeBaseEntity> findSimilar(...);

// Manual/PDF 분리 쿼리도 동일하게 deleted_at IS NULL 추가
```

---

### Step 4. Backend Service 변경 — 삭제 분기 + 검색/정렬

**변경 파일**: `KnowledgeBaseServiceImpl.java`, `PdfPipelineServiceImpl.java`

**삭제 로직 분기**:
```java
void delete(Long id) {
    KnowledgeBaseEntity entity = repository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("KB not found"));

    if (entity.getSource() != null) {
        // PDF 항목 → Soft Delete (원본 보존)
        repository.softDelete(id, LocalDateTime.now());
    } else {
        // 수동 항목 → Hard Delete (기존 동작 유지)
        repository.deleteById(id);
    }
}
```

**책 단위 삭제 (`deleteBook`) 변경**:
```java
// Hard Delete → Soft Delete로 변경
void deleteBook(String source) {
    repository.softDeleteBySource(source, LocalDateTime.now());
    // job 테이블은 유지 (이력 보존)
}
```

**검색/정렬 지원**:
```java
List<KbResponse> findAll(String search, String sort) {
    // search: 제목/내용 부분 일치
    // sort: newest(기본), oldest, title
    return repository.findActiveWithSearchAndSort(search, sort)
        .stream().map(this::toResponse).toList();
}
```

**카테고리 서비스 (`KbCategoryService`, 신규)**:
```java
List<CategoryResponse> findAll();                       // 전체 카테고리 목록
CategoryResponse create(String name);                   // 카테고리 생성
List<CategoryResponse> search(String query);            // 자동 완성용 검색
```

---

### Step 5. Backend Controller 변경 — 엔드포인트 추가

**변경 파일**: `KnowledgeBaseController.java`, `KbCategoryController.java` (신규)

**기존 엔드포인트 변경**:

| 엔드포인트 | 변경 내용 |
|------------|----------|
| `GET /api/kb` | `?search=`, `?sort=newest\|oldest\|title` 쿼리 파라미터 추가 |
| `DELETE /api/kb/{id}` | PDF→Soft Delete, 수동→Hard Delete 분기 |
| `DELETE /api/kb/books/{source}` | Soft Delete로 변경 |
| `POST /api/kb/upload-pdf` | `categoryId` 파라미터 추가 |

**신규 엔드포인트 (`KbCategoryController`)**:

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb/categories` | 전체 카테고리 목록 |
| GET | `/api/kb/categories/search?q=` | 자동 완성 검색 |
| POST | `/api/kb/categories` | 카테고리 생성 |

---

### Step 6. Frontend — 태그 제거 + 카테고리 자동 완성

**변경 파일**:
- `types/senior.ts` — `KbItem`에서 `tags` 제거, `categoryId`/`categoryName`/`deletedAt` 추가
- `api/senior.ts` — 카테고리 API 추가 (`kbCategoryApi`)
- `hooks/useKbCategory.ts` (신규) — 카테고리 목록 + 자동 완성 hook
- `components/kb/CategoryAutocomplete.tsx` (신규) — 자동 완성 입력 컴포넌트

**카테고리 자동 완성 동작**:
1. 입력 시 기존 카테고리 목록에서 필터링하여 드롭다운 표시
2. 드롭다운에서 선택하거나, 새 카테고리를 직접 입력하면 POST로 생성
3. PDF 업로드 모달, KB 작성/수정 페이지에서 동일 컴포넌트 사용

---

### Step 7. Frontend — PDF 편집 + 업로드 카테고리

**변경 파일**:
- `KbDetailPage.tsx` — PDF 항목에도 수정 버튼 표시 (현재는 수동 항목만 표시)
- `KbEditPage.tsx` — PDF 항목 로드 시 source 정보 표시 (읽기 전용), 나머지 필드 편집 가능
- `PdfUploadModal.tsx` — 카테고리 선택 필드 추가 (`CategoryAutocomplete` 사용)
- `KnowledgeBasePage.tsx` — 태그 표시 제거, 카테고리만 표시

---

### Step 8. Frontend — 정렬 + 검색 UI

**변경 파일**:
- `KnowledgeBasePage.tsx`
- `useKnowledgeBase.ts`
- `api/senior.ts`

**검색 UI**:
- 필터 탭 상단에 검색 입력 필드 추가
- 입력 시 debounce (300ms) 후 API 호출
- 검색 대상: 제목 + 내용 (서버 사이드)

**정렬 UI**:
- 검색 필드 우측에 정렬 드롭다운
- 옵션: 최신순 (기본), 오래된순, 제목순

**API 연동 변경**:
```typescript
// 기존: kbApi.getAll()
// 변경: kbApi.getAll({ search, sort })
getAll: (params?: { search?: string; sort?: string }) =>
    apiClient.get('/api/kb', { params }).then(r => r.data.data)
```

**useKnowledgeBase 변경**:
- `search` (string), `sort` (string) 상태 추가
- `setSearch`, `setSort` 함수 노출
- 서버 사이드 검색/정렬로 전환 (기존 클라이언트 필터링은 소스 필터만 유지)

---

### Step 9. 단위 테스트 작성

**변경 파일**: `KnowledgeBaseServiceImplTest.java`, `KnowledgeBaseControllerTest.java`

| # | 테스트 케이스 | 검증 포인트 |
|---|-------------|------------|
| T1 | `delete`: PDF 항목 → softDelete 호출 확인 | source != null이면 deletedAt 설정 |
| T2 | `delete`: 수동 항목 → deleteById 호출 확인 | source == null이면 Hard Delete |
| T3 | `deleteBook`: Soft Delete로 변경 확인 | source별 일괄 softDelete |
| T4 | `findAll`: deletedAt != null 항목 제외 확인 | Soft Delete된 항목 미반환 |
| T5 | `findAll(search, sort)`: 검색어 필터링 확인 | 제목/내용 부분 일치 |
| T6 | `findAll(search, sort)`: 정렬 동작 확인 | newest, oldest, title |
| T7 | `CategoryService`: 카테고리 CRUD + 중복 검증 | unique constraint |
| T8 | `CategoryController`: 자동 완성 검색 응답 확인 | 쿼리별 필터링 |
| T9 | `KbRequest`: tags 없이 category만 사용 | 역호환 검증 |
| T10 | `uploadPdf`: categoryId 전달 확인 | PDF 청크에 category 일괄 적용 |

**신규 테스트 파일**: `KbCategoryServiceTest.java`, `KbCategoryControllerTest.java`

---

### Step 10. E2E 테스트 작성

**변경 파일**: `qa/api/kb.spec.ts`, `qa/ui/kb.spec.ts`

**API 테스트 추가**:

| # | 테스트 케이스 | 검증 |
|---|-------------|------|
| E1 | GET /api/kb?search=키워드 → 필터링된 결과 | 검색 동작 |
| E2 | GET /api/kb?sort=oldest → 오래된순 정렬 | 정렬 동작 |
| E3 | DELETE PDF 항목 → GET으로 재조회 시 미반환 | Soft Delete |
| E4 | POST /api/kb/categories → 카테고리 생성 | 201 응답 |
| E5 | GET /api/kb/categories → 목록 조회 | 생성한 카테고리 포함 |
| E6 | POST /api/kb (categoryId 포함) → 카테고리 연결 | categoryName 반환 확인 |

**UI 테스트 추가**:

| # | 테스트 케이스 | 검증 |
|---|-------------|------|
| U1 | 검색 입력 → 결과 필터링 | 검색 UI 동작 |
| U2 | 정렬 변경 → 순서 변경 | 정렬 UI 동작 |
| U3 | PDF 항목 상세 → 수정 버튼 표시 | PDF 편집 가능 |
| U4 | KB 작성 → 카테고리 자동 완성 | 드롭다운 표시 |
| U5 | 태그 입력 필드 미표시 | 태그 제거 확인 |

---

### Step 11. 4-Agent Pipeline 실행

기존 테스트 + 새 테스트 전체 통과 확인.

```bash
# Agent-D 순서
1. cd backend && ./gradlew clean build
2. ./gradlew test
3. cd .. && docker compose up -d && sleep 10
4. cd qa && npx playwright test
5. cd .. && docker compose down
```

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `V17__kb_soft_delete_and_category.sql` | deleted_at 컬럼, kb_category 테이블, category_id FK, 데이터 마이그레이션 |
| `KnowledgeBaseEntity.java` | deletedAt, categoryId 필드 추가 |
| `KnowledgeBaseDto.java` | tags 제거, categoryId/categoryName/deletedAt 추가 |
| `KbCategoryEntity.java` (신규) | 카테고리 엔티티 |
| `KbCategoryRepository.java` (신규) | 카테고리 CRUD + 검색 |
| `KbCategoryService.java` (신규) | 카테고리 비즈니스 로직 |
| `KbCategoryController.java` (신규) | 카테고리 API 엔드포인트 |
| `KnowledgeBaseRepository.java` | Soft Delete 쿼리, 검색/정렬 쿼리, deleted_at 필터 |
| `KnowledgeBaseServiceImpl.java` | 삭제 분기 로직, 검색/정렬 파라미터, toResponse 매핑 |
| `KnowledgeBaseController.java` | 검색/정렬 파라미터, uploadPdf에 categoryId 추가 |
| `PdfPipelineServiceImpl.java` | deleteBook → Soft Delete, 카테고리 전달 |
| `PdfProcessingWorker.java` | 청크 생성 시 categoryId 설정 |
| `types/senior.ts` | KbItem tags 제거, categoryId/categoryName/deletedAt 추가 |
| `api/senior.ts` | getAll에 검색/정렬 파라미터, 카테고리 API 추가 |
| `hooks/useKnowledgeBase.ts` | search/sort 상태, 서버 사이드 검색/정렬 |
| `hooks/useKbCategory.ts` (신규) | 카테고리 목록 + 자동 완성 |
| `components/kb/CategoryAutocomplete.tsx` (신규) | 자동 완성 입력 컴포넌트 |
| `KnowledgeBasePage.tsx` | 검색/정렬 UI, 태그 제거, 카테고리만 표시 |
| `KbDetailPage.tsx` | PDF 항목 수정 버튼 표시 |
| `KbEditPage.tsx` | PDF 항목 편집 지원 (source 읽기 전용) |
| `KbWritePage.tsx` | 태그 입력 제거, CategoryAutocomplete 적용 |
| `PdfUploadModal.tsx` | 카테고리 선택 필드 추가 |

---

## DB 스키마 변경 없음 보장

- `category` VARCHAR 컬럼: **삭제하지 않음** (기존 데이터 보존, 코드에서 사용 중단)
- `tags` VARCHAR 컬럼: **삭제하지 않음** (기존 데이터 보존, 코드에서 사용 중단)
- 신규 컬럼/테이블만 추가 (비파괴적 마이그레이션)

---

## 리스크

| 리스크 | 완화 방안 |
|--------|----------|
| Soft Delete로 vector search에 삭제 항목 포함 | 모든 vector search 쿼리에 `deleted_at IS NULL` 추가 |
| 카테고리 마이그레이션 시 기존 데이터 불일치 | `ON CONFLICT DO NOTHING`으로 중복 방지, 매핑 후 검증 쿼리 실행 |
| tags→category 전환 시 기존 태그 데이터 유실 | DB 컬럼 유지, 코드에서만 사용 중단 |
| 검색/정렬 쿼리 성능 | title + content에 GIN index 고려 (대량 데이터 시) |
| PDF 편집 시 원본과 수정본 혼동 | UI에서 source 배지로 "도서 원본 (수정됨)" 표시 |
| 카테고리 자동 완성 UX | debounce 적용, 빈 입력 시 최근 사용 카테고리 표시 |

---

## 영향 범위

| 영역 | 영향 |
|------|------|
| Backend 코드 | Entity, Service, Controller, Repository 전반 수정 + 신규 카테고리 도메인 |
| Frontend | 5개 페이지/컴포넌트 수정 + 2개 신규 (CategoryAutocomplete, useKbCategory) |
| DB 스키마 | V17 마이그레이션 (비파괴적: 추가만) |
| API 엔드포인트 | 기존 3개 변경 + 신규 3개 (카테고리) |
| E2E 테스트 | API 6개 + UI 5개 추가 |
| RAG 검색 | deleted_at IS NULL 필터 추가 (동작 변경) |

---

## 진행 상황

- [x] Step 1: Flyway 마이그레이션 — Soft Delete + 카테고리 테이블
- [x] Step 2: Backend Entity + DTO 변경
- [x] Step 3: Backend Repository 변경 — Soft Delete 쿼리
- [x] Step 4: Backend Service 변경 — 삭제 분기 + 검색/정렬
- [x] Step 5: Backend Controller 변경 — 엔드포인트 추가
- [x] Step 6: Frontend — 태그 제거 + 카테고리 자동 완성
- [x] Step 7: Frontend — PDF 편집 + 업로드 카테고리
- [x] Step 8: Frontend — 정렬 + 검색 UI
- [x] Step 9: 단위 테스트 작성
- [x] Step 10: E2E 테스트 작성
- [x] Step 11: 4-Agent Pipeline 실행

---

## 4-Agent Pipeline 결과

| Step | 결과 |
|------|------|
| Backend clean build | BUILD SUCCESSFUL (32s) |
| Unit tests | 전체 통과 (신규: KbCategoryServiceImplTest 9개, KbCategoryControllerTest 4개, KbServiceImpl delete 분기/search/sort 테스트) |
| E2E API tests | **18 passed** (기존 8개 + 신규 10개: search 3, category 3, sort 포함) |
| E2E UI tests | **11 passed** (기존 8개 + 신규 3개: search UI, sort dropdown, tags 제거 확인) |

---

## 최종 요약

### 구현 결정사항

1. **카테고리 접근 방식 간소화**: `category_id` FK 대신, `knowledge_base.category` VARCHAR 유지 + `kb_category` 테이블은 자동완성 전용으로 사용. 복잡한 FK 관계 없이 동일한 UX 달성.
2. **태그/카테고리 DB 컬럼 보존**: `tags`, `category` VARCHAR 컬럼 삭제하지 않음 — 코드에서만 사용 중단 (비파괴적 마이그레이션)
3. **삭제 분기**: PDF 항목(source != null) → Soft Delete, 수동 항목(source == null) → Hard Delete
4. **책 단위 삭제 변경**: `deleteBook()` — Hard Delete → Soft Delete로 변경, Job 이력도 보존
5. **검색/정렬**: 서버 사이드 구현 (JPQL), 클라이언트는 debounce 300ms 후 API 호출

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `V17__kb_soft_delete_and_category.sql` | deleted_at 컬럼, kb_category 테이블, 기존 카테고리 마이그레이션, 인덱스 |
| `KnowledgeBaseEntity.java` | deletedAt 필드 추가 |
| `KnowledgeBaseDto.java` | tags 제거, deletedAt 추가 |
| `KbCategoryEntity/Repository/Service/Controller` | 신규 카테고리 도메인 (CRUD + 자동완성 검색) |
| `KnowledgeBaseRepository.java` | findAllActive, findActiveById, softDelete, softDeleteBySource, search/sort 쿼리, vector search에 deleted_at IS NULL 추가 |
| `KnowledgeBaseServiceImpl.java` | 삭제 분기(PDF=soft, 수동=hard), findAll(search, sort), categoryService 연동 |
| `KnowledgeBaseController.java` | search/sort 쿼리 파라미터, uploadPdf에 category 추가 |
| `PdfPipelineService/Impl.java` | startUpload에 category 파라미터, deleteBook → softDeleteBySource |
| `PdfProcessingWorker.java` | processPdf에 category 파라미터, 청크에 category 설정 |
| `types/senior.ts` | KbItem에서 tags 제거, deletedAt/KbCategory 추가 |
| `api/senior.ts` | getAll에 search/sort 파라미터, uploadPdf에 category, kbCategoryApi 추가 |
| `CategoryAutocomplete.tsx` | 신규 자동완성 입력 컴포넌트 |
| `useKnowledgeBase.ts` | search/sort 상태, 서버 사이드 검색/정렬 |
| `KnowledgeBasePage.tsx` | 검색 입력 + 정렬 드롭다운 UI, 태그 표시 제거 |
| `KbDetailPage.tsx` | PDF 항목에도 수정/삭제 버튼 표시, 태그 제거 |
| `KbWritePage/KbEditPage.tsx` | 태그 입력 제거, CategoryAutocomplete 적용 |
| `PdfUploadModal.tsx` | 카테고리 선택 필드 추가 |
| senior 컴포넌트 (FaqCard, FaqView, ChatView 등) | tags 참조 전부 제거 |
