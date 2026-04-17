# Feature Registry — QA 테스트 관리 플랫폼

> 최종 업데이트: 2026-04-17 | 현재 버전: v17

---

## 개요 — QA에게 이 도구가 왜 필요한가

### 문제: 파편화된 QA 업무

QA 팀의 일상은 스프레드시트에 테스트 케이스를 작성하고, Jira에서 버그를 수동으로 집계하고, 릴리즈 때마다 "대충 다 잡힌 것 같은데…"라는 감에 의존하는 것이었다. 테스트 자산은 개인 파일에 흩어지고, 실행 이력은 남지 않으며, 과거 릴리즈의 품질 데이터는 복구할 수 없었다.

### 해결: 엔드투엔드 QA 플랫���

Feature Registry는 **테스트 케이스 작성부터 릴리즈 Go/No-Go 판단까지** 하나�� 플랫폼에서 처리한다.

### 핵심 가치

| 가치 | 의미 | 대응 기능 |
|------|------|-----------|
| **테스트 자산 중앙화** | TC가 팀의 지적 자산으로 축적된다 | Company → Product → Segment → TestCase 계층 관리 |
| **실행 이력 추적성** | 어떤 버전에서 무엇을 테스트했는지 남는다 | Version → Phase → TestResult + 진행률 |
| **결함 연동 자동화** | FAIL 즉시 Jira 티켓이 생성된다 | Ticket 자동 생성 + 상태 동기화 |
| **데이터 기반 릴리즈 판단** | 감이 아닌 숫자로 Go/No-Go를 결정한다 | Release Readiness + Daily Snapshot + Trend |

### QA 일상 업무 Before/After

| QA 업무 | 기존 방식 | Feature Registry |
|---------|-----------|-----------------|
| TC 작성 | 스프레드시트, 개인 문서 | TestCase + Segment 계층 + 이미지 첨부 |
| TC 분류 | 폴더명, 시트 탭 | Segment 트리 (DnD 재배치, 자동완성) |
| 테스트 실행 | 수동 체크리스트 | Version → Phase → TestResult 상태 변경 |
| 결함 보고 | Jira 수동 생성 | FAIL 클릭 → Jira 자동 티켓 + Priority 설정 |
| 진행률 보고 | 수동 집계, 보고서 작성 | 실시간 ProgressStats (Pass/Fail/Blocked 자동 계산) |
| "릴리즈 해도 될까?" | PM에게 물어봄, 감에 의존 | Release Readiness Go/No-Go (4개 기준 자동 평가) |
| "어제보다 나아졌나?" | 기억에 의존 | Daily Trend 차트 (Bug 추이, Pass Rate 변화) |
| "방치된 버그는?" | Jira 필터 수동 생성 | Aging Bug 리스트 자동 노출 (3일+) |
| 과거 릴리즈 상태 조회 | 복구 불가 | Daily Snapshot → 해당 날짜 리포트 조회 |

---

## 시스템 아키텍처 한눈에 보기

```
Company (1) ──→ Product (N)
                  │
                  ├── Segment (N, 계층형 self-ref)
                  │     └── TestCase.path = Segment ID 배열로 참���
                  │
                  ├── TestCase (N) ──→ TestCaseImage (N, S3)
                  │
                  ├── TestRun (N) ←─→ TestCase (N:M)
                  │     └── 재사용 가능한 TC 묶음 (Product 레벨)
                  │
                  └── Version (N) ──→ VersionPhase (N)
                                       │
                                       ├──→ TestRun (N:M)
                                       ���──→ TestCase (N:M, 직접 할당)
                                       │
                                       └──→ TestResult (N)
                                              │
                                              ├── Ticket (N, Jira 연동)
                                              └── Comment (N, 스레드형)

                  DailyTestSnapshot ── Phase별 일일 스냅샷 (통계)
```

**15개 테이블 | 7개 Enum | 12개 컨트롤러 | 59개 API 엔드포인트**

---

## 핵심 기능

### 1. 테스트 자산 관리 (Core)

> **QA 시니어가 말하는 이 기능의 가치:**
> "테스트 케이스는 QA의 지적 자산이다. 체계적으로 관리되지 않으면 사람이 바뀔 때마다 처음부터 다시 만든다. 신입 QA가 들어왔을 때 '여기 들어가서 보세요'라고 말할 수 있는 곳이 있어야 한다."

**Company → Product → TestCase 3단계 드릴다운**

URL 기반 네비게이션으로 브라우저 히스토리가 자연스럽게 동작한다. Breadcrumb으로 현재 위치를 항상 표시한다.

| 단계 | URL | 화��� |
|------|-----|------|
| 1단계 | `/features` | Company 목록 (활성 회사 1개 제한) |
| 2���계 | `/features/companies/:companyId` | Product 목록 (Platform별 분류) |
| 3단계 | `/features/companies/:cid/products/:pid` | TestCase 관리 (메인 작업 화면) |

**Segment 계층 트리**

TestCase의 분류 체계. Adjacency List 방식의 self-referencing 트리 구조로, 무한 depth를 지원한다.

- **트리 뷰**: 펼침/접힘 + 노드별 TC 카운트 배지
- **드래그 앤 드롭**: 세그먼트를 끌어 계층 재배치 (BFS 기반 순환 참조 방지)
- **인라인 생성**: CascadingPathInput에서 새 세그먼트 즉시 생성
- **경로 표시**: `결제 단말기 > 결제 > IC카드 결제` 형태로 사람이 읽을 수 있는 경로

**Path 트리 그룹핑**

공통 상위 경로를 1회만 표시하고, 하위 카테고리를 들여쓰기 + vertical guideline으로 시각화한다. 대량 TC에서 가독성이 크게 향상된다.

```
📁 결제 단말기 > 결제
   │
   ├─ 📂 IC카드 결제
   │     [Card] IC카드 정상 결제
   │     [Card] IC카드 중간 제거 시 롤백
   │
   ├─ ���� NFC 결제
   │     [Card] NFC 결제 (삼성페이)
   │
   └─ 📂 QR 결제
         [Card] QR ��제 (토스페이)
```

**TestCase 상세**

| 필드 | 설명 |
|------|------|
| title | TC 제목 |
| path | Segment ID 배열 (분류 경로) |
| preconditions | 사전 조건 |
| steps | JSON 배열 `[{order, action, expected}]` |
| expected_result | 기대 ��과 |
| priority | HIGH, MEDIUM, LOW |
| test_type | SMOKE, FUNCTIONAL, REGRESSION, E2E |
| status | DRAFT, ACTIVE, DEPRECATED (기본: ACTIVE) |
| images | S3 이미지 첨부 (Step/Expected Result에서 참조) |

**AI Draft 생성**

Spring AI ChatClient(Claude)를 통해 Segment 경로 기반으로 테스트 케이스 초안을 자동 생성한다. DRAFT 상태로 저장되어 QA가 검토 후 활성화한다.

---

### 2. 테스트 실행 관리 (Execution)

> **QA 시니어��� 말하는 이 기능의 가치:**
> "테스트를 실행하지 않으면 품질은 문서에만 존재한다. '이번 릴리즈에서 뭘 테스트했고, 어떤 결과가 나왔는지' — 이 기록이 없으면 다음 릴리즈에서 같은 실수를 반복한다. 실행 이력이 남아야 진짜 테스트다."

**핵심 개념 3가지**

| 개념 | 설명 | QA 가�� |
|------|------|---------|
| **TestRun** | 재사용 가능한 TC 묶음 (Product 레벨) | "로그인 스모크 테스트" 같은 TC 세트를 한번 만들면 매 릴리즈마다 재사용 |
| **Version** | 릴리즈 계획 (release_date, 복사 기능) | "v2.1 릴리즈"처럼 버전별로 테스트 계획을 관리 |
| **VersionPhase** | Phase 단위 실행 (1차/2차/Regression) | 동일 버전 내에서 Phase를 나눠 단계적으로 테스트 진행 |

**Phase의 유연한 구성**

- Phase ↔ TestRun **N:M 관계**: 하나의 Phase에 여러 TestRun을 포함할 수 있어 대규모 테스트 스위트를 구성할 수 있다
- Phase ↔ TestCase **직접 할당**: TestRun 없이도 개별 TC를 Phase에 직접 추가할 수 있다
- Phase Type: `FIRST` (1차), `SECOND` (2차), `REGRESSION` (회귀) — 유형별 통계 비교 가능
- Phase 기간: `startDate`, `endDate` — 기간 기반 통계 산출

**TestResult — 6가지 실행 상���**

| 상태 | 의미 | 색상 |
|------|------|------|
| PASS | 성공 | 초록 |
| FAIL | 실패 (→ Jira 티켓 생성 트리거) | 빨강 |
| BLOCKED | 선행 조건 미충족으로 실행 불가 | 주�� |
| SKIPPED | 의도적 건너뜀 | 회색 |
| RETEST | 재테��트 필요 | 파랑 |
| UNTESTED | 미실행 | 연회색 |

**진행률 실시간 계산 (ProgressStats)**

Phase 내 모든 TestResult를 in-memory 집계하여 Pass/Fail/Blocked/Skipped/Retest/Untested 수와 비율을 실시간 표시한다. 상태 변경 즉시 업데이트된다.

**Failed TC 히스토리**

과거 버전에서 FAIL이었던 TC를 조회할 수 있어, Regression Phase 구성 시 "이전에 실패했던 케이스"를 우선 포함할 ��� 있다.

**Version 복사**

기존 Version의 Phase 구성을 새 Version으로 복사하여 매 릴리즈마다 테스트 계획을 빠르게 생성할 수 ���다.

**화면 구성**

| URL | 화면 | 설명 |
|-----|------|------|
| `.../test-runs` | TestRunListPage | Product의 TestRun 목록 |
| `.../test-runs/:id` | TestRunDetailPage | TC 계층형 표시 + 선택/제거 |
| `.../versions` | VersionListPage | Product�� Version 목록 |
| `.../versions/:id` | VersionDetailPage | Phase 관리 + Release Readiness 대시보드 |
| `.../versions/:vid/phases/:pid` | VersionPhaseDetailPage | Phase 실행 (결과 입력 + 댓글 + 티켓) |

---

### 3. 결함 추적 (Defect Tracking)

> **QA 시니어가 말하는 이 기능의 가치:**
> "버그를 발견하고 추적하지 않으면 같은 버그가 릴리즈마다 반복된다. FAIL을 눌렀는데 Jira 티켓이 자동으로 만들어지고, 그 티켓이 닫혔는지까지 추적해주면 — QA가 버그 관리에 쓰는 시간의 절반이 줄어든다."

**FAIL → Jira 자동 티켓 생성**

Phase 실행 화면에서 TC를 FAIL로 변경하면 Jira 티켓 생성 다이얼로그가 자동으로 열린다. Summary를 입력하고 Priority를 선택하면 Jira Cloud에 이슈가 생성되고, TestResult에 티켓이 연결된다.

**Jira 연동 상세**

| 기능 | 설명 |
|------|------|
| 자동 생성 | FAIL 시 Jira 이슈 생성 (프로젝트 키, 이슈 타입 설정 가능) |
| Priority 매핑 | HIGHEST / HIGH / MEDIUM / LOW / LOWEST → Jira priority 필드에 직접 반영 |
| 상태 동기화 | 개별 Refresh 또는 Phase 전체 일괄 Refresh |
| 종료 감지 | Jira에서 Done 상태로 변경되면 `closedAt` 자동 기록 |
| 재오픈 감지 | Done → 미완료 전환 시 `reopenCount` 증가 (수정 품질 지표) |

**티켓 Priority 5단계**

| Priority | Jira 매핑 | Go/No-Go 기준 |
|----------|-----------|---------------|
| HIGHEST | Highest | 미해결 **0건** 이하 필수 |
| HIGH | High | 미해결 **2건** 이하 필수 |
| MEDIUM | Medium | - |
| LOW | Low | - |
| LOWEST | Lowest | - |

**TestResult 댓글 스레드**

각 TestResult에 계층형 댓글을 남길 수 있다. 이미지 첨부도 가능하여 버그 재현 스크린샷이나 로그를 기록할 수 있다. 팀원 간 논의 이력이 TestResult에 직접 남는다.

---

### 4. QA 릴리즈 통계 (Release Intelligence)

> **QA 시���어가 말하는 이 기능의 가치:**
> "릴리즈 가능 여부를 '감'으로 판단하던 시대는 끝났다. 'Critical 미해결 0건, Regression Pass Rate 98.5%입니다 — GO입니다'라고 숫자로 말할 수 있어야 한다. 그래야 PM이든 개발팀이든 납득한다."

**Release Readiness — Go/No-Go 자동 판단**

Version Detail 페이지 진입 시 아래 4개 기준이 자동으로 평가된다.

| 기준 | 임계값 | Go 조건 |
|------|--------|---------|
| Highest 미해결 버그 | 0건 이하 | 필수 |
| High 미해결 버그 | 2건 이하 | 필수 |
| Regression Phase Pass Rate | 98% 이상 | 필수 |
| Aging 버그 (3일+) | 별도 표시 | 참고 지표 |

모든 필수 조건 충족 시 **GO** (초록 배지), 하나라도 미충�� 시 **NO-GO** (빨간 배지) + 미충족 사유 표시.

**Daily Test Snapshot — 시계열 통계**

매일 자정 `@Scheduled` 배치가 진행 중인 모든 Phase의 스냅샷을 저장한다.

| 스냅샷 항��� | 설명 |
|------------|------|
| TC 실행 통계 | total, pass, fail, blocked, skipped, retest, untested |
| 당일 신규 버그 | Priority별 (Highest/High/Medium/Low/Lowest) |
| 당일 종료 버그 | closedAt 기준 |
| Open 누적 버그 | 미종료 티켓 수 |
| Aging 버그 | 생성 후 3일 이상 미해결 |
| 산출 지표 | Pass Rate (%), Progress Rate (%) |

- `UNIQUE(phase_id, snapshot_date)` — 중복 실행해도 덮어쓰기 (멱등성)
- 스냅샷 없는 날짜 → 실시간 계산 fallback
- 수동 재생성: `POST /api/admin/snapshots/run?date=YYYY-MM-DD`

**Trend 차트**

- **Bug 추이**: 일자별 신규 버그 (Priority별 누적 영역) + 종료 버그 (라인)
- **Pass Rate**: 일자별 Pass Rate + Progress Rate 라인 차트
- Phase 필터로 특정 Phase만 조회 가능
- 차트의 데이터 포인트 클릭 시 해당 날짜의 Daily Report 모달 오픈

**Aging Bug / Blocked TC 리스트**

- Aging Bug: 3일 이상 미해결 티켓 목록 (Priority 배지, Jira 링크, 경과일)
- Blocked TC: BLOCKED 상태 TC 목록 (TC 제목, Segment 경로, Phase)

**판단 기준 설정값 관리**

`application.yml`의 `statistics.readiness.*`로 Go/No-Go 임계값을 조정할 수 있다.

```yaml
statistics:
  readiness:
    max-highest-open: 0
    max-high-open: 2
    min-regression-pass-rate: 98.0
    aging-threshold-days: 3
```

---

## 데이터베이스 스키마

### 테이블 구조 (15개)

#### Core — 테스트 자산 (5)

| 테이블 | 주요 ���럼 | 비�� |
|--------|----------|------|
| **company** | id, name, is_active, created_at | partial unique index (활성 1개 제한) |
| **product** | id, company_id(FK), name, platform, description, jira_project_key, created_at | Platform enum |
| **segment** | id, name, product_id(FK), parent_id(FK self-ref) | Adjacency List, CASCADE 삭제 |
| **test_case** | id, product_id(FK), path(bigint[]), title, description, prompt_text, preconditions, steps(jsonb), expected_result, priority, test_type, status, created_at, updated_at | path = Segment ID 배열 |
| **test_case_image** | id, test_case_id(FK), filename, original_name, order_index | S3 저장 |

#### Execution — 테스트 실행 (6)

| 테이블 | 주요 컬럼 | 비고 |
|--------|----------|------|
| **test_run** | id, product_id(FK), name, description, created_at, updated_at | UNIQUE(product_id, name) |
| **test_run_test_case** | id, test_run_id(FK), test_case_id(FK), added_at | N:M 중간 테이블 |
| **version** | id, product_id(FK), name, description, release_date, copied_from, created_at, updated_at | 릴리즈 계획 |
| **version_phase** | id, version_id(FK), phase_name, order_index, phase_type, start_date, end_date, created_at, updated_at | PhaseType enum |
| **version_phase_test_run** | id, version_phase_id(FK), test_run_id(FK) | Phase ↔ TestRun N:M |
| **version_phase_test_case** | id, version_phase_id(FK), test_case_id(FK), added_at | Phase ↔ TC 직접 할당 |

#### Result & Defect — 실행 결과 및 결함 (3)

| ���이블 | 주요 컬럼 | 비고 |
|--------|----------|------|
| **test_result** | id, version_id(FK), version_phase_id(FK), test_case_id(FK), status, comment, executed_at, created_at, updated_at | UNIQUE(version_phase_id, test_case_id) |
| **test_result_comment** | id, test_result_id(FK), parent_id(FK self-ref), author, content, image_url, created_at, updated_at | 계층형 스레드 |
| **ticket** | id, test_result_id(FK), jira_key, jira_url, summary, status, priority, closed_at, reopen_count, created_at, updated_at | Jira 연동 |

#### Statistics — 통계 (1)

| 테이블 | 주요 ���럼 | 비고 |
|--------|----------|------|
| **daily_test_snapshot** | id, version_id(FK), phase_id(FK), snapshot_date, total_tc, pass/fail/blocked/skipped/retest/untested_count, new_bug (priority별), closed/open/aging_bug_count, pass_rate, progress_rate, created_at | UNIQUE(phase_id, snapshot_date) |

### Enum 값 (7개)

| Enum | 값 | 사용처 |
|------|----|--------|
| **Platform** | WEB, DESKTOP, MOBILE, ETC | Product |
| **Priority** | HIGH, MEDIUM, LOW | TestCase |
| **TestType** | SMOKE, FUNCTIONAL, REGRESSION, E2E | TestCase |
| **TestStatus** | DRAFT, ACTIVE, DEPRECATED | TestCase |
| **RunResultStatus** | PASS, FAIL, BLOCKED, SKIPPED, RETEST, UNTESTED | TestResult |
| **PhaseType** | FIRST, SECOND, REGRESSION | VersionPhase |
| **TicketPriority** | HIGHEST, HIGH, MEDIUM, LOW, LOWEST | Ticket |

### Flyway 마이그레이션

#### 레거시 (V1~V17): 순차 번호

| 버전 | 설명 |
|------|------|
| V1 | Company, Product 생성 |
| V2 | TestCase 생성 |
| V3 | Feature 제거, Segment 추가, TestCase에 product_id/path 이전 |
| V7 | 초기 데이터 시드 |
| V8 | test_run, version, version_phase, test_result 생성 |
| V9~V11 | TestRun/Phase junction 개선, cascade 수정 |
| V13 | test_case_image, test_result_comment 생성 |

#### 타임스탬프 기반 (V202604xx)

| 버전 | 설명 |
|------|------|
| V202604151600 | version_phase_test_run junction 생성 |
| V202604152100 | ticket, version_phase_test_case 생성 |
| V202604170900 | ticket에 priority/closedAt/reopenCount 추가 + daily_test_snapshot 생성 |
| V202604171400 | ticket severity → priority 변환 (Jira 우선순위 체계 일치) |

---

## Backend API 엔드포인트

모든 엔드포인트는 `ApiResponse<T>` (success, message, data) 형식으로 응답한다.

### Company (`/api/companies`) — 6개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/companies` | 전체 회사 목록 |
| POST | `/api/companies` | 회사 생성 |
| PATCH | `/api/companies/{id}/activate` | 회사 활성화 (1개만 가능) |
| PUT | `/api/companies/{id}` | 회사 수정 |
| PATCH | `/api/companies/{id}/deactivate` | 회사 비활���화 |
| DELETE | `/api/companies/{id}` | 회사 삭제 (CASCADE) |

### Product (`/api/products`) — 4개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/products?companyId={id}` | 회사별 제품 목록 |
| POST | `/api/products` | 제품 생성 |
| PUT | `/api/products/{id}` | 제품 수정 |
| DELETE | `/api/products/{id}` | 제품 삭제 (CASCADE) |

### Segment (`/api/segments`) — 5개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/segments?productId={id}` | 제품별 세그먼트 전체 조회 |
| POST | `/api/segments` | ��그먼트 생성 (productId, name, parentId) |
| PUT | `/api/segments/{id}` | 이름 수정 |
| DELETE | `/api/segments/{id}` | 삭제 (자식 CASCADE) |
| PATCH | `/api/segments/{id}/parent` | 부모 변경 (DnD, 순환 참조 검증) |

### TestCase (`/api/test-cases`) — 8개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/test-cases?productId={id}` | 제품별 테스트 케이스 ��록 |
| POST | `/api/test-cases` | 테스트 ��이스 생성 (@Valid) |
| PUT | `/api/test-cases/{id}` | 수정 |
| DELETE | `/api/test-cases/{id}` | 삭제 |
| POST | `/api/test-cases/generate-draft` | AI 드래프트 생성 |
| GET | `/api/test-cases/{id}/images` | TC 이미지 목록 |
| POST | `/api/test-cases/{id}/images` | TC 이미지 추가 (S3) |
| DELETE | `/api/test-cases/{id}/images/{imageId}` | TC 이미지 삭제 |

### TestRun — 5개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/products/{pid}/test-runs` | Product별 TestRun 목록 |
| GET | `/api/test-runs/{id}` | TestRun 상세 (포함 TC 목록) |
| POST | `/api/products/{pid}/test-runs` | TestRun 생성 (TC 선택) |
| PATCH | `/api/test-runs/{id}` | TestRun 수정 (TC 추가/제거) |
| DELETE | `/api/test-runs/{id}` | TestRun 삭제 |

### Version — 7개

| Method | Endpoint | 설��� |
|--------|----------|------|
| GET | `/api/products/{pid}/versions` | Product별 Version 목록 |
| GET | `/api/versions/{id}` | Version 상세 |
| POST | `/api/products/{pid}/versions` | Version 생성 |
| PATCH | `/api/versions/{id}` | Version 수정 |
| POST | `/api/versions/{id}/copy` | Version 복사 (Phase 구성 포함) |
| DELETE | `/api/versions/{id}` | Version 삭제 (CASCADE) |
| GET | `/api/versions/{id}/failed-test-cases` | 과거 FAIL TC 목록 (Regression 구성용) |

### VersionPhase — 7개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/versions/{vid}/phases` | Phase 목록 |
| POST | `/api/versions/{vid}/phases` | Phase 추가 (phaseType, testRunIds, testCaseIds) |
| PATCH | `/api/versions/{vid}/phases/{pid}` | Phase 수정 |
| DELETE | `/api/versions/{vid}/phases/{pid}` | Phase ���제 |
| POST | `/api/versions/{vid}/phases/{pid}/reorder` | Phase 순서 변경 |
| POST | `/api/versions/{vid}/phases/{pid}/test-cases` | Phase에 TC 추��� |
| DELETE | `/api/versions/{vid}/phases/{pid}/test-cases` | Phase에서 TC 제거 |

### TestResult — 3개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/versions/{vid}/results` | Version 전체 TestResult |
| GET | `/api/versions/{vid}/phases/{pid}/results` | Phase별 TestResult |
| PATCH | `/api/versions/{vid}/results/{rid}` | 결과 상태 변경 (PASS/FAIL/...) |

### TestResultComment — 3개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/versions/{vid}/results/{rid}/comments` | 댓글 목록 (스레드) |
| POST | `/api/versions/{vid}/results/{rid}/comments` | 댓글 작성 (이미지 가능) |
| DELETE | `/api/versions/{vid}/results/{rid}/comments/{cid}` | 댓글 삭제 |

### Ticket (Jira 연동) — 5개

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/versions/{vid}/results/{rid}/tickets` | Jira 티켓 생성 |
| GET | `/api/versions/{vid}/results/{rid}/tickets` | TestResult의 티켓 목록 |
| DELETE | `/api/versions/{vid}/results/{rid}/tickets/{tid}` | 티켓 삭제 |
| POST | `.../tickets/{tid}/refresh` | 개별 티켓 Jira 상태 동기화 |
| POST | `/api/versions/{vid}/phases/{pid}/tickets/refresh-all` | Phase 전체 티켓 일괄 Refresh |

### FeatureImage — 1개

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/feature-images` | 이미지 업로드 (S3, multipart) |

### Statistics (통계) — 5개

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/phases/{id}/reports/daily?date=` | Phase 특정 날짜 Daily Report |
| GET | `/api/phases/{id}/reports/trend?from=&to=` | Phase 기간 시계열 데이터 |
| GET | `/api/versions/{id}/release-readiness` | Release Readiness Go/No-Go |
| GET | `/api/versions/{id}/dashboard` | Version 대시보드 통합 데이터 |
| POST | `/api/admin/snapshots/run?date=` | 스냅샷 수동 재생성 |

---

## URL 라우팅

| 단계 | URL | 페이지 |
|------|-----|--------|
| 1 | `/features` | CompanyListPage |
| 2 | `/features/companies/:companyId` | ProductListPage |
| 3 | `/features/companies/:cid/products/:pid` | TestCasePage |
| 4 | `/features/.../products/:pid/test-runs` | TestRunListPage |
| 5 | `/features/.../products/:pid/test-runs/:testRunId` | TestRunDetailPage |
| 6 | `/features/.../products/:pid/versions` | VersionListPage |
| 7 | `/features/.../products/:pid/versions/:versionId` | VersionDetailPage |
| 8 | `/features/.../versions/:versionId/phases/:phaseId` | VersionPhaseDetailPage |

---

## Backend 파�� 구조

```
backend/src/main/java/com/myqaweb/
├── feature/                            # Registry 핵심 도메인 (~78 파일)
│   ├── Company*.java                   # Entity, Dto, Repository, Service, ServiceImpl, Controller
│   ├── Product*.java                   # 〃
│   ├── Segment*.java                   # 〃
│   ├── TestCase*.java                  # 〃
│   ├── TestCaseImage*.java             # Entity, Repository
│   ├── TestRun*.java                   # Entity, Dto, Repository, Service, ServiceImpl, Controller
│   ├── TestRunTestCase*.java           # Entity, Repository (N:M junction)
│   ���── Version*.java                   # Entity, Dto, Repository, Service, ServiceImpl, Controller
│   ├── VersionPhase*.java              # Entity, Repository, Service, ServiceImpl, Controller
│   ├── VersionPhaseTestRun*.java       # Entity, Repository (N:M junction)
│   ├── VersionPhaseTestCase*.java      # Entity, Repository (N:M junction)
│   ├── TestResult*.java                # Entity, Repository, Service, ServiceImpl, Controller
│   ├── TestResultComment*.java         # Entity, Dto, Repository, Service, ServiceImpl, Controller
│   ├── Ticket*.java                    # Entity, Dto, Repository, Service, ServiceImpl, Controller
│   ├── FeatureImageController.java     # 이미지 업로드
│   ├── JiraConfig.java / JiraService.java / JiraServiceImpl.java
│   ├── Platform / Priority / TestType / TestStatus / RunResultStatus / PhaseType / TicketPriority  # Enum
│   └── TestStep.java                   # record(order, action, expected)
│
├── statistics/                         # 통계 패키지 (격리, ~10 파��)
│   ├── DailyTestSnapshotEntity.java    # @Entity
│   ���── DailyTestSnapshotRepository.java # JPA + upsert 네이티브 쿼리
│   ├── ReadinessConfig.java            # @ConfigurationProperties (Go/No-Go 임���값)
│   ├── SnapshotScheduler.java          # @Scheduled 매일 자정
│   ├── SnapshotService.java / SnapshotServiceImpl.java
│   ├── StatisticsDto.java              # DailyReport, TrendData, ReleaseReadiness, Dashboard 등
│   ├── StatisticsService.java / StatisticsServiceImpl.java
│   └── StatisticsController.java       # 5개 API 엔드포인트
│
└── common/
    ├── ApiResponse.java                # 공통 응답 래퍼
    └── GlobalExceptionHandler.java     # 예외 핸들러
```

---

## Frontend 파일 구조

```
frontend/src/
├── pages/features/                     # 8개 페이지
│   ├��─ CompanyListPage.tsx             # 회사 목록 + CRUD
│   ├── ProductListPage.tsx             # 제��� 목록 + CRUD
│   ├── TestCasePage.tsx                # TC 관리 (메인 작업 화면)
│   ├── TestRunListPage.tsx             # TestRun 목록
│   ├── TestRunDetailPage.tsx           # TestRun 상세 (계층형 TC 표시)
│   ├��─ VersionListPage.tsx             # Version 목록
│   ├── VersionDetailPage.tsx           # Version 상세 + Release Readiness 대시보드
│   └── VersionPhaseDetailPage.tsx      # Phase 실행 (결과 입력 + 댓글 + 티켓)
���
├── components/features/                # 17+ 컴포넌트
│   ├── Breadcrumb.tsx                  # 네비게이션 경로
│   ├── SegmentTreeView.tsx             # Segment 트리 (DnD + ScrollSpy)
│   ├── TestCaseFormModal.tsx           # TC 생성/수정 모달 (이미지 첨부)
│   ├── TestCaseGroupSelector.tsx       # Segment 기반 TC 선택
│   ├── CompanyFormModal.tsx            # 회사 생성/수정
│   ├── ProductFormModal.tsx            # 제품 생성/수정
│   ├── TestRunFormModal.tsx            # TestRun 생성/수정
│   ├── VersionFormModal.tsx            # Version 생성/수정
│   ├── VersionCopyModal.tsx            # Version 복사
│   ├── PhaseFormModal.tsx              # Phase 생성/수정
│   ├── ConfirmDialog.tsx               # 확인 다이얼로그
│   ├── CommentThread.tsx               # 계층형 댓글
│   ├── ResultStatusBadge.tsx           # 상태 배지 (PASS/FAIL/...)
│   ├── StatusButtonGroup.tsx           # 상태 선택 버튼 그룹
│   ├── ProgressStats.tsx               # 진행률 바
│   ├── ImageRefText.tsx                # 이미지 참조 텍스트
│   └── statistics/                     # 통계 컴포넌트 (5개)
│       ├── ReleaseReadinessCard.tsx     # Go/No-Go + KPI + 기준 체크리스트
│       ├── TrendChartSection.tsx        # Bug 추이 + Pass Rate 차트 (recharts)
│       ├── AgingBugList.tsx             # Aging 버그 테이블
│       ├── BlockedTcList.tsx            # Blocked TC 테���블
│       └── DailyReportModal.tsx         # 특정 날짜 Daily Report 모달
│
├── api/features.ts                     # 13개 API 모듈
├── types/features.ts                   # 30+ TypeScript 인터페이스/Enum
├── context/ActiveCompanyContext.tsx     # 활성 회사 상태 관리
└── stores/featureStore.ts              # Zustand 스���어
```

---

## E2E 테스트 커버리지

### API 테스트 (`qa/api/`) — 10개 spec

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `company.spec.ts` | Company CRUD | 생성, 조회, 활성화, 비활성화, 삭제 |
| `product.spec.ts` | Product CRUD | 생성, 조회, 수정, 삭제, CASCADE |
| `segment.spec.ts` | Segment CRUD | 생성, 조회, 수정, 삭제, 부모 변경, CASCADE |
| `feature.spec.ts` | TestCase CRUD | 생성, 조회, 수정, 삭제, 검증(400), CASCADE |
| `test-run.spec.ts` | TestRun CRUD | 생성, 조회, 수정, TC 추가/제거, 삭제 |
| `version.spec.ts` | Version CRUD | 생성, 조회, 수정, 복사, 삭제 |
| `version-phase.spec.ts` | Phase 관리 | Phase CRUD, 순서 변경, TC 할�� |
| `test-result.spec.ts` | TestResult | 상태 변경, 결과 조회 |
| `test-result-comment.spec.ts` | 댓글 | 생성, 조회, 삭제, 스레드 |
| `ticket.spec.ts` | Jira 티켓 | 생성, 조회, 삭제, Refresh |

### UI 테스트 (`qa/ui/`) — 6개 spec

| 파일 | 대상 | 테스트 항목 |
|------|------|------------|
| `company-panel.spec.ts` | Company 페이지 | 표시, 추가, 활성화, 삭제, Product 이동 |
| `product-panel.spec.ts` | Product 페이지 | 폼, 추가, API 데이터 표시, 삭제, TC 이동 |
| `feature-panel.spec.ts` | TestCase 페이지 | 빈 목록, 추가, 데이터 표시, 삭제, 뷰 전환 |
| `test-run.spec.ts` | TestRun 페이지 | 생성, TC 선택, 상세 표시 |
| `version.spec.ts` | Version 페이지 | 생성, Phase 관리, 실행, 복사 |
| `segment-dnd.spec.ts` | Segment DnD | 드래그, 드롭, 계층 변경 확인 |

### 테스트 헬퍼

| 파일 | 역할 |
|------|------|
| `qa/helpers/api-helpers.ts` | createTestCompany, createTestProduct, createTestSegment, createTestTestCase, cleanupAllTestData |
| `qa/pages/features-page.ts` | Page Object (goto, gotoCompany, gotoProduct 등) |

---

## 버전 히스토리

| 버전 | 날짜 | 유형 | 요약 | QA 임팩트 |
|------|------|------|------|-----------|
| v1 | 2026-03-18 | 기능 추가 | Company + Product + Feature CRUD | 테스트 자산 관리의 첫 단계 |
| v2 | 2026-03-20 | 기능 추가 | TestRail 스타일 4단계 드릴다운 | URL 기반 네비게이션, 상태 유지 |
| v3 | 2026-03-22 | 기능 개선 | Feature → Segment 전환, 3단계 드릴다운 | Segment ID 배열로 분류 체계 확립 |
| v4 | 2026-03-24 | 기능 개선 | Segment 트리 뷰 + 경로 입력 UI | 직관적 트리 탐색, 컨텍스트 메뉴 |
| v5 | 2026-03-25 | 버그 수정 | TestCase 모달 개선, UX 통일 | Add/Edit 통합 모달, UX 일관성 |
| v6 | 2026-03-26 | 기능 개선 | 불필요 필드 제거, Status 기본값 ACTIVE | 인지 부하 감소, 작업 속도 향상 |
| v7 | 2026-03-28 | 기능 추가 | Segment 드래그 앤 드롭 | 테스트 구조 재편성 용이 |
| v8 | 2026-03-30 | 버그 수정 | 순환 참조 검증 BFS 수정 | 데이터 무결성 보장 |
| v9 | 2026-04-01 | 기능 추가 | TestRun + Version + Phase + TestResult | 테스트 실행 추적 체계 도��� |
| v10 | 2026-04-05 | 기능 개선 | Phase Detail 실시간 테스트 실행 | 상태 변경 즉시 반영, 진행률 실시간 |
| v11 | 2026-04-08 | 기능 개선 | TestRunDetailPage, 계층적 TC 그룹핑 | TestRun 내 TC 경로 기반 탐색 |
| v12 | 2026-04-09 | 기능 추가 | 이미지 첨부 + 댓글 스레드 + 인라인 상태 버튼 | 결함 증거 첨부, 팀 논의 기록 |
| v13 | 2026-04-10 | 기능 개선 | Breadcrumb + ScrollSpy + Priority 색상 | 위치 인식, 대량 TC 네비게이션 |
| v14 | 2026-04-15 | 기능 개선 | Step 이미지 삽입 + Phase:TestRun 1:N | 대규모 테스트 스위트 지원 |
| v15 | 2026-04-15 | 기능 추가 | Jira 티켓 연동 + Version 재설계 + Failed TC 히스토리 | 결함 자동 추적, Regression 구성 |
| v16 | 2026-04-16 | 기능 개선 | Path 트리 그룹핑 (prefix 압축, vertical guideline) | 대량 TC 가독성 향상 |
| v17 | 2026-04-17 | 기능 추가 | QA 릴리즈 통계 + Release Readiness + Daily Snapshot | 데이터 기반 릴리즈 Go/No-Go 판단 |
