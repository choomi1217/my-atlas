# Words Convention — UI 정렬 + 카테고리 자동완성 (v3)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-20  
> 버전: v3  
> 상태: 완료

---

## 1. 요구사항

### word detail 페이지가 살짝 왼쪽으로 몰림
- 현재 바뀐 UI 기준으로 가운데 배치 되어야합니다.

### Category  등록 및 수정시 자동완성 혹은 태그 기능 필요합니다.
1. 현재는 Category에 `UI` 라는 데이터가 있음에도 자동완성이 되지 않습니다.
2. KB의 카테고리를 참고해서 같은 방식으로 구현해주십시오.
3. 이를 통해 공통 분모를 뽑아낼 수 있다면 코드를 재활용 할 수 있게끔 구현 해주십시오.
4. 그렇다고 DB 테이블을 통일해서는 안되므로 word_category 테이블을 따로 생성하십시오.

---

## 2. 현재 상태 분석

### 2-1. 레이아웃 문제

`ConventionFormPage.tsx`의 루트 div가 `max-w-2xl`만 적용되어 있고 `mx-auto`가 없어 왼쪽 정렬됨.

```tsx
// 현재 (Line 91)
<div className="max-w-2xl">
```

### 2-2. 카테고리 현재 구현

- `convention` 테이블에 `category VARCHAR(100)` 인라인 저장
- Frontend에서 plain text input으로 입력 (자동완성 없음)
- 별도 카테고리 테이블 없음

### 2-3. KB 카테고리 참고 구현 (재활용 대상)

KB는 이미 카테고리 자동완성이 구현되어 있다:

| 계층 | KB 구현 | Convention에 필요한 것 |
|------|---------|----------------------|
| DB | `kb_category` 테이블 (id, name, created_at, UNIQUE name) | `word_category` 테이블 (동일 구조) |
| Backend Entity | `KbCategoryEntity.java` | `WordCategoryEntity.java` |
| Backend Service | `KbCategoryService/Impl` (findAll, search, create, ensureExists) | `WordCategoryService/Impl` (동일 패턴) |
| Backend Controller | `/api/kb/categories` (GET all, GET search, POST create) | `/api/conventions/categories` (동일 패턴) |
| Backend DTO | `KbCategoryDto` (CategoryRequest, CategoryResponse) | 공통 DTO로 추출 가능 |
| Frontend Component | `kb/CategoryAutocomplete.tsx` (KB 전용 API 하드코딩) | **공통 컴포넌트로 리팩터링** |
| Frontend API | `kbCategoryApi` (senior.ts 내부) | `conventionCategoryApi` (convention.ts 내부) |
| Frontend Type | `KbCategory` (senior.ts) | 공통 `CategoryItem` 타입으로 추출 가능 |

### 2-4. 코드 재활용 전략

요구사항 3번 "공통 분모를 뽑아낼 수 있다면 코드를 재활용"에 따라:

**Frontend — 공통 컴포넌트 추출**
- 현재 `kb/CategoryAutocomplete.tsx`는 `kbCategoryApi`를 직접 import
- **Props로 API 함수를 주입**하는 방식으로 범용화하면, KB와 Convention 양쪽에서 사용 가능
- 공통 컴포넌트 위치: `components/common/CategoryAutocomplete.tsx`

**Frontend — 공통 타입 추출**
- `KbCategory` 타입을 `CategoryItem`으로 범용화하여 `types/common.ts`에 배치
- KB와 Convention이 동일 인터페이스 사용

**Backend — DTO 공통화**
- `KbCategoryDto`의 `CategoryRequest`/`CategoryResponse`는 범용적이므로 `common/` 패키지로 이동 가능
- Entity/Service/Controller는 도메인별로 분리 유지 (요구사항 4번: DB 테이블 통일 금지)

---

## 3. 변경 범위 요약

| 구분 | 변경 내용 |
|------|-----------|
| DB | `word_category` 테이블 생성 (Flyway 마이그레이션) + 기존 convention.category 데이터 시딩 |
| Backend | WordCategoryEntity/Service/Controller 신규, CategoryDto 공통화 |
| Frontend | CategoryAutocomplete 공통 컴포넌트 추출, ConventionFormPage 레이아웃 수정 + 자동완성 적용 |
| E2E | Convention 카테고리 자동완성 테스트 추가 |

---

## 4. DB 스키마 변경

### Flyway 마이그레이션

```sql
-- V{timestamp}__create_word_category.sql

CREATE TABLE word_category (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_word_category_name UNIQUE (name)
);

-- 기존 convention.category 데이터를 word_category로 시딩
INSERT INTO word_category (name)
SELECT DISTINCT TRIM(category)
FROM convention
WHERE category IS NOT NULL AND TRIM(category) != ''
ON CONFLICT (name) DO NOTHING;
```

### word_category 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| name | VARCHAR(100) NOT NULL, UNIQUE | 카테고리 이름 |
| created_at | TIMESTAMP | 생성일 |

> convention 테이블의 `category VARCHAR(100)` 컬럼은 유지 — FK 관계 없이 텍스트 매칭 방식

---

## 5. Backend 변경

### 5-1. 공통 DTO (`common/CategoryDto.java`) — 신규

```java
// KbCategoryDto에서 추출하여 공통화
public class CategoryDto {
    public record CategoryRequest(@NotBlank String name) {}
    public record CategoryResponse(Long id, String name, LocalDateTime createdAt) {}
}
```

### 5-2. WordCategoryEntity — 신규

`KbCategoryEntity`와 동일 구조, 테이블명만 `word_category`.

### 5-3. WordCategoryRepository — 신규

```java
public interface WordCategoryRepository extends JpaRepository<WordCategoryEntity, Long> {
    Optional<WordCategoryEntity> findByName(String name);
    List<WordCategoryEntity> findByNameContainingIgnoreCaseOrderByNameAsc(String query);
    boolean existsByName(String name);
}
```

### 5-4. WordCategoryService/Impl — 신규

`KbCategoryServiceImpl`과 동일 패턴:
- `findAll()` — 전체 조회
- `search(String query)` — 대소문자 무시 부분 일치 검색
- `create(String name)` — 중복 검증 후 생성
- `ensureExists(String name)` — 없으면 생성, 있으면 무시

### 5-5. WordCategoryController — 신규

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/conventions/categories` | 전체 카테고리 조회 |
| GET | `/api/conventions/categories/search?q=` | 카테고리 검색 |
| POST | `/api/conventions/categories` | 카테고리 생성 |

### 5-6. ConventionServiceImpl 수정

- `create()` / `update()` 시 카테고리가 있으면 `wordCategoryService.ensureExists(category)` 호출
- 새 카테고리 입력 시 자동으로 `word_category` 테이블에 등록

### 5-7. KbCategoryDto → 공통 CategoryDto 리팩터링

- `KbCategoryDto`를 `common/CategoryDto`로 이동
- `KbCategoryController`, `KbCategoryServiceImpl`의 import 경로 변경
- 기존 동작에 영향 없음 (타입 동일, 패키지만 변경)

---

## 6. Frontend 변경

### 6-1. ConventionFormPage 레이아웃 수정

```tsx
// Before
<div className="max-w-2xl">

// After
<div className="max-w-2xl mx-auto">
```

### 6-2. 공통 타입 추출 (`types/common.ts`) — 신규

```typescript
export interface CategoryItem {
  id: number;
  name: string;
  createdAt: string;
}
```

- `senior.ts`의 `KbCategory` → `CategoryItem`을 re-export하거나 점진적으로 교체

### 6-3. 공통 CategoryAutocomplete 추출 (`components/common/CategoryAutocomplete.tsx`) — 신규

현재 `kb/CategoryAutocomplete.tsx`에서 API 호출을 Props로 주입받는 방식으로 범용화:

```typescript
interface CategoryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  fetchAll: () => Promise<CategoryItem[]>;  // API 주입
  placeholder?: string;
}
```

- KB는 `fetchAll={kbCategoryApi.getAll}` 전달
- Convention은 `fetchAll={conventionCategoryApi.getAll}` 전달

### 6-4. Convention API 카테고리 추가 (`api/convention.ts`)

```typescript
export const conventionCategoryApi = {
  getAll: () => apiClient.get('/api/conventions/categories').then(r => r.data.data),
  search: (q: string) => apiClient.get('/api/conventions/categories/search', { params: { q } }).then(r => r.data.data),
  create: (name: string) => apiClient.post('/api/conventions/categories', { name }).then(r => r.data.data),
};
```

### 6-5. ConventionFormPage에 CategoryAutocomplete 적용

Category input을 공통 CategoryAutocomplete 컴포넌트로 교체.

### 6-6. KB CategoryAutocomplete 교체

기존 `kb/CategoryAutocomplete.tsx`를 공통 컴포넌트로 교체하여 중복 제거.

---

## 7. 구현 순서

| Step | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | ConventionFormPage 레이아웃 수정 (`mx-auto` 추가) | `ConventionFormPage.tsx` | ✅ |
| 2 | Flyway 마이그레이션 — word_category 테이블 생성 + 기존 데이터 시딩 | `V202604201000__create_word_category.sql` | ✅ |
| 3 | Backend — WordCategoryEntity, Repository, DTO 생성 | `convention/WordCategory*.java`, `common/CategoryDto.java` | ✅ |
| 4 | Backend — WordCategoryService/Impl 생성 | `convention/WordCategoryService*.java` | ✅ |
| 5 | Backend — WordCategoryController 생성 | `convention/WordCategoryController.java` | ✅ |
| 6 | Backend — ConventionServiceImpl에 ensureExists 호출 추가 | `ConventionServiceImpl.java` | ✅ |
| 7 | Backend — KbCategoryDto → 공통 CategoryDto 리팩터링 + KB 코드 import 변경 | `common/CategoryDto.java`, `KbCategory*.java` | ✅ |
| 8 | Frontend — 공통 타입 `CategoryItem` 추출 | `types/common.ts` | ✅ |
| 9 | Frontend — 공통 CategoryAutocomplete 컴포넌트 추출 | `components/common/CategoryAutocomplete.tsx` | ✅ |
| 10 | Frontend — Convention API에 카테고리 엔드포인트 추가 | `api/convention.ts` | ✅ |
| 11 | Frontend — ConventionFormPage에 공통 CategoryAutocomplete 적용 | `ConventionFormPage.tsx` | ✅ |
| 12 | Frontend — KB CategoryAutocomplete를 공통 컴포넌트로 교체 | `KbEditPage.tsx`, `KbWritePage.tsx`, `PdfUploadModal.tsx` | ✅ |

---

## 8. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ConventionFormPage 접근 | 폼이 화면 가운데 정렬됨 |
| 2 | Category 입력 필드 포커스 | 기존 카테고리 목록이 드롭다운으로 표시 |
| 3 | Category에 "U" 입력 | "UI" 등 매칭되는 카테고리가 자동완성 제안 |
| 4 | 자동완성 제안 클릭 | 해당 카테고리가 입력 필드에 채워짐 |
| 5 | 새 카테고리 입력 후 Convention 저장 | word_category 테이블에 새 카테고리 자동 등록 |
| 6 | 동일 카테고리로 다른 Convention 저장 | word_category 중복 생성 없음 (ensureExists) |
| 7 | KB 카테고리 자동완성 기능 | 공통 컴포넌트 교체 후에도 기존과 동일하게 동작 |
| 8 | 기존 Convention 수정 | 기존 category 값이 자동완성 입력에 정상 표시 |

---

## 9. Agent Pipeline

본 기능 개선은 4-Agent Pipeline을 따른다.

| Agent | 역할 |
|-------|------|
| Agent-A | 레이아웃 수정 + Backend 카테고리 CRUD + Frontend 공통 컴포넌트 + 적용 |
| Agent-B | WordCategory 관련 Backend 단위 테스트 작성 |
| Agent-C | Convention 카테고리 E2E 테스트 작성 |
| Agent-D | Build & Test 전체 검증 |
