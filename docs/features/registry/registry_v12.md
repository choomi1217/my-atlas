# Feature Registry — TestCase 이미지, 댓글 스레드, CRUD UX 개선 (v12)

> 변경 유형: 기능 추가 + 기능 개선  
> 작성일: 2026-04-09  
> 버전: v12  
> 상태: 완료

---

## 요구사항

### [FEAT-1] TestCase에 이미지 추가 기능

- TestCase에는 테스트 할 때 참고할 수 있는 사진을 넣을 수 있어야 한다.
- 사용자가 사진을 드래그&드랍 혹은 File 첨부 등으로 사진을 첨부할 경우 Steps, Expected Result에서 해당 사진을 참고 할 수 있게끔 `image #1` 등으로 표시해주고, 이미지에 마우스 호버 시 이미지를 보여주는 방식으로 노출한다.

### [FEAT-2] TestResult Comment 스레드 기능

1. Comment를 달고 나서 DB에 저장은 되지만, UI로 보여주지 않는다.
   - Comment의 UI가 보여야 하며, 이미지도 첨부 할 수 있어야 한다.
2. Comment는 여러 개 달 수 있어야 한다.
   - 대댓글 구조 (댓글에 댓글)
   - 현재로서 유저 정보는 필요 없고 아래처럼 댓글을 달 수 있으면 된다.
```
- TestEngineer : UI가 기대결과와 조금 달라서 Fail 처리 했습니다. [이미지 첨부]
    - QA : 이에 대해 디자이너와 소통 했습니다. 이게 현재 옳게 디자인 된 것으로 피그마 업데이트가 필요 해보입니다. [피그마 링크 첨부]
- TestEngineer : 위 대화를 통해 이번 Test Pass 처리 했습니다.
```

### [UX-1] TestResult Status 선택 UX 개선

- 현재 select box로 Pass/Fail을 선택하는 UX가 좋지 않다.
- **변경 제안**: 인라인 버튼 그룹으로 교체
  - 모든 상태를 한눈에 볼 수 있고, 1-click으로 변경 가능
  - 각 버튼은 상태별 색상 (PASS=초록, FAIL=빨강, BLOCKED=노랑 등)
  - 현재 선택된 상태는 배경색 강조 + 체크 아이콘
```
현재: [Select Box ▼] → 클릭 → 옵션 선택 → 반영 (2-click)

변경: [✓ Pass] [✗ Fail] [⊘ Blocked] [→ Skip] [↻ Retest]  ← 1-click 즉시 반영
       (초록)   (빨강)    (노랑)      (회색)    (파랑)
```

### [UX-2] Company 수정 기능

1. Company Active 상태 수정 UI 부재
   - 한번 Active로 변경된 Company는 Deactivate 불가
   - Active/Deactivate 토글로 Company 관리 가능하게 변경
2. Company 이름 수정 불가
   - 이름 수정 UI 추가

### [UX-3] Product 수정 기능

- Product의 이름과 Description 수정하는 UI가 없다.
- Backend PUT `/api/products/{id}` 엔드포인트는 이미 존재 → Frontend UI만 추가

### [UX-4] Version 수정 기능

- Version의 이름과 Description 수정하는 UI가 없다.
- Backend PATCH `/api/versions/{id}` 엔드포인트는 이미 존재 → Frontend UI만 추가

### [DESIGN-1] Company 카드 UI 개선 (PM/Designer 제안)

**문제:**
- Company 카드가 작고 볼품없어 보인다.
- 실제로 Company 수가 많지 않으므로 (이직 빈도가 낮음) 목록 형태가 과하다.

**제안: Active Company 히어로 레이아웃**
```
┌──────────────────────────────────────────────────────────┐
│  ★ Active Company                                        │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  🏢  my-atlas                                       │ │
│  │      Active since 2026-03-01                        │ │
│  │      Products: 3                                    │ │
│  │                                                     │ │
│  │      [Edit Name] [Deactivate] [Delete]              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ─── Other Companies ──────────────────────────────────  │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │ old-company (비활성)  │  │ test-corp (비활성)       │ │
│  │ [Activate] [Edit]    │  │ [Activate] [Edit]        │ │
│  │ [Delete]             │  │ [Delete]                 │ │
│  └──────────────────────┘  └──────────────────────────┘ │
│                                                          │
│  [+ New Company]                                         │
└──────────────────────────────────────────────────────────┘
```

- Active Company → 상단에 큰 히어로 카드 (accent border, 넓은 영역)
- Inactive Companies → 하단에 콤팩트 카드 (작은 크기, 회색 톤)
- Product 개수 표시로 정보 밀도 증가
- Active Company가 없으면 "활성 회사를 선택하세요" 안내 표시

---

## 현재 코드 분석 (Context)

### TestCaseEntity (FEAT-1 관련)

- 파일: `backend/src/main/java/com/myqaweb/feature/TestCaseEntity.java`
- 현재 필드: title, description, promptText, preconditions, steps(JSONB), expectedResult, priority, testType, status
- 이미지 관련 필드/테이블 **없음**
- `TestStep.java`: `record TestStep(int order, String action, String expected)` — 이미지 참조 없음

### TestCaseFormModal (FEAT-1 관련)

- 파일: `frontend/src/components/features/TestCaseFormModal.tsx`
- Steps 편집: 인라인 텍스트 입력 (action, expected)
- 파일 업로드 UI **없음**
- Expected Result: textarea

### TestResultEntity (FEAT-2 관련)

- 파일: `backend/src/main/java/com/myqaweb/feature/TestResultEntity.java`
- `comment` 필드: 단일 TEXT 컬럼 (L40)
- 대댓글/스레드 구조 **없음**

### VersionPhaseDetailPage (FEAT-2, UX-1 관련)

- 파일: `frontend/src/pages/features/VersionPhaseDetailPage.tsx`
- Comment UI (L270-293): 단일 textarea + Save 버튼, 기존 댓글 목록 표시 없음
- Status 선택 (L206-218): `<select>` HTML 요소로 6개 상태 표시
- ResultStatusBadge 컴포넌트: 상태별 색상 매핑 존재 (초록, 빨강, 노랑, 회색, 파랑)

### CompanyController (UX-2 관련)

- 파일: `backend/src/main/java/com/myqaweb/feature/CompanyController.java`
- 기존 엔드포인트: GET(목록), POST(생성), PATCH activate, DELETE
- 이름 수정 PUT/PATCH **없음**
- Deactivate 엔드포인트 **없음**
- CompanyService: `findAll`, `findById`, `save`, `setActive`, `delete` — `update`/`deactivate` **없음**

### CompanyListPage (UX-2, DESIGN-1 관련)

- 파일: `frontend/src/pages/features/CompanyListPage.tsx`
- 카드 UI (L129-166): 작은 카드에 name + isActive 배지 + Activate/Delete 버튼
- 편집 기능 **없음**
- companyApi: `getAll`, `create`, `setActive`, `delete` — `update`/`deactivate` **없음**

### ProductListPage (UX-3 관련)

- 파일: `frontend/src/pages/features/ProductListPage.tsx`
- 카드 버튼: Test Runs / Versions / Delete — 편집 버튼 **없음**
- Backend PUT `/api/products/{id}` **존재** (ProductController L45-51)
- Frontend `productApi.update()` **존재** (features.ts L84-100)
- ProductFormModal은 생성 전용 — 수정 모드 **미구현**

### VersionDetailPage (UX-4 관련)

- 파일: `frontend/src/pages/features/VersionDetailPage.tsx`
- Version 정보: read-only 표시 (name, description, releaseDate)
- Backend PATCH `/api/versions/{id}` **존재** (VersionController L50-58)
- Frontend `versionApi.update()` **존재 확인 필요**
- 편집 UI **없음**

### 기존 이미지 업로드 패턴 (재사용 가능)

- 파일: `backend/src/main/java/com/myqaweb/knowledgebase/KbImageController.java`
- POST `/api/kb/images`: multipart 업로드 → UUID 파일명 → 로컬 디스크 저장
- GET `/api/kb/images/{filename}`: Content-Type 자동 감지 후 서빙
- 허용 확장자: png, jpg, jpeg, gif, webp / 최대 10MB
- `application.yml` L68-69: `kb.image.upload-dir` 설정

### Flyway 마이그레이션

- 현재: V1 ~ V12 (V12는 KB 관련)
- 다음 마이그레이션: **V13**

---

## 구현 계획

### Step 1 — DB Migration: V13 (test_case_image + test_result_comment)

**신규 파일:** `backend/src/main/resources/db/migration/V13__create_test_case_image_and_result_comment.sql`

```sql
-- TestCase에 첨부된 이미지 (1:N)
CREATE TABLE test_case_image (
    id             BIGSERIAL PRIMARY KEY,
    test_case_id   BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    filename       VARCHAR(255) NOT NULL,     -- UUID 기반 저장 파일명
    original_name  VARCHAR(255) NOT NULL,     -- 원본 파일명
    order_index    INT NOT NULL,              -- image #1, #2, ... 순번
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_test_case_image_tc ON test_case_image(test_case_id);

-- TestResult 댓글 스레드 (대댓글: self-ref parent_id)
CREATE TABLE test_result_comment (
    id              BIGSERIAL PRIMARY KEY,
    test_result_id  BIGINT NOT NULL REFERENCES test_result(id) ON DELETE CASCADE,
    parent_id       BIGINT REFERENCES test_result_comment(id) ON DELETE CASCADE,
    author          VARCHAR(100),             -- 작성자 이름 (인증 없음, 자유 입력)
    content         TEXT NOT NULL,
    image_url       VARCHAR(500),             -- 첨부 이미지 URL (선택)
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trc_result ON test_result_comment(test_result_id);
CREATE INDEX idx_trc_parent ON test_result_comment(parent_id);
```

- [x] V13 마이그레이션 SQL 작성
- [x] 기존 `test_result.comment` 컬럼은 유지 (하위 호환), Frontend에서만 새 테이블 사용

---

### Step 2 — Backend: Feature Image Upload (공통 이미지 컨트롤러)

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/FeatureImageController.java` | 이미지 업로드/서빙 REST 컨트롤러 |

**기존 KbImageController 패턴 재사용:**
- POST `/api/feature-images` → multipart 업로드, UUID 파일명, 로컬 저장
- GET `/api/feature-images/{filename}` → Content-Type 자동 감지 후 서빙
- 허용: png, jpg, jpeg, gif, webp / 최대 10MB
- 저장 경로: `feature-images/` (application.yml에 설정 추가)

**변경 파일:** `backend/src/main/resources/application.yml`

- [x] `feature.image.upload-dir` 설정 추가
- [x] FeatureImageController 생성 (upload + serve)
- [x] TestCase 이미지와 Comment 이미지 모두 이 엔드포인트 사용

---

### Step 3 — Backend: TestCase Image 관리

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/TestCaseImageEntity.java` | @Entity test_case_image |
| `feature/TestCaseImageRepository.java` | findAllByTestCaseIdOrderByOrderIndex |

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `feature/TestCaseDto.java` | TestCaseResponse에 `images` 리스트 추가 |
| `feature/TestCaseController.java` | 이미지 연결 엔드포인트 추가 |
| `feature/TestCaseServiceImpl.java` | 이미지 CRUD 로직 추가 |

**엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/test-cases/{id}/images` | 이미지 연결 (filename, originalName 전달) |
| DELETE | `/api/test-cases/{id}/images/{imageId}` | 이미지 연결 해제 |
| GET | `/api/test-cases/{id}/images` | TestCase의 이미지 목록 조회 |

- [x] TestCaseImageEntity 생성
- [x] TestCaseImageRepository 생성
- [x] TestCaseDto.TestCaseResponse에 images 필드 추가
- [x] TestCaseController에 이미지 관리 엔드포인트 추가
- [x] TestCaseServiceImpl에 이미지 CRUD 로직 추가

---

### Step 4 — Backend: TestResult Comment Thread

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/TestResultCommentEntity.java` | @Entity test_result_comment (self-ref parent_id) |
| `feature/TestResultCommentDto.java` | CreateCommentRequest, CommentResponse (children 포함) |
| `feature/TestResultCommentRepository.java` | findAllByTestResultIdAndParentIdIsNull + replies 조회 |
| `feature/TestResultCommentService.java` | 인터페이스 |
| `feature/TestResultCommentServiceImpl.java` | CRUD + 트리 변환 로직 |
| `feature/TestResultCommentController.java` | REST 컨트롤러 |

**엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/versions/{versionId}/results/{resultId}/comments` | 댓글 스레드 조회 (트리 구조) |
| POST | `/api/versions/{versionId}/results/{resultId}/comments` | 댓글 작성 (body: author, content, parentId?, imageUrl?) |
| DELETE | `/api/versions/{versionId}/results/{resultId}/comments/{commentId}` | 댓글 삭제 (CASCADE) |

**CommentResponse 구조:**
```json
{
  "id": 1,
  "author": "TestEngineer",
  "content": "UI가 기대결과와 조금 달라서 Fail 처리 했습니다.",
  "imageUrl": "/api/feature-images/abc123.png",
  "createdAt": "2026-04-09T14:30:00",
  "children": [
    {
      "id": 2,
      "author": "QA",
      "content": "디자이너와 소통 했습니다...",
      "imageUrl": null,
      "createdAt": "2026-04-09T15:00:00",
      "children": []
    }
  ]
}
```

- [x] TestResultCommentEntity 생성 (self-ref parent_id)
- [x] TestResultCommentDto 생성 (CreateCommentRequest, CommentResponse with children)
- [x] TestResultCommentRepository 생성
- [x] TestResultCommentService + Impl 생성 (트리 변환 로직)
- [x] TestResultCommentController 생성

---

### Step 5 — Backend: Company Update & Deactivate

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `feature/CompanyService.java` | `update(Long id, String name)`, `deactivate(Long id)` 추가 |
| `feature/CompanyServiceImpl.java` | 구현 |
| `feature/CompanyController.java` | PUT `/api/companies/{id}`, PATCH `/api/companies/{id}/deactivate` 추가 |
| `feature/CompanyDto.java` | CompanyResponse에 productCount 추가 (DESIGN-1용) |

- [x] CompanyService에 update, deactivate 메서드 추가
- [x] CompanyServiceImpl 구현 (deactivate: is_active = false 설정)
- [x] CompanyController에 PUT, PATCH deactivate 엔드포인트 추가
- [x] CompanyDto.CompanyResponse에 productCount 필드 추가

---

### Step 6 — Frontend: TestCase 이미지 업로드 & 참조

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `types/features.ts` | TestCaseImage 인터페이스 추가 |
| `api/features.ts` | featureImageApi, testCaseImageApi 추가 |
| `components/features/TestCaseFormModal.tsx` | 이미지 업로드 영역 + 참조 삽입 |
| `pages/features/TestCasePage.tsx` | 목록에서 이미지 참조 호버 미리보기 |

**이미지 업로드 UX:**
```
┌── 이미지 첨부 ──────────────────────────────────┐
│                                                  │
│   📎 드래그 & 드롭 또는 클릭하여 이미지 첨부     │
│                                                  │
│   [image #1] login.png  ×                        │
│   [image #2] error.png  ×                        │
│                                                  │
└──────────────────────────────────────────────────┘

Steps:
┌────┬────────────────────────┬──────────────────────────┐
│ #  │ Action                 │ Expected                 │
├────┼────────────────────────┼──────────────────────────┤
│ 1  │ 로그인 페이지 접속     │ image #1 참고            │
│    │                        │        ↑ 호버 시 팝오버  │
│ 2  │ 잘못된 비밀번호 입력   │ image #2 에러 메시지     │
└────┴────────────────────────┴──────────────────────────┘
```

**호버 미리보기 동작:**
- Steps/Expected Result 텍스트 내 `image #N` 패턴을 감지 (정규식: `/image #(\d+)/g`)
- 매칭 시 해당 텍스트를 클릭/호버 가능한 요소로 변환
- 호버 시 Tooltip/Popover로 해당 이미지 표시 (최대 너비 400px)

- [x] types/features.ts에 TestCaseImage 인터페이스 추가
- [x] api/features.ts에 featureImageApi (upload), testCaseImageApi (link/unlink/list) 추가
- [x] TestCaseFormModal에 이미지 드래그&드롭 업로드 영역 추가
- [x] 업로드된 이미지 목록 표시 (썸네일 + `image #N` 라벨 + 삭제 버튼)
- [x] Steps/Expected Result 텍스트 내 `image #N` 호버 미리보기 구현
- [x] TestCasePage 목록 뷰에서도 `image #N` 호버 미리보기 지원

---

### Step 7 — Frontend: TestResult Comment Thread

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `components/features/CommentThread.tsx` | 댓글 스레드 컴포넌트 (재귀 트리 렌더링) |

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `types/features.ts` | TestResultComment 인터페이스 추가 |
| `api/features.ts` | testResultCommentApi 추가 |
| `pages/features/VersionPhaseDetailPage.tsx` | 기존 단일 textarea → CommentThread 교체 |

**Comment Thread UX:**
```
┌── Comments ──────────────────────────────────────────────┐
│                                                          │
│  TestEngineer  •  2026-04-09 14:30                       │
│  UI가 기대결과와 조금 달라서 Fail 처리 했습니다.          │
│  [🖼 첨부 이미지 (클릭하여 확대)]                        │
│  [Reply]                                                 │
│                                                          │
│    └─ QA  •  2026-04-09 15:00                            │
│       디자이너와 소통 했습니다. 피그마 업데이트 필요.       │
│       [Reply]                                            │
│                                                          │
│  TestEngineer  •  2026-04-09 16:00                       │
│  위 대화를 통해 이번 Test Pass 처리 했습니다.              │
│  [Reply]                                                 │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  Author: [           ]                                   │
│  [📎 이미지]                                             │
│  [                     댓글 입력...                     ] │
│  [Submit]                                                │
└──────────────────────────────────────────────────────────┘
```

- [x] types/features.ts에 TestResultComment 인터페이스 추가 (children 포함)
- [x] api/features.ts에 testResultCommentApi (list, create, delete) 추가
- [x] CommentThread 컴포넌트 생성 (재귀 트리 렌더링 + Reply 버튼 + 이미지 첨부)
- [x] VersionPhaseDetailPage의 기존 단일 comment textarea → CommentThread 교체
- [x] Comment 작성 시 author 입력 필드 + 이미지 첨부 지원

---

### Step 8 — Frontend: TestResult Status 버튼 그룹

**변경 파일:** `frontend/src/pages/features/VersionPhaseDetailPage.tsx`

**기존 `<select>` → 인라인 버튼 그룹으로 교체:**

```tsx
// 기존 (select box)
<select value={result.status} onChange={...}>
  {Object.values(RunResultStatus).map(s => <option key={s}>{s}</option>)}
</select>

// 변경 (button group)
<StatusButtonGroup
  current={result.status}
  onChange={(status) => handleStatusChange(result.id, status)}
/>
```

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `components/features/StatusButtonGroup.tsx` | 상태 버튼 그룹 컴포넌트 |

**버튼 그룹 동작:**
- 각 상태별 작은 버튼 (약어 + 색상): `P` `F` `B` `S` `R`
- 선택된 상태: 진한 배경색 + 체크 아이콘
- 미선택: 연한 배경 + 회색 테두리
- 클릭 시 즉시 API 호출 → 상태 변경
- UNTESTED 상태: 아무 버튼도 선택되지 않은 상태 (모두 연한 색)

- [x] StatusButtonGroup 컴포넌트 생성
- [x] VersionPhaseDetailPage의 select → StatusButtonGroup 교체
- [x] ResultStatusBadge 색상 매핑 재사용

---

### Step 9 — Frontend: Company 수정 UX + 카드 UI 개선

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `api/features.ts` | companyApi에 update, deactivate 추가 |
| `pages/features/CompanyListPage.tsx` | 히어로 레이아웃 + Edit/Deactivate 기능 |

**변경 사항:**
- Active Company: 상단 히어로 카드 (큰 크기, accent 스타일, productCount 표시)
- Inactive Companies: 하단 콤팩트 카드 그룹
- 각 카드에 Edit 버튼 (이름 수정 — 인라인 편집 또는 모달)
- Active 카드에 Deactivate 버튼, Inactive 카드에 Activate 버튼
- Active Company 없을 때: "활성 회사를 선택하세요" 안내

- [x] companyApi에 update(id, name), deactivate(id) 추가
- [x] CompanyListPage를 히어로 레이아웃으로 재구성
- [x] Company 이름 편집 기능 추가 (인라인 또는 모달)
- [x] Deactivate 버튼 추가 (확인 다이얼로그 포함)
- [x] productCount 표시 추가

---

### Step 10 — Frontend: Product 수정 UX

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/ProductListPage.tsx` | Edit 버튼 추가 |
| `components/features/ProductFormModal.tsx` | 수정 모드 지원 (initialData prop) |

**변경 사항:**
- Product 카드에 Edit 버튼 추가
- ProductFormModal을 수정 모드 지원 (기존 데이터 pre-fill)
- 수정 시 `productApi.update(id, name, platform, description)` 호출

- [x] ProductFormModal에 수정 모드 추가 (initialData prop, isEdit flag)
- [x] ProductListPage에 Edit 버튼 추가 + 수정 핸들러

---

### Step 11 — Frontend: Version 수정 UX

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/VersionDetailPage.tsx` | Edit 버튼 + 인라인 편집 또는 모달 |
| `components/features/VersionFormModal.tsx` | 수정 모드 지원 (선택) |

**변경 사항:**
- VersionDetailPage에 Edit 버튼 추가
- 이름, Description, Release Date 편집 가능
- 수정 시 `versionApi.update(id, name, description, releaseDate)` 호출

- [x] VersionDetailPage에 Edit 기능 추가 (인라인 편집)
- [x] 수정 완료 시 Version 정보 실시간 갱신

---

## 변경 요약

### 신규 파일 (Backend)

| 파일 | 내용 |
|------|------|
| `db/migration/V13__create_test_case_image_and_result_comment.sql` | 테이블 2개 생성 |
| `feature/FeatureImageController.java` | 이미지 업로드/서빙 (공용) |
| `feature/TestCaseImageEntity.java` | @Entity test_case_image |
| `feature/TestCaseImageRepository.java` | JPA Repository |
| `feature/TestResultCommentEntity.java` | @Entity test_result_comment |
| `feature/TestResultCommentDto.java` | DTO (Request/Response) |
| `feature/TestResultCommentRepository.java` | JPA Repository |
| `feature/TestResultCommentService.java` | 인터페이스 |
| `feature/TestResultCommentServiceImpl.java` | 구현 (트리 변환) |
| `feature/TestResultCommentController.java` | REST 컨트롤러 |

### 신규 파일 (Frontend)

| 파일 | 내용 |
|------|------|
| `components/features/CommentThread.tsx` | 댓글 스레드 (재귀 트리 + 이미지) |
| `components/features/StatusButtonGroup.tsx` | 상태 버튼 그룹 (1-click 변경) |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `application.yml` | feature.image.upload-dir 설정 추가 |
| `feature/CompanyService.java` | update, deactivate 추가 |
| `feature/CompanyServiceImpl.java` | 구현 |
| `feature/CompanyController.java` | PUT, PATCH deactivate 추가 |
| `feature/CompanyDto.java` | CompanyResponse에 productCount 추가 |
| `feature/TestCaseDto.java` | TestCaseResponse에 images 추가 |
| `feature/TestCaseController.java` | 이미지 관리 엔드포인트 추가 |
| `feature/TestCaseServiceImpl.java` | 이미지 CRUD 로직 |
| `types/features.ts` | TestCaseImage, TestResultComment 추가 |
| `api/features.ts` | featureImageApi, testCaseImageApi, testResultCommentApi, companyApi 확장 |
| `components/features/TestCaseFormModal.tsx` | 이미지 업로드 + 참조 |
| `pages/features/VersionPhaseDetailPage.tsx` | CommentThread + StatusButtonGroup |
| `pages/features/CompanyListPage.tsx` | 히어로 레이아웃 + Edit/Deactivate |
| `pages/features/ProductListPage.tsx` | Edit 버튼 |
| `components/features/ProductFormModal.tsx` | 수정 모드 |
| `pages/features/VersionDetailPage.tsx` | Edit 기능 |

---

## 최종 요약

### 구현 내용

1. **[FEAT-1]** TestCase 이미지 첨부 — DB 테이블(V13), Backend CRUD, Frontend 드래그&드롭 업로드 + `image #N` 호버 미리보기
2. **[FEAT-2]** TestResult 댓글 스레드 — 대댓글 구조(self-ref parent_id), CommentThread 재귀 렌더링, 이미지 첨부 지원
3. **[UX-1]** TestResult Status — select box → StatusButtonGroup 1-click 인라인 버튼 그룹
4. **[UX-2]** Company 수정 — PUT 이름 수정 + PATCH Deactivate 엔드포인트, 히어로 레이아웃
5. **[UX-3]** Product 수정 — ProductFormModal 수정 모드 지원, Edit 버튼 추가
6. **[UX-4]** Version 수정 — VersionDetailPage 인라인 편집 (이름, 설명, 릴리스일)
7. **[DESIGN-1]** Company 카드 UI — Active 히어로 카드 + Inactive 콤팩트 카드 분리, productCount 표시

### 신규 파일

| 구분 | 파일 수 |
|------|---------|
| Backend (Entity, DTO, Service, Controller, Repository, Migration) | 10 |
| Frontend (CommentThread, StatusButtonGroup) | 2 |

### 수정 파일

| 구분 | 파일 수 |
|------|---------|
| Backend | 7 |
| Frontend | 8 |
