# Words Convention — Frontend 구현 + 이미지 첨부 (v1)

> 변경 유형: 기능 추가  
> 작성일: 2026-04-10  
> 버전: v1  
> 상태: 완료

---

## 1. 목적

IT 회사에서 직군 간 용어 불일치(디자이너 "LNB", 개발자 "GNB", QA "Left Bar")를 해결하기 위한 팀 용어 표준화 UI를 구현한다. 용어에 대표 이미지를 첨부하여 시각적으로 의미를 전달할 수 있도록 한다.

---

## 2. 변경 범위 요약

| 구분 | 변경 내용 |
|------|-----------|
| DB | `convention` 테이블에 `image_url`, `updated_at` 컬럼 추가 |
| Backend | Convention 이미지 업로드/서빙 Controller 추가, DTO에 imageUrl 필드 추가 |
| Frontend | Word Card List 페이지, Word 등록/수정 상세 페이지, 검색/정렬 기능 구현 |
| E2E | API 테스트 보강 + UI 테스트 신규 작성 |

---

## 3. 유저 시나리오

### 3-1. Word 등록 (상세 페이지)

```
LNB > Word Conventions 클릭
    ↓
Word Card List 화면 진입
    ↓
[+ Add Word] 버튼 클릭
    ↓
/conventions/new 상세 페이지로 이동
    ↓
Term 입력: "LNB"
Definition 입력: "Left Navigation Bar. 화면 좌측 세로 메뉴 영역"
Category 입력: "UI" (선택)
이미지 첨부: LNB 스크린샷 업로드
    ↓
[Save] 버튼 클릭
    ↓
/conventions (Word Card List) 로 리다이렉트
```

### 3-2. Word Card List

```
LNB > Word Conventions 클릭
    ↓
Word Card List 노출
    ↓
(기능) 정렬: 이름순 / 등록순 토글
(기능) 검색: 클라이언트 사이드 필터링 (term + definition + category)
(기능) Word Card 클릭 → /conventions/:id (상세/수정 페이지) 이동
(기능) Word Card 삭제 버튼 → 확인 다이얼로그 → 삭제
```

### 3-3. Word Card 구성

```
┌────────────────────────────┐
│  ┌──────────────────────┐  │
│  │                      │  │
│  │    대표 이미지        │  │
│  │    (없으면 placeholder) │
│  └──────────────────────┘  │
│  Term: LNB                 │
│  Left Navigation Bar...    │  ← definition 2줄 말줄임
│                    [🗑️]    │
└────────────────────────────┘
```

---

## 4. 화면 구성

### 4-1. Word Card List (`/conventions`)

```
┌─────────────────────────────────────────┐
│  Word Conventions            [+ Add Word] │  ← Header
├─────────────────────────────────────────┤
│  🔍 [검색 바]        정렬: [이름순 ▼]     │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ [이미지]  │  │ [이미지]  │  │ [이미지]  │ │
│  │ LNB      │  │ GNB      │  │ CTA      │ │
│  │ Left Na..│  │ Global...│  │ Call To..│ │
│  │      [🗑️]│  │      [🗑️]│  │      [🗑️]│ │
│  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐               │
│  │ [이미지]  │  │ [이미지]  │               │
│  │ Toast    │  │ Modal    │               │
│  │ A brief..│  │ An over..│               │
│  │      [🗑️]│  │      [🗑️]│               │
│  └──────────┘  └──────────┘               │
└─────────────────────────────────────────┘
```

- 그리드 레이아웃: 반응형 (lg: 3열, md: 2열, sm: 1열)
- 검색: 클라이언트 사이드 필터링 (API 재호출 없음)
- 정렬: 이름순 (term A→Z) / 등록순 (createdAt 최신순)
- 검색 결과 없음: "일치하는 용어가 없습니다." 안내 문구

### 4-2. Word 상세/등록/수정 페이지 (`/conventions/new`, `/conventions/:id`)

```
┌─────────────────────────────────────────┐
│  ← Word Conventions         [Delete]     │  ← Header (수정 시만 Delete 표시)
├─────────────────────────────────────────┤
│                                         │
│  Term *                                 │
│  ┌─────────────────────────────────┐    │
│  │ LNB                             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Definition *                           │
│  ┌─────────────────────────────────┐    │
│  │ Left Navigation Bar.            │    │
│  │ 화면 좌측 세로 메뉴 영역         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Category                               │
│  ┌─────────────────────────────────┐    │
│  │ UI                              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Image                                  │
│  ┌─────────────────────────────────┐    │
│  │  📷 Click to upload or drag     │    │  ← 이미지 미등록 시
│  │     & drop                      │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  [이미지 미리보기]          [✕]  │    │  ← 이미지 등록 후
│  └─────────────────────────────────┘    │
│                                         │
│              [Save]                     │
│                                         │
└─────────────────────────────────────────┘
```

- 등록(/conventions/new): Term, Definition 필수. Save 후 `/conventions`로 리다이렉트
- 수정(/conventions/:id): 기존 데이터 로드. Save 후 `/conventions`로 리다이렉트
- 이미지: 선택 사항. 업로드 시 즉시 서버에 저장 → URL 반환 → 미리보기 표시
- Header [← Word Conventions] 클릭 시 목록으로 돌아감

---

## 5. DB 스키마 변경

### V14 마이그레이션

```sql
-- Flyway: V14__add_convention_image_and_updated_at.sql
ALTER TABLE convention
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL;

ALTER TABLE convention
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN convention.image_url IS '대표 이미지 URL (예: /api/convention-images/uuid.png)';
```

### convention 테이블 (변경 후)

| 컬럼 | 타입 | 설명 | 변경 |
|------|------|------|------|
| id | BIGSERIAL PK | | 기존 |
| term | VARCHAR(200) NOT NULL | 용어 | 기존 |
| definition | TEXT NOT NULL | 정의 | 기존 |
| category | VARCHAR(100) | 카테고리 | 기존 |
| created_at | TIMESTAMP | 생성일 | 기존 |
| **image_url** | **VARCHAR(500)** | **대표 이미지 URL** | **추가** |
| **updated_at** | **TIMESTAMP** | **수정일** | **추가** |

---

## 6. Backend 변경

### 6-1. ConventionEntity 변경

```java
// 추가 필드
@Column(name = "image_url", length = 500)
private String imageUrl;

@Column(name = "updated_at")
private LocalDateTime updatedAt;
```

### 6-2. ConventionDto 변경

```java
public record ConventionRequest(
    @NotBlank String term,
    @NotBlank String definition,
    String category,
    String imageUrl          // 추가 (nullable)
) {}

public record ConventionResponse(
    Long id,
    String term,
    String definition,
    String category,
    String imageUrl,         // 추가
    LocalDateTime createdAt,
    LocalDateTime updatedAt  // 추가
) {}
```

### 6-3. ConventionServiceImpl 변경

- `create()`: imageUrl 세팅, updatedAt = now()
- `update()`: imageUrl 세팅, updatedAt = now()
- `toResponse()`: imageUrl, updatedAt 포함

### 6-4. ConventionImageController 신규

기존 `KbImageController` 패턴을 따라 구현한다.

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/convention-images` | 이미지 업로드 → `{ url: "/api/convention-images/{uuid}.png" }` |
| GET | `/api/convention-images/{filename}` | 이미지 서빙 |

- 업로드 디렉토리: `${CONVENTION_IMAGE_UPLOAD_DIR:convention-images}`
- 허용 확장자: png, jpg, jpeg, gif, webp
- 최대 크기: 10MB
- 파일명: UUID 기반

### 6-5. application.yml 변경

```yaml
convention:
  image:
    upload-dir: ${CONVENTION_IMAGE_UPLOAD_DIR:convention-images}
```

---

## 7. Frontend 변경

### 7-1. 라우팅 추가 (App.tsx)

```
기존: /conventions → ConventionsPage (목록)
추가: /conventions/new → ConventionFormPage (등록)
추가: /conventions/:id → ConventionFormPage (수정)
```

### 7-2. 파일 구조

```
frontend/src/
├── api/
│   └── convention.ts               # 신규 — Convention CRUD + 이미지 업로드 API
├── hooks/
│   └── useConvention.ts            # 신규 — Convention 목록/CRUD 상태 관리
├── pages/
│   ├── ConventionsPage.tsx         # 수정 — placeholder → Word Card List
│   └── ConventionFormPage.tsx      # 신규 — 등록/수정 상세 페이지
├── components/convention/
│   ├── ConventionCard.tsx          # 신규 — Word Card (이미지 + term + definition + 삭제)
│   └── ConventionImageUpload.tsx   # 신규 — 이미지 업로드 영역 (드래그 & 드롭 + 미리보기)
└── types/
    └── convention.ts               # 신규 — Convention 전용 타입 (senior.ts에서 분리)
```

### 7-3. API 클라이언트 (`api/convention.ts`)

```typescript
export const conventionApi = {
  getAll: () => apiClient.get('/api/conventions'),
  getById: (id: number) => apiClient.get(`/api/conventions/${id}`),
  create: (data: ConventionRequest) => apiClient.post('/api/conventions', data),
  update: (id: number, data: ConventionRequest) => apiClient.put(`/api/conventions/${id}`, data),
  delete: (id: number) => apiClient.delete(`/api/conventions/${id}`),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/convention-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

### 7-4. 커스텀 훅 (`hooks/useConvention.ts`)

```typescript
// 목록 조회 + 검색 필터링 + 정렬
const useConvention = () => {
  const [conventions, setConventions] = useState<ConventionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  // ... CRUD 함수, filtered/sorted 목록 반환
};
```

### 7-5. ConventionsPage (목록)

- Header: "Word Conventions" 타이틀 + [+ Add Word] 버튼
- 검색 바: 클라이언트 사이드 필터링 (term + definition + category 부분 일치)
- 정렬 토글: 이름순 (term A→Z) / 등록순 (createdAt DESC)
- 그리드: ConventionCard 반복 렌더링
- 카드 클릭 → `/conventions/:id` 이동
- 삭제 버튼 → 확인 다이얼로그 → API 삭제 → 목록 갱신

### 7-6. ConventionFormPage (등록/수정)

- `/conventions/new` → 빈 폼 (등록 모드)
- `/conventions/:id` → 기존 데이터 로드 (수정 모드)
- Header: [← Word Conventions] 뒤로가기 + [Delete] (수정 모드만)
- 이미지 업로드: 파일 선택 즉시 서버 업로드 → URL 수신 → 미리보기
- [Save] → 등록/수정 API 호출 → `/conventions`로 navigate

### 7-7. ConventionCard

- 대표 이미지 (없으면 회색 placeholder + 아이콘)
- Term (1줄)
- Definition (2줄 말줄임)
- 삭제 버튼 (카드 우하단, stopPropagation으로 카드 클릭과 분리)

### 7-8. ConventionImageUpload

- 드래그 & 드롭 영역 + 클릭 파일 선택
- 업로드 중 로딩 표시
- 업로드 완료 시 미리보기 + [✕] 제거 버튼

---

## 8. 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | Flyway V14 마이그레이션 (image_url, updated_at) | `V14__add_convention_image_and_updated_at.sql` |
| 2 | ConventionEntity에 imageUrl, updatedAt 필드 추가 | `ConventionEntity.java` |
| 3 | ConventionDto에 imageUrl, updatedAt 추가 | `ConventionDto.java` |
| 4 | ConventionServiceImpl에 imageUrl, updatedAt 처리 반영 | `ConventionServiceImpl.java` |
| 5 | ConventionImageController 신규 (업로드 + 서빙) | `ConventionImageController.java` |
| 6 | application.yml에 convention.image.upload-dir 추가 | `application.yml` |
| 7 | Frontend 타입 정의 (types/convention.ts) | `convention.ts` |
| 8 | Frontend API 클라이언트 (api/convention.ts) | `convention.ts` |
| 9 | Frontend hook (hooks/useConvention.ts) | `useConvention.ts` |
| 10 | ConventionCard 컴포넌트 | `ConventionCard.tsx` |
| 11 | ConventionImageUpload 컴포넌트 | `ConventionImageUpload.tsx` |
| 12 | ConventionsPage (목록 + 검색 + 정렬) | `ConventionsPage.tsx` |
| 13 | ConventionFormPage (등록/수정 상세 페이지) | `ConventionFormPage.tsx` |
| 14 | App.tsx 라우팅 추가 (/conventions/new, /conventions/:id) | `App.tsx` |

---

## 9. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | LNB에서 Word Conventions 클릭 | `/conventions` 진입, Word Card List 노출 |
| 2 | [+ Add Word] 클릭 | `/conventions/new` 상세 페이지로 이동 |
| 3 | Term, Definition 입력 + Save | Convention 생성, `/conventions`로 리다이렉트, 카드 목록에 반영 |
| 4 | 이미지 첨부 후 Save | 카드에 대표 이미지 표시 |
| 5 | 이미지 없이 Save | 카드에 placeholder 이미지 표시 |
| 6 | Term 빈 값으로 Save | 필수 입력 검증 에러 표시 |
| 7 | Word Card 클릭 | `/conventions/:id` 상세/수정 페이지로 이동, 기존 데이터 로드 |
| 8 | 상세 페이지에서 Definition 수정 + Save | 수정 반영, 목록으로 리다이렉트 |
| 9 | 상세 페이지에서 기존 이미지 제거 + 새 이미지 업로드 + Save | 이미지 교체 반영 |
| 10 | 카드 삭제 버튼 클릭 | 확인 다이얼로그 → 삭제 → 목록에서 제거 |
| 11 | 상세 페이지 Header [Delete] 클릭 | 삭제 → 목록으로 리다이렉트 |
| 12 | 검색 바에 "LNB" 입력 | term/definition/category에 "LNB" 포함하는 카드만 필터링 |
| 13 | 정렬: 이름순 선택 | term A→Z 정렬 |
| 14 | 정렬: 등록순 선택 | createdAt 최신순 정렬 |
| 15 | 검색 결과 없음 | "일치하는 용어가 없습니다." 안내 문구 |
| 16 | [← Word Conventions] 클릭 | 목록 페이지로 복귀 |

---

## [최종 요약]

### 검증 결과

| 항목 | 결과 |
|------|------|
| Backend Build | PASSED |
| Backend Unit Tests | PASSED (353 tests, 0 failures) |
| Frontend Unit Tests | PASSED (52 tests, 0 failures) |
| E2E API Tests (convention) | PASSED |
| E2E UI Tests (convention) | PASSED |
| 전체 E2E | 179/186 passed (7 failures는 기존 company v12 테스트 — 본 변경과 무관) |

### 생성/변경 파일 목록

#### Backend
| 파일 | 구분 |
|------|------|
| `db/migration/V14__add_convention_image_and_updated_at.sql` | 신규 |
| `convention/ConventionEntity.java` | 수정 |
| `convention/ConventionDto.java` | 수정 |
| `convention/ConventionServiceImpl.java` | 수정 |
| `convention/ConventionImageController.java` | 신규 |
| `application.yml` | 수정 |

#### Frontend
| 파일 | 구분 |
|------|------|
| `types/convention.ts` | 신규 |
| `api/convention.ts` | 신규 |
| `hooks/useConvention.ts` | 신규 |
| `components/convention/ConventionCard.tsx` | 신규 |
| `components/convention/ConventionImageUpload.tsx` | 신규 |
| `pages/ConventionsPage.tsx` | 수정 (전면 재작성) |
| `pages/ConventionFormPage.tsx` | 신규 |
| `App.tsx` | 수정 |

#### Tests
| 파일 | 구분 |
|------|------|
| `ConventionServiceImplTest.java` | 수정 |
| `ConventionControllerTest.java` | 수정 |
| `ConventionImageControllerTest.java` | 신규 |
| `hooks/__tests__/useConvention.test.ts` | 신규 |
| `components/convention/__tests__/ConventionCard.test.tsx` | 신규 |
| `qa/api/convention.spec.ts` | 수정 |
| `qa/ui/convention.spec.ts` | 신규 |
