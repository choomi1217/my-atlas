# Feature Registry v17 — QA 릴리즈 통계 & Release Readiness

> 변경 유형: 기능 추가  
> 작성일: 2026-04-17  
> 버전: v17  
> 상태: 진행 중

---

## QA에게 이 통계가 왜 필요한가

### 문제: "감"으로 판단하는 릴리즈

지금까지 릴리즈 가능 여부는 QA 담당자의 경험과 감에 의존했다.
"버그가 대충 다 잡힌 것 같은데…", "Critical은 없는 것 같은데…" — 이런 판단으로는 릴리즈 후 장애를 막을 수 없다.

### 해결: 데이터 기반 Go/No-Go 판단

이 통계 기능은 QA가 **숫자로 릴리즈를 판단**할 수 있게 한다.

**Release Readiness (Go/No-Go)**
- Critical 미해결 버그가 0건인가?
- Major 미해결 버그가 2건 이하인가?
- Regression Phase Pass Rate가 98% 이상인가?
- 3일 넘게 방치된 Aging 버그가 있는가?

이 4가지 기준을 시스템이 자동으로 평가하고, GO 또는 NO-GO를 표시한다. QA는 더 이상 "느낌"이 아니라 **근거**를 가지고 릴리즈를 승인하거나 거부할 수 있다.

### QA 실무에서의 활용

| 시나리오 | 기존 | v17 이후 |
|---------|------|---------|
| "릴리즈 해도 될까?" | PM/개발에게 물어봄 | Version Detail에서 GO/NO-GO 확인 |
| "버그가 잘 잡히고 있나?" | Jira에서 수동 집계 | Daily Trend 차트로 신규/종료 버그 추이 확인 |
| "어제보다 나아졌나?" | 기억에 의존 | 일별 스냅샷으로 Pass Rate 변화 추이 비교 |
| "방치된 버그는?" | Jira 필터 수동 생성 | Aging Bug 리스트 자동 노출 (3일+) |
| "테스트 진행 중 막힌 건?" | 스프레드시트 관리 | Blocked TC 리스트 자동 노출 |
| "Phase별 품질 차이는?" | Phase 끝나고 수동 정리 | Phase 필터로 실시간 비교 |
| "지난주 목요일 상태는?" | 복구 불가 | 해당 날짜 Daily Report 조회 |

### 핵심 가치

1. **객관성** — 감이 아닌 숫자로 릴리즈 판단
2. **추적성** — 일별 스냅샷으로 과거 상태를 언제든 되돌아볼 수 있음
3. **가시성** — PM, 개발팀에게 "지금 이 상태입니다"라고 대시보드 URL 하나로 공유
4. **조기 경보** — Aging 버그, Blocked TC가 쌓이기 전에 발견

---

# 요구사항

### Version Phase별 통계 기능 추가
릴리즈 품질을 데이터 기반으로 판단하기 위해 Phase별, Version별 통계 기능을 추가해야 합니다.

- 유저 시나리오
1. Version Detail 페이지 진입
2. 상단에 Release Readiness 요약 카드 노출 (Go/No-Go 판단 + 핵심 KPI 4개)
3. Phase별 Daily Report 섹션에서 일자별 진행률, 신규 버그, 종료 버그 추이 확인
4. 하단에 Aging 버그 리스트, Blocked TC 리스트 노출
5. 특정 날짜를 선택하면 해당 시점의 스냅샷 데이터 조회 가능

- 참고
1. 통계는 실시간 집계가 아닌 일일 스냅샷 기반으로 동작해야 합니다 (과거 추세 추적 필수).
2. 통계 모듈은 별도 패키지로 격리하여 기존 코드 수정을 최소화 해야 합니다.
3. 기존 데이터 backfill이 반드시 필요합니다 (default 값 설정 필수).


### 통계 산출을 위한 기존 엔티티 필드 추가
통계를 계산하기 위해 BugTicket과 TestRun(Phase)에 필수 필드를 추가해야 합니다.

- 추가 필드
1. BugTicket
    - severity: Critical / Major / Minor / Trivial (Severity 분포 및 가중치 분석용)
    - closedAt: 티켓 종료 시각 (Fix Time, 일일 종료 버그 집계용)
    - reopenCount: 재오픈 횟수 (Reopen Rate 산출용 / 수정 품질 지표)
2. Phase (또는 TestRun)
    - phase type: First / Second / Regression (Phase별 결함 발견율 비교용)
    - startDate, endDate: 기간 기반 통계용

- 참고
1. 기존 BugTicket 데이터는 severity default를 Major로 backfill 합니다.
2. 기존 Phase 데이터는 phase type default를 First로 backfill 합니다.
3. 기존 API 응답 스키마는 변경하지 않습니다. 신규 필드는 통계 API에서만 노출 됩니다.


### Daily Snapshot 테이블 신설 및 배치 추가
시계열 통계 추적을 위해 매일 자정에 통계 스냅샷을 저장하는 기능이 필요합니다.

- DailyTestSnapshot 테이블 컬럼
1. phaseId, versionId, snapshotDate
2. 누적 Pass / Fail / Blocked 수
3. 당일 신규 버그 수 (Severity별)
4. 당일 종료 버그 수
5. Open 누적 버그 수
6. Aging 버그 수 (생성 후 3일 이상 미해결)
7. Pass Rate, 진행률(%)

- 유저 시나리오
1. 매일 자정 자동으로 진행 중인 모든 Phase의 통계가 스냅샷으로 저장됩니다.
2. 관리자가 특정 날짜를 지정해 수동으로 스냅샷을 재생성할 수 있어야 합니다.
3. 같은 날짜에 중복 실행되어도 데이터가 중복 저장되지 않아야 합니다 (멱등성).

- 참고
1. 실시간 집계만 있을 경우 과거 추세 비교가 불가능 하므로 스냅샷 저장은 필수 입니다.
2. 운영 환경에서 서버 다중화 시 중복 실행 방지 처리가 필요합니다.


### 통계 API Endpoint 추가
프론트 대시보드에서 사용할 통계 API를 신설해야 합니다.

- 필요한 Endpoint
1. GET /api/phases/{id}/reports/daily?date=YYYY-MM-DD
    - 특정 Phase의 특정 날짜 Daily Report
2. GET /api/phases/{id}/reports/trend?from=&to=
    - 특정 Phase의 기간 내 시계열 데이터
3. GET /api/versions/{id}/release-readiness
    - Version 단위 종합 + Go/No-Go 판단 결과
4. GET /api/versions/{id}/dashboard
    - Version Detail 대시보드용 통합 데이터
5. POST /api/admin/snapshots/run?date=YYYY-MM-DD
    - 스냅샷 수동 재생성용 관리자 endpoint

- 참고
1. 모든 API는 read-only 이며 기존 도메인 Service를 수정하지 않고 별도 통계 Service에서 처리 합니다.
2. TC 1만건 / Bug 1천건 기준 응답 1초 이내가 목표입니다.


### Release Readiness 판단 기준 정의 및 적용
Go/No-Go 판단을 시스템에서 자동으로 노출해주기 위한 기준 정의가 필요합니다.

- 기본 판단 기준 (Phase별 / Version 전체)
1. Critical 미해결 버그: 0건
2. Major 미해결 버그: 2건 이하
3. Regression Phase Pass Rate: 98% 이상
4. Aging 버그(3일+): 별도 표시

- 유저 시나리오
1. Version Detail 진입 시 위 조건 자동 평가
2. 모든 조건 충족 시 "Go" / 미충족 시 "No-Go" 표시
3. No-Go인 경우 미충족 사유를 함께 표기

- 참고
1. 판단 기준은 추후 프로젝트별로 커스텀 가능해야 하므로 설정값으로 관리할 수 있는 구조가 좋습니다.
2. Aging 임계값(기본 3일)도 설정값으로 관리되어야 합니다.


### Version Detail 대시보드 UI 추가
Phase별/Version별 통계를 시각화하는 대시보드 화면이 필요합니다.

- 화면 구성
1. 상단: Release Readiness 요약 카드
    - Go/No-Go 표시 + 핵심 KPI 4개 (Pass Rate, Open Bug, Critical 잔존, 진행률)
2. 중단: Trend 차트
    - 일자별 신규/종료 버그 추이
    - 일자별 Pass Rate 추이
    - Phase 단위로 필터 가능
3. 하단:
    - Aging 버그 리스트 (3일+ 미해결)
    - Blocked TC 리스트

- 유저 시나리오
1. Version Detail 진입 시 대시보드 자동 로드
2. Phase 탭 전환 시 해당 Phase 통계로 갱신
3. 차트의 특정 일자 클릭 시 해당 시점 Daily Report 모달 노출

---

## 현재 코드 분석 (Context)

### TicketEntity.java — 통계 필드 부재

- 파일: `backend/src/main/java/com/myqaweb/feature/TicketEntity.java`

**현재 필드:**
```java
@Entity @Table(name = "ticket")
public class TicketEntity {
    Long id;
    TestResultEntity testResult;  // FK (test_result_id)
    String jiraKey;               // VARCHAR(50), NOT NULL
    String jiraUrl;               // VARCHAR(500), NOT NULL
    String summary;               // VARCHAR(500), NOT NULL
    String status;                // VARCHAR(50), NOT NULL ("OPEN", "IN_PROGRESS", ...)
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**부재 필드:**
- `severity` — Severity 분포 분석, 가중치 기반 릴리즈 판단 불가
- `closedAt` — Fix Time 산출, 일일 종료 버그 집계 불가
- `reopenCount` — Reopen Rate 산출 불가 (수정 품질 지표 미확보)

### VersionPhaseEntity.java — Phase 유형/기간 필드 부재

- 파일: `backend/src/main/java/com/myqaweb/feature/VersionPhaseEntity.java`

**현재 필드:**
```java
@Entity @Table(name = "version_phase")
public class VersionPhaseEntity {
    Long id;
    VersionEntity version;  // FK (version_id)
    String phaseName;       // VARCHAR(100), NOT NULL
    Integer orderIndex;     // NOT NULL
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**부재 필드:**
- `phaseType` — First / Second / Regression 구분 불가 → Phase별 결함 발견율 비교 불가
- `startDate`, `endDate` — 기간 기반 통계(일별 추이, 진행 기간) 산출 불가

### ProgressStats — 실시간 집계만 존재, 시계열 없음

- 파일: `backend/src/main/java/com/myqaweb/feature/VersionDto.java` (L60-69)

```java
public record ProgressStats(
    Integer total, Integer completed, Integer pass, Integer fail,
    Integer blocked, Integer skipped, Integer retest, Integer untested
) {}
```

- `TestResultServiceImpl`에서 매 요청마다 in-memory 집계
- **시계열 저장 구조 없음** → 과거 추세 추적 불가
- 일일 버그 신규/종료 추이, Pass Rate 변화 추이 시각화 불가

### application.yml — 스케줄링 미설정

- `@EnableScheduling` 미적용, `spring.task.scheduling.*` 설정 없음
- 자정 스냅샷 배치를 위해 스케줄링 인프라 활성화 필요

### 기존 데이터 Backfill 현황

| 대상 | 현재값 | Backfill 기본값 | 근거 |
|------|--------|----------------|------|
| ticket.severity | 컬럼 없음 | `'MAJOR'` | 요구사항 명시 |
| ticket.closed_at | 컬럼 없음 | `NULL` | 미종료 상태 유지 |
| ticket.reopen_count | 컬럼 없음 | `0` | 재오픈 이력 없음 |
| version_phase.phase_type | 컬럼 없음 | `'FIRST'` | 요구사항 명시 |
| version_phase.start_date | 컬럼 없음 | `created_at::date` | 생성일 기준 |
| version_phase.end_date | 컬럼 없음 | `NULL` | 진행 중 간주 |

### 공통 비교 — 현재 vs 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 버그 Severity 분류 | 없음 | Critical/Major/Minor/Trivial 4단계 |
| 시계열 통계 | 없음 (실시간 집계만) | daily_test_snapshot 테이블 + 자정 배치 |
| Release Readiness | 없음 | Go/No-Go 자동 판단 (4개 기준) |
| Phase 유형 구분 | 없음 (이름 문자열만) | Enum: FIRST, SECOND, REGRESSION |
| 대시보드 UI | 없음 | KPI 카드 + Trend 차트 + Aging/Blocked 리스트 |

---

## 구현 계획

### 변경 범위

| 구분 | 내용 |
|------|------|
| DB Migration | 마이그레이션 1개 (기존 테이블 ALTER + daily_test_snapshot 신설) |
| Backend 기존 코드 | TicketEntity, VersionPhaseEntity 필드 추가, Enum 2개, ServiceImpl 최소 변경 |
| Backend 신규 | `statistics` 패키지 격리 (엔티티, DTO, 서비스, 스케줄러, 컨트롤러) |
| Frontend 신규 | 통계 컴포넌트 5개 + recharts 의존성 추가 |
| Frontend 수정 | VersionDetailPage에 대시보드 섹션 추가, types/api 확장 |

---

### Step 1 — DB Migration: 기존 테이블 필드 추가 + daily_test_snapshot 신설

**신규 파일:** `backend/src/main/resources/db/migration/V{타임스탬프}__add_statistics_fields_and_snapshot.sql`

```sql
-- 1. ticket 테이블에 통계 필드 추가
ALTER TABLE ticket ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'MAJOR';
ALTER TABLE ticket ADD COLUMN closed_at TIMESTAMP;
ALTER TABLE ticket ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0;

-- Backfill: 기존 ticket 데이터는 DEFAULT 절로 자동 적용됨

-- 2. version_phase 테이블에 유형/기간 필드 추가
ALTER TABLE version_phase ADD COLUMN phase_type VARCHAR(20) NOT NULL DEFAULT 'FIRST';
ALTER TABLE version_phase ADD COLUMN start_date DATE;
ALTER TABLE version_phase ADD COLUMN end_date DATE;

-- Backfill: start_date를 created_at 기준으로 설정
UPDATE version_phase SET start_date = created_at::date WHERE start_date IS NULL;

-- 3. daily_test_snapshot 테이블 생성
CREATE TABLE daily_test_snapshot (
    id                BIGSERIAL PRIMARY KEY,
    version_id        BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    phase_id          BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    snapshot_date     DATE NOT NULL,

    -- TC 실행 통계
    total_tc          INTEGER NOT NULL DEFAULT 0,
    pass_count        INTEGER NOT NULL DEFAULT 0,
    fail_count        INTEGER NOT NULL DEFAULT 0,
    blocked_count     INTEGER NOT NULL DEFAULT 0,
    skipped_count     INTEGER NOT NULL DEFAULT 0,
    retest_count      INTEGER NOT NULL DEFAULT 0,
    untested_count    INTEGER NOT NULL DEFAULT 0,

    -- 버그 통계 (당일 기준)
    new_bug_critical  INTEGER NOT NULL DEFAULT 0,
    new_bug_major     INTEGER NOT NULL DEFAULT 0,
    new_bug_minor     INTEGER NOT NULL DEFAULT 0,
    new_bug_trivial   INTEGER NOT NULL DEFAULT 0,
    closed_bug_count  INTEGER NOT NULL DEFAULT 0,
    open_bug_count    INTEGER NOT NULL DEFAULT 0,
    aging_bug_count   INTEGER NOT NULL DEFAULT 0,

    -- 산출 지표
    pass_rate         DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    progress_rate     DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (phase_id, snapshot_date)
);

CREATE INDEX idx_snapshot_version ON daily_test_snapshot(version_id);
CREATE INDEX idx_snapshot_phase_date ON daily_test_snapshot(phase_id, snapshot_date);
CREATE INDEX idx_snapshot_date ON daily_test_snapshot(snapshot_date);
```

**설계 근거:**
- `UNIQUE (phase_id, snapshot_date)` — 같은 Phase + 같은 날짜에 중복 스냅샷 방지 (멱등성 보장)
- `version_id` 별도 인덱스 — Version 단위 대시보드 조회 최적화
- `pass_rate`, `progress_rate`를 미리 계산하여 저장 — 조회 시 재계산 불필요
- `ON DELETE CASCADE` — Version/Phase 삭제 시 스냅샷 자동 정리
- severity는 `VARCHAR(20)` — Java Enum 매핑 (`@Enumerated(EnumType.STRING)`)

- [x] 타임스탬프 기반 마이그레이션 파일 생성
- [x] ticket에 severity, closed_at, reopen_count 추가 (DEFAULT로 backfill)
- [x] version_phase에 phase_type, start_date, end_date 추가 + start_date backfill
- [x] daily_test_snapshot 테이블 + 인덱스 생성

---

### Step 2 — Backend: Enum 추가 + 기존 엔티티/DTO 필드 확장

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `feature/Severity.java` | Enum: CRITICAL, MAJOR, MINOR, TRIVIAL |
| `feature/PhaseType.java` | Enum: FIRST, SECOND, REGRESSION |

```java
// Severity.java
public enum Severity {
    CRITICAL, MAJOR, MINOR, TRIVIAL
}

// PhaseType.java
public enum PhaseType {
    FIRST, SECOND, REGRESSION
}
```

**TicketEntity 변경 (3 필드 추가):**
```java
// 기존 필드 유지 + 아래 추가
@Enumerated(EnumType.STRING)
@Column(nullable = false, length = 20)
private Severity severity = Severity.MAJOR;

@Column(name = "closed_at")
private LocalDateTime closedAt;

@Column(name = "reopen_count", nullable = false)
private Integer reopenCount = 0;
```

**VersionPhaseEntity 변경 (3 필드 추가):**
```java
// 기존 필드 유지 + 아래 추가
@Enumerated(EnumType.STRING)
@Column(name = "phase_type", nullable = false, length = 20)
private PhaseType phaseType = PhaseType.FIRST;

@Column(name = "start_date")
private LocalDate startDate;

@Column(name = "end_date")
private LocalDate endDate;
```

**DTO 변경 — 요청만 확장, 기존 응답 스키마 유지:**

```java
// TicketDto.CreateTicketRequest — severity 추가 (선택, 기본 MAJOR)
public record CreateTicketRequest(
    @NotBlank String summary,
    String description,
    Severity severity       // nullable → service에서 default MAJOR
) {}

// VersionDto.PhaseRequest — phaseType, startDate, endDate 추가 (선택)
public record PhaseRequest(
    @NotBlank String phaseName,
    List<Long> testRunIds,
    List<Long> testCaseIds,
    PhaseType phaseType,    // nullable → default FIRST
    LocalDate startDate,    // nullable → default LocalDate.now()
    LocalDate endDate       // nullable → 진행 중
) {}
```

**기존 응답 스키마 변경 없음:**
- `TicketResponse` — severity, closedAt, reopenCount **미노출** (기존 API 호환)
- `VersionPhaseDto` — phaseType, startDate, endDate **미노출**
- 신규 필드는 Step 4의 통계 전용 DTO에서만 노출

**TicketServiceImpl 변경:**
```java
// createTicket() — severity 설정
ticket.setSeverity(request.severity() != null ? request.severity() : Severity.MAJOR);

// refreshFromJira() — closedAt, reopenCount 갱신 로직 추가
String newStatus = jiraService.getIssueStatus(ticket.getJiraKey());
String oldStatus = ticket.getStatus();

// 종료 감지: 미종료 → 종료
if (isDoneStatus(newStatus) && ticket.getClosedAt() == null) {
    ticket.setClosedAt(LocalDateTime.now());
}
// 재오픈 감지: 종료 → 미종료
if (isDoneStatus(oldStatus) && !isDoneStatus(newStatus)) {
    ticket.setReopenCount(ticket.getReopenCount() + 1);
    ticket.setClosedAt(null);
}
ticket.setStatus(newStatus);
```

**VersionPhaseServiceImpl 변경:**
```java
// addPhase() — phaseType, startDate, endDate 설정
phase.setPhaseType(request.phaseType() != null ? request.phaseType() : PhaseType.FIRST);
phase.setStartDate(request.startDate() != null ? request.startDate() : LocalDate.now());
phase.setEndDate(request.endDate());
```

- [x] Severity enum 생성
- [x] PhaseType enum 생성
- [x] TicketEntity에 severity, closedAt, reopenCount 필드 추가
- [x] VersionPhaseEntity에 phaseType, startDate, endDate 필드 추가
- [x] TicketDto.CreateTicketRequest에 severity 추가 (optional, default MAJOR)
- [x] VersionDto.PhaseRequest에 phaseType, startDate, endDate 추가 (optional)
- [x] TicketServiceImpl — severity 설정 + closedAt/reopenCount 갱신 로직
- [x] VersionPhaseServiceImpl — phaseType/startDate/endDate 설정 로직
- [x] isDoneStatus() 헬퍼 메서드 (Jira 종료 상태 판별)

---

### Step 3 — Backend: statistics 패키지 — 스냅샷 엔티티 + 서비스 + 스케줄러

**신규 패키지:** `backend/src/main/java/com/myqaweb/statistics/`

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `statistics/DailyTestSnapshotEntity.java` | @Entity daily_test_snapshot |
| `statistics/DailyTestSnapshotRepository.java` | JPA Repository + 커스텀 쿼리 |
| `statistics/SnapshotService.java` | 스냅샷 생성 인터페이스 |
| `statistics/SnapshotServiceImpl.java` | 스냅샷 계산 + UPSERT 저장 |
| `statistics/SnapshotScheduler.java` | @Scheduled 자정 배치 |

**DailyTestSnapshotEntity:**
```java
@Entity @Table(name = "daily_test_snapshot")
@Getter @Setter
public class DailyTestSnapshotEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", nullable = false)
    private VersionEntity version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id", nullable = false)
    private VersionPhaseEntity phase;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    // TC 실행 통계
    private Integer totalTc;
    private Integer passCount;
    private Integer failCount;
    private Integer blockedCount;
    private Integer skippedCount;
    private Integer retestCount;
    private Integer untestedCount;

    // 버그 통계
    private Integer newBugCritical;
    private Integer newBugMajor;
    private Integer newBugMinor;
    private Integer newBugTrivial;
    private Integer closedBugCount;
    private Integer openBugCount;
    private Integer agingBugCount;

    // 산출 지표
    private BigDecimal passRate;
    private BigDecimal progressRate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
```

**DailyTestSnapshotRepository:**
```java
public interface DailyTestSnapshotRepository extends JpaRepository<DailyTestSnapshotEntity, Long> {

    Optional<DailyTestSnapshotEntity> findByPhaseIdAndSnapshotDate(Long phaseId, LocalDate date);

    List<DailyTestSnapshotEntity> findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
        Long phaseId, LocalDate from, LocalDate to);

    List<DailyTestSnapshotEntity> findAllByVersionIdAndSnapshotDate(
        Long versionId, LocalDate date);

    @Modifying
    @Query(value = """
        INSERT INTO daily_test_snapshot (
            version_id, phase_id, snapshot_date,
            total_tc, pass_count, fail_count, blocked_count,
            skipped_count, retest_count, untested_count,
            new_bug_critical, new_bug_major, new_bug_minor, new_bug_trivial,
            closed_bug_count, open_bug_count, aging_bug_count,
            pass_rate, progress_rate, created_at
        ) VALUES (
            :versionId, :phaseId, :date,
            :totalTc, :pass, :fail, :blocked,
            :skipped, :retest, :untested,
            :newCritical, :newMajor, :newMinor, :newTrivial,
            :closed, :open, :aging,
            :passRate, :progressRate, NOW()
        )
        ON CONFLICT (phase_id, snapshot_date)
        DO UPDATE SET
            total_tc = EXCLUDED.total_tc,
            pass_count = EXCLUDED.pass_count,
            fail_count = EXCLUDED.fail_count,
            blocked_count = EXCLUDED.blocked_count,
            skipped_count = EXCLUDED.skipped_count,
            retest_count = EXCLUDED.retest_count,
            untested_count = EXCLUDED.untested_count,
            new_bug_critical = EXCLUDED.new_bug_critical,
            new_bug_major = EXCLUDED.new_bug_major,
            new_bug_minor = EXCLUDED.new_bug_minor,
            new_bug_trivial = EXCLUDED.new_bug_trivial,
            closed_bug_count = EXCLUDED.closed_bug_count,
            open_bug_count = EXCLUDED.open_bug_count,
            aging_bug_count = EXCLUDED.aging_bug_count,
            pass_rate = EXCLUDED.pass_rate,
            progress_rate = EXCLUDED.progress_rate
        """, nativeQuery = true)
    void upsertSnapshot(
        @Param("versionId") Long versionId, @Param("phaseId") Long phaseId,
        @Param("date") LocalDate date,
        @Param("totalTc") int totalTc, @Param("pass") int pass,
        @Param("fail") int fail, @Param("blocked") int blocked,
        @Param("skipped") int skipped, @Param("retest") int retest,
        @Param("untested") int untested,
        @Param("newCritical") int newCritical, @Param("newMajor") int newMajor,
        @Param("newMinor") int newMinor, @Param("newTrivial") int newTrivial,
        @Param("closed") int closed, @Param("open") int open, @Param("aging") int aging,
        @Param("passRate") BigDecimal passRate, @Param("progressRate") BigDecimal progressRate);
}
```

**SnapshotServiceImpl — 핵심 로직:**
```java
@Service
@RequiredArgsConstructor
public class SnapshotServiceImpl implements SnapshotService {

    private final TestResultRepository testResultRepository;
    private final TicketRepository ticketRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final DailyTestSnapshotRepository snapshotRepository;
    private final ReadinessConfig config;

    @Override
    @Transactional
    public void createSnapshot(Long phaseId, LocalDate date) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
            .orElseThrow(() -> new IllegalArgumentException("Phase not found: " + phaseId));
        Long versionId = phase.getVersion().getId();

        // 1. TC 실행 통계 집계
        List<TestResultEntity> results = testResultRepository.findAllByVersionPhaseId(phaseId);
        int total = results.size();
        int pass = countByStatus(results, RunResultStatus.PASS);
        int fail = countByStatus(results, RunResultStatus.FAIL);
        int blocked = countByStatus(results, RunResultStatus.BLOCKED);
        int skipped = countByStatus(results, RunResultStatus.SKIPPED);
        int retest = countByStatus(results, RunResultStatus.RETEST);
        int untested = countByStatus(results, RunResultStatus.UNTESTED);

        // 2. 버그 통계 집계 (Phase의 TestResult에 연결된 Ticket 기준)
        List<Long> resultIds = results.stream().map(TestResultEntity::getId).toList();
        List<TicketEntity> allTickets = ticketRepository.findAllByTestResultIdIn(resultIds);

        int newCritical = countNewBySeverityOnDate(allTickets, Severity.CRITICAL, date);
        int newMajor = countNewBySeverityOnDate(allTickets, Severity.MAJOR, date);
        int newMinor = countNewBySeverityOnDate(allTickets, Severity.MINOR, date);
        int newTrivial = countNewBySeverityOnDate(allTickets, Severity.TRIVIAL, date);
        int closed = countClosedOnDate(allTickets, date);
        int open = (int) allTickets.stream().filter(t -> t.getClosedAt() == null).count();
        int aging = (int) allTickets.stream()
            .filter(t -> t.getClosedAt() == null)
            .filter(t -> t.getCreatedAt().toLocalDate()
                .plusDays(config.getAgingThresholdDays()).isBefore(date.plusDays(1)))
            .count();

        // 3. 비율 계산
        int executed = total - untested;
        BigDecimal passRate = executed > 0
            ? BigDecimal.valueOf(pass * 100.0 / executed)
                .setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        BigDecimal progressRate = total > 0
            ? BigDecimal.valueOf(executed * 100.0 / total)
                .setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        // 4. UPSERT (멱등성 — 같은 날짜 재실행 시 덮어쓰기)
        snapshotRepository.upsertSnapshot(
            versionId, phaseId, date,
            total, pass, fail, blocked, skipped, retest, untested,
            newCritical, newMajor, newMinor, newTrivial,
            closed, open, aging, passRate, progressRate);
    }

    @Override
    @Transactional
    public void createSnapshotsForDate(LocalDate date) {
        // 진행 중인 Phase: endDate == null 또는 endDate >= date
        List<VersionPhaseEntity> activePhases = versionPhaseRepository.findAll().stream()
            .filter(p -> p.getEndDate() == null || !p.getEndDate().isBefore(date))
            .toList();

        for (VersionPhaseEntity phase : activePhases) {
            createSnapshot(phase.getId(), date);
        }
    }
}
```

**SnapshotScheduler:**
```java
@Component
@RequiredArgsConstructor
@Slf4j
public class SnapshotScheduler {

    private final SnapshotService snapshotService;

    @Scheduled(cron = "0 0 0 * * *")  // 매일 자정
    public void dailySnapshot() {
        log.info("Daily snapshot started for date: {}", LocalDate.now());
        snapshotService.createSnapshotsForDate(LocalDate.now());
        log.info("Daily snapshot completed");
    }
}
```

**MyQaWebApplication.java 변경:**
```java
@SpringBootApplication
@EnableScheduling       // ← 추가
public class MyQaWebApplication { ... }
```

**TicketRepository 확장 (기존 파일):**
```java
// 신규 쿼리 추가
List<TicketEntity> findAllByTestResultIdIn(List<Long> testResultIds);
```

**중복 실행 방지:**
- `UNIQUE (phase_id, snapshot_date)` + `ON CONFLICT DO UPDATE` → DB 수준 멱등성 보장
- 단일 서버(현재 EC2 t3.small) 환경에서는 @Scheduled만으로 충분
- 다중 서버 확장 시: `ShedLock` 라이브러리 추가 권장 (PostgreSQL 기반 분산 잠금)

- [x] DailyTestSnapshotEntity 생성
- [x] DailyTestSnapshotRepository 생성 (findBy + upsert 네이티브 쿼리)
- [x] SnapshotService 인터페이스 생성
- [x] SnapshotServiceImpl 구현 (TC 통계 + 버그 통계 + 비율 계산 + UPSERT)
- [x] SnapshotScheduler 생성 (@Scheduled cron 매일 자정)
- [x] MyQaWebApplication에 @EnableScheduling 추가
- [x] TicketRepository에 findAllByTestResultIdIn() 쿼리 추가
- [x] 진행 중 Phase 판별 로직 (endDate == null || endDate >= today)

---

### Step 4 — Backend: 통계 서비스 + Release Readiness + 컨트롤러

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `statistics/StatisticsDto.java` | DailyReport, TrendData, ReleaseReadiness, Dashboard 등 |
| `statistics/StatisticsService.java` | 통계 조회 인터페이스 |
| `statistics/StatisticsServiceImpl.java` | 통계 계산 + Release Readiness 판단 |
| `statistics/StatisticsController.java` | 5개 API 엔드포인트 |
| `statistics/ReadinessConfig.java` | @ConfigurationProperties (판단 기준 설정값) |

**ReadinessConfig:**
```java
@ConfigurationProperties(prefix = "statistics.readiness")
@Getter @Setter
public class ReadinessConfig {
    private int maxCriticalOpen = 0;              // Critical 미해결 최대 허용: 0건
    private int maxMajorOpen = 2;                 // Major 미해결 최대 허용: 2건
    private double minRegressionPassRate = 98.0;  // Regression Pass Rate 최소: 98%
    private int agingThresholdDays = 3;           // Aging 판단 기준: 3일
}
```

**application.yml 추가:**
```yaml
statistics:
  readiness:
    max-critical-open: 0
    max-major-open: 2
    min-regression-pass-rate: 98.0
    aging-threshold-days: 3
```

**StatisticsDto (7개 record):**
```java
public class StatisticsDto {

    // 1. Phase 특정 날짜 Daily Report
    public record DailyReport(
        Long phaseId, String phaseName, LocalDate snapshotDate,
        Integer totalTc, Integer passCount, Integer failCount,
        Integer blockedCount, Integer skippedCount, Integer retestCount, Integer untestedCount,
        Integer newBugCritical, Integer newBugMajor, Integer newBugMinor, Integer newBugTrivial,
        Integer closedBugCount, Integer openBugCount, Integer agingBugCount,
        BigDecimal passRate, BigDecimal progressRate
    ) {}

    // 2. Phase 기간 시계열 데이터
    public record TrendData(
        Long phaseId, String phaseName,
        LocalDate from, LocalDate to,
        List<DailyReport> dailyReports
    ) {}

    // 3. Release Readiness 판단 결과
    public record ReleaseReadiness(
        boolean ready,
        String verdict,                         // "GO" 또는 "NO_GO"
        List<ReadinessCriterion> criteria,
        VersionProgressSummary progress
    ) {}

    public record ReadinessCriterion(
        String name,          // e.g., "Critical 미해결 버그"
        String threshold,     // e.g., "0건 이하"
        String actual,        // e.g., "2건"
        boolean passed
    ) {}

    public record VersionProgressSummary(
        Integer totalTc, Integer completed,
        Integer pass, Integer fail, Integer blocked,
        BigDecimal overallPassRate, BigDecimal overallProgressRate
    ) {}

    // 4. Version 대시보드 통합 데이터
    public record Dashboard(
        ReleaseReadiness releaseReadiness,
        List<TrendData> phaseTrends,
        List<AgingBugInfo> agingBugs,
        List<BlockedTcInfo> blockedTcs
    ) {}

    public record AgingBugInfo(
        Long ticketId, String jiraKey, String jiraUrl,
        String summary, Severity severity,
        String phaseName, String testCaseTitle,
        LocalDateTime createdAt, long agingDays
    ) {}

    public record BlockedTcInfo(
        Long testResultId, Long testCaseId,
        String testCaseTitle, List<Long> testCasePath,
        String phaseName
    ) {}
}
```

**StatisticsServiceImpl — 핵심 메서드:**
```java
@Service
@RequiredArgsConstructor
public class StatisticsServiceImpl implements StatisticsService {

    private final DailyTestSnapshotRepository snapshotRepository;
    private final TestResultRepository testResultRepository;
    private final TicketRepository ticketRepository;
    private final VersionRepository versionRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final ReadinessConfig config;

    // 1. Phase Daily Report
    @Override
    public DailyReport getDailyReport(Long phaseId, LocalDate date) {
        return snapshotRepository.findByPhaseIdAndSnapshotDate(phaseId, date)
            .map(this::toReport)
            .orElseGet(() -> computeRealtimeReport(phaseId, date));
        // 스냅샷 없으면 실시간 계산 fallback (오늘 날짜 등)
    }

    // 2. Phase Trend
    @Override
    public TrendData getTrend(Long phaseId, LocalDate from, LocalDate to) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)...;
        List<DailyTestSnapshotEntity> snapshots =
            snapshotRepository.findAllByPhaseIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(
                phaseId, from, to);
        return new TrendData(
            phaseId, phase.getPhaseName(), from, to,
            snapshots.stream().map(this::toReport).toList());
    }

    // 3. Release Readiness
    @Override
    public ReleaseReadiness getReleaseReadiness(Long versionId) {
        List<ReadinessCriterion> criteria = new ArrayList<>();

        // 기준 1: Critical 미해결 버그 0건
        int criticalOpen = countOpenTicketsBySeverity(versionId, Severity.CRITICAL);
        criteria.add(new ReadinessCriterion(
            "Critical 미해결 버그",
            config.getMaxCriticalOpen() + "건 이하",
            criticalOpen + "건",
            criticalOpen <= config.getMaxCriticalOpen()));

        // 기준 2: Major 미해결 버그 2건 이하
        int majorOpen = countOpenTicketsBySeverity(versionId, Severity.MAJOR);
        criteria.add(new ReadinessCriterion(
            "Major 미해결 버그",
            config.getMaxMajorOpen() + "건 이하",
            majorOpen + "건",
            majorOpen <= config.getMaxMajorOpen()));

        // 기준 3: Regression Phase Pass Rate 98% 이상
        BigDecimal regressionPassRate = getRegressionPassRate(versionId);
        criteria.add(new ReadinessCriterion(
            "Regression Pass Rate",
            config.getMinRegressionPassRate() + "% 이상",
            regressionPassRate + "%",
            regressionPassRate.doubleValue() >= config.getMinRegressionPassRate()));

        // 기준 4: Aging 버그 (참고 지표 — Go/No-Go에 영향 없음, 별도 표시)
        int agingCount = countAgingBugs(versionId);
        criteria.add(new ReadinessCriterion(
            "Aging 버그 (" + config.getAgingThresholdDays() + "일+)",
            "별도 표시",
            agingCount + "건",
            true));  // 항상 pass — 참고 지표

        // Go/No-Go 판단 (Aging 제외)
        boolean ready = criteria.stream()
            .filter(c -> !c.name().startsWith("Aging"))
            .allMatch(ReadinessCriterion::passed);

        return new ReleaseReadiness(
            ready, ready ? "GO" : "NO_GO", criteria,
            computeVersionProgress(versionId));
    }

    // 4. Dashboard 통합
    @Override
    public Dashboard getDashboard(Long versionId) {
        return new Dashboard(
            getReleaseReadiness(versionId),
            getPhaseTrends(versionId),
            getAgingBugs(versionId),
            getBlockedTcs(versionId));
    }
}
```

**StatisticsController:**
```java
@RestController
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;
    private final SnapshotService snapshotService;

    // 1. GET /api/phases/{id}/reports/daily?date=YYYY-MM-DD
    @GetMapping("/api/phases/{id}/reports/daily")
    public ApiResponse<StatisticsDto.DailyReport> getDailyReport(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.success(statisticsService.getDailyReport(id, date));
    }

    // 2. GET /api/phases/{id}/reports/trend?from=&to=
    @GetMapping("/api/phases/{id}/reports/trend")
    public ApiResponse<StatisticsDto.TrendData> getTrend(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.success(statisticsService.getTrend(id, from, to));
    }

    // 3. GET /api/versions/{id}/release-readiness
    @GetMapping("/api/versions/{id}/release-readiness")
    public ApiResponse<StatisticsDto.ReleaseReadiness> getReleaseReadiness(
            @PathVariable Long id) {
        return ApiResponse.success(statisticsService.getReleaseReadiness(id));
    }

    // 4. GET /api/versions/{id}/dashboard
    @GetMapping("/api/versions/{id}/dashboard")
    public ApiResponse<StatisticsDto.Dashboard> getDashboard(
            @PathVariable Long id) {
        return ApiResponse.success(statisticsService.getDashboard(id));
    }

    // 5. POST /api/admin/snapshots/run?date=YYYY-MM-DD
    @PostMapping("/api/admin/snapshots/run")
    public ApiResponse<Void> runSnapshot(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        snapshotService.createSnapshotsForDate(date);
        return ApiResponse.success(null, "Snapshot created for " + date);
    }
}
```

**TicketRepository 확장 (통계 조회용):**
```java
// Version 단위 Severity별 Open 티켓 수
@Query("""
    SELECT COUNT(t) FROM TicketEntity t
    WHERE t.testResult.version.id = :versionId
      AND t.severity = :severity
      AND t.closedAt IS NULL
    """)
int countOpenByVersionIdAndSeverity(@Param("versionId") Long versionId,
                                     @Param("severity") Severity severity);

// Version 단위 Aging 티켓 수
@Query("""
    SELECT COUNT(t) FROM TicketEntity t
    WHERE t.testResult.version.id = :versionId
      AND t.closedAt IS NULL
      AND t.createdAt < :threshold
    """)
int countAgingByVersionId(@Param("versionId") Long versionId,
                           @Param("threshold") LocalDateTime threshold);
```

- [x] ReadinessConfig 생성 (@ConfigurationProperties)
- [x] application.yml에 statistics.readiness.* 설정 추가
- [x] StatisticsDto 생성 (DailyReport, TrendData, ReleaseReadiness, Dashboard 등 7개 record)
- [x] StatisticsService 인터페이스 생성 (dailyReport, trend, releaseReadiness, dashboard)
- [x] StatisticsServiceImpl 구현
- [x] Release Readiness 판단 로직 (기준 3개 + Aging 참고 지표)
- [x] Regression Phase Pass Rate 계산 (phaseType == REGRESSION인 Phase 기준)
- [x] 실시간 계산 fallback (스냅샷 없는 날짜 대비)
- [x] StatisticsController 생성 (5개 엔드포인트)
- [x] TicketRepository에 countOpenByVersionIdAndSeverity, countAgingByVersionId 쿼리 추가

---

### Step 5 — Frontend: 통계 타입 + API 추가

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `types/features.ts` | 통계 관련 타입 + Severity/PhaseType enum 추가 |
| `api/features.ts` | statisticsApi 모듈 추가 |
| `package.json` | recharts 의존성 추가 |

**types/features.ts 추가:**
```typescript
// Severity enum
export enum Severity {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  TRIVIAL = 'TRIVIAL',
}

// PhaseType enum
export enum PhaseType {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  REGRESSION = 'REGRESSION',
}

// Daily Report (Phase 특정 날짜)
export interface DailyReport {
  phaseId: number;
  phaseName: string;
  snapshotDate: string;
  totalTc: number;
  passCount: number;
  failCount: number;
  blockedCount: number;
  skippedCount: number;
  retestCount: number;
  untestedCount: number;
  newBugCritical: number;
  newBugMajor: number;
  newBugMinor: number;
  newBugTrivial: number;
  closedBugCount: number;
  openBugCount: number;
  agingBugCount: number;
  passRate: number;
  progressRate: number;
}

// Trend Data (Phase 기간 시계열)
export interface TrendData {
  phaseId: number;
  phaseName: string;
  from: string;
  to: string;
  dailyReports: DailyReport[];
}

// Release Readiness
export interface ReleaseReadiness {
  ready: boolean;
  verdict: 'GO' | 'NO_GO';
  criteria: ReadinessCriterion[];
  progress: VersionProgressSummary;
}

export interface ReadinessCriterion {
  name: string;
  threshold: string;
  actual: string;
  passed: boolean;
}

export interface VersionProgressSummary {
  totalTc: number;
  completed: number;
  pass: number;
  fail: number;
  blocked: number;
  overallPassRate: number;
  overallProgressRate: number;
}

// Dashboard 통합
export interface Dashboard {
  releaseReadiness: ReleaseReadiness;
  phaseTrends: TrendData[];
  agingBugs: AgingBugInfo[];
  blockedTcs: BlockedTcInfo[];
}

export interface AgingBugInfo {
  ticketId: number;
  jiraKey: string;
  jiraUrl: string;
  summary: string;
  severity: Severity;
  phaseName: string;
  testCaseTitle: string;
  createdAt: string;
  agingDays: number;
}

export interface BlockedTcInfo {
  testResultId: number;
  testCaseId: number;
  testCaseTitle: string;
  testCasePath: number[];
  phaseName: string;
}
```

**api/features.ts — statisticsApi 추가:**
```typescript
export const statisticsApi = {
  // Phase Daily Report
  getDailyReport: async (phaseId: number, date: string): Promise<DailyReport> => {
    const res = await api.get(`/api/phases/${phaseId}/reports/daily`, { params: { date } });
    return res.data.data;
  },

  // Phase Trend
  getTrend: async (phaseId: number, from: string, to: string): Promise<TrendData> => {
    const res = await api.get(`/api/phases/${phaseId}/reports/trend`, { params: { from, to } });
    return res.data.data;
  },

  // Release Readiness
  getReleaseReadiness: async (versionId: number): Promise<ReleaseReadiness> => {
    const res = await api.get(`/api/versions/${versionId}/release-readiness`);
    return res.data.data;
  },

  // Dashboard 통합
  getDashboard: async (versionId: number): Promise<Dashboard> => {
    const res = await api.get(`/api/versions/${versionId}/dashboard`);
    return res.data.data;
  },

  // 수동 스냅샷 재생성
  runSnapshot: async (date: string): Promise<void> => {
    await api.post('/api/admin/snapshots/run', null, { params: { date } });
  },
};
```

**recharts 설치:**
```bash
cd frontend && npm install recharts
```

- [x] types/features.ts에 Severity, PhaseType enum 추가
- [x] types/features.ts에 DailyReport, TrendData, ReleaseReadiness, Dashboard 등 인터페이스 추가
- [x] api/features.ts에 statisticsApi 모듈 추가 (5개 함수)
- [x] recharts 설치 (`npm install recharts`)

---

### Step 6 — Frontend: Version Dashboard UI

**신규 파일:**

| 파일 | 내용 |
|------|------|
| `components/features/statistics/ReleaseReadinessCard.tsx` | Go/No-Go 배지 + 4 KPI + 기준 체크리스트 |
| `components/features/statistics/TrendChartSection.tsx` | Bug 추이 + Pass Rate 차트 (recharts) |
| `components/features/statistics/AgingBugList.tsx` | 3일+ 미해결 버그 테이블 |
| `components/features/statistics/BlockedTcList.tsx` | BLOCKED TC 테이블 |
| `components/features/statistics/DailyReportModal.tsx` | 특정 날짜 Daily Report 모달 |

**변경 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `pages/features/VersionDetailPage.tsx` | 대시보드 섹션 추가 (Phase 필터 + 5개 컴포넌트 배치) |

**VersionDetailPage 레이아웃 변경:**
```
VersionDetailPage (현재 496줄):

[기존] Header (버전 이름, 편집, 복사, 삭제)

[신규] ── 대시보드 섹션 ──────────────────────────────
│
│  ┌─ Release Readiness ───────────────────────────┐
│  │  GO / NO-GO 배지                              │
│  │  ────────────────────────────────────────────  │
│  │  Pass Rate    Open Bug    Critical    진행률   │
│  │  [  95.2% ]   [  3건  ]   [  0건  ]  [ 87% ] │
│  │                                                │
│  │  ✅ Critical 미해결: 0건 (0건 이하)             │
│  │  ✅ Major 미해결: 1건 (2건 이하)                │
│  │  ✅ Regression Pass Rate: 98.5% (98% 이상)     │
│  │  ⚠ Aging 버그: 1건 (3일+)                      │
│  └────────────────────────────────────────────────┘
│
│  Phase 필터: [전체] [1차 테스트] [Regression]
│
│  ┌─ Trend Charts ────────────────────────────────┐
│  │  탭: [Bug 추이] [Pass Rate]                    │
│  │                                                │
│  │  (recharts LineChart)                          │
│  │  X축: 날짜, Y축: 건수 / %                      │
│  │  * 데이터 포인트 클릭 → DailyReportModal        │
│  └────────────────────────────────────────────────┘
│
│  ┌─ Aging Bugs ──────────┐ ┌─ Blocked TCs ───────┐
│  │  🎫 AT-12 Critical    │ │  TC-34 로그인 실패   │
│  │    로그인 장애 (5일)   │ │    Phase: 1차 테스트 │
│  │  🎫 AT-45 Major       │ │  TC-78 결제 오류     │
│  │    결제 오류 (3일)     │ │    Phase: Regression │
│  └───────────────────────┘ └─────────────────────┘
│
────────────────────────────────────────────────────

[기존] Phase 목록 + Phase 생성 섹션
```

**ReleaseReadinessCard.tsx:**
```tsx
interface ReleaseReadinessCardProps {
  releaseReadiness: ReleaseReadiness;
}

// Go → 초록 배경, No-Go → 빨간 배경
// KPI 4개: Pass Rate, Open Bug, Critical 잔존, 진행률 — 숫자 카드
// 기준 체크리스트: ✅ passed / ❌ failed 아이콘 + name + threshold vs actual
```

**TrendChartSection.tsx:**
```tsx
interface TrendChartSectionProps {
  phaseTrends: TrendData[];
  selectedPhaseId: number | null;  // null = 전체
  onDateClick: (date: string) => void;
}

// recharts: LineChart + XAxis(date) + YAxis + Tooltip + Legend
// Bug 추이 탭: newBugCritical+Major+Minor+Trivial (누적 영역) + closedBugCount (라인)
// Pass Rate 탭: passRate (라인) + progressRate (라인)
// 데이터 포인트 클릭 → onDateClick(date) → DailyReportModal 오픈
```

**AgingBugList.tsx:**
```tsx
interface AgingBugListProps {
  agingBugs: AgingBugInfo[];
}

// 테이블: Severity 배지 | Jira 키 (링크) | 제목 | Phase | TC | 경과일
// Severity 색상: CRITICAL=빨강, MAJOR=주황, MINOR=노랑, TRIVIAL=회색
// 빈 목록 시 "Aging 버그가 없습니다" 표시
```

**BlockedTcList.tsx:**
```tsx
interface BlockedTcListProps {
  blockedTcs: BlockedTcInfo[];
}

// 테이블: TC 제목 | Path (segment 이름) | Phase
// 빈 목록 시 "Blocked TC가 없습니다" 표시
```

**DailyReportModal.tsx:**
```tsx
interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  phaseId: number;
  date: string;
}

// 모달 오픈 시 statisticsApi.getDailyReport(phaseId, date) 호출
// TC 통계: pass/fail/blocked/skipped/retest/untested 막대 or 파이
// 버그 통계: 신규 (severity별) / 종료 / Open / Aging
// Pass Rate, Progress Rate 표시
```

**VersionDetailPage 데이터 로딩 확장:**
```tsx
// 기존 useEffect + 신규 대시보드 데이터 로딩
const [dashboard, setDashboard] = useState<Dashboard | null>(null);
const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<number | null>(null);
const [dailyReportDate, setDailyReportDate] = useState<string | null>(null);
const [dailyReportPhaseId, setDailyReportPhaseId] = useState<number | null>(null);

useEffect(() => {
  if (version) {
    statisticsApi.getDashboard(version.id).then(setDashboard).catch(console.error);
  }
}, [version]);
```

- [x] ReleaseReadinessCard 컴포넌트 생성 (Go/No-Go + KPI + 기준 체크리스트)
- [x] TrendChartSection 컴포넌트 생성 (recharts LineChart + 탭 + 날짜 클릭)
- [x] AgingBugList 컴포넌트 생성 (Severity 배지 + Jira 링크 + 경과일)
- [x] BlockedTcList 컴포넌트 생성 (TC 제목 + Path + Phase)
- [x] DailyReportModal 컴포넌트 생성 (특정 날짜 스냅샷 상세)
- [x] VersionDetailPage — dashboard 상태 + statisticsApi 호출 추가
- [x] VersionDetailPage — Phase 필터 탭 추가 (전체 / 개별 Phase)
- [x] VersionDetailPage — 대시보드 섹션 배치 (Readiness → Trend → Issues → 기존 Phase 목록)
- [x] Phase 필터 전환 시 Trend 차트 갱신

---

### Step 7 — 검증

**Frontend Lint:**
```bash
cd frontend && npm run lint   # 0 warnings 필수
```

**Agent-D 빌드 검증 단계:**
```bash
# Step 1: Backend build + tests
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew clean build

# Step 2: Full stack 기동
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d --build && sleep 10

# Step 3: E2E tests (전체)
cd /Users/yeongmi/dev/qa/my-atlas/qa && npx playwright test

# Teardown (항상 실행)
cd /Users/yeongmi/dev/qa/my-atlas && docker compose down
```

**시각적 검증 항목:**

| 시나리오 | 기대 결과 |
|---------|----------|
| Version Detail 진입 | Release Readiness 카드 자동 로드 (Go/No-Go + 4 KPI) |
| Go 상태 | 초록 배지, 모든 기준 ✅ |
| No-Go 상태 | 빨간 배지, 미충족 기준 ❌ + 사유 표시 |
| Phase 필터 전환 | Trend 차트가 해당 Phase 데이터로 갱신 |
| Bug 추이 차트 | 일자별 신규/종료 버그 라인 표시 |
| Pass Rate 차트 | 일자별 Pass Rate/Progress Rate 라인 표시 |
| 차트 날짜 클릭 | DailyReportModal 오픈 + 해당 날짜 스냅샷 표시 |
| Aging Bug 리스트 | 3일+ 미해결 버그 목록 (Severity 배지 + Jira 링크) |
| Blocked TC 리스트 | BLOCKED 상태 TC 목록 (Path + Phase 표시) |
| 빈 데이터 | "데이터가 없습니다" 안내 메시지 |
| 스냅샷 없는 날짜 조회 | 실시간 계산 fallback 동작 |
| 수동 스냅샷 재생성 | POST /api/admin/snapshots/run 호출 후 데이터 갱신 |

- [x] Frontend lint 0 warnings
- [x] Backend build 성공 (전체 테스트 통과)
- [ ] E2E 전체 통과 (Docker 기동 후 수동 실행 필요)
- [ ] 시각적 검증 항목 전수 확인 (유저 확인 필요)

---

## 변경 요약

### 신규 파일 (Backend)

| 파일 | 내용 |
|------|------|
| `db/migration/V{ts}__add_statistics_fields_and_snapshot.sql` | ticket/version_phase ALTER + daily_test_snapshot CREATE |
| `feature/Severity.java` | Enum: CRITICAL, MAJOR, MINOR, TRIVIAL |
| `feature/PhaseType.java` | Enum: FIRST, SECOND, REGRESSION |
| `statistics/DailyTestSnapshotEntity.java` | @Entity daily_test_snapshot |
| `statistics/DailyTestSnapshotRepository.java` | JPA Repository + upsert 네이티브 쿼리 |
| `statistics/SnapshotService.java` | 스냅샷 생성 인터페이스 |
| `statistics/SnapshotServiceImpl.java` | TC/버그 통계 집계 + UPSERT |
| `statistics/SnapshotScheduler.java` | @Scheduled 매일 자정 |
| `statistics/StatisticsDto.java` | DailyReport, TrendData, ReleaseReadiness, Dashboard 등 7개 record |
| `statistics/StatisticsService.java` | 통계 조회 인터페이스 |
| `statistics/StatisticsServiceImpl.java` | 통계 계산 + Release Readiness 판단 |
| `statistics/StatisticsController.java` | 5개 API 엔드포인트 |
| `statistics/ReadinessConfig.java` | @ConfigurationProperties (판단 기준 설정) |

### 신규 파일 (Frontend)

| 파일 | 내용 |
|------|------|
| `components/features/statistics/ReleaseReadinessCard.tsx` | Go/No-Go + KPI 카드 + 기준 체크리스트 |
| `components/features/statistics/TrendChartSection.tsx` | Bug 추이 + Pass Rate 차트 (recharts) |
| `components/features/statistics/AgingBugList.tsx` | Aging 버그 테이블 |
| `components/features/statistics/BlockedTcList.tsx` | Blocked TC 테이블 |
| `components/features/statistics/DailyReportModal.tsx` | 특정 날짜 Daily Report 모달 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `feature/TicketEntity.java` | severity, closedAt, reopenCount 필드 추가 |
| `feature/VersionPhaseEntity.java` | phaseType, startDate, endDate 필드 추가 |
| `feature/TicketDto.java` | CreateTicketRequest에 severity 추가 |
| `feature/VersionDto.java` | PhaseRequest에 phaseType, startDate, endDate 추가 |
| `feature/TicketServiceImpl.java` | severity 설정, closedAt/reopenCount 갱신 로직 |
| `feature/TicketRepository.java` | findAllByTestResultIdIn, countOpen/Aging 쿼리 추가 |
| `feature/VersionPhaseServiceImpl.java` | phaseType/startDate/endDate 설정 로직 |
| `MyQaWebApplication.java` | @EnableScheduling 추가 |
| `application.yml` | statistics.readiness.* 설정 추가 |
| `types/features.ts` | Severity, PhaseType, DailyReport, Dashboard 등 타입 추가 |
| `api/features.ts` | statisticsApi 모듈 추가 |
| `pages/features/VersionDetailPage.tsx` | 대시보드 섹션 + Phase 필터 + 5개 통계 컴포넌트 배치 |
| `package.json` | recharts 의존성 추가 |

---

## 추가 변경 사항 (구현 중 개선)

### Ticket Severity → Priority 변환

Jira의 우선순위 체계와 일치하도록 Severity를 Priority로 변경했다.

**변경 전:** `Severity` (CRITICAL / MAJOR / MINOR / TRIVIAL)
**변경 후:** `TicketPriority` (HIGHEST / HIGH / MEDIUM / LOW / LOWEST)

| 변경 대상 | 내용 |
|-----------|------|
| DB Migration | `V202604171400__rename_ticket_severity_to_priority.sql` — 컬럼명 rename + 값 변환 |
| `Severity.java` → `TicketPriority.java` | Enum 값 5개 (HIGHEST/HIGH/MEDIUM/LOW/LOWEST) |
| `TicketEntity.java` | `severity` → `priority` 필드명 변경 |
| `TicketDto.java` | CreateTicketRequest에 `priority: TicketPriority` |
| `TicketServiceImpl.java` | priority 설정 + `toJiraPriorityName()` 매핑 |
| `JiraService.java` / `JiraServiceImpl.java` | `createIssue()`에 priority 파라미터 추가 → Jira `fields.priority.name`에 전달 |
| `TicketRepository.java` | `countOpenByVersionIdAndSeverity` → `countOpenByVersionIdAndPriority` |
| `ReadinessConfig.java` | `maxCriticalOpen` → `maxHighestOpen`, `maxMajorOpen` → `maxHighOpen` |
| `application.yml` | `max-critical-open` → `max-highest-open`, `max-major-open` → `max-high-open` |
| `StatisticsServiceImpl.java` | Go/No-Go 기준: Highest 0건, High 2건 이하 |
| `SnapshotServiceImpl.java` | `countNewBySeverityOnDate` → `countNewByPriorityOnDate` |
| `StatisticsDto.java` | `AgingBugInfo.severity` → `AgingBugInfo.priority` |
| `types/features.ts` | `Severity` → `TicketPriority` enum |
| `AgingBugList.tsx` | Severity 배지 → Priority 배지 |
| `ReleaseReadinessCard.tsx` | "Critical" → "Highest" |
| `VersionPhaseDetailPage.tsx` | 티켓 생성 다이얼로그에 **Priority 드롭다운** 추가 |
| `api/features.ts` | `ticketApi.create()`에 priority 파라미터 추가 |

**Go/No-Go 기준 매핑:**
- Highest 미해결 0건 (기존 Critical)
- High 미해결 2건 이하 (기존 Major)

**Jira 연동:** 티켓 생성 시 선택한 Priority가 Jira 이슈의 우선순위 필드에 그대로 반영됨

### Phase 전체 Ticket Refresh 기능

개별 티켓 새로고침 외에 Phase 전체 티켓을 한번에 Jira에서 갱신하는 기능을 추가했다.

| 변경 대상 | 내용 |
|-----------|------|
| `TicketService.java` | `refreshAllByPhaseId(Long phaseId)` 메서드 추가 |
| `TicketServiceImpl.java` | Phase의 모든 TestResult → 연결된 Ticket 일괄 Jira 조회 + closedAt/reopenCount 갱신 |
| `TicketController.java` | `POST /api/versions/{versionId}/phases/{phaseId}/tickets/refresh-all` |
| `api/features.ts` | `ticketApi.refreshAllByPhase()` 추가 |
| `VersionPhaseDetailPage.tsx` | 헤더에 "Refresh All Tickets" 버튼 + 갱신 후 티켓 목록 reload |
