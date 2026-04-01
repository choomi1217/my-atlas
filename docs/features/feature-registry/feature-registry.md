# Feature Registry — 현재 구현 요약 (v3)

## 개요

Feature Registry는 QA 테스트 케이스를 계층적으로 관리하는 시스템이다.
Company → Product → TestCase 3단계 드릴다운 구조로, Segment 기반 경로(Path)를 통해 테스트 케이스를 분류한다.

```
Company (1) → Product (N) → TestCase (M)
                  └── Segment (N) ← 계층형 경로 노드 (Adjacency List)
                        └── TestCase.path = Segment ID 배열로 참조
```

---

## URL 라우팅

| 단계 | URL | 화면 |
|------|-----|------|
| 1 | `/features` | Company 목록 |
| 2 | `/features/companies/:companyId` | Product 목록 |
| 3 | `/features/companies/:companyId/products/:productId` | TestCase 목록 |

---

## 데이터베이스 스키마

### 테이블 구조

| 테이블 | 주요 컬럼 | 비고 |
|--------|----------|------|
| **company** | id, name, is_active, created_at | 활성 회사 1개 제한 (partial unique index) |
| **product** | id, company_id(FK), name, platform, description, created_at | Platform: WEB, DESKTOP, MOBILE, ETC |
| **segment** | id, name, product_id(FK), parent_id(FK self-ref) | Adjacency List, CASCADE 삭제 |
| **test_case** | id, product_id(FK), path(bigint[]), title, description, prompt_text, preconditions, steps(jsonb), expected_result, priority, test_type, status, created_at, updated_at | path는 Segment ID 배열 |

### Enum 값

- **Platform**: WEB, DESKTOP, MOBILE, ETC
- **Priority**: HIGH, MEDIUM, LOW
- **TestType**: SMOKE, FUNCTIONAL, REGRESSION, E2E
- **TestStatus**: DRAFT, ACTIVE, DEPRECATED

### Flyway 마이그레이션

- `V1__create_company_features.sql` — Company, Product 초기 스키마
- `V2__create_test_case.sql` — TestCase 테이블 (feature_id 기반, 현재 제거됨)
- `V3__remove_feature_add_segment.sql` — Feature 제거, Segment 추가, TestCase에 product_id/path/description/prompt_text 이전

---

## Backend API

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### Company (`/api/companies`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/companies` | 전체 회사 목록 |
| POST | `/api/companies` | 회사 생성 |
| PATCH | `/api/companies/{id}/activate` | 회사 활성화 (1개만 가능) |
| DELETE | `/api/companies/{id}` | 회사 삭제 (CASCADE) |

### Product (`/api/products`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/products?companyId={id}` | 회사별 제품 목록 |
| POST | `/api/products` | 제품 생성 |
| PUT | `/api/products/{id}` | 제품 수정 |
| DELETE | `/api/products/{id}` | 제품 삭제 (CASCADE) |

### Segment (`/api/segments`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/segments?productId={id}` | 제품별 세그먼트 전체 조회 |
| POST | `/api/segments` | 세그먼트 생성 (productId, name, parentId) |
| PUT | `/api/segments/{id}` | 이름 수정 |
| DELETE | `/api/segments/{id}` | 삭제 (자식 CASCADE) |

### TestCase (`/api/test-cases`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/test-cases?productId={id}` | 제품별 테스트 케이스 목록 |
| POST | `/api/test-cases` | 테스트 케이스 생성 (@Valid 검증) |
| PUT | `/api/test-cases/{id}` | 테스트 케이스 수정 |
| DELETE | `/api/test-cases/{id}` | 삭제 (JPQL 직접 삭제) |
| POST | `/api/test-cases/generate-draft` | AI 드래프트 생성 (productId, path) |

---

## Backend 파일 구조

```
backend/src/main/java/com/myqaweb/feature/
├── CompanyEntity.java / CompanyDto.java / CompanyRepository.java
├── CompanyService.java / CompanyServiceImpl.java / CompanyController.java
├── ProductEntity.java / ProductDto.java / ProductRepository.java
├── ProductService.java / ProductServiceImpl.java / ProductController.java
├── SegmentEntity.java / SegmentDto.java / SegmentRepository.java
├── SegmentService.java / SegmentServiceImpl.java / SegmentController.java
├── TestCaseEntity.java / TestCaseDto.java / TestCaseRepository.java
├── TestCaseService.java / TestCaseServiceImpl.java / TestCaseController.java
├── TestStep.java              # record(order, action, expected)
├── Platform.java / Priority.java / TestType.java / TestStatus.java
├── ApiResponse.java           # 공통 응답 래퍼
└── GlobalExceptionHandler.java
```

---

## Frontend 파일 구조

```
frontend/src/
├── types/features.ts          # Company, Product, Segment, TestCase, TestStep 인터페이스
├── api/features.ts            # companyApi, productApi, segmentApi, testCaseApi
├── pages/features/
│   ├── CompanyListPage.tsx     # 회사 목록 + CRUD
│   ├── ProductListPage.tsx     # 제품 목록 + CRUD
│   └── TestCasePage.tsx        # 테스트 케이스 관리 (메인 페이지)
├── components/features/
│   ├── Breadcrumb.tsx          # 네비게이션 경로 표시
│   ├── PathViewToggle.tsx      # 입력 뷰 / 목차 뷰 전환
│   ├── CascadingPathInput.tsx  # 세그먼트 Cascading Dropdown (자동완성 + 생성)
│   └── SegmentTreeView.tsx     # 세그먼트 트리 뷰 (펼침/접힘, 카운트 배지)
├── context/ActiveCompanyContext.tsx  # 활성 회사 상태 관리
└── stores/featureStore.ts     # Zustand 스토어
```

---

## 핵심 기능

### 1. Segment 기반 경로 관리

TestCase의 path는 `Long[]` (bigint[])로 Segment ID 배열을 저장한다.
UI에서는 Segment 이름으로 해석하여 `"Main > Login > Social"` 형태로 표시한다.

- **CascadingPathInput**: depth별 Combobox 배열, 자동완성 + 새 세그먼트 인라인 생성
- **SegmentTreeView**: Adjacency List 기반 트리 렌더링, 노드별 테스트 케이스 수 배지

### 2. AI 드래프트 생성

Spring AI ChatClient를 통해 Claude에게 테스트 케이스 초안 생성을 요청한다.

- Segment path를 이름으로 해석하여 context 구성
- JSON 배열 형식의 테스트 스텝 응답을 파싱
- DRAFT 상태의 TestCase로 저장
- 실패 시 빈 목록 반환 (graceful fallback)

### 3. 테스트 케이스 필터링

클라이언트 사이드에서 selectedPath 기준으로 필터링:
```typescript
selectedPath.every((id, i) => testCase.path[i] === id)
```

### 4. 단일 활성 회사

PostgreSQL partial unique index로 `is_active = true`인 회사를 최대 1개로 제한한다.

---

## E2E 테스트 커버리지

### API 테스트 (`qa/api/`)

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `company.spec.ts` | Company CRUD | 생성, 조회, 활성화, 삭제 |
| `product.spec.ts` | Product CRUD | 생성, 조회, 수정, 삭제, CASCADE 삭제 |
| `segment.spec.ts` | Segment CRUD | 생성, 조회, 수정, 삭제, 부모 검증, CASCADE 삭제 |
| `feature.spec.ts` | TestCase CRUD | 생성, 조회, 수정, 삭제, 검증(400), CASCADE 삭제 |

### UI 테스트 (`qa/ui/`)

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `company-panel.spec.ts` | Company 페이지 | 제목 표시, 추가, 활성화, 삭제, Product 이동 |
| `product-panel.spec.ts` | Product 페이지 | 폼 표시, 추가(WEB/MOBILE), API 데이터 표시, 삭제, TestCase 이동, 빈 상태 |
| `feature-panel.spec.ts` | TestCase 페이지 | 빈 목록, 추가, API 데이터 표시, 삭제, 뷰 전환, 경로 표시 |

### 헬퍼 (`qa/helpers/`, `qa/pages/`)

- `api-helpers.ts` — createTestCompany, createTestProduct, createTestSegment, createTestTestCase, cleanupAllTestData
- `features-page.ts` — Page Object (goto, gotoCompany, gotoProduct 등)

---

## 버전 히스토리

| 버전 | 주요 변경 | 문서 |
|------|----------|------|
| v1 | 초기 Company + Product + Feature 구조 | `feature-registry_v1.md` |
| v2 | TestRail 스타일 4단계 드릴다운 (Company → Product → Feature → TestCase) | `feature-registry_v2.md` |
| v3 | Feature 제거, Segment 추가, 3단계 드릴다운 (Company → Product → TestCase) | `feature-registry_v3.md` |
| v4 | Segment 트리 뷰 및 경로 입력 UI 개선 | `feature-registry_v4.md` |
| v5 | TestCase 모달 대규모 개선, ConfirmDialog, Company/Product UX 개선 | `feature-registry_v5.md` |
| v6 | TestCase 모달 다듬기 (Description/Prompt Text 삭제, Status 기본값 ACTIVE) | `feature-registry_v6.md` |
| v7 | Segment 드래그 앤 드롭으로 계층 구조 변경 | `feature-registry_v7.md` |
