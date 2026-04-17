# 테스트 방법론 기반 TC 작성 계획

> 변경 유형: 테스트 보강  
> 작성일: 2026-04-09  
> 버전: v10  
> 상태: 진행 중

---

## 1. Context

### 1.1 배경

qa_v1~v9를 통해 자동화 테스트(Backend 179개, Frontend 33개, E2E 157개)가 구축되었다.
그러나 이 테스트들은 **코드 레벨의 회귀 방지**에 집중되어 있으며, **QA 관점의 체계적 TC(Test Case)** 는 testcase_v1의 22개(Feature Registry CRUD 중심)만 존재한다.

현재 프로젝트에는 다음과 같은 테스트 Gap이 있다:

| 기능 영역 | 기존 TC | 상태 |
|-----------|--------|------|
| Feature Registry (Company/Product/Segment/TestCase) | 22개 | testcase_v1 |
| Version / VersionPhase | 0개 | 미커버 |
| TestRun / TestResult | 0개 | 미커버 |
| Knowledge Base (Article + PDF + Image + Pin) | 0개 | 미커버 |
| My Senior (Chat + FAQ 큐레이션 + RAG) | 0개 | 미커버 |
| Convention | 0개 | 미커버 |

### 1.2 목표

1. **테스트 방법론**(EP, BVA, State Transition, Decision Table, Use Case)을 적용한 TC 설계
2. 모든 기능 영역을 커버하는 체계적 TC 작성
3. my-atlas **Product Test Suite** 기능을 활용하여 TC를 시스템에 등록

### 1.3 적용 대상 요약

기존 22개 TC(testcase_v1)는 유지하고, **신규 TC 45개**를 추가한다.

- Feature Registry 신규 도메인: 14개 (Version 4, Phase 2, TestRun 5, TestResult 3)
- Knowledge Base: 12개 (Article CRUD 4, PDF 4, Image 1, 소스 필터 1, Pin/Unpin 2)
- My Senior: 8개 (Chat 3, FAQ 큐레이션 3, RAG 2)
- Convention: 4개 (CRUD 3, 유효성 1)
- Cross-Feature E2E: 7개 (통합 시나리오)

---

## 2. 적용 테스트 방법론

### 2.1 동등 분할 (Equivalence Partitioning, EP)

입력값을 동일하게 처리되는 그룹으로 나누어 각 그룹에서 대표값을 테스트한다.

**적용 대상:**
- RunResultStatus enum: PASS, FAIL, BLOCKED, SKIPPED, RETEST, UNTESTED (6개 파티션)
- KB 소스 필터: 전체 / 직접작성(source=null) / PDF(source≠null) (3개 파티션)
- 이미지 업로드 확장자: 허용(png/jpg/gif/webp) / 비허용(.exe/.pdf) (2개 파티션)

### 2.2 경계값 분석 (Boundary Value Analysis, BVA)

등가 클래스의 경계에서 결함이 집중되므로 경계값을 테스트한다.

**적용 대상:**
- KB Pin 고정 한도: 14건(경계 내), 15건(경계), 16건(경계 초과)
- FAQ 큐레이션 목록: 고정 15 + 조회수 Top 5 = 최대 20건
- Convention term 빈 문자열(0자) / 유효 입력(1자 이상)

### 2.3 상태 전이 테스팅 (State Transition Testing)

상태를 가진 엔티티의 유효/무효 전이를 검증한다.

**적용 대상:**

```
PdfUploadJob:
  PENDING → PROCESSING → DONE (정상)
  PENDING → PROCESSING → FAILED (실패)

KB Pin 상태:
  unpinned (pinned_at=NULL) → pinned (pinned_at=TIMESTAMP)
  pinned → unpinned

RunResultStatus:
  UNTESTED → PASS / FAIL / BLOCKED / SKIPPED / RETEST
  (모든 상태 간 자유 전이 가능)
```

### 2.4 의사결정 테이블 (Decision Table)

여러 조건의 조합에 따른 결과를 검증한다.

**적용 대상:**

| faqContext | KB 수동 결과 | PDF 청크 결과 | Convention | 기대 답변 품질 |
|-----------|-------------|-------------|------------|-------------|
| 있음 | 3건 | 2건 | 전체 | 최상 (우선 컨텍스트 + RAG 보강) |
| 없음 | 3건 | 2건 | 전체 | 양호 (RAG만으로 답변) |
| 없음 | 0건 | 0건 | 전체 | 최소 (Convention만 참조) |
| 없음 | 0건 | 0건 | 0건 | AI 기본 지식만 사용 |

### 2.5 유스케이스 테스팅 (Use Case Testing)

사용자 시나리오 기반 E2E 흐름을 검증한다.

**적용 대상:**
- 릴리스 관리 전체 흐름: Version 생성 → Phase 추가 → TestRun 생성(TC 선택) → 결과 기록
- 지식 → 채팅 흐름: KB 글 작성 → Pin 고정 → Senior FAQ에 노출 → Chat 질문 → RAG 답변

---

## 3. Product Test Suite — Segment 구조

기존 Segment 구조를 유지하고, 신규 기능 영역을 추가한다.

```
Product Test Suite (기존 Product)
│
├── Company 관리          ← 기존 (TC-01 ~ TC-07)
│   ├── CRUD
│   ├── 검색
│   └── 정렬
├── Product 관리          ← 기존 (TC-08 ~ TC-14)
│   ├── CRUD
│   ├── 검색
│   └── 정렬
├── Segment 관리          ← 기존 (TC-15 ~ TC-17)
│   └── CRUD
├── TestCase 관리         ← 기존 (TC-18 ~ TC-22)
│   ├── CRUD
│   └── 필터링
│
├── Version 관리          ← 신규
│   ├── CRUD
│   └── 복사
├── Phase 관리            ← 신규
│   └── CRUD
├── TestRun 관리          ← 신규
│   ├── CRUD
│   ├── TC 선택
│   └── 상세
├── TestResult 관리       ← 신규
│   └── 실행
│
├── Knowledge Base        ← 신규
│   ├── Article CRUD
│   ├── PDF 업로드
│   ├── 이미지
│   └── 큐레이션
├── My Senior             ← 신규
│   ├── Chat
│   ├── FAQ
│   └── RAG
└── Convention            ← 신규
    └── CRUD
```

---

## 4. TC 설계

> TC-01 ~ TC-22는 testcase_v1에 정의 완료. 아래는 TC-23부터 시작한다.

---

### 4.1 Feature Registry — Version 관리 (4개)

#### [TC-23] Version 생성

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- Product 선택 완료, VersionListPage 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "+ New Version" 버튼 클릭 | VersionFormModal 열림 |
| 2 | 이름(예: "v1.0"), 설명, 릴리스 날짜 입력 | 폼 작성 완료 |
| 3 | "Create" 버튼 클릭 | Version 목록에 추가됨, 모달 닫힘 |

**예상 결과:** 새 Version이 Product 아래에 생성되고 카드로 표시됨

---

#### [TC-24] Version 카드 클릭 → 상세 페이지 이동

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Version 최소 1개 존재, VersionListPage 열림

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Version 카드 영역 클릭 | VersionDetailPage로 이동 |
| 2 | 이름, 설명, 릴리스 날짜, 복사 출처, Phase 목록 확인 | 모든 정보가 정확히 표시됨 |

**예상 결과:** 카드 클릭으로 상세 페이지에 진입, 모든 필드가 DB 데이터와 일치

---

#### [TC-25] Version 복사

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- Phase가 포함된 Version 존재, VersionDetailPage 열림

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "버전 복사" 버튼 클릭 | VersionCopyModal 열림, 새 버전명 입력 필드 비어 있음 |
| 2 | 새 버전명 입력 (예: "v1.1-hotfix") | 텍스트 입력 완료 |
| 3 | "복사" 버튼 클릭 | 새 Version 생성, Phase 구조 복제됨 |
| 4 | 새 Version 상세 페이지에서 복사 출처 확인 | 원본 Version 이름이 표시됨 (ID가 아닌 이름) |

**예상 결과:** 원본의 Phase 구조가 복제된 새 Version이 생성되고, 복사 출처가 이름으로 표시됨

---

#### [TC-26] Version 삭제 (CASCADE)

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Phase, TestRun, TestResult가 연결된 Version 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | VersionListPage에서 삭제 버튼 클릭 | ConfirmDialog 표시 |
| 2 | "Delete" 확인 | Version, 하위 Phase, TestRun, TestResult 모두 삭제됨 |

**예상 결과:** CASCADE 삭제로 연관 데이터 전부 제거, 목록에서 사라짐

---

### 4.2 Feature Registry — Phase 관리 (2개)

#### [TC-27] Phase 생성

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- Version 상세 페이지 진입 완료

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "Add Phase" 버튼 클릭 | Phase 생성 모달/인라인 폼 표시 |
| 2 | Phase 이름 입력 (예: "QA Testing") | 입력 완료 |
| 3 | 생성 확인 | Phase 카드가 Version 상세 페이지에 추가됨 |

**예상 결과:** Phase가 Version 아래에 생성되고, 진행률 통계가 0/0으로 초기화됨

---

#### [TC-28] Phase 카드 클릭 → 테스트 실행 페이지 이동

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- TestRun과 TestResult가 연결된 Phase 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Phase 카드 영역 클릭 | VersionPhaseDetailPage로 이동 |
| 2 | 상단 통계 확인 | PASS/FAIL/BLOCKED/SKIPPED/RETEST/UNTESTED 건수 표시 |
| 3 | 하단 테스트 케이스 목록 확인 | 실제 TestResult 데이터 기반 목록 (더미 아님) |

**예상 결과:** 실제 API 데이터 기반 테스트 실행 페이지가 표시됨

---

### 4.3 Feature Registry — TestRun 관리 (5개)

#### [TC-29] TestRun 생성 — Path 기반 TC 그룹 선택

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- Product에 Segment 트리와 TestCase가 존재, TestRunListPage 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "+ New Test Run" 버튼 클릭 | TestRunFormModal 열림 |
| 2 | 이름, 설명 입력 | 입력 완료 |
| 3 | TestCaseGroupSelector에서 Segment 노드 체크 | 하위 TC 일괄 선택, 카운터 업데이트 ("선택: N/M개") |
| 4 | "Create" 클릭 | TestRun 생성, 목록에 TC 수와 함께 표시 |

**예상 결과:** Segment 트리 기반으로 TC를 그룹 선택하여 TestRun 생성 완료

---

#### [TC-30] TestRun 상세 페이지 — TC 목록 Path 그룹핑

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- TC가 포함된 TestRun 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | TestRun 카드 클릭 | TestRunDetailPage로 이동 |
| 2 | TC 목록 확인 | Segment path 기준 계층 구조로 그룹핑되어 표시 |
| 3 | 이름, 설명, 생성일, 수정일, TC 수 확인 | DB 데이터와 일치 |

**예상 결과:** TestRun 상세 정보와 TC 목록이 계층적으로 표시됨

---

#### [TC-31] TestRun 수정 — 인라인 편집

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case (BUG-1, BUG-2 검증 포함) |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- TC가 포함된 TestRun의 상세 페이지 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "수정" 버튼 클릭 | 편집 모드 전환: 이름/설명이 input으로 변경, TestCaseGroupSelector 표시 |
| 2 | 기존 선택된 TC가 체크 상태인지 확인 | 기존 TC가 모두 체크되어 있음 (BUG-2 검증) |
| 3 | 이름 수정 + TC 추가/제거 후 "저장" | PATCH API 호출, **새 TestRun이 생성되지 않음** (BUG-1 검증) |
| 4 | 목록 페이지에서 TestRun 수 확인 | 수정 전과 동일 (수정이지 생성이 아님) |

**예상 결과:** 기존 TestRun이 제자리에서 수정됨, 새 레코드 생성 없음

---

#### [TC-32] TestRun 삭제

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- TestRun 상세 페이지 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "삭제" 버튼 클릭 | ConfirmDialog 표시 |
| 2 | "Delete" 확인 | TestRun 삭제, 목록 페이지로 이동 |

**예상 결과:** TestRun과 연관 TestResult 삭제, 원본 TestCase는 유지됨

---

#### [TC-33] TestRun TC 선택 — 검색 필터

| 항목 | 값 |
|------|-----|
| **방법론** | EP (검색어 일치 / 불일치 / 부분 일치) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- TestRunFormModal 또는 TestRunDetailPage 편집 모드에서 TestCaseGroupSelector 표시

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 검색창에 TC 제목 일부 입력 (예: "로그인") | 일치하는 TC만 트리에 표시, 나머지 숨김 |
| 2 | 검색창 비우기 | 전체 TC 트리 복원 |
| 3 | 존재하지 않는 검색어 입력 | 트리가 비어 있음 |

**예상 결과:** TC 제목 기준 실시간 필터링 정상 작동

---

### 4.4 Feature Registry — TestResult 관리 (3개)

#### [TC-34] TestResult 상태 변경 — 전체 상태값 (EP + State Transition)

| 항목 | 값 |
|------|-----|
| **방법론** | EP (6개 상태값), State Transition |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- VersionPhaseDetailPage 진입, TestResult 목록 표시

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | UNTESTED 상태의 TC에서 드롭다운 → PASS 선택 | 즉시 PATCH API 호출, 배지 초록색으로 변경, 상단 통계 갱신 |
| 2 | 같은 TC에서 드롭다운 → FAIL 변경 | 배지 빨간색, 통계 PASS -1 / FAIL +1 |
| 3 | 다른 TC에서 BLOCKED 선택 | 배지 변경, 통계 반영 |
| 4 | SKIPPED, RETEST 각각 확인 | 모든 상태값이 정상 저장 및 표시 |

**예상 결과:** 6개 RunResultStatus(PASS/FAIL/BLOCKED/SKIPPED/RETEST/UNTESTED) 모두 정상 전이, 상단 통계 실시간 반영

---

#### [TC-35] TestResult — TC 상세 펼침 (Accordion)

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- VersionPhaseDetailPage에 TestResult 목록 표시

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | TC 행 클릭 | 해당 TC 상세 영역 펼침 (Accordion) |
| 2 | Preconditions, Steps 테이블, Expected Result 확인 | 원본 TC 데이터가 정확히 표시됨 |
| 3 | 같은 행 다시 클릭 | 상세 영역 접힘 |
| 4 | 다른 행 클릭 | 이전 행 접히고 새 행 펼침 |

**예상 결과:** Accordion 방식으로 TC 상세 내용이 펼침/접힘 동작

---

#### [TC-36] TestResult — Comment 작성

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- TC 상세 영역이 펼쳐진 상태

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Comment 입력 필드에 비고 작성 | 텍스트 입력 완료 |
| 2 | "Save" 버튼 클릭 | Comment가 저장됨, API 호출 성공 |
| 3 | 페이지 새로고침 후 같은 TC 펼침 | 저장된 Comment가 유지됨 |

**예상 결과:** TestResult에 Comment가 저장되고 영속됨

---

### 4.5 Knowledge Base (12개)

#### [TC-37] KB Article 생성 — Markdown 에디터

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- KB 목록 페이지 (`/kb`) 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "[+ 직접 작성]" 버튼 클릭 | `/kb/write` 페이지로 이동, Markdown 에디터 표시 |
| 2 | 제목, 내용(Markdown 문법 포함), 카테고리, 태그 입력 | 에디터 라이브 미리보기에 렌더링 표시 |
| 3 | "저장" 클릭 | KB 항목 생성, `/kb/:id` 상세 페이지로 이동 |
| 4 | 상세 페이지에서 Markdown 렌더링 확인 | `# 제목`, `**굵게**` 등이 정상 렌더링 |

**예상 결과:** Markdown 원본이 DB에 저장되고, 상세 페이지에서 렌더링됨

---

#### [TC-38] KB Article 수정

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- KB 항목 상세 페이지 (`/kb/:id`) 열림

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "수정" 버튼 클릭 | `/kb/edit/:id` 페이지로 이동, 기존 내용 에디터에 로드 |
| 2 | 제목과 내용 수정 | 변경사항 반영 |
| 3 | "저장" 클릭 | 수정 완료, 상세 페이지에 변경 내용 표시 |

**예상 결과:** 기존 KB 항목이 수정되고, 비동기 임베딩 재생성됨

---

#### [TC-39] KB Article 삭제

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- KB 항목 상세 페이지 열림

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "삭제" 버튼 클릭 | ConfirmDialog 표시 |
| 2 | "Delete" 확인 | KB 목록으로 이동, 해당 항목 사라짐 |

**예상 결과:** KB 항목이 삭제됨 (수동 작성 항목만 삭제 가능)

---

#### [TC-40] KB 카드 클릭 → 상세 페이지

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- KB 목록에 항목 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | KB 카드 클릭 | `/kb/:id` 상세 페이지로 이동 |
| 2 | 제목, Markdown 렌더링 내용, 카테고리, 태그 확인 | DB 데이터와 일치 |
| 3 | 카드의 미리보기 텍스트(150자 truncate)가 Markdown 문법 없이 표시되었는지 확인 | `#`, `**`, `![](...)` 등 제거된 plain text |

**예상 결과:** 카드에서 상세 페이지로 이동, Markdown이 정상 렌더링됨

---

#### [TC-41] PDF 업로드 — 정상 처리 (State Transition)

| 항목 | 값 |
|------|-----|
| **방법론** | State Transition (PENDING → PROCESSING → DONE) |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- KB 목록 페이지 진입, 유효한 PDF 파일 준비

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "PDF 업로드" 버튼 클릭 | PdfUploadModal 열림 |
| 2 | 책 제목 입력, PDF 파일 선택 | 폼 작성 완료 |
| 3 | "업로드" 클릭 | jobId 반환, 상태 PENDING 표시 |
| 4 | 자동 폴링(3초 간격) 관찰 | PENDING → PROCESSING → DONE 상태 전이 |
| 5 | 완료 후 KB 목록 확인 | `[도서]` 뱃지와 함께 청크들이 목록에 추가됨 |

**예상 결과:** PDF가 챕터별로 청킹되어 KB에 저장, Job 상태가 DONE으로 완료

---

#### [TC-42] PDF 업로드 — Job 상태 조회

| 항목 | 값 |
|------|-----|
| **방법론** | State Transition |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- PDF 업로드 이력이 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Job 목록 확인 (GET /api/kb/jobs) | 전체 Job 목록 표시 |
| 2 | 각 Job의 상태, 총 청크 수, 파일명 확인 | DB 데이터와 일치 |
| 3 | DONE 상태의 Job에 totalChunks가 0이 아닌지 확인 | 청크가 1개 이상 생성됨 |

**예상 결과:** Job 이력이 정확하게 기록되고 조회됨

---

#### [TC-43] PDF 책 단위 삭제

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- PDF 업로드 완료된 책(source)이 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 해당 책의 삭제 버튼 클릭 | ConfirmDialog 표시 |
| 2 | 삭제 확인 | 해당 source의 모든 청크 + Job 삭제 |
| 3 | KB 목록에서 해당 책의 청크가 사라졌는지 확인 | `[도서]` 탭에서 해당 책 청크 0건 |

**예상 결과:** 책 단위로 모든 청크와 Job이 삭제됨

---

#### [TC-44] PDF 업로드 실패 처리 (State Transition — 실패 경로)

| 항목 | 값 |
|------|-----|
| **방법론** | State Transition (PENDING → PROCESSING → FAILED) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- 손상된 PDF 파일 또는 비 PDF 파일 준비

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 비정상 파일을 PDF로 업로드 시도 | Job 생성 |
| 2 | 상태 전이 관찰 | PENDING → PROCESSING → FAILED |
| 3 | FAILED Job에 error_message 존재 확인 | 에러 원인 메시지 표시 |

**예상 결과:** 실패 시 Job이 FAILED 상태로 전환되고, 에러 메시지가 기록됨

---

#### [TC-45] KB 이미지 첨부 (EP — 허용/비허용 확장자)

| 항목 | 값 |
|------|-----|
| **방법론** | EP (허용: png/jpg/gif/webp, 비허용: exe/pdf 등) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- KB 글 작성/수정 페이지 (Markdown 에디터)

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | png 이미지 파일 첨부 (버튼 또는 드래그) | 업로드 성공, `![image](url)` 에디터에 삽입 |
| 2 | 미리보기에서 이미지 표시 확인 | 이미지가 렌더링됨 |
| 3 | 비허용 확장자 파일(.exe) 첨부 시도 | 에러 메시지 표시, 업로드 차단 |

**예상 결과:** 허용된 확장자만 업로드 가능, 비허용 시 명확한 에러 표시

---

#### [TC-46] KB 소스 필터 탭 (EP — 3개 파티션)

| 항목 | 값 |
|------|-----|
| **방법론** | EP (전체 / 직접작성 / PDF 도서) |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- 수동 작성 KB 항목과 PDF 청크가 모두 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "전체" 탭 클릭 | 모든 KB 항목 표시, 카운트 = 수동 + PDF |
| 2 | "직접 작성" 탭 클릭 | `[직접 작성]` 뱃지 항목만 표시, PDF 청크 숨김 |
| 3 | "PDF 도서" 탭 클릭 | `[도서]` 뱃지 항목만 표시, 수동 항목 숨김 |
| 4 | 각 탭의 카운트(N)가 실제 항목 수와 일치하는지 확인 | 카운트 정확 |

**예상 결과:** 소스 유형별 필터링 정상, 카운트 정확

---

#### [TC-47] KB Pin 고정

| 항목 | 값 |
|------|-----|
| **방법론** | State Transition (unpinned → pinned) |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- Pin 되지 않은 KB 항목 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | KB 항목의 Pin 버튼 클릭 | PATCH /api/kb/{id}/pin 호출 |
| 2 | pinned_at 값 확인 | NULL → TIMESTAMP로 변경 |
| 3 | Senior FAQ 목록 확인 | 고정된 항목이 FAQ에 노출됨 |

**예상 결과:** KB 항목이 Pin 고정되어 Senior FAQ에 노출됨

---

#### [TC-48] KB Pin 해제 + 최대 15건 제한 (BVA)

| 항목 | 값 |
|------|-----|
| **방법론** | BVA (15건 경계), State Transition (pinned → unpinned) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- 15건 이상의 KB 항목이 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 15건 Pin 고정 | 모두 고정 성공 |
| 2 | Senior FAQ에서 고정 목록 확인 | 15건 모두 표시 |
| 3 | Pin된 항목 중 1건 해제 (Pin 해제 버튼) | pinned_at → NULL, FAQ에서 사라짐 |
| 4 | 16번째 항목 Pin 시도 (경계 초과) | 시스템 동작 확인 (제한 여부 또는 자동 처리) |

**예상 결과:** Pin 고정/해제 전이 정상, FAQ 목록에 즉시 반영

---

### 4.6 My Senior (8개)

#### [TC-49] Chat 질문 전송 — SSE 스트리밍

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- Senior 페이지 → Chat 뷰 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 질문 입력 (예: "테스팅의 7원칙을 설명해줘") | 입력창에 텍스트 표시 |
| 2 | 전송 버튼 클릭 또는 Enter | 사용자 메시지가 채팅 영역에 표시, 로딩 표시 |
| 3 | SSE 스트리밍 응답 관찰 | 글자가 하나씩(또는 청크 단위로) 실시간 표시 |
| 4 | 스트리밍 완료 | 로딩 해제, 전체 답변 표시 |

**예상 결과:** Claude AI의 SSE 스트리밍 답변이 실시간으로 표시됨

---

#### [TC-50] Chat — FAQ 컨텍스트 전달

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- Senior FAQ 뷰에 KB 큐레이션 항목이 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | FAQ 카드 클릭하여 펼침 | 카드 내용 표시, "Chat에서 더 물어보기" 버튼 노출 |
| 2 | "Chat에서 더 물어보기" 클릭 | Chat 뷰로 전환, faqContext 배너 표시, 입력창 자동 포커스 |
| 3 | 질문 입력 후 전송 | faqContext가 request body에 포함되어 전송됨 |
| 4 | 답변 확인 | FAQ 내용이 우선적으로 참조된 답변 생성 |
| 5 | 전송 후 faqContext 배너 확인 | 배너 사라짐 (자동 초기화) |

**예상 결과:** FAQ 항목이 Chat의 최우선 컨텍스트로 전달되고, 전송 후 초기화됨

---

#### [TC-51] Chat — 대화 연속성

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Chat 뷰 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 첫 번째 질문 전송 | 답변 표시 |
| 2 | 후속 질문 전송 (예: "더 자세히 설명해줘") | 이전 대화 맥락을 반영한 답변 |
| 3 | 채팅 영역 스크롤 | 전체 대화 히스토리 확인 가능 |

**예상 결과:** 대화 히스토리가 유지되며 연속적인 질의응답 가능

---

#### [TC-52] FAQ 큐레이션 목록 — 고정 + 조회수 조합 (Decision Table)

| 항목 | 값 |
|------|-----|
| **방법론** | Decision Table, BVA (최대 20건) |
| **Type** | FUNCTIONAL |
| **Priority** | HIGH |

**사전조건:**
- Pin 고정된 KB 항목 다수 + Chat 검색 이력이 있는 KB 항목 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Senior FAQ 뷰 진입 | 큐레이션 목록 표시 |
| 2 | 고정(pinned) 항목이 먼저 표시되는지 확인 | 고정 항목이 상단, pinned_at 순 정렬 |
| 3 | 조회수 Top 항목이 하단에 표시되는지 확인 | 고정 항목과 중복 없이, hit_count DESC 순 |
| 4 | 총 표시 건수 확인 | 최대 20건 (고정 15 + 조회수 5) |

**예상 결과:** 큐레이션 알고리즘에 따라 고정 + 조회수 기반 최대 20건 표시

---

#### [TC-53] FAQ 카드 펼침/접힘

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Senior FAQ 뷰에 큐레이션 항목 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | FAQ 카드 클릭 | 카드 내용이 펼쳐짐 (Collapse → Expand) |
| 2 | 같은 카드 다시 클릭 | 카드 내용이 접힘 (Expand → Collapse) |
| 3 | 다른 카드 클릭 | 새 카드 펼쳐짐 (이전 카드 상태 유지 또는 접힘) |

**예상 결과:** FAQ 카드가 Collapse/Expand 토글로 동작

---

#### [TC-54] FAQ 검색 필터링

| 항목 | 값 |
|------|-----|
| **방법론** | EP (일치 / 불일치) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Senior FAQ 뷰에 다양한 제목의 항목 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | 검색 바에 키워드 입력 | 제목에 키워드가 포함된 항목만 필터링 표시 |
| 2 | 검색어 비우기 | 전체 큐레이션 목록 복원 |

**예상 결과:** 클라이언트 사이드 검색 필터링 정상 동작

---

#### [TC-55] RAG 답변 품질 — KB 참조 확인

| 항목 | 값 |
|------|-----|
| **방법론** | Decision Table (KB 존재 시 vs 미존재 시) |
| **Type** | REGRESSION |
| **Priority** | HIGH |

**사전조건:**
- KB에 특정 주제의 글이 저장되어 있음 (예: "경계값 분석")

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Chat에서 해당 주제 질문 (예: "경계값 분석이란?") | SSE 답변 생성 |
| 2 | 답변 내용이 KB에 저장된 내용을 참조하는지 확인 | KB 글의 핵심 내용이 답변에 반영됨 |
| 3 | KB에 없는 주제 질문 (예: "양자 컴퓨팅이란?") | AI 기본 지식으로 답변 (RAG 컨텍스트 없음) |

**예상 결과:** RAG 파이프라인이 KB 데이터를 정상 참조하여 답변 품질 향상

---

#### [TC-56] RAG 조회수 증가 확인

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- KB 항목의 현재 hit_count 확인

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Chat에서 해당 KB 내용과 관련된 질문 전송 | 답변 생성 |
| 2 | 해당 KB 항목의 hit_count 확인 | 이전 대비 +1 증가 |

**예상 결과:** Chat RAG 검색 시 조회된 KB 항목의 hit_count가 증가함

---

### 4.7 Convention (4개)

#### [TC-57] Convention 생성

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | SMOKE |
| **Priority** | HIGH |

**사전조건:**
- Convention 페이지 (`/conventions`) 진입

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | "추가" 버튼 클릭 | Convention 생성 폼/모달 표시 |
| 2 | Term(용어), Definition(정의), Category(카테고리) 입력 | 폼 작성 완료 |
| 3 | "Create" 클릭 | Convention 목록에 추가됨 |

**예상 결과:** 새 Convention이 저장되고 목록에 표시됨

---

#### [TC-58] Convention 수정

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Convention 최소 1개 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Convention의 "수정" 버튼 클릭 | 수정 폼 표시, 기존 데이터 로드 |
| 2 | Term, Definition 수정 | 변경 반영 |
| 3 | "Save" 클릭 | 목록에 변경 내용 표시 |

**예상 결과:** Convention이 수정되고 DB에 반영됨

---

#### [TC-59] Convention 삭제

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- Convention 최소 1개 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Convention의 "삭제" 버튼 클릭 | ConfirmDialog 표시 |
| 2 | "Delete" 확인 | Convention 목록에서 제거됨 |

**예상 결과:** Convention이 삭제되고 Senior RAG의 Convention 컨텍스트에서도 제거됨

---

#### [TC-60] Convention 빈 값 유효성 검증 (BVA)

| 항목 | 값 |
|------|-----|
| **방법론** | BVA (0자 경계) |
| **Type** | FUNCTIONAL |
| **Priority** | LOW |

**사전조건:**
- Convention 생성 폼 열림

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Term을 빈 문자열로, Definition 입력 후 "Create" | 유효성 에러 표시 (term은 필수) |
| 2 | Term 입력, Definition 빈 문자열로 "Create" | 유효성 에러 표시 (definition은 필수) |
| 3 | 둘 다 정상 입력 후 "Create" | 생성 성공 |

**예상 결과:** 필수 필드 빈 값 시 생성 차단, 유효성 에러 메시지 표시

---

### 4.8 Cross-Feature E2E 시나리오 (7개)

#### [TC-61] 릴리스 관리 전체 흐름

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case (End-to-End) |
| **Type** | E2E |
| **Priority** | HIGH |

**사전조건:**
- Company, Product, Segment, TestCase가 존재하는 상태

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Product 카드 → "Versions" 클릭 | VersionListPage 이동 |
| 2 | Version 생성 (예: "v1.0-RC1") | Version 카드 생성 |
| 3 | Version 카드 클릭 → Phase 추가 (예: "QA Test") | Phase 카드 생성 |
| 4 | Phase 카드 클릭 → 테스트 실행 페이지 | TestResult 목록 표시 |
| 5 | 각 TC에 대해 PASS/FAIL 상태 변경 | 상단 통계 실시간 갱신 |
| 6 | 전체 TC를 PASS로 변경 | 진행률 100% |

**예상 결과:** Version → Phase → TestResult 전체 릴리스 관리 흐름이 완결됨

---

#### [TC-62] Version 복사 후 새 Phase에서 재테스트

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | E2E |
| **Priority** | HIGH |

**사전조건:**
- TC-61에서 생성한 Version("v1.0-RC1")이 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Version 상세 → "버전 복사" | 새 Version 생성 (예: "v1.0-RC2") |
| 2 | 새 Version에서 Phase 구조 복제 확인 | 원본의 Phase가 복사됨 |
| 3 | 복사된 Phase에서 새로운 테스트 실행 | 결과 독립 기록 (원본 영향 없음) |

**예상 결과:** 복사된 Version에서 독립적인 테스트 사이클 운영 가능

---

#### [TC-63] KB 글 작성 → Senior FAQ 노출 → Chat 질문

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case (End-to-End), Decision Table |
| **Type** | E2E |
| **Priority** | HIGH |

**사전조건:**
- KB에 새로운 주제의 글이 없는 상태

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | KB에 새 글 작성 (예: "테스트 전략 수립 가이드") | KB 항목 생성 |
| 2 | 해당 KB 항목 Pin 고정 | pinned_at 설정 |
| 3 | Senior FAQ 뷰 진입 | 고정한 항목이 FAQ 목록에 노출 |
| 4 | 해당 FAQ 카드 → "Chat에서 더 물어보기" | Chat 뷰 전환, faqContext 설정 |
| 5 | "테스트 전략 수립 시 주의할 점은?" 질문 | KB 내용이 참조된 답변 생성 |

**예상 결과:** KB → Pin → FAQ → Chat → RAG 답변의 전체 데이터 흐름이 연결됨

---

#### [TC-64] PDF 업로드 → RAG 검색 → Chat 답변 (qa_v9 연계)

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case (End-to-End) |
| **Type** | E2E |
| **Priority** | HIGH |

**사전조건:**
- ISTQB CTFL PDF가 업로드되어 청크가 KB에 존재 (qa_v9 Stage 1 통과)

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | KB 목록 → "PDF 도서" 탭에서 청크 존재 확인 | ISTQB_CTFL 청크 표시 |
| 2 | Senior Chat에서 ISTQB 관련 질문 (예: "테스팅의 7원칙은?") | SSE 답변 생성 |
| 3 | 답변이 ISTQB 교재 내용을 참조하는지 확인 | 교재 원문 기반의 정확한 답변 |
| 4 | 해당 KB 청크의 hit_count 증가 확인 | 이전 대비 +1 |

**예상 결과:** PDF 청크가 RAG 파이프라인을 통해 Chat 답변에 활용됨

---

#### [TC-65] Company 삭제 → Senior RAG 영향 확인

| 항목 | 값 |
|------|-----|
| **방법론** | Decision Table (활성 Company 유무에 따른 RAG) |
| **Type** | FUNCTIONAL |
| **Priority** | MEDIUM |

**사전조건:**
- 활성 Company가 1개 존재, Product/Segment/TestCase 보유

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Senior Chat에서 Product 관련 질문 | Company Features 컨텍스트가 포함된 답변 |
| 2 | 해당 Company 삭제 (CASCADE) | Company, Product, Segment, TestCase 모두 삭제 |
| 3 | Senior Chat에서 동일 질문 | Company Features 컨텍스트 없이 답변 생성 (에러 아님) |

**예상 결과:** 활성 Company가 없어도 Chat이 정상 작동 (graceful degradation)

---

#### [TC-66] Convention 등록 → Senior RAG 참조 확인

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case |
| **Type** | E2E |
| **Priority** | MEDIUM |

**사전조건:**
- Convention에 특정 용어가 등록되지 않은 상태

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | Convention 생성 (예: term="TC", definition="Test Case의 약자") | Convention 저장 |
| 2 | Senior Chat에서 "TC가 뭐야?" 질문 | RAG에 Convention 컨텍스트 포함 |
| 3 | 답변에 Convention 정의가 참조되는지 확인 | "Test Case의 약자"라는 정의가 답변에 반영 |

**예상 결과:** Convention이 Senior RAG의 컨텍스트로 활용되어 답변에 반영됨

---

#### [TC-67] TestRun 생성 → Phase에서 결과 기록 → 통계 확인

| 항목 | 값 |
|------|-----|
| **방법론** | Use Case (End-to-End) |
| **Type** | E2E |
| **Priority** | HIGH |

**사전조건:**
- Version, Phase가 생성되어 있고, TestCase가 존재

**Steps:**

| Order | Action | Expected |
|-------|--------|----------|
| 1 | TestRun 생성 (Path 기반 TC 그룹 선택) | TestRun에 선택한 TC들이 포함됨 |
| 2 | Phase 상세 페이지에서 TestResult 목록 확인 | TestRun의 TC들이 UNTESTED 상태로 표시 |
| 3 | 3개 TC를 PASS, 2개를 FAIL, 1개를 BLOCKED로 변경 | 각 상태별 배지 및 통계 갱신 |
| 4 | 상단 통계에서 PASS 3 / FAIL 2 / BLOCKED 1 확인 | 실시간 통계 정확 |
| 5 | FAIL인 TC에 Comment "재현 경로: ..." 작성 | Comment 저장 |

**예상 결과:** TestRun → Phase → TestResult 전체 테스트 실행 흐름과 통계가 정상 동작

---

## 5. TC 요약 매트릭스

### 방법론별 분포

| 방법론 | TC 수 | TC 번호 |
|--------|-------|---------|
| Use Case | 29 | TC-23~33, 35~43, 49~51, 53, 56~59, 61~67 |
| EP | 4 | TC-34, 45, 46, 54 |
| BVA | 2 | TC-48, 60 |
| State Transition | 5 | TC-34, 41, 44, 47, 48 |
| Decision Table | 3 | TC-52, 55, 65 |

> 일부 TC는 2개 이상의 방법론을 복합 적용

### Type별 분포

| Type | 기존 (testcase_v1) | 신규 (v10) | 합계 |
|------|-------------------|-----------|------|
| SMOKE | 3 | 7 | 10 |
| FUNCTIONAL | 17 | 24 | 41 |
| REGRESSION | 0 | 1 | 1 |
| E2E | 2 | 13 | 15 |
| **합계** | **22** | **45** | **67** |

### Priority별 분포

| Priority | 기존 | 신규 | 합계 |
|----------|------|------|------|
| HIGH | 5 | 23 | 28 |
| MEDIUM | 10 | 18 | 28 |
| LOW | 7 | 4 | 11 |
| **합계** | **22** | **45** | **67** |

---

## Steps

- [ ] Step 1: Product Test Suite에 신규 Segment 구조 생성 (Version/Phase/TestRun/TestResult/KB/Senior/Convention)
- [ ] Step 2: Feature Registry TC 등록 — Version/Phase (TC-23 ~ TC-28)
- [ ] Step 3: Feature Registry TC 등록 — TestRun/TestResult (TC-29 ~ TC-36)
- [ ] Step 4: Knowledge Base TC 등록 (TC-37 ~ TC-48)
- [ ] Step 5: My Senior TC 등록 (TC-49 ~ TC-56)
- [ ] Step 6: Convention TC 등록 (TC-57 ~ TC-60)
- [ ] Step 7: Cross-Feature E2E TC 등록 (TC-61 ~ TC-67)
- [ ] Step 8: 최종 요약 및 qa_v9 연계 검토
