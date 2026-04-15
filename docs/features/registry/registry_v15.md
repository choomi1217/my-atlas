# Feature Registry — Ticket 발행, Version/Phase 구조 개편, Segment 기반 실행 (v15)

> 변경 유형: 기능 추가 + 기능 개선  
> 작성일: 2026-04-15  
> 버전: v15  
> 상태: 완료

---

# 요구사항 

### Test Result가 Fail일 경우 Ticket 발행
Version에서 테스트 실행 결과로 Fail로 설정할 경우 Ticket을 발행 해주세요.
- 유저 시나리오
1. Version #1의 테스트 수행도중 Fail 된 테스트가 있다.
2. 해당 Test를 Fail 처리
3. 연동된 Jira Project에 Bug Ticket이 발행됩니다.
4. Version #1의 Fail 된 Test를 클릭하면 연동된 티켓 URL이 보이고, 클릭시 티켓으로 이동됨

- 참고
1. Failed된 이유가 여러가지 티켓 때문일 수도 있으므로 TestCase Result:Ticket=1:N 관계여야 합니다.
2. Ticket의 상태가 변하면 해당 TestCase Rusult에도 그 상태가 UI 로 확인 되어야 합니다.
3. Ticket이 Done처리가 되어도 직접 테스트하지 않았다면 그 TestCase는 절대 Pass 상태가 되면 안되므로 TestCase Result 상태는 Ticket과 관계 없습니다.


### 아래의 Phase 추가를 위한 Version 생성 방식 변경
버전 생성 modal에서 바로 Phase를 추가하지 않고, Version Detail 페이지에서 추가하는 걸로 바꿔야 합니다.
Phase에 TC를 선택 할 수도 있어야 하고, TestRun을 추가할 수도 있어야 하는 복잡한 형태가 되었으므로 모달로는 해소가 되지 않습니다.

- 유저 시나리오
1. Version List 진입 -> Version 추가 버튼 클릭 -> 모달 오픈 -> 생성
    - Version Name, 설명, 릴리즈 데이트 정도만 노출
1. 새 버전 #ver1 생성 -> List에 바로 해당 버전 노출 -> 해당 버전 클릭
2. 버전 디테일 페이지 진입 -> +Phase 버튼 클릭 -> TestRun을 선택하는 섹션 + TC들을 추가하는 섹션
    - TestRun을 생성하는 걸 예로 들 수 있을것 같습니다.

### Phase Detail 화면 Imporve
테스트 수행할 때 Segment들을 표시해주지 않으면 테스트 하는데에 어려움을 겪습니다.
TestCase가 어떤 Segment 의 하위인지 UI로 표시 해주세요.
위에서 처럼 앞으로 Phase에는 TestRun을 추가할 수도 있고, TestCase를 개별적으로도 추가할 수 있으므로 이 사항도 모두 고려해서 Segment를 UI로 표시 해주세요.

### 한번이라도 Fail이 되었고, 한번이라도 Ticket이 발행이 된 해당 version의 TestCase Result 에 대한 히스토리가 남아야합니다.
한번 Failed 된 테스트케이스는 다음 Phase에서 테스트 하거나 Regression때 반드시 포함 해야 하기 때문입니다.
이를 위해 현재 Phase에 TestRun을 추가하는 것 외에도 TestCase를 추가할 수 있어야 합니다.
해당 버전에서 Failed된 TestCase들을 Phase에 추가할 수 있도록 해주시고, Phase에서 제외하고 싶은 TC가 있다면 제거할 수 있게 해주세요.

---

## 현재 코드 분석 (Context)

### VersionFormModal.tsx (311줄) — Version 생성 시 Phase 포함

- 파일: `frontend/src/components/features/VersionFormModal.tsx`

**현재 Form 구조:**
```tsx
// Form state (L9-14, L24-29)
interface VersionFormData {
  name: string;
  description: string;
  releaseDate: string;
  phases: PhaseFormData[];  // ← Phase를 인라인으로 생성
}
const emptyForm = {
  ...
  phases: [{ phaseName: '', testRunIds: [] }],  // 최소 1개 Phase 필수
};
```

- L62-85: `handleSubmit()` — `form.phases.length === 0` 또는 `testRunIds.length === 0`이면 alert → **Phase 없이 Version 생성 불가**
- L87-92: `addPhase()` — Phase 추가 버튼
- L193-278: Phase별 인라인 phaseName 입력 + TestRun multi-checkbox
- **문제:** Phase 생성이 Version 모달 안에 강제 포함 → 복잡한 TC 선택 UI 배치 불가

### PhaseFormModal.tsx (171줄) — Phase 추가 (TestRun multi-select)

- 파일: `frontend/src/components/features/PhaseFormModal.tsx`

**현재 Form:**
```tsx
// L4-7
interface PhaseFormData {
  phaseName: string;
  testRunIds: number[];  // ← TestRun만 선택, 개별 TC 선택 없음
}
```

- L115-147: TestRun 목록을 체크박스로 표시, 선택/해제 토글
- L63-83: `handleSubmit()` — `testRunIds.length === 0`이면 alert → **TestRun 없이 Phase 생성 불가**
- **문제:** 개별 TC 선택 섹션 없음, Failed TC 추가 기능 없음

### VersionPhaseDetailPage.tsx (280줄) — Phase 실행 화면

- 파일: `frontend/src/pages/features/VersionPhaseDetailPage.tsx`

**데이터 로딩 (L35-59):**
```tsx
const [v, r, tc] = await Promise.all([
  versionApi.getById(Number(versionId)),
  testResultApi.getByVersionPhaseId(Number(versionId), Number(phaseId)),
  testCaseApi.getByProductId(Number(productId)),  // 전체 TC 로드 (path 접근 가능)
]);
```

- L181-276: **결과 목록이 Flat 리스트** — Segment 그룹핑 없음
- L217-271: 펼침 영역에 Steps, Expected Result, CommentThread 표시
- L151-157: 헤더에 TestRun 이름/TC 수 표시
- **문제:** TC가 어떤 Segment에 속하는지 표시되지 않아 테스트 수행 시 맥락 파악 어려움
- **기회:** `testCaseApi.getByProductId()`로 이미 전체 TC(path 포함) 로드 중 → Segment 로드만 추가하면 그룹핑 가능

### VersionDetailPage.tsx (401줄) — Phase 관리

- 파일: `frontend/src/pages/features/VersionDetailPage.tsx`

- L323-327: "+Phase" 버튼 → `PhaseFormModal` 오픈
- L96-109: `handleAddPhase()` → `versionPhaseApi.addPhase(versionId, phaseName, testRunIds)`
- L334-378: Phase 카드 목록 (TestRun 이름, TC 수, Progress)
- Phase 편집 기능 **없음** — 추가/삭제만 가능
- **문제:** Phase 생성이 모달 기반이라 복잡한 TC 선택 배치 불가

### VersionServiceImpl.java (271줄) — Version 생성

- 파일: `backend/src/main/java/com/myqaweb/feature/VersionServiceImpl.java`

**create() L45-89:**
```java
// 1. Version 생성 (L51-57)
VersionEntity version = new VersionEntity();
version.setName(request.name()); ...
VersionEntity savedVersion = versionRepository.save(version);

// 2. Phase 생성 루프 — Version 생성 시점에 Phase까지 함께 생성 (L61-86)
for (VersionDto.PhaseRequest phaseReq : request.phases()) {
    // Phase 생성 → junction 연결 → TestResult 초기화
    testResultService.createInitialResults(versionId, phaseId, phaseReq.testRunIds());
}
```

**VersionDto.CreateVersionRequest:**
```java
public record CreateVersionRequest(
    Long productId, String name, String description, LocalDate releaseDate,
    @NotEmpty List<PhaseRequest> phases  // ← Phase 필수
) {}
```

### TestResultServiceImpl.java (163줄) — TestResult 생성

- 파일: `backend/src/main/java/com/myqaweb/feature/TestResultServiceImpl.java`

**createInitialResults() L32-67 — TestRun 기반 TC만 처리:**
```java
public void createInitialResults(Long versionId, Long phaseId, List<Long> testRunIds) {
    Set<Long> seenTestCaseIds = new HashSet<>();  // 중복 방지
    for (Long testRunId : testRunIds) {
        List<TestRunTestCaseEntity> rtcs = testRunTestCaseRepository.findAllByTestRunId(testRunId);
        for (TestRunTestCaseEntity rtc : rtcs) {
            if (seenTestCaseIds.add(rtc.getTestCase().getId())) {
                // UNTESTED 상태의 TestResult 생성
            }
        }
    }
    testResultRepository.saveAll(results);
}
```
- **문제:** 개별 TC 추가를 지원하지 않음 — TestRun 경유만 가능

### DB Schema — test_result 제약조건

```sql
-- V8__create_test_run.sql
UNIQUE (version_phase_id, test_case_id)  -- Phase당 TC는 1개 결과만
```
- 이 제약조건 덕분에 TestRun과 개별 TC에서 동일 TC가 중복 추가되어도 TestResult는 1개만 보장
- 개별 TC 추가 시 기존 TestResult가 있으면 SKIP, 없으면 INSERT

### Ticket 관련 — 현재 없음

- 티켓 테이블, 엔티티, Jira 연동 — 모두 **미구현**
- TestResultEntity: `status`, `comment` 필드만 존재, 티켓 참조 없음

---

## 구현 계획

### Step 1 — DB Migration: Ticket 테이블 + Phase-TC Junction

**신규 파일:** `backend/src/main/resources/db/migration/V{타임스탬프}__create_ticket_and_phase_test_case.sql`

```sql
-- 1. Ticket (test_result:ticket = 1:N)
CREATE TABLE ticket (
    id              BIGSERIAL PRIMARY KEY,
    test_result_id  BIGINT NOT NULL REFERENCES test_result(id) ON DELETE CASCADE,
    jira_key        VARCHAR(50) NOT NULL,      -- "AT-123" (Jira 이슈 키)
    jira_url        VARCHAR(500) NOT NULL,    -- Jira 이슈 전체 URL
    summary         VARCHAR(500) NOT NULL,    -- 티켓 제목
    status          VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_result ON ticket(test_result_id);

-- 2. Phase-TestCase 직접 연결 (TestRun 경유 없이 개별 TC 추가)
CREATE TABLE version_phase_test_case (
    id                BIGSERIAL PRIMARY KEY,
    version_phase_id  BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_case_id      BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    added_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (version_phase_id, test_case_id)
);
CREATE INDEX idx_vptc_phase ON version_phase_test_case(version_phase_id);
CREATE INDEX idx_vptc_tc ON version_phase_test_case(test_case_id);

-- 3. Product에 Jira 프로젝트 키 추가 (선택)
ALTER TABLE product ADD COLUMN jira_project_key VARCHAR(20);
```

**설계 근거:**
- `ticket.status`는 Jira 상태를 그대로 저장 (VARCHAR) — Jira 상태명은 프로젝트마다 커스터마이징 가능하므로 Enum 사용 안 함
- `ticket.jira_key`, `jira_url`이 NULL이면 Jira 미연동 수동 티켓 (로컬 관리)
- `version_phase_test_case`는 개별 TC 추가 전용 — TestRun 경유 TC는 기존 `version_phase_test_run` junction으로 관리
- `test_result`의 `UNIQUE (version_phase_id, test_case_id)` 제약이 중복 결과 방지 보장

- [x] 타임스탬프 기반 마이그레이션 파일 생성
- [x] ticket 테이블 생성
- [x] version_phase_test_case 테이블 생성
- [x] product.jira_project_key 컬럼 추가

---

### Step 2 — Backend: Ticket Entity + Jira Integration Service

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/TicketEntity.java` | @Entity ticket |
| `feature/TicketDto.java` | CreateTicketRequest, TicketResponse |
| `feature/TicketRepository.java` | findAllByTestResultId |
| `feature/TicketService.java` | 인터페이스 |
| `feature/TicketServiceImpl.java` | CRUD + Jira 연동 위임 |
| `feature/TicketController.java` | REST 컨트롤러 |
| `feature/JiraService.java` | Jira API 인터페이스 |
| `feature/JiraServiceImpl.java` | Jira REST API 호출 (RestTemplate) |
| `feature/JiraConfig.java` | @ConfigurationProperties (Jira 연결 설정) |

**TicketEntity:**
```java
@Entity @Table(name = "ticket")
public class TicketEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_result_id", nullable = false)
    private TestResultEntity testResult;

    private String jiraKey;       // nullable
    private String jiraUrl;       // nullable
    @Column(nullable = false) private String summary;
    @Column(nullable = false) private String status;  // "OPEN", "IN_PROGRESS", "DONE" 등
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**TicketDto:**
```java
public record CreateTicketRequest(
    String summary,               // 필수: 티켓 제목
    String description            // 선택: 상세 설명
) {}

public record TicketResponse(
    Long id, Long testResultId,
    String jiraKey, String jiraUrl,
    String summary, String status,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {}
```

**JiraConfig (application.yml):**
```yaml
jira:
  base-url: ${JIRA_BASE_URL:}
  email: ${JIRA_EMAIL:}
  api-key: ${JIRA_API_KEY:}
  default-project-key: AT
  issue-type: Bug
```

**JiraServiceImpl — 핵심 메서드:**
```java
// Jira 설정 여부 확인
public boolean isConfigured() {
    return StringUtils.hasText(jiraConfig.getBaseUrl())
        && StringUtils.hasText(jiraConfig.getEmail())
        && StringUtils.hasText(jiraConfig.getApiToken());
}

// Jira 이슈 생성
public JiraIssue createIssue(String projectKey, String summary, String description) {
    // POST {baseUrl}/rest/api/2/issue
    // Auth: Basic base64(email:apiToken)
    // Body: { fields: { project: { key }, summary, description, issuetype: { name: "Bug" } } }
    // Returns: { key: "PROJ-123", self: "https://..." }
}

// Jira 이슈 상태 조회
public String getIssueStatus(String jiraKey) {
    // GET {baseUrl}/rest/api/2/issue/{jiraKey}?fields=status
    // Returns: status.name (e.g., "To Do", "In Progress", "Done")
}
```

**TicketServiceImpl — 생성 로직:**
```java
public TicketResponse createTicket(Long resultId, CreateTicketRequest request) {
    TestResultEntity result = testResultRepository.findById(resultId)...;
    TicketEntity ticket = new TicketEntity();
    ticket.setTestResult(result);
    ticket.setSummary(request.summary());
    ticket.setStatus("OPEN");

    // Jira 연동 시 자동 발행
    if (jiraService.isConfigured()) {
        String projectKey = getProjectKeyForResult(result);  // Product의 jira_project_key
        if (projectKey != null) {
            JiraIssue issue = jiraService.createIssue(projectKey, request.summary(), request.description());
            ticket.setJiraKey(issue.key());
            ticket.setJiraUrl(issue.url());
        }
    }

    return toResponse(ticketRepository.save(ticket));
}
```

**엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/versions/{versionId}/results/{resultId}/tickets` | 티켓 생성 (Jira 연동 시 자동 발행) |
| GET | `/api/versions/{versionId}/results/{resultId}/tickets` | 해당 Result의 티켓 목록 |
| DELETE | `/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}` | 티켓 삭제 |
| POST | `/api/versions/{versionId}/results/{resultId}/tickets/{ticketId}/refresh` | Jira에서 최신 상태 동기화 |

**Jira 연동 실패 시 동작:**
- Jira 설정 누락 / API 토큰 만료 / 네트워크 오류 → **에러 메시지만 표시** ("Jira 연결을 확인하세요")
- 로컬 fallback 없음 — Jira API가 유일한 티켓 발행 수단
- `ticket` 테이블의 `jira_key`, `jira_url`은 **NOT NULL** (Jira 이슈 참조 전용)

- [x] JiraConfig (@ConfigurationProperties) 생성
- [x] application.yml에 `jira.*` 설정 추가
- [x] JiraService 인터페이스 + JiraServiceImpl (createIssue, getIssueStatus, isConfigured)
- [x] TicketEntity 생성
- [x] TicketDto 생성 (CreateTicketRequest, TicketResponse)
- [x] TicketRepository 생성 (findAllByTestResultId)
- [x] TicketService 인터페이스 + TicketServiceImpl (create, list, delete, refreshFromJira)
- [x] TicketController 생성 (4개 엔드포인트)

---

### Step 3 — Backend: Phase TC Direct Management + Version 생성 단순화

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/VersionPhaseTestCaseEntity.java` | @Entity version_phase_test_case junction |
| `feature/VersionPhaseTestCaseRepository.java` | findAllByVersionPhaseId, deleteByVersionPhaseIdAndTestCaseId |

**VersionPhaseTestCaseEntity:**
```java
@Entity @Table(name = "version_phase_test_case")
public class VersionPhaseTestCaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_phase_id", nullable = false)
    private VersionPhaseEntity versionPhase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id", nullable = false)
    private TestCaseEntity testCase;

    private LocalDateTime addedAt;
}
```

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `feature/VersionDto.java` | CreateVersionRequest 단순화, PhaseRequest에 testCaseIds 추가 |
| `feature/VersionServiceImpl.java` | create() 단순화 (Phase 생성 제거) |
| `feature/VersionPhaseServiceImpl.java` | addTestCasesToPhase, removeTestCasesFromPhase 추가 |
| `feature/TestResultServiceImpl.java` | createResultsForTestCaseIds 추가 |
| `feature/VersionPhaseController.java` | TC 관리 엔드포인트 + Failed TC 조회 |
| `feature/TestResultRepository.java` | findAllByVersionIdAndStatus 추가 |

**VersionDto 변경:**
```java
// Before
public record CreateVersionRequest(
    Long productId, String name, String description, LocalDate releaseDate,
    @NotEmpty List<PhaseRequest> phases  // ← Phase 필수
) {}

// After — Phase 분리
public record CreateVersionRequest(
    @NotNull Long productId,
    @NotBlank String name,
    String description,
    LocalDate releaseDate
    // phases 제거 — Version Detail 페이지에서 별도 추가
) {}

// PhaseRequest 확장 — 개별 TC 추가 지원
public record PhaseRequest(
    @NotBlank String phaseName,
    List<Long> testRunIds,       // TestRun 경유 TC (기존)
    List<Long> testCaseIds       // 개별 TC 직접 추가 (신규)
) {}
```

**VersionServiceImpl.create() 단순화:**
```java
// Before: Version + Phase 동시 생성 (L45-89)
// After: Version만 생성
@Transactional
public VersionDetail create(CreateVersionRequest request) {
    VersionEntity version = new VersionEntity();
    version.setProduct(productRepository.findById(request.productId())...);
    version.setName(request.name());
    version.setDescription(request.description());
    version.setReleaseDate(request.releaseDate());
    return getById(versionRepository.save(version).getId());
}
```

**VersionPhaseServiceImpl — Phase TC 관리 메서드:**
```java
// addPhase() 확장 — testRunIds + testCaseIds 모두 처리
@Transactional
public VersionPhaseDto addPhase(Long versionId, PhaseRequest request) {
    // 1. Phase 생성 (기존)
    // 2. TestRun junction 생성 (기존)
    // 3. 개별 TC junction 생성 (신규)
    if (request.testCaseIds() != null) {
        for (Long tcId : request.testCaseIds()) {
            VersionPhaseTestCaseEntity junction = new VersionPhaseTestCaseEntity();
            junction.setVersionPhase(savedPhase);
            junction.setTestCase(testCaseRepository.findById(tcId)...);
            versionPhaseTestCaseRepository.save(junction);
        }
    }
    // 4. TestResult 초기화 — TestRun TC + 개별 TC 합산, 중복 제거
    testResultService.createInitialResults(versionId, savedPhase.getId(),
        request.testRunIds(), request.testCaseIds());
}

// Phase에 개별 TC 추가 (이미 생성된 Phase에)
@Transactional
public void addTestCasesToPhase(Long versionId, Long phaseId, List<Long> testCaseIds) {
    VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)...;
    for (Long tcId : testCaseIds) {
        // junction 생성 (UNIQUE 제약으로 중복 방지)
        // TestResult 생성 (없는 경우만)
    }
}

// Phase에서 TC 제거
@Transactional
public void removeTestCasesFromPhase(Long phaseId, List<Long> testCaseIds) {
    for (Long tcId : testCaseIds) {
        versionPhaseTestCaseRepository.deleteByVersionPhaseIdAndTestCaseId(phaseId, tcId);
        testResultRepository.deleteByVersionPhaseIdAndTestCaseId(phaseId, tcId);
    }
}
```

**TestResultServiceImpl — 확장:**
```java
// Before: createInitialResults(versionId, phaseId, List<Long> testRunIds)
// After: testRunIds + directTestCaseIds 모두 처리
@Transactional
public void createInitialResults(Long versionId, Long phaseId,
        List<Long> testRunIds, List<Long> directTestCaseIds) {
    Set<Long> seenTestCaseIds = new HashSet<>();
    List<TestResultEntity> results = new ArrayList<>();

    // 1. TestRun 경유 TC (기존 로직)
    if (testRunIds != null) {
        for (Long testRunId : testRunIds) { ... }
    }

    // 2. 개별 TC 추가 (신규)
    if (directTestCaseIds != null) {
        for (Long tcId : directTestCaseIds) {
            if (seenTestCaseIds.add(tcId)) {
                TestCaseEntity tc = testCaseRepository.findById(tcId)...;
                // UNTESTED TestResult 생성
            }
        }
    }

    testResultRepository.saveAll(results);
}
```

**신규 엔드포인트:**

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/versions/{versionId}/phases/{phaseId}/test-cases` | Phase에 개별 TC 추가 (body: testCaseIds[]) |
| DELETE | `/api/versions/{versionId}/phases/{phaseId}/test-cases` | Phase에서 TC 제거 (body: testCaseIds[]) |
| GET | `/api/versions/{versionId}/failed-test-cases` | 해당 Version의 FAIL 상태 TC 목록 (Phase/Ticket 이력 포함) |

**Failed TC 조회 응답:**
```java
public record FailedTestCaseInfo(
    Long testCaseId,
    String testCaseTitle,
    Long[] testCasePath,
    String failedInPhaseName,       // 어느 Phase에서 FAIL이었는지
    Integer ticketCount             // 발행된 티켓 수
) {}
```

- [x] VersionPhaseTestCaseEntity 생성
- [x] VersionPhaseTestCaseRepository 생성
- [x] VersionDto.CreateVersionRequest에서 phases 제거
- [x] VersionDto.PhaseRequest에 testCaseIds 추가
- [x] VersionServiceImpl.create() 단순화 (Phase 생성 제거)
- [x] VersionPhaseServiceImpl.addPhase() 확장 (testCaseIds 처리)
- [x] VersionPhaseServiceImpl.addTestCasesToPhase() 추가
- [x] VersionPhaseServiceImpl.removeTestCasesFromPhase() 추가
- [x] TestResultServiceImpl.createInitialResults() 확장 (directTestCaseIds 파라미터)
- [x] TestResultRepository.findAllByVersionIdAndStatus() 추가
- [x] VersionPhaseController에 TC 관리 엔드포인트 3개 추가
- [x] VersionDto.FailedTestCaseInfo record 추가
- [x] VersionServiceImpl.copy() — 개별 TC junction도 복사

---

### Step 4 — Frontend: Version 생성 단순화

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `components/features/VersionFormModal.tsx` | Phase 섹션 제거 (name, description, releaseDate만) |
| `pages/features/VersionListPage.tsx` | 생성 후 VersionDetailPage로 navigate |
| `api/features.ts` | versionApi.create() 시그니처 변경 |
| `types/features.ts` | VersionFormData 단순화 |

**VersionFormModal 변경 (311줄 → ~100줄):**
```
Before:
┌───────────────────────────────────────────────┐
│ 새 버전 생성                                   │
│ ───────────────────────────────────────────── │
│ 버전 이름 *   [v2.0 Release QA             ]  │
│ 설명          [QA 릴리즈 테스트             ]  │
│ 릴리즈 날짜   [2026-04-30                   ]  │
│ ───────────────────────────────────────────── │
│ Phase 1: [1차 테스트] TestRun: ☑로그인 ☑결제  │  ← 제거
│ Phase 2: [Regression] TestRun: ☑전체 회귀     │  ← 제거
│ [+ Phase 추가]                                │  ← 제거
│ ───────────────────────────────────────────── │
│                               [취소] [생성]    │
└───────────────────────────────────────────────┘

After:
┌───────────────────────────────────────────────┐
│ 새 버전 생성                                   │
│ ───────────────────────────────────────────── │
│ 버전 이름 *   [v2.0 Release QA             ]  │
│ 설명          [QA 릴리즈 테스트             ]  │
│ 릴리즈 날짜   [2026-04-30                   ]  │
│ ───────────────────────────────────────────── │
│                               [취소] [생성]    │
└───────────────────────────────────────────────┘
```

**VersionListPage — 생성 후 navigate:**
```tsx
// Before: 생성 후 목록 새로고침
const handleCreate = async (form) => {
  await versionApi.create(productId, form.name, form.description, form.releaseDate, form.phases);
  loadVersions();
};

// After: 생성 후 Detail 페이지로 이동 (Phase 추가 유도)
const handleCreate = async (form) => {
  const created = await versionApi.create(productId, form.name, form.description, form.releaseDate);
  navigate(`/features/companies/${companyId}/products/${productId}/versions/${created.id}`);
};
```

**api/features.ts 변경:**
```typescript
// Before
create: (productId, name, description, releaseDate, phases) => POST ...
// After
create: (productId, name, description, releaseDate) => POST ...  // phases 제거
```

- [x] VersionFormModal에서 Phase 관련 코드 전체 제거 (addPhase, removePhase, toggleTestRunForPhase, Phase UI)
- [x] VersionFormModal 검증 로직 단순화 (Phase 검증 제거)
- [x] VersionListPage.handleCreate() — 생성 후 navigate to VersionDetailPage
- [x] api/features.ts versionApi.create() 시그니처 변경 (phases 제거)

---

### Step 5 — Frontend: Phase 생성 방식 변경 (VersionDetailPage 인라인)

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/VersionDetailPage.tsx` | PhaseFormModal 제거, 인라인 Phase 생성 섹션 추가 |
| `api/features.ts` | versionPhaseApi.addPhase 시그니처 변경, addTestCasesToPhase/removeTestCasesFromPhase 추가, getFailedTestCases 추가 |
| `types/features.ts` | PhaseFormData 확장, FailedTestCaseInfo 추가 |

**삭제 파일:**

| 파일 | 이유 |
|------|------|
| `components/features/PhaseFormModal.tsx` | 인라인 섹션으로 대체 |

**Phase 생성 인라인 UX:**
```
VersionDetailPage:

[Phase 목록]
  1️⃣ 1차 테스트 — 로그인(15), 결제(22) — 총 37 TC  [▶]
  2️⃣ Regression — 전체 회귀(100) — 총 100 TC        [▶]

[+ Phase 추가]  ← 클릭 시 아래 섹션 펼침
────────────────────────────────────────────────────────
┌── Phase 생성 ────────────────────────────────────────┐
│                                                      │
│  Phase 이름 *                                        │
│  [3차 테스트                                      ]  │
│                                                      │
│  ── TestRun 선택 ──────────────────────────────────  │
│  ☑ 로그인/회원가입       (15 TC)                     │
│  ☐ 결제 플로우           (22 TC)                     │
│  ☑ 마이페이지             (8 TC)                     │
│  선택: 2개, 23 TC                                    │
│                                                      │
│  ── TestCase 개별 추가 ────────────────────────────  │
│  ▼ ☑ Main (2/5)                                     │
│    ▼ ☑ Login (2/3)                                  │
│        ☑ TC-12: 로그인 성공 테스트                    │
│        ☑ TC-13: 비밀번호 오류 테스트                  │
│        ☐ TC-14: 소셜 로그인 테스트                    │
│  선택: 2 TC                                          │
│                                                      │
│  ── Failed TC 추가 ────────────────────────────────  │
│  ⚠ 이 Version에서 Fail된 TC: 3건                     │
│  ☑ TC-12: 로그인 성공 테스트 (1차 테스트에서 FAIL)    │
│  ☐ TC-45: 결제 오류 처리 (1차 테스트에서 FAIL)        │
│  ☑ TC-67: 마이페이지 로딩 (2차 테스트에서 FAIL)       │
│  선택: 2 TC                                          │
│                                                      │
│                              [취소] [Phase 생성]      │
└──────────────────────────────────────────────────────┘
```

**구현:**
- `isCreatingPhase` state — "+Phase 추가" 클릭 시 true → 인라인 폼 펼침
- TestRun multi-checkbox: 기존 PhaseFormModal 패턴 재사용
- TC 개별 선택: `TestCaseGroupSelector` 컴포넌트 재사용 (v11에서 생성)
- Failed TC: `versionApi.getFailedTestCases(versionId)` API 호출 → 체크박스 목록

**api/features.ts 확장:**
```typescript
// Phase 추가 시그니처 변경
versionPhaseApi.addPhase: (versionId, phaseName, testRunIds, testCaseIds) => POST ...

// Phase TC 관리 (신규)
versionPhaseApi.addTestCases: (versionId, phaseId, testCaseIds) => POST ...
versionPhaseApi.removeTestCases: (versionId, phaseId, testCaseIds) => DELETE ...

// Failed TC 조회 (신규)
versionApi.getFailedTestCases: (versionId) => GET .../failed-test-cases
```

- [x] PhaseFormModal.tsx 삭제
- [x] VersionDetailPage에 `isCreatingPhase` state + 인라인 Phase 생성 섹션 추가
- [x] 인라인 폼: Phase 이름 + TestRun multi-checkbox + TestCaseGroupSelector + Failed TC 목록
- [x] Phase 생성 시 `versionPhaseApi.addPhase(versionId, phaseName, testRunIds, testCaseIds)` 호출
- [x] "취소" 시 폼 접기 + 상태 초기화
- [x] types/features.ts에 FailedTestCaseInfo 인터페이스 추가
- [x] api/features.ts에 versionPhaseApi.addTestCases, removeTestCases, versionApi.getFailedTestCases 추가

---

### Step 6 — Frontend: Phase Detail Segment Grouping + TC 관리

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/VersionPhaseDetailPage.tsx` | Segment 그룹핑, TC 추가/제거 버튼 |

**Segment 그룹핑:**
```
Before (현재 — Flat 리스트):
┌──────────────────────────────────────────────────────┐
│  Phase: 1차 테스트                                    │
│  ──────────────────────────────────────────────────  │
│  T12  로그인 성공 테스트      [P][F][B][S][R] ▼     │
│  T13  비밀번호 오류 테스트    [P][F][B][S][R] ▼     │
│  T45  결제 시작              [P][F][B][S][R] ▼     │
│  T46  카드 등록              [P][F][B][S][R] ▼     │
└──────────────────────────────────────────────────────┘

After — Segment 그룹핑:
┌──────────────────────────────────────────────────────┐
│  Phase: 1차 테스트        [+ TC 추가] [+ Failed TC]  │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  ▼ Main > Login (2)                                  │
│  ├ T12  로그인 성공 테스트   [P][F][B][S][R] ▼      │
│  └ T13  비밀번호 오류 테스트 [P][F][B][S][R] ▼      │
│                                                      │
│  ▼ Main > Payment (2)                                │
│  ├ T45  결제 시작           [P][F][B][S][R] ▼      │
│  └ T46  카드 등록           [P][F][B][S][R] ▼      │
│                                                      │
│  ▼ 경로 없음 (1)                                     │
│  └ T99  직접 추가된 TC      [P][F][B][S][R] ▼ [×]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**데이터 로딩 확장:**
```tsx
// 기존 (L35-59)
const [v, r, tc] = await Promise.all([
  versionApi.getById(...),
  testResultApi.getByVersionPhaseId(...),
  testCaseApi.getByProductId(...),
]);

// 확장 — Segment 로드 추가
const [v, r, tc, seg] = await Promise.all([
  versionApi.getById(...),
  testResultApi.getByVersionPhaseId(...),
  testCaseApi.getByProductId(...),
  segmentApi.getByProductId(Number(productId)),  // ← 신규
]);
setSegments(seg);
```

**그룹핑 로직:**
```tsx
const groupedResults = useMemo(() => {
  // 1. result.testCaseId → testCase.path 매핑 (allTestCases에서 찾기)
  // 2. path별 그룹핑 (TestCasePage의 groupedTestCases 패턴 재사용)
  // 3. path를 Segment 이름으로 해석 (resolvePathNames)
  // 4. DFS 순서 정렬
}, [results, allTestCases, segments]);
```

**TC 추가/제거:**
- 헤더에 "+ TC 추가" 버튼 → TestCaseGroupSelector 모달 (또는 인라인)
- "+ Failed TC" 버튼 → Failed TC 목록 모달
- 직접 추가된 TC 행에 "×" 제거 버튼 (TestRun 경유 TC에는 없음)
- TC 추가 → `versionPhaseApi.addTestCases()` → 결과 목록 새로고침
- TC 제거 → 확인 다이얼로그 (테스트 실행 기록 삭제 경고) → `versionPhaseApi.removeTestCases()`

- [x] Segment 로드 추가 (`segmentApi.getByProductId`)
- [x] 결과를 Segment path 기준으로 그룹핑 (resolvePathNames 재사용)
- [x] Segment 그룹 헤더 렌더링 (접기/펼치기)
- [x] "+ TC 추가" 버튼 + TestCaseGroupSelector 연동
- [x] "+ Failed TC" 버튼 + Failed TC 목록 연동
- [x] 직접 추가된 TC에 제거(×) 버튼 (ConfirmDialog)
- [x] path 없는 TC를 "경로 없음" 그룹으로 분류

---

### Step 7 — Frontend: Ticket UI

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/VersionPhaseDetailPage.tsx` | Ticket 생성 다이얼로그 + 티켓 목록 표시 |
| `types/features.ts` | Ticket, CreateTicketRequest 인터페이스 추가 |
| `api/features.ts` | ticketApi 추가 |

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `components/features/TicketCreateDialog.tsx` | 티켓 생성 다이얼로그 |
| `components/features/TicketList.tsx` | 티켓 목록 (상태 배지 + URL 링크) |

**Ticket 생성 플로우:**
```
1. StatusButtonGroup에서 FAIL 클릭
   ↓
2. handleStatusChange() — status 업데이트 성공
   ↓
3. FAIL로 변경된 경우 → TicketCreateDialog 자동 오픈
   ↓
┌── Ticket 발행 ──────────────────────────────────────┐
│                                                      │
│  테스트 결과가 Fail로 변경되었습니다.                  │
│  Jira 티켓을 생성하시겠습니까?                        │
│                                                      │
│  제목 *                                              │
│  [FAIL: TC-12 로그인 성공 테스트                   ]  │  ← 자동 생성
│                                                      │
│  설명 (선택)                                         │
│  [Phase: 1차 테스트                                ]  │  ← 자동 생성
│  [Version: v2.0 Release QA                         ]  │
│                                                      │
│              [건너뛰기] [티켓 생성]                    │
└──────────────────────────────────────────────────────┘
   ↓ "티켓 생성" 클릭
4. ticketApi.create(versionId, resultId, { summary, description })
   ↓ Jira 연동 시 자동 발행
5. 티켓 목록에 새 티켓 추가
```

**Ticket 표시 (TestResult 펼침 영역):**
```
▼ T12  로그인 성공 테스트  [FAIL]  [P][✓F][B][S][R]
  ┌─────────────────────────────────────────────────┐
  │  Preconditions: ...                             │
  │  Steps: ...                                     │
  │  Expected Result: ...                           │
  │                                                 │
  │  ── Tickets ─────────────────────────────────── │
  │  🎫 PROJ-123  FAIL: 로그인 성공 테스트           │
  │     Status: [In Progress]  🔄                   │
  │     ↗ Jira에서 보기                             │
  │                                                 │
  │  🎫 PROJ-456  UI 렌더링 깨짐                     │
  │     Status: [Open]  🔄                          │
  │     ↗ Jira에서 보기                             │
  │                                                 │
  │  [+ 티켓 추가]                                   │
  │                                                 │
  │  ── Comments ────────────────────────────────── │
  │  ...                                            │
  └─────────────────────────────────────────────────┘
```

**TicketList 컴포넌트:**
```tsx
interface TicketListProps {
  versionId: number;
  resultId: number;
  tickets: Ticket[];
  onRefresh: () => void;
}
```
- 각 티켓: Jira 키 + 제목 + 상태 배지 + 🔄 새로고침 버튼 + 외부 링크
- 상태 배지 색상: OPEN=회색, IN_PROGRESS=파랑, DONE=초록 (문자열 매핑)
- "Jira에서 보기" → `ticket.jiraUrl` 새 탭 열기 (jiraUrl이 null이면 숨김)
- 🔄 클릭 → `ticketApi.refresh()` → 상태 업데이트

**FAIL 행에 티켓 개수 표시:**
```
T12  로그인 성공 테스트  [FAIL] 🎫2  [P][✓F][B][S][R] ▼
                                ↑ 티켓 2개 있음
```

- [x] types/features.ts에 Ticket, CreateTicketRequest 인터페이스 추가
- [x] api/features.ts에 ticketApi (create, list, delete, refresh) 추가
- [x] TicketCreateDialog 컴포넌트 생성 (제목/설명 입력, 건너뛰기/생성 버튼)
- [x] TicketList 컴포넌트 생성 (티켓 배지, URL 링크, 새로고침)
- [x] VersionPhaseDetailPage — FAIL 변경 시 TicketCreateDialog 자동 오픈
- [x] VersionPhaseDetailPage — 펼침 영역에 TicketList 배치 (CommentThread 위)
- [x] VersionPhaseDetailPage — FAIL 행에 티켓 개수 배지 표시
- [x] 티켓 상태 배지 색상 매핑 (OPEN/IN_PROGRESS/DONE 등)

---

## 변경 요약

### 신규 파일 (Backend)

| 파일 | 내용 |
|------|------|
| `db/migration/V{ts}__create_ticket_and_phase_test_case.sql` | ticket + version_phase_test_case 테이블, product.jira_project_key |
| `feature/TicketEntity.java` | @Entity ticket |
| `feature/TicketDto.java` | CreateTicketRequest, TicketResponse |
| `feature/TicketRepository.java` | findAllByTestResultId |
| `feature/TicketService.java` | 인터페이스 |
| `feature/TicketServiceImpl.java` | CRUD + Jira 위임 |
| `feature/TicketController.java` | 4개 엔드포인트 |
| `feature/JiraService.java` | Jira API 인터페이스 |
| `feature/JiraServiceImpl.java` | createIssue, getIssueStatus |
| `feature/JiraConfig.java` | @ConfigurationProperties |
| `feature/VersionPhaseTestCaseEntity.java` | @Entity junction |
| `feature/VersionPhaseTestCaseRepository.java` | JPA Repository |

### 신규 파일 (Frontend)

| 파일 | 내용 |
|------|------|
| `components/features/TicketCreateDialog.tsx` | 티켓 생성 다이얼로그 |
| `components/features/TicketList.tsx` | 티켓 목록 (배지 + 링크 + 새로고침) |

### 삭제 파일

| 파일 | 이유 |
|------|------|
| `components/features/PhaseFormModal.tsx` | VersionDetailPage 인라인으로 대체 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `application.yml` | jira.* 설정 추가 |
| `feature/VersionDto.java` | CreateVersionRequest 단순화, PhaseRequest에 testCaseIds 추가, FailedTestCaseInfo 추가 |
| `feature/VersionServiceImpl.java` | create() 단순화, copy()에 개별 TC junction 복사 |
| `feature/VersionPhaseServiceImpl.java` | addPhase() 확장, addTestCasesToPhase, removeTestCasesFromPhase 추가 |
| `feature/TestResultServiceImpl.java` | createInitialResults() 확장 (directTestCaseIds 파라미터) |
| `feature/VersionPhaseController.java` | TC 관리 + Failed TC 조회 엔드포인트 |
| `feature/TestResultRepository.java` | findAllByVersionIdAndStatus 추가 |
| `feature/ProductEntity.java` | jiraProjectKey 필드 추가 |
| `feature/ProductDto.java` | jiraProjectKey 포함 |
| `types/features.ts` | Ticket, FailedTestCaseInfo, CreateTicketRequest 추가 |
| `api/features.ts` | ticketApi, versionPhaseApi 확장, versionApi.create 단순화 |
| `components/features/VersionFormModal.tsx` | Phase 섹션 전체 제거 |
| `pages/features/VersionListPage.tsx` | 생성 후 navigate to detail |
| `pages/features/VersionDetailPage.tsx` | PhaseFormModal → 인라인 생성 섹션 (TestRun + TC + Failed TC) |
| `pages/features/VersionPhaseDetailPage.tsx` | Segment 그룹핑, TC 추가/제거, TicketList 배치 |
