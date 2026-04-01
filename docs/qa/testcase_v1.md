# Product Test Suite 기능 - TestCase 명세 v1

> 변경 유형: 기능 추가  
> 작성일: 2026-03-31  
> 버전: v1  
> 상태: 진행 중

---

## 목표

Product Test Suite 기능(Company → Product → TestCase 3단계 드릴다운)의 모든 기능을 커버하는 QA TestCase를 정의한다.

**포함 범위:**
- Company 관리 (CRUD, 검색, 정렬)
- Product 관리 (CRUD, 검색, 정렬)
- Segment 관리 (Tree 구조)
- TestCase 관리 (CRUD, 필터링)
- 전체 E2E 흐름

**TestCase 총 22개**

---

## Segment 구조 (분류 체계)

```
Product Test Suite (Root)
├── Company 관리 (L1)
│   ├── CRUD (L2)
│   ├── 검색 (L2)
│   └── 정렬 (L2)
├── Product 관리 (L1)
│   ├── CRUD (L2)
│   ├── 검색 (L2)
│   └── 정렬 (L2)
├── Segment 관리 (L1)
│   ├── CRUD (L2)
└── TestCase 관리 (L1)
    ├── CRUD (L2)
    └── 필터링 (L2)
```

---

## TestCase 목록 및 상세 명세

### Group 1: Company 관리 (7개)

#### [TC-01] Company 신규 등록

| 항목 | 값 |
|------|-----|
| **ID** | TC-01 |
| **제목** | Company 신규 등록 |
| **분류** | Company CRUD |
| **Type** | SMOKE |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Product Test Suite UI에 접속 완료 (`/features`)
- Company 목록 페이지 확인

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | "Add New" 버튼 클릭 | CompanyFormModal 열림 |
| 2 | Company 이름 입력 (예: "TestCo") | 텍스트 입력 완료 |
| 3 | "Create" 버튼 클릭 | Company 목록에 "TestCo" 추가 확인, 모달 닫힘 |

**예상 결과:**
- 새 Company가 DB에 저장되고, 목록에 표시됨

---

#### [TC-02] Company 활성화

| 항목 | 값 |
|------|-----|
| **ID** | TC-02 |
| **제목** | Company 활성화 |
| **분류** | Company CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- 최소 2개 이상의 Company가 등록됨
- Product Test Suite UI에 접속 완료

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | 첫 번째 Company 카드의 "Activate" 버튼 클릭 | isActive 플래그 true로 변경, 카드 강조 표시 |
| 2 | 다른 Company의 "Activate" 버튼 클릭 | 이전 활성 Company는 비활성화, 새로운 Company만 활성화 |

**예상 결과:**
- 한 시점에 최대 1개 Company만 활성화 상태 유지

---

#### [TC-03] Company 삭제

| 항목 | 값 |
|------|-----|
| **ID** | TC-03 |
| **제목** | Company 삭제 |
| **분류** | Company CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- Product이 없는 Company 존재
- Company 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Company 카드의 Delete 버튼 클릭 | 확인 다이얼로그 표시 |
| 2 | 확인 다이얼로그에서 "Delete" 선택 | Company 목록에서 제거됨 |

**예상 결과:**
- Company와 연관된 Product 모두 삭제됨 (CASCADE)

---

#### [TC-04] Company 이름 검색 — 일치

| 항목 | 값 |
|------|-----|
| **ID** | TC-04 |
| **제목** | Company 이름 검색 — 일치 |
| **분류** | Company 검색 |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- "TestCo", "AnotherCorp", "DevTeam" 등 다양한 Company 존재
- Company 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | 검색 입력창에 "TestCo" 입력 | Company 목록이 실시간 필터링됨, "TestCo"만 표시 |
| 2 | 검색창을 비우기 | 전체 Company 목록 복원 |

**예상 결과:**
- 검색어에 부분 일치하는 Company만 표시

---

#### [TC-05] Company 이름 검색 — 결과 없음

| 항목 | 값 |
|------|-----|
| **ID** | TC-05 |
| **제목** | Company 이름 검색 — 결과 없음 |
| **분류** | Company 검색 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- Company 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | 검색 입력창에 존재하지 않는 이름 입력 (예: "xyz123") | 목록 비어 있음, "No companies found" 메시지 표시 |

**예상 결과:**
- 검색 결과가 없을 때 명확한 메시지 표시

---

#### [TC-06] Company 이름순 정렬

| 항목 | 값 |
|------|-----|
| **ID** | TC-06 |
| **제목** | Company 이름순 정렬 |
| **분류** | Company 정렬 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- "Zebra Corp", "Apple Inc", "Beta Systems" 등의 Company 존재
- Company 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Sort 드롭다운에서 "Name (A-Z)" 선택 | 목록이 알파벳순으로 정렬됨 (Apple, Beta, Zebra) |

**예상 결과:**
- Company 목록이 이름순 오름차순 정렬

---

#### [TC-07] Company 최신순 정렬

| 항목 | 값 |
|------|-----|
| **ID** | TC-07 |
| **제목** | Company 최신순 정렬 |
| **분류** | Company 정렬 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- 여러 시점에 생성된 Company 존재
- Company 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Sort 드롭다운에서 "Newest" 선택 | 목록이 createdAt 역순(최신)으로 정렬됨 |

**예상 결과:**
- Company 목록이 최신 생성순으로 정렬

---

### Group 2: Product 관리 (7개)

#### [TC-08] Product 신규 등록

| 항목 | 값 |
|------|-----|
| **ID** | TC-08 |
| **제목** | Product 신규 등록 |
| **분류** | Product CRUD |
| **Type** | SMOKE |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Company 선택 완료 (`/features/companies/:companyId`)
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | "Add New" 버튼 클릭 | ProductFormModal 열림 |
| 2 | Product 이름 입력 (예: "WebApp") | 텍스트 입력 완료 |
| 3 | Platform 선택 (예: "WEB") | 드롭다운에서 선택됨 |
| 4 | "Create" 버튼 클릭 | Product 목록에 추가됨, 모달 닫힘 |

**예상 결과:**
- 새 Product가 선택된 Company 아래에 저장되고 표시됨

---

#### [TC-09] Product 플랫폼별 등록

| 항목 | 값 |
|------|-----|
| **ID** | TC-09 |
| **제목** | Product 플랫폼별 등록 |
| **분류** | Product CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- Company 선택 완료
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | "Add New" 클릭 후 ProductFormModal 열기 | 폼 표시 |
| 2 | Platform 드롭다운 확인 | WEB, DESKTOP, MOBILE, ETC 옵션 표시 |
| 3 | MOBILE 플랫폼 선택하고 Product 생성 | "platform" 필드가 MOBILE로 저장됨 |

**예상 결과:**
- 각 플랫폼별로 Product가 정확하게 저장됨

---

#### [TC-10] Product 삭제

| 항목 | 값 |
|------|-----|
| **ID** | TC-10 |
| **제목** | Product 삭제 |
| **분류** | Product CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- Product이 최소 1개 이상 존재
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Product 카드의 Delete 버튼 클릭 | 확인 다이얼로그 표시 |
| 2 | "Delete" 선택 | Product 목록에서 제거됨 |

**예상 결과:**
- Product과 연관된 모든 Segment, TestCase 삭제됨 (CASCADE)

---

#### [TC-11] Product 이름 검색 — 일치

| 항목 | 값 |
|------|-----|
| **ID** | TC-11 |
| **제목** | Product 이름 검색 — 일치 |
| **분류** | Product 검색 |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- "WebApp", "MobileApp", "API Service" 등의 Product 존재
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | 검색 입력창에 "WebApp" 입력 | Product 목록 필터링, "WebApp"만 표시 |
| 2 | 검색창 비우기 | 전체 Product 목록 복원 |

**예상 결과:**
- 검색어 부분 일치 필터링 정상 작동

---

#### [TC-12] Product 이름 검색 — 결과 없음

| 항목 | 값 |
|------|-----|
| **ID** | TC-12 |
| **제목** | Product 이름 검색 — 결과 없음 |
| **분류** | Product 검색 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | 검색 입력창에 존재하지 않는 이름 입력 | 목록 비어 있음, "No products found" 메시지 표시 |

**예상 결과:**
- 검색 결과 없음을 사용자에게 명확히 전달

---

#### [TC-13] Product 이름순 정렬

| 항목 | 값 |
|------|-----|
| **ID** | TC-13 |
| **제목** | Product 이름순 정렬 |
| **분류** | Product 정렬 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- "Zebra", "Apple", "Beta" 등의 Product 존재
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Sort 드롭다운에서 "Name (A-Z)" 선택 | 목록이 이름순 정렬 (Apple, Beta, Zebra) |

**예상 결과:**
- Product 목록이 알파벳순으로 정렬됨

---

#### [TC-14] Product 최신순 정렬

| 항목 | 값 |
|------|-----|
| **ID** | TC-14 |
| **제목** | Product 최신순 정렬 |
| **분류** | Product 정렬 |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |
| **Status** | DRAFT |

**사전조건:**
- 여러 시점에 생성된 Product 존재
- Product 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Sort 드롭다운에서 "Newest" 선택 | 목록이 최신순 정렬됨 (createdAt DESC) |

**예상 결과:**
- Product 목록이 최신 생성순으로 정렬됨

---

### Group 3: Segment 관리 (3개)

#### [TC-15] Root Segment 추가

| 항목 | 값 |
|------|-----|
| **ID** | TC-15 |
| **제목** | Root Segment 추가 |
| **분류** | Segment 관리 |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Product 선택 완료 (`/features/companies/:companyId/products/:productId`)
- TestCase 페이지 열림
- Segment가 없는 상태 (또는 새로운 Product)

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | SegmentTreeView에서 "Root Path 등록" 버튼 클릭 | 인라인 텍스트 입력 필드 표시 |
| 2 | Segment 이름 입력 (예: "Authentication") | 텍스트 입력 완료 |
| 3 | Enter 키 또는 확인 버튼 클릭 | Root Segment 생성, 트리에 표시됨 |

**예상 결과:**
- Root Segment가 Product 아래에 생성되고 트리에 표시됨

---

#### [TC-16] Child Segment 추가

| 항목 | 값 |
|------|-----|
| **ID** | TC-16 |
| **제목** | Child Segment 추가 |
| **분류** | Segment 관리 |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Root Segment 존재 (예: "Authentication")
- SegmentTreeView 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | Root Segment 노드에 마우스 호버 | "+" 버튼 표시 |
| 2 | "+" 버튼 클릭 또는 우클릭 메뉴에서 "하단에 Path 추가" 선택 | 인라인 입력 필드 표시 |
| 3 | Child Segment 이름 입력 (예: "Login") | 텍스트 입력 완료 |
| 4 | Enter 키 클릭 | "Login"이 "Authentication"의 자식으로 생성, 트리에 표시됨 |

**예상 결과:**
- Child Segment가 올바른 부모 아래에 생성되고, 트리 구조 유지

---

#### [TC-17] Segment 삭제 (cascade)

| 항목 | 값 |
|------|-----|
| **ID** | TC-17 |
| **제목** | Segment 삭제 (cascade) |
| **분류** | Segment 관리 |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- 다단계 Segment 트리 존재 (예: Authentication > Login > Social > Google)
- SegmentTreeView 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | "Login" Segment 우클릭, "Path 삭제" 선택 | 확인 다이얼로그 표시 |
| 2 | "Delete" 선택 | "Login"과 모든 하위 Segment (Social, Google) 삭제됨 |

**예상 결과:**
- 삭제된 Segment와 모든 자식 Segment가 제거되고, 관련 TestCase path는 유지 또는 정리됨

---

### Group 4: TestCase 관리 (5개)

#### [TC-18] TestCase 신규 생성

| 항목 | 값 |
|------|-----|
| **ID** | TC-18 |
| **제목** | TestCase 신규 생성 |
| **분류** | TestCase CRUD |
| **Type** | SMOKE |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Product 선택 완료
- Segment 트리에서 특정 경로(path) 선택됨
- TestCase 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | SegmentTreeView에서 "Authentication > Login" 경로 선택 | 경로 선택 상태 시각적으로 표시 |
| 2 | "Add Test Case" 버튼 클릭 | TestCaseFormModal 열림, path 필드는 읽기 전용으로 "Authentication > Login" 표시 |
| 3 | 제목 입력, Priority/Type/Status 선택, Steps 추가 (최소 1개) | 폼 작성 완료 |
| 4 | "Create" 버튼 클릭 | TestCase 목록에 추가, 모달 닫힘 |

**예상 결과:**
- 새 TestCase가 선택된 경로(path) 아래에 저장되고 표시됨

---

#### [TC-19] TestCase 수정

| 항목 | 값 |
|------|-----|
| **ID** | TC-19 |
| **제목** | TestCase 수정 |
| **분류** | TestCase CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- TestCase 최소 1개 존재
- TestCase 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | TestCase 카드의 "Edit" 버튼 클릭 | TestCaseFormModal 열림, 기존 데이터 로드됨 |
| 2 | 제목 수정 (예: "Updated Title") | 텍스트 변경 |
| 3 | "Save" 버튼 클릭 | TestCase 업데이트, 목록에 변경 사항 반영 |

**예상 결과:**
- TestCase의 모든 필드(path 제외)가 업데이트되고, DB에 반영됨

---

#### [TC-20] TestCase 삭제

| 항목 | 값 |
|------|-----|
| **ID** | TC-20 |
| **제목** | TestCase 삭제 |
| **분류** | TestCase CRUD |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- TestCase 최소 1개 존재
- TestCase 목록 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | TestCase 카드의 Delete 버튼 클릭 | 확인 다이얼로그 표시 |
| 2 | "Delete" 선택 | TestCase 목록에서 제거됨 |

**예상 결과:**
- TestCase가 DB에서 삭제되고, 목록에서 제거됨

---

#### [TC-21] Path별 TestCase 필터링

| 항목 | 값 |
|------|-----|
| **ID** | TC-21 |
| **제목** | Path별 TestCase 필터링 |
| **분류** | TestCase 필터링 |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |
| **Status** | DRAFT |

**사전조건:**
- 다양한 경로(path)에 다양한 TestCase 존재
- 예: "Auth > Login" (3개), "Auth > Logout" (2개), "Payment" (5개)
- TestCase 페이지 열림

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | SegmentTreeView에서 "Auth" 선택 | TestCase 목록이 "Auth" 아래의 모든 TestCase 표시 (5개) |
| 2 | "Auth > Login" 선택 | 목록이 "Login" 경로의 TestCase만 표시 (3개) |
| 3 | "Payment" 선택 | 목록이 "Payment" 경로의 TestCase만 표시 (5개) |

**예상 결과:**
- 선택된 경로(path)에 맞게 TestCase 목록이 필터링됨 (prefix match)

---

#### [TC-22] Company → Product → TestCase 전체 흐름 (E2E)

| 항목 | 값 |
|------|-----|
| **ID** | TC-22 |
| **제목** | Company → Product → TestCase 전체 흐름 |
| **분류** | E2E |
| **Type** | E2E |
| **Priority** | HIGH |
| **Status** | DRAFT |

**사전조건:**
- Product Test Suite UI (`/features`) 접속 가능
- DB 초기 상태

**테스트 스텝:**
| Order | Action | Expected Result |
|-------|--------|-----------------|
| 1 | `/features` 접속 → Company 신규 등록 (예: "QA Team") | Company 목록에 "QA Team" 추가됨 |
| 2 | "QA Team" 클릭 → Product 페이지로 이동 | 경로 변경: `/features/companies/:id` |
| 3 | Product 신규 등록 (예: "Mobile App", MOBILE) | Product 목록에 추가됨 |
| 4 | "Mobile App" 클릭 → TestCase 페이지 이동 | 경로 변경: `/features/companies/:id/products/:id` |
| 5 | Segment 추가: "Feature A" → "Scenario 1" | 트리 구조 생성됨 |
| 6 | "Scenario 1" 선택 후 TestCase 생성 | TestCase 저장, "Scenario 1" 경로로 분류됨 |
| 7 | TestCase 수정, 삭제 작업 수행 | 모든 CRUD 작업 정상 동작 |

**예상 결과:**
- 전체 3단계 드릴다운 흐름이 끝에서 끝까지 정상 작동함

---

## DB Insert 현황

### ✅ 준비 완료
- `backend/src/main/resources/db/migration/V7__seed_testcase_v1.sql` 작성 예정
- Company: `my-atlas`
- Product: `Product Test Suite` (WEB)
- Segment: 위 분류 체계와 동일한 구조
- TestCase: 위 22개 모두 INSERT

### 실행 방법
```bash
# Docker Compose로 전체 스택 시작
docker compose up -d

# Flyway가 V7 자동 실행 → TestCase 데이터 DB 로드
# 브라우저에서 확인: http://localhost:5173/features
```

---

## 최종 요약

**TestCase 명세 완성**
- Product Test Suite의 모든 기능(CRUD, 검색, 정렬, 필터링, E2E)을 커버하는 22개 TestCase 정의
- 각 TestCase는 ID, 제목, 분류, Type, Priority, Status를 포함
- 사전조건, 스텝, 예상 결과를 상세히 기술

**DB Seed 전략**
- Flyway V7 migration으로 테스트용 데이터 자동 로드
- Company, Product, Segment 트리, TestCase 모두 포함
- `docker compose up -d` 시 자동 적용 → 즉시 사용 가능
