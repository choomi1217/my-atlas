# feature-registry_v9
Feature Registry — Test Run & Version 기능 추가 (고급 계획 관리)

## 변경 유형
기능 추가

## 배경

QA팀이 복잡한 릴리스 계획을 체계적으로 관리해야 한다.

**시나리오:**
```
v9 릴리스 (2026-04-30 예정)
  ├── Phase 1: 1차 테스트
  ├── Phase 2: 2차 테스트
  ├── Phase 3: Regression (재사용)    ← 같은 테스트를 여러 버전에서 사용
  └── Phase 4: 릴리스 검증

v8 릴리스 (2026-03-31 예정)
  ├── Phase 1: Regression (재사용)    ← v9와 동일한 테스트 집합
  └── Phase 2: 릴리스 검증
```

**요구사항:**
- **Test Run**: 독립적인 테스트 집합 (Product 레벨, 재사용 가능)
- **Version**: 릴리스 계획 (Phase별 TestRun 선택, release_date 관리)
- **Release Date 초과 시**: Version 자동 LOCK → 수정 불가
- **Version 복사**: LOCKED된 Version을 기반으로 새 Version 생성
- **진행률 계산**: Option A (전체) + Option B (Phase별) 동시 지원

---

## 테이블 관계도

```
product (1)
  │
  ├─── test_run (N)  ─── test_run_test_case ─── test_case (N:M)
  │    (독립 재사용)
  │
  └─── version (N)
        │
        ├─── version_phase (N)
        │     ├─── test_run (참조, 재사용)
        │     └─── test_result (N) ─── test_case
        │
        └─── version_copy_history (이력)
```

---

## DB 스키마 변경 (V8 Migration)

### 신규 테이블

```sql
-- Test Run: 독립적 테스트 집합 (Product 레벨, 재사용 가능)
CREATE TABLE test_run (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,     -- e.g. "Regression", "1차 테스트"
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)              -- Product 내 Run명 중복 방지
);
CREATE INDEX idx_test_run_product_id ON test_run(product_id);

-- Test Run과 Test Case의 N:M 관계
CREATE TABLE test_run_test_case (
    test_run_id  BIGINT NOT NULL REFERENCES test_run(id) ON DELETE CASCADE,
    test_case_id BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    added_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (test_run_id, test_case_id)
);
CREATE INDEX idx_test_run_test_case_run ON test_run_test_case(test_run_id);

-- Version: 릴리스 계획
CREATE TABLE version (
    id            BIGSERIAL PRIMARY KEY,
    product_id    BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,   -- e.g. "v9", "v2.1-hotfix"
    description   TEXT,
    release_date  DATE,                    -- 릴리스 예정일 (NULL이면 무제한)
                                          -- release_date 00:00:00를 지나면 경고
    copied_from   BIGINT,                  -- 복사 원본 version_id (NULL이면 신규)
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)
);
CREATE INDEX idx_version_product_id ON version(product_id);
CREATE INDEX idx_version_release_date ON version(release_date);

-- Version Phase: Version 내 각 단계별 TestRun 참조
CREATE TABLE version_phase (
    id            BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    phase_name    VARCHAR(100) NOT NULL,   -- e.g. "1차 테스트", "Regression"
    test_run_id   BIGINT NOT NULL REFERENCES test_run(id),
    order_index   INT NOT NULL,            -- 실행 순서 (1, 2, 3, ...)
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_version_phase_version ON version_phase(version_id);
CREATE INDEX idx_version_phase_test_run ON version_phase(test_run_id);
CREATE UNIQUE INDEX idx_version_phase_order ON version_phase(version_id, order_index);

-- Test Result: 실제 수행 결과 (Version + Phase 단위)
CREATE TABLE test_result (
    id               BIGSERIAL PRIMARY KEY,
    version_id       BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    version_phase_id BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_case_id     BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    status           VARCHAR(20) DEFAULT 'UNTESTED',
                     -- PASS | FAIL | BLOCKED | SKIPPED | RETEST | UNTESTED
    comment          TEXT,
    executed_at      TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE (version_phase_id, test_case_id)  -- Phase당 TC 결과 1개만
);
CREATE INDEX idx_test_result_version      ON test_result(version_id);
CREATE INDEX idx_test_result_version_phase ON test_result(version_phase_id);
CREATE INDEX idx_test_result_test_case    ON test_result(test_case_id);
```

**설계 결정:**
- `test_run`: Product 레벨 독립 개념 (여러 Version에서 재사용)
- `version_phase`: Version 내 Phase별로 TestRun 할당 (순서 관리)
- `test_result`: Phase별 수행 결과 기록 (같은 TestRun이여도 Version별로 다른 결과)
- `version.release_date`: 일정 초과 시 자동 LOCK
- `version.copied_from`: Version 복사 이력 추적

---

## 진행률 계산

### Option A: Version 전체 진행률
```
v9 전체: 30/30 완료 (모든 Phase의 모든 결과 합산)
├── Phase 1: 1차 테스트      → 10/10 완료
├── Phase 2: 2차 테스트      → 8/8 완료
├── Phase 3: Regression      → 8/8 완료
└── Phase 4: 릴리스 검증     → 4/4 완료

Pass: 22 | Fail: 5 | Blocked: 2 | Skipped: 1
```

### Option B: Phase별 진행률
```
v9
├── Phase 1: 1차 테스트      ██████░░ 10/10 (Pass 8 / Fail 2)
├── Phase 2: 2차 테스트      ████░░░░ 8/8 (Pass 6 / Fail 2)
├── Phase 3: Regression      ██████░░ 8/8 (Pass 8 / Fail 0)
└── Phase 4: 릴리스 검증     ░░░░░░░░ 0/4 (Untested)
```

**계산 로직:**
- `total = Phase의 모든 TC 개수`
- `completed = UNTESTED가 아닌 결과 수`
- `pass/fail/blocked/... = 상태별 카운트`

---

## Release Date 기반 경고 (Warning Only, No Hard Lock)

Release를 예정대로 진행하지 못하는 경우가 많으므로, **LOCK이 아닌 경고** 방식 채택.

### 동작 방식

```typescript
// API 응답에 포함
{
    id: 1,
    name: "v9",
    release_date: "2026-04-30",
    isReleaseDatePassed: false,  // false (2026-04-30 00:00:00 이전)
    warningMessage: null
}

// 오늘이 2026-05-01 이상이면
{
    id: 1,
    name: "v9",
    release_date: "2026-04-30",
    isReleaseDatePassed: true,   // true (2026-04-30 00:00:00 초과)
    warningMessage: "⚠️ 릴리스 예정일(2026-04-30)이 지났습니다. 진행 상황을 확인하세요."
}
```

### Frontend 동작

- **ReleaseDatePassed가 false**: 정상 (경고 없음)
- **ReleaseDatePassed가 true**:
  - ❌ 상단에 경고 배너 표시 (주황색)
  - ✅ Phase 추가/수정/삭제 계속 가능
  - ✅ Result 수정 계속 가능
  - ✅ Version 복사 가능
  - 사용자의 판단으로 계속 진행하거나 Version을 분기할 수 있음

### 예시

```
v9 "2026-04-30 릴리스"
⚠️ 릴리스 예정일(2026-04-30)이 지났습니다. 진행 상황을 확인하세요.
상태: OPEN | Release: 2026-04-30 (6일 초과)

[+ 새 Phase 추가] (여전히 가능)
[설정] [복사] [삭제]   (여전히 가능)

Phase 목록: (편집 가능)
...
```

### 복사 시나리오

```
v9 (release_date 초과) → "복사" 클릭 → v10 생성
  ├── 새 release_date 설정 가능 (예: 2026-05-15)
  └── Phase 동일하게 복사, result 초기화
```

### Release Date가 null인 경우
- 경고 없음 (무제한 수정 가능)

---

## Version 복사 / Phase 재구성

### Scenario 1: Version 전체 복사 (모든 상태에서 가능)
```
v9 (OPEN) → "v9 복사" 클릭 → v10 생성
  ├── Phase 1: 1차 테스트 (동일 TestRun 참조)
  ├── Phase 2: Regression (동일 TestRun 참조)
  └── Phase 3: 릴리스 검증 (동일 TestRun 참조)

v10 (OPEN) → 새 release_date 설정 가능, Phase/Result 수정 가능
```

```
v9 (release_date 초과, isReleaseDatePassed=true)
→ "v9 복사" 클릭 → v9-延期 생성
  ├── 동일 Phase 구조 복사
  ├── 새 release_date 설정 (예: 2026-05-15)
  └── test_result 초기화 (UNTESTED로 새로 시작)
```

**복사 로직:**
1. 새 Version 생성 (name: "v9-hotfix" / "v9 Copy" 등, copied_from: v9.id)
2. 원본의 모든 version_phase 복사 (동일 TestRun 참조)
3. test_result는 복사 안 함 (초기: UNTESTED)
4. release_date는 사용자가 새로 설정 가능

### Scenario 2: Phase별 TestRun 재사용
```
v9 Phase 3: Regression (TestRun #5)
└── 같은 TestRun #5를 v8 Phase 1에서도 사용
```

**가능한 작업:**
- Version A의 Phase "Regression" (TestRun #5)
- → Version B의 Phase "Regression"에 동일 TestRun #5 할당
- 각 Version은 독립적인 test_result 유지

### Scenario 3: 전혀 다른 Version 생성하되 기존 TestRun 재사용
```
"Regression" TestRun은 v9, v8, v7에서 모두 Phase로 할당
→ 같은 TestRun이 여러 버전에서 다른 결과로 추적
```

---

## Backend 구현 항목

### 신규 파일

| 파일 | 내용 |
|------|------|
| `db/migration/V8__create_test_run.sql` | 위 스키마 (test_run, version, version_phase, test_result) |
| `feature/RunResultStatus.java` | enum: PASS, FAIL, BLOCKED, SKIPPED, RETEST, UNTESTED |
| `feature/TestRunEntity.java` | @Entity test_run (product_id 참조) |
| `feature/TestRunDto.java` | CreateTestRunRequest, TestRunSummary, etc. |
| `feature/TestRunRepository.java` | findAllByProductId, findByProductIdAndName |
| `feature/TestRunService.java` | 인터페이스 |
| `feature/TestRunServiceImpl.java` | 구현체 |
| `feature/TestRunController.java` | REST 컨트롤러 |
| `feature/VersionEntity.java` | @Entity version (release_date, status, copied_from) |
| `feature/VersionPhaseEntity.java` | @Entity version_phase |
| `feature/VersionDto.java` | CreateVersionRequest, VersionSummary, VersionDetail, VersionPhaseDto |
| `feature/VersionRepository.java` | findAllByProductId, 자동 LOCK 로직 |
| `feature/VersionService.java` | 인터페이스 (복사 포함) |
| `feature/VersionServiceImpl.java` | 구현체 |
| `feature/VersionController.java` | REST 컨트롤러 (복사 엔드포인트) |
| `feature/TestResultEntity.java` | @Entity test_result (version, version_phase, test_case) |
| `feature/TestResultRepository.java` | findAllByVersionPhaseId, findByVersionPhaseIdAndTestCaseId |
| `feature/TestResultService.java` | 인터페이스 |
| `feature/TestResultServiceImpl.java` | 구현체 (진행률 계산 A+B) |
| `feature/TestResultController.java` | REST 컨트롤러 |

### API 엔드포인트

#### Test Run API (Product 레벨)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/products/{productId}/test-runs` | Product의 모든 TestRun 목록 |
| GET | `/api/test-runs/{id}` | TestRun 상세 (선택된 TC 목록 포함) |
| POST | `/api/products/{productId}/test-runs` | TestRun 생성 |
| PATCH | `/api/test-runs/{id}` | TestRun 수정 (이름, 설명, TC 목록) |
| DELETE | `/api/test-runs/{id}` | TestRun 삭제 |

#### Version API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/products/{productId}/versions` | Product의 모든 Version 목록 (release_date 기준, isReleaseDatePassed 포함) |
| GET | `/api/versions/{id}` | Version 상세 (Phase 목록 + 진행률 A+B + isReleaseDatePassed 경고) |
| POST | `/api/products/{productId}/versions` | Version 생성 |
| PATCH | `/api/versions/{id}` | Version 수정 (이름, 설명, release_date) |
| DELETE | `/api/versions/{id}` | Version 삭제 |
| POST | `/api/versions/{id}/copy` | Version 복사 (새 Version 생성, 이름/release_date 변경 가능) |

#### Version Phase API (Version 내 Phase 관리)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/versions/{versionId}/phases` | Phase 추가 (TestRun 선택) |
| PATCH | `/api/versions/{versionId}/phases/{phaseId}` | Phase 수정 (이름, TestRun, 순서) |
| DELETE | `/api/versions/{versionId}/phases/{phaseId}` | Phase 삭제 |
| POST | `/api/versions/{versionId}/phases/{phaseId}/reorder` | Phase 순서 변경 |

#### Test Result API (수행 결과)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/versions/{versionId}/results` | Version의 모든 결과 (Option A) |
| GET | `/api/versions/{versionId}/phases/{phaseId}/results` | Phase의 결과 (Option B) |
| PATCH | `/api/versions/{versionId}/results/{resultId}` | 결과 상태/코멘트 수정 |

---

## 네비게이션 흐름 (드릴다운)

```
CompanyListPage
  └── ProductListPage
        ├── [Test Cases →]   →  TestCasePage (기존)
        ├── [Test Runs →]    →  TestRunListPage (NEW) — Product 레벨 재사용 가능
        └── [Versions →]     →  VersionListPage (NEW)
              └── VersionDetailPage (NEW)
                    └── VersionPhaseDetailPage (NEW) — Phase별 결과 보기/편집
```

---

## Frontend 구현 항목

### 신규 파일

| 파일 | 내용 |
|------|------|
| `pages/features/TestRunListPage.tsx` | Product의 모든 TestRun 목록 (재사용 가능) |
| `pages/features/TestRunDetailPage.tsx` | TestRun 상세 (선택된 TC 목록) + 편집 |
| `pages/features/VersionListPage.tsx` | Version 목록 (release_date, status, 진행률) |
| `pages/features/VersionDetailPage.tsx` | Version 상세 (Phase 목록, 전체 진행률) |
| `pages/features/VersionPhaseDetailPage.tsx` | Phase별 결과 보기/편집 (Option B 진행률) |
| `components/features/TestRunFormModal.tsx` | TestRun 생성/수정 (TC 다중선택) |
| `components/features/VersionFormModal.tsx` | Version 생성 (release_date, Phase 구성) |
| `components/features/VersionCopyModal.tsx` | Version 복사 옵션 (이름 변경 후 복사) |
| `components/features/PhaseFormModal.tsx` | Phase 추가/수정 (TestRun 선택) |
| `components/features/ProgressStats.tsx` | Option A (전체) + Option B (Phase별) 진행률 표시 |
| `components/features/ResultStatusBadge.tsx` | RunResultStatus 색상 배지 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `types/features.ts` | TestRun, Version, VersionPhase, VersionStatus, TestResultStatus, ProgressStats 추가 |
| `api/features.ts` | testRunApi, versionApi, versionPhaseApi, testResultApi 추가 |
| `App.tsx` | 신규 라우트 5개 추가 |
| `components/features/Breadcrumb.tsx` | testRun, version, phase 레벨 추가 |
| `pages/features/ProductListPage.tsx` | "Test Runs" / "Versions" 버튼 2개 추가 |

---

## Frontend 화면 구성

### TestRunListPage
```
Product: Feature Registry

[+ New Test Run]

테스트 집합 목록:
┌─────────────────────────────────┐
│ Regression (재사용 가능)         │
│ TC 8개 선택됨                   │
│ 사용 중인 Version: v9, v8, v7   │
│ [수정] [삭제]                   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 1차 테스트                      │
│ TC 10개 선택됨                  │
│ 사용 중인 Version: v9           │
└─────────────────────────────────┘
```

### VersionListPage
```
Product: Feature Registry

[+ New Version]

버전 목록 (release_date 순):
┌──────────────────────────────────────┐
│ v9 "2026-04-30 릴리스"               │
│ Release: 2026-04-30 (24일 남음)      │
│ Phase: 4개 (1차/2차/Regression/릴)   │
│ 진행률: ██████░░ 25/30 완료          │
│ Pass 22 | Fail 5 | Blocked 2        │
│ [상세보기] [수정] [복사] [삭제]      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ⚠️  v8 "2026-03-31 릴리스"           │
│ Release: 2026-03-31 (6일 초과)       │
│ Phase: 2개 (Regression/릴)           │
│ 진행률: ██████░░ 15/16 완료          │
│ [상세보기] [수정] [복사] [삭제]      │
│ (계속 진행 또는 v8 Copy로 분기 가능) │
└──────────────────────────────────────┘
```

### VersionDetailPage
```
v9 "2026-04-30 릴리스"
Release: 2026-04-30 (24일 남음) | copied_from: — (신규)

[+ 새 Phase 추가]
[설정] [복사] [삭제]

전체 진행률 (Option A): ██████░░ 25/30
Pass 22 | Fail 5 | Blocked 2 | Skipped 1

Phase 목록:
1️⃣ 1차 테스트 (TestRun: "1차 테스트" - TC 10개)
   진행률: ████░░░░ 10/10 (Pass 8 / Fail 2)
   [결과보기] [수정] [삭제]

2️⃣ 2차 테스트 (TestRun: "2차 테스트" - TC 8개)
   진행률: ██░░░░░░ 8/8 (Pass 6 / Fail 2)
   [결과보기] [수정] [삭제]

3️⃣ Regression (TestRun: "Regression" - TC 8개) ⭐ 재사용중
   진행률: ██████░░ 8/8 (Pass 8 / Fail 0)
   [결과보기] [수정] [삭제]

4️⃣ 릴리스 검증 (TestRun: "릴리스 검증" - TC 4개)
   진행률: ░░░░░░░░ 0/4 (Untested)
   [결과보기] [수정] [삭제]
```

---

### VersionDetailPage (ReleaseDatePassed = True)
```
⚠️  v8 "2026-03-31 릴리스"
Release: 2026-03-31 (6일 초과) | copied_from: v7 (v7에서 복사)

경고: 릴리스 예정일이 지났습니다. 진행 상황을 확인하세요.
→ 계속 진행하거나 [v8-延期로 분기] 버튼으로 새 버전 생성 가능

[+ 새 Phase 추가]   (계속 가능)
[설정] [복사] [삭제] (계속 가능)

전체 진행률 (Option A): ██████░░ 15/16

Phase 목록: (편집 가능)
1️⃣ Regression (TestRun: "Regression" - TC 8개) ⭐ v9, v7도 사용중
   진행률: ██████░░ 8/8 (Pass 8 / Fail 0)
   [결과보기] [수정] [삭제]

2️⃣ 릴리스 검증 (TestRun: "릴리스 검증" - TC 8개)
   진행률: ███░░░░░ 7/8 (Pass 6 / Fail 1)
   [결과보기] [수정] [삭제]
```

### VersionPhaseDetailPage (Option B 진행률)
```
v9 > Phase 1: 1차 테스트

TestRun: "1차 테스트" (TC 10개 선택)
진행률: ████░░░░ 10/10
Pass 8 | Fail 2

결과 목록:
┌─────────────────────────────────────┐
│ ✅ TC #1 "로그인 기능"              │
│    Status: PASS                     │
│    Comment: "모두 정상"             │
│ [수정]                              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ❌ TC #5 "결제 처리"                │
│    Status: FAIL                     │
│    Comment: "타임아웃 발생"         │
│ [수정]                              │
└─────────────────────────────────────┘

(이하 8개 TC 결과...)
```

---

## 테스트 파일

### Backend 단위 테스트

| 파일 | 내용 |
|------|------|
| `test/feature/TestRunServiceImplTest.java` | TestRun CRUD, TC 목록 관리 |
| `test/feature/TestRunControllerTest.java` | TestRun API 엔드포인트 |
| `test/feature/VersionServiceImplTest.java` | Version CRUD, LOCK 로직, 복사 기능 |
| `test/feature/VersionControllerTest.java` | Version API 엔드포인트 |
| `test/feature/VersionPhaseServiceImplTest.java` | Phase 관리, 순서 변경 |
| `test/feature/TestResultServiceImplTest.java` | 진행률 계산 (A+B), LOCK 상태 거부 |
| `test/feature/TestResultControllerTest.java` | 결과 수정 API, LOCK 검증 |

### E2E 테스트

| 파일 | 내용 |
|------|------|
| `qa/api/test-run.spec.ts` | TestRun CRUD, TC 재선택 |
| `qa/api/version.spec.ts` | Version CRUD, LOCK, 복사, Phase 관리 |
| `qa/api/test-result.spec.ts` | 결과 수정, LOCK 상태 거부, 진행률 계산 |
| `qa/ui/test-run.spec.ts` | TestRunListPage, TestRunDetailPage |
| `qa/ui/version.spec.ts` | VersionListPage → VersionDetailPage → VersionPhaseDetailPage 흐름 |

---

## 구현 계획 및 진행 상황

### Phase 1: DB & Backend Core (Agent-A) ✅ **완료**

#### Step 1 — DB Migration
- [x] `V8__create_test_run.sql` 작성 ✅

#### Step 2 — Enum & Core Entity
- [x] `RunResultStatus.java` ✅
- [x] `TestRunEntity.java`, `VersionEntity.java`, `VersionPhaseEntity.java`, `TestResultEntity.java` ✅

#### Step 3 — Repository 계층
- [x] `TestRunRepository.java` ✅
- [x] `VersionRepository.java` ✅
- [x] `VersionPhaseRepository.java` ✅
- [x] `TestResultRepository.java` ✅

#### Step 4 — DTO & Service 인터페이스
- [x] `TestRunDto.java` ✅
- [x] `VersionDto.java` (isReleaseDatePassed, warningMessage 포함) ✅
- [x] Service 인터페이스 ✅

#### Step 5 — Service 구현 (기본 기능)
- [x] `TestRunServiceImpl.java` — CRUD + TC 목록 관리 ✅
- [x] `VersionServiceImpl.java` — CRUD + 복사 + isReleaseDatePassed 계산 ✅
- [x] `VersionPhaseServiceImpl.java` — Phase CRUD ⚠️ **기본만 구현**
- [x] `TestResultServiceImpl.java` — 진행률 계산 (A+B) ✅

#### Step 6 — Controller ✅
- [x] `TestRunController.java` ✅
- [x] `VersionController.java` ✅
- [x] `VersionPhaseController.java` ⚠️ **기본만 구현**
- [x] `TestResultController.java` ✅

### Phase 2: Frontend (Agent-A) ✅ **완료**

#### Step 7 — Types & API
- [x] `types/features.ts` ✅
- [x] `api/features.ts` ✅

#### Step 8 — Components
- [x] 기본 컴포넌트 ✅
- [x] Modal 컴포넌트 ✅

#### Step 9 — Pages & Routing
- [x] 모든 페이지 및 라우트 ✅

### Phase 3: Backend 단위 테스트 (Agent-B) ✅ **완료**

#### Step 10 — 단위 테스트 작성
- [x] 모든 서비스/컨트롤러 테스트 ✅
- [x] **통과: 251/251 테스트** ✅

### Phase 4: E2E 테스트 (Agent-C) ✅ **작성 완료, 부분 실행**

#### Step 11 — E2E 테스트 작성
- [x] API 테스트 파일 작성 ✅
- [x] UI 테스트 파일 작성 ✅
- [x] 테스트 실행: **80/105 통과** (E2E에서 productId/phases 필드 추가로 수정 완료)

### Phase 5: Build & Verification (Agent-D) ✅ **진행 중**

#### Step 12 — 최종 검증
- [x] `./gradlew clean build` 성공 ✅
- [x] `./gradlew test` 성공 (251/251) ✅
- [x] `docker compose up -d` 정상 기동 ✅
- [ ] `npx playwright test` — ⚠️ **25개 skip 상태**
- [x] `docker compose down` 정리 ✅

---

## ✅ 현재 구현 상태 요약

### 완료된 기능
- ✅ TestRun 생성/조회/수정 (기본 CRUD)
- ✅ Version 생성/조회/수정/복사
- ✅ Phase 생성/조회/기본 수정
- ✅ TestResult 상태 변경/진행률 계산
- ✅ isReleaseDatePassed 경고 시스템
- ✅ 모든 Frontend 페이지 (드릴다운 네비게이션)
- ✅ Backend 빌드 및 단위 테스트 (251/251 ✅)
- ✅ E2E 테스트 작성 (80/105 실행 중)

### 미구현 기능 (Option A 완성 필요)
- ⚠️ Phase 순서 변경 (reorder) — VersionPhaseServiceImpl
- ⚠️ Phase 삭제 후 orderIndex 자동 조정 — VersionPhaseServiceImpl
- ⚠️ Version/Phase 생성 시 초기 TestResult 자동 생성 — TestResultServiceImpl
- ⚠️ TestRun 수정 (PATCH) — TestRunServiceImpl
- ⚠️ TestRun 삭제 (DELETE) — TestRunServiceImpl

---

## 📋 Option A 완성을 위한 남은 Backend 구현

이 섹션은 E2E 테스트를 100% 통과시키기 위해 **필수적으로 구현**해야 할 Backend 기능입니다.

### 1️⃣ VersionPhaseServiceImpl — Phase 순서 관리

**파일:** `backend/src/main/java/com/myqaweb/feature/VersionPhaseServiceImpl.java`

#### 미구현 메서드

```java
/**
 * Phase를 삭제하고, 이후 Phase들의 orderIndex를 자동으로 조정
 * 예: Phase(order=2) 삭제 시, order=3,4,5는 각각 2,3,4로 변경
 *
 * @param versionId the version ID
 * @param phaseId the phase ID to delete
 */
public void deletePhase(Long versionId, Long phaseId)

/**
 * Phase의 순서를 변경
 * 예: Phase의 orderIndex를 2 → 4로 변경 시,
 *     기존 order 3,4를 각각 2,3으로 shift
 *
 * @param versionId the version ID
 * @param phaseId the phase ID
 * @param newOrderIndex the new order index
 */
public void reorderPhase(Long versionId, Long phaseId, int newOrderIndex)
```

**구현 로직:**

```
deletePhase(versionId, phaseId):
  1. Phase 조회 (orderIndex 저장)
  2. Phase 삭제
  3. 해당 version의 더 큰 orderIndex를 가진 Phase 찾기
  4. 각 Phase의 orderIndex -= 1
  5. 저장

reorderPhase(versionId, phaseId, newOrderIndex):
  1. Phase 조회 (현재 orderIndex 저장)
  2. 현재 orderIndex와 newOrderIndex 비교
  3. 사이에 있는 Phase들의 orderIndex shift
  4. Phase의 orderIndex 업데이트
  5. 저장
```

**테스트 케이스:**
- Phase 순서 1→3: 기존 order 2,3을 1,2로 shift
- Phase 순서 3→1: 기존 order 1,2를 2,3으로 shift
- Phase 삭제 후 orderIndex 자동 조정

---

### 2️⃣ TestResultServiceImpl — 초기 Result 자동 생성

**파일:** `backend/src/main/java/com/myqaweb/feature/TestResultServiceImpl.java`

#### 미구현 메서드

```java
/**
 * VersionPhase 생성 시 호출되어, TestRun의 모든 TestCase에 대해
 * 초기 TestResult를 UNTESTED 상태로 자동 생성
 *
 * @param versionId the version ID
 * @param phaseId the phase ID
 * @param testRunId the test run ID
 */
public void createInitialResults(Long versionId, Long phaseId, Long testRunId)
```

**구현 로직:**

```
createInitialResults(versionId, phaseId, testRunId):
  1. TestRun 조회
  2. TestRunTestCase JOIN으로 모든 TC 목록 조회
  3. 각 TC에 대해 TestResult 생성
     - status = UNTESTED
     - comment = null
     - executedAt = null
     - version_id, version_phase_id, test_case_id 설정
  4. saveAll()로 일괄 저장
```

**호출 위치:**
- `VersionPhaseServiceImpl.addPhase()` 내에서 Phase 생성 후 호출
- `VersionServiceImpl.copy()` 내에서 Phase 복사 후 각 Phase마다 호출

**테스트 케이스:**
- Phase 생성 시 10개 TC → 10개 Result 생성됨
- 모든 Result status = UNTESTED
- Version 복사 시 Result 초기화

---

### 3️⃣ TestRunServiceImpl — 수정/삭제 기능

**파일:** `backend/src/main/java/com/myqaweb/feature/TestRunServiceImpl.java`

#### 미구현 메서드

```java
/**
 * TestRun의 정보와 선택된 TestCase 목록을 수정
 * TC 목록 변경 시, test_run_test_case 레코드 삭제 후 재생성
 *
 * @param id the test run ID
 * @param request UpdateTestRunRequest (name, description, testCaseIds)
 * @return updated TestRunSummary
 */
public TestRunDto.TestRunSummary updateTestRun(Long id, TestRunDto.UpdateTestRunRequest request)

/**
 * TestRun 삭제
 * cascade: test_run_test_case, test_result 모두 자동 삭제
 *
 * @param id the test run ID
 */
public void deleteTestRun(Long id)
```

**구현 로직:**

```
updateTestRun(id, request):
  1. TestRun 조회
  2. name, description 업데이트
  3. testCaseIds 변경 확인
  4. 기존 test_run_test_case 모두 삭제
  5. 새로운 testCaseIds로 test_run_test_case 생성
  6. 저장 및 반환

deleteTestRun(id):
  1. TestRun 조회
  2. 관련 test_run_test_case 삭제 (cascade)
  3. 관련 test_result 삭제 (cascade) — DB 제약
  4. TestRun 삭제
```

**테스트 케이스:**
- TestRun TC 목록 수정 (추가/제거)
- 중복 TC 방지 (UNIQUE 제약)
- TestRun 삭제 시 cascade

---

## 📝 구현 우선순위 및 예상 시간

| 순번 | 항목 | 파일 | 메서드 수 | 예상 시간 |
|------|------|------|----------|---------|
| 1️⃣ | TestResult 초기 생성 | TestResultServiceImpl | 1개 | 15분 |
| 2️⃣ | TestRun CRUD | TestRunServiceImpl | 2개 | 20분 |
| 3️⃣ | Phase 순서 관리 | VersionPhaseServiceImpl | 2개 | 30분 |

**총 예상 시간: 약 1시간**

---

## 🎯 완성 후 검증

모든 구현 완료 후:

```bash
cd /Users/yeongmi/dev/qa/my-atlas/backend
./gradlew test --tests "*TestResult*"
./gradlew test --tests "*TestRun*"
./gradlew test --tests "*VersionPhase*"
```

**단위 테스트가 통과하면, E2E 테스트도 자동으로 25개 skip 해제:**

```bash
cd /Users/yeongmi/dev/qa/my-atlas/qa
npx playwright test qa/api/version-phase.spec.ts
npx playwright test qa/api/test-result.spec.ts
npx playwright test qa/api/test-run.spec.ts
```

**최종 목표: E2E 테스트 105/105 통과** ✅

---

## 검증 체크리스트

### Backend - TestRun
- [ ] TestRun CRUD 정상
- [ ] TC 선택/재선택 가능
- [ ] Product 내 TestRun명 중복 방지

### Backend - Version
- [ ] Version CRUD 정상
- [ ] release_date 초과 시 `isReleaseDatePassed = true` 반환
- [ ] 모든 상태의 Version 복사 가능 (copied_from 기록)
- [ ] release_date 초과 후에도 Phase/Result 수정 계속 가능
- [ ] API 응답에 경고 메시지 포함

### Backend - VersionPhase
- [ ] Phase 추가/수정/삭제
- [ ] Phase 순서 관리
- [ ] TestRun 재사용 (같은 TestRun을 여러 Phase/Version에서 사용)

### Backend - TestResult & 진행률
- [ ] 결과 상태/코멘트 수정
- [ ] Option A: Version 전체 진행률 계산 (모든 Phase 합산)
- [ ] Option B: Phase별 진행률 계산
- [ ] LOCKED 상태에서 결과 수정 거부

### Frontend - Navigation
- [ ] ProductListPage → TestRunListPage / VersionListPage 이동
- [ ] VersionListPage → VersionDetailPage
- [ ] VersionDetailPage → VersionPhaseDetailPage

### Frontend - UI
- [ ] TestRunListPage: 재사용 가능한 TestRun 목록
- [ ] VersionListPage: release_date, isReleaseDatePassed 여부 표시
- [ ] VersionListPage: isReleaseDatePassed=true면 경고 배너 (⚠️) 표시
- [ ] VersionDetailPage: Phase 목록 + 전체 진행률 (Option A)
- [ ] VersionDetailPage: isReleaseDatePassed=true면 경고 배너 + "분기" 버튼 제공
- [ ] VersionPhaseDetailPage: Phase별 결과 (Option B 진행률)
- [ ] 모든 상태의 Version에서 복사 가능 (UI에서 제약 없음)

### E2E (Agent-D)
- [ ] API: CRUD, LOCK, 복사, Phase 관리 정상
- [ ] UI: 네비게이션 흐름 정상
- [ ] `npx playwright test` — **전체 통과**
