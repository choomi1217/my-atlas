# Registry v32 — Test Result 통계 버그 수정 + Fail 결과 개선

> 변경 유형: 버그 수정, 기능 개선  
> 작성일: 2026-11-04  
> 버전: v32  
> 상태: 완료

---

| Step | 내용 | Notion 항목 | 브랜치 | 상태 |
|------|------|-------------|--------|------|
| 1 | Trend 그래프: 오늘 결과 반영 · 시작일~릴리즈일 범위 | [🐞 통계 / Phase 속, Test Result 통계가 실제 결과와 상이함](https://app.notion.com/p/3ba107b270e8809abf65df78d24ac4aa) | `bugfix/trend-today` | ✅ |
| 2 | Fail 결과 Priority · AI 사유 표시 · Failed 목록 | [Test Result 통계 개선](https://app.notion.com/p/40d107b270e880788e36c29e5d5b0043) | `feature/registry-fail-ticket` | ✅ |
| 3 | 버그 티켓 Notion 발행 | 〃 | 〃 | ✅ |

- Step마다 4-Agent Pipeline. 배포를 위해 Step 1~3을 한 PR(`feature/registry-fail-ticket`)로 올린다. PR 본문에 Notion 링크 2개 — 머지하면 notion-sync가 둘 다 Done 처리.
- Step 2·3은 v31 Step 1과 같은 파일(`AgentExecutionServiceImpl`, `VersionPhaseDetailPage`, `types/features.ts`, `api/features.ts`)을 고치고 v31의 `utils/apiError.ts`를 쓰므로 **v31 PR 머지 후** develop에서 시작한다. Step 1은 겹치는 파일이 없다.

## 결정

| # | 항목 | 결정 |
|---|------|------|
| 1 | 결과 Priority | 5단계(HIGHEST~LOWEST) + **Unknown**. AI가 쓴 결과는 항상 Unknown이고, 사람이 Priority를 골라야 확정된다. 사람이 FAIL로 바꾸면 TC Priority로 자동 입력(HIGH→HIGH, MEDIUM→MEDIUM, LOW→LOW), 수정 가능 |
| 2 | 그래프 범위 | x축 = Phase 시작일 ~ 릴리즈 예정일 (릴리즈일이 없으면 오늘). 범위 밖 점은 그리지 않는다. 릴리즈일 뒤 변경은 그래프에 안 나온다 (771: 릴리즈 10-31, 결과 변경 11-03) |
| 3 | Notion 발행 위치 | [PRD DB](https://app.notion.com/p/7ad107b270e8820e90c401aac14ec805?v=3ba107b270e880a8aab8000c94d0c55a)(Bug List 뷰)에 `Scope=Bug`로 발행. 본문은 [🐞 버그 리포트 양식](https://app.notion.com/p/3ba107b270e8805a8e14dceaf8bba0b1) |
| 4 | Jira | 새 티켓은 Notion만. Jira 코드는 기존 Jira 티켓 상태 갱신용으로 남긴다 |
| 5 | 릴리즈 판정 (버전 화면 맨 위 박스) | **FAIL 결과로 센다** (지금은 발행된 티켓 수라 티켓이 0건이면 Fail이 있어도 GO). TC마다 마지막 실행 결과(Phase 순서상 마지막, UNTESTED 제외)가 FAIL이면 미해결이고, 재테스트 Phase에서 PASS하면 해결된다. Highest·High는 그 결과의 Priority로 센다. Unknown(AI FAIL, 사람 확인 전)은 `확인 필요`로 따로 세고, 0건이어야 GO |
| 6 | 기존 통계 방식 반영 | Bug 추이 탭에 "테스트 기간 50% 시점까지 등록된 버그 비율(전체 · High 이상)" 1줄과 50% 기준선만 추가 (프론트만). 초기:통합 테스트 발견 비율, TC로 찾은 버그 비율은 다음 버전 |

1~6 모두 확정 (2026-11-04).

## Step 1 — Trend 그래프

### 원인

그래프는 `daily_test_snapshot`만 그린다. 스냅샷은 매일 00:00(KST) 한 번 저장되므로 그날 바뀐 결과는 다음 날 00:00까지 안 보인다.

| 관찰 | 실제 데이터 (운영 API) |
|------|------------------------|
| 772 그래프 없음 | 11-03 14:53 생성 → 11-04 00:00 전까지 스냅샷 0건 → "선택한 Phase에 스냅샷 데이터가 없습니다" |
| 771 그래프 ≠ 실제 | Phase 788 스냅샷(11-03) P20/F17/R9 = 43.48%, 실제 P45/F1 = 97.83% |
| 버그 티켓 (버전 764) | Phase 769 스냅샷(08-12) Untested 6 = 0%. 00:53 AI 실행으로 6/6 끝난 뒤에도 그래프는 0% |

같은 구조에서 나오는 문제:

- `SnapshotScheduler.java:26` — 00:00에 `오늘` 날짜로 저장. 어제 마감 상태가 오늘 날짜로 찍혀 하루 밀린다
- `SnapshotServiceImpl.java:64-77` — 신규·종료 버그를 `오늘 00:00~24:00` 구간으로 세는데 00:00에 실행되어 항상 0
- `StatisticsServiceImpl.java:146-172` `computeRealtimeReport` — 스냅샷 계산 복사본, 버그 수 0 고정
- `StatisticsServiceImpl.java:220-221` — 범위가 `Phase 종료일 ?? 오늘`까지라 릴리즈일 뒤 날짜도 그린다 (771: 10-29~11-04)
- `VersionDetailPage.tsx:296,309` — 기본으로 첫 Phase를 그리는데 탭에는 선택 표시가 없다

### 수정

1. `SnapshotScheduler`: 00:00에 **어제** 날짜로 저장 (`LocalDate.now().minusDays(1)`)
2. `SnapshotService`에 `compute(phaseId, date)` 분리 → `createSnapshot` = compute + upsert. `computeRealtimeReport` 삭제
3. `StatisticsServiceImpl`
   - Trend 값 = 어제까지 스냅샷 + 오늘 `compute` 값. `getTrend`·`getPhaseTrends` 공통
   - 대시보드 범위 = Phase 시작일(`startDate ?? createdAt`) ~ 릴리즈 예정일. 오늘이 범위 밖이면 오늘 점 없음
   - `getDailyReport`는 오늘이면 `compute`
4. `TrendChartSection`: x축을 범위의 모든 날짜로 채운다 (오늘 뒤는 빈칸)
5. `VersionDetailPage`: 그래프가 그리는 Phase 탭 선택 표시 (`selectedPhaseFilter ?? phases[0].id`)

- 기존 스냅샷은 하루 밀린 채로 둔다 (보정 안 함)

### 테스트

- Unit: 오늘 점 = 실시간 값, 릴리즈일 뒤 점 제외, 스케줄러가 어제 날짜로 호출, 전날 생성 티켓이 신규 버그로 집계
- E2E: 결과 변경 직후 그래프에 오늘 점, x축 끝 = 릴리즈 예정일

### 결과 (2026-11-04)

| 검증 | 결과 |
|------|------|
| Backend `./gradlew clean build` | 922건 통과 (신규 `statistics` 19건) |
| Frontend lint · Vitest | 0 warnings · 161건 통과 (신규 8건) |
| E2E 전체 | 407 통과 · 1 실패 · 30 skip(기존 fixme/skip). 신규 API 4건 통과 |
| 실패 1건 | 신규 UI 테스트 셀렉터 — recharts 3은 x축 tick 라벨을 별도 레이어로 그려 `.recharts-xAxis` 하위가 아님 → `.recharts-xAxis-tick-labels`로 수정, 단독 실행 통과 |
| 전체 재검증 | 생략 (User 결정). 바뀐 것은 E2E 셀렉터 1줄, 프로덕션 코드는 첫 검증과 같음 |

## Step 2 — Fail 결과 Priority · AI 사유 · Failed 목록

### 현재

| 항목 | 현재 |
|------|------|
| 결과 Priority | `test_result`에 없음. TC Priority(3단계)와 티켓 Priority(5단계)만 있다 |
| Fail 노출 | 버전 대시보드에 Aging Bugs·Blocked TCs만 있고 Failed 목록이 없다. Fail은 진행률의 "Fail 3" 글자뿐 |
| AI 사유 | 워커가 `test_result.comment`에 `[AI FAIL] #2 FAIL: …`로 저장 중 (`AgentExecutionServiceImpl.java:472-474`). **프론트가 `result.comment`를 어디에도 그리지 않는다** |
| AI 사유 소실 | 수동 상태 변경(`TestResultServiceImpl.java:126`)이 comment를 null로 덮고 `executedBy`는 AGENT로 남긴다. 771 결과 2216은 FAIL·AGENT인데 사유가 비어 있다. AI 재실행 PASS는 이전 FAIL 사유를 지우지 않는다 |
| 릴리즈 판정 | Highest·High 미해결을 티켓 수로 센다(`StatisticsServiceImpl.java:79,87`) → 티켓 0건이면 Fail이 있어도 GO. KPI `Open Bug`는 버전 전체 FAIL 수(`ReleaseReadinessCard.tsx:23`)라 재테스트에서 PASS한 TC의 이전 FAIL도 남는다 |

워커 수정은 없다.

### DB

`V{구현시각}__add_test_result_priority.sql` — null = Unknown

```sql
ALTER TABLE test_result ADD COLUMN priority VARCHAR(20);
```

### Backend

- `TestResultEntity.priority` (`TicketPriority`, null = Unknown). 결과 응답·PATCH에 `priority` 추가
- AI(`upsertAgentTestResult`): priority는 항상 Unknown. comment는 항상 덮어쓴다 (PASS면 null)
- 수동(`updateResult`): FAIL인데 priority가 없으면 TC Priority로 채운다. comment는 요청에 있을 때만 바꾼다. 상태가 바뀌면 `executedBy=HUMAN` (Priority만 고르면 AGENT 유지)
- 티켓 생성 시 결과 Priority가 Unknown이면 티켓 Priority로 확정
- `unresolvedFails(versionId)`: TC마다 마지막 실행 결과(Phase `orderIndex` 최대, UNTESTED 제외)가 FAIL인 결과. 릴리즈 판정·Failed 목록·Open Bug가 같이 쓴다
- `getReleaseReadiness`: Highest·High 미해결 = `unresolvedFails`의 Priority별 수 (티켓 수 아님). `Priority 확인 필요`(Unknown) 기준 추가. Aging은 티켓 기준 그대로
- `VersionProgressSummary`에 `openFail`(= `unresolvedFails` 수) 추가
- 대시보드에 `failedTcs` 추가 = `unresolvedFails` (TC당 1행), 항목에 phaseId·priority·comment. 정렬: Unknown → HIGHEST → … → LOWEST

### Frontend

- `VersionDetailPage`: Readiness 카드 바로 아래 전체 폭 **Failed TCs** — Priority 배지(Unknown은 `확인 필요`), TC, Phase, AI 사유 1줄, 헤더에 확인 필요 건수. 클릭하면 해당 Phase로 이동
- `FailedTcList` 신규 (`BlockedTcList`와 같은 모양, `AgingBugList`의 Priority 색 재사용)
- `ReleaseReadinessCard`: KPI `Open Bug` = `openFail`
- `VersionPhaseDetailPage` 결과 행: FAIL이면 Priority 선택(Unknown이면 `확인 필요`). comment는 펼친 화면에 전체, 접힌 행에 1줄
- 티켓 생성 Priority 기본값 = 결과 Priority, Unknown이면 직접 골라야 생성된다 (`VersionPhaseDetailPage.tsx:325` MEDIUM 고정)
- `TrendChartSection` Bug 추이 탭: 50% 시점 기준선 + 비율 1줄 (기간 N일 중 `ceil(N/2)`일차, 티켓 기준 신규 버그) — 신규 지표라 버그 PR(Step 1)이 아닌 이 PR에 넣는다

### 테스트

- Unit: AI 결과 Priority = Unknown, 사람 FAIL → TC Priority, 수동 변경이 comment 유지·HUMAN 전환, AI PASS가 comment 비움, 티켓 생성이 Unknown 확정, failedTcs 정렬
- Unit (판정): 1차 FAIL → 2차 PASS는 해결, 1차 FAIL → 2차 UNTESTED는 미해결, 1차 PASS → 2차 FAIL은 미해결, Unknown은 `확인 필요`로 집계
- E2E: AI FAIL → Failed 목록에 `확인 필요` → Priority 선택 후 해제. 사람 FAIL → TC Priority 표시. High FAIL 3건 → 판정 NO-GO, 재테스트 PASS 후 GO

## Step 3 — 버그 티켓 Notion 발행

### User 준비

- 로컬·EC2 `.env`에 `NOTION_API_KEY`(PRD DB를 이미 쓰는 notion-sync 통합 토큰 재사용), `NOTION_BUG_DATABASE_ID`(PRD DB id) → `docker compose up -d --force-recreate`

### Notion 속성 (PRD DB)

| 속성 | 값 |
|------|-----|
| 무엇을 개발할 것인가 (제목) | 티켓 summary |
| Scope | `Bug` |
| Status | 생성 시 `Waiting...`. `Done`·`Close`면 종료 |
| 우선순위 | HIGHEST→Highest, HIGH→High, MEDIUM→Mid, LOW·LOWEST→Low |
| 아이콘 | 🐞 |

### 본문 (🐞 버그 리포트 양식)

| 섹션 | 내용 |
|------|------|
| PreCondition | TC Preconditions |
| Test Data | Phase 페이지 링크(프론트가 현재 URL을 요청에 담음), Company · Product · Version · Phase |
| Steps | TC Steps |
| Expected Result | TC Expected Result |
| Actual Result | 결과 comment (AI 사유) |
| Memo | 티켓 생성 창에 입력한 설명 |

### DB

`V{구현시각}__generalize_ticket_tracker.sql` — 기존 행 보존

```sql
ALTER TABLE ticket RENAME COLUMN jira_key TO issue_key;
ALTER TABLE ticket RENAME COLUMN jira_url TO issue_url;
ALTER TABLE ticket ADD COLUMN tracker VARCHAR(20) NOT NULL DEFAULT 'JIRA';
```

### Backend

- `NotionService` + `NotionServiceImpl` (`POST /v1/pages`, `GET /v1/pages/{id}`), `NotionConfig` (`notion.api-key`, `notion.bug-database-id`)
- `TicketServiceImpl`(`:42-66` Jira 전용): 생성은 Notion(`tracker=NOTION`), 상태 갱신은 tracker별. `isDoneStatus`에 `CLOSE`(Notion)·`완료`(Jira 한글 상태) 추가
- Notion 호출 실패 → 502 + `Notion 연동 실패: …` (500 `Unexpected error`로 묻히지 않게)
- `.env.example`에 `NOTION_*` 추가

### Frontend

- 티켓: `jiraKey/jiraUrl` → `issueKey/issueUrl` (`VersionPhaseDetailPage`, `AgingBugList`, `types/features.ts`), 링크 문구 tracker별
- 실패 시 서버 message 표시 (`utils/apiError.ts`)

### 테스트

- Unit: Notion 요청 본문(속성·우선순위 매핑·양식 섹션), 미설정 오류, tracker별 상태 갱신, `Done`·`Close` 종료 감지
- E2E: `qa/api/ticket.spec.ts`의 `[400,500]` 허용 제거 → 미설정 응답을 정확히 검증 (CI에는 Notion 토큰 없음)

## Step 2·3 결과 (2026-11-04)

| 검증 | 결과 |
|------|------|
| Backend `./gradlew clean build` | 993건 통과 (Step 1 대비 +71) |
| Frontend lint · Vitest | 0 warnings · 188건 통과 (23 files) |
| Flyway | `V202611040240`, `V202611040250` 적용 |
| E2E 전체 | 420 통과 · 0 실패 · 27 skip(기존 fixme 연쇄) · did not run 0 |
| 신규 E2E | API statistics 10 · ticket 4, UI 5건 이름으로 실행 확인 |

- 실제 Notion 페이지가 생기지 않도록 E2E는 `GET /api/tickets/config`가 configured면 발행 테스트를 건너뛴다. 실제 발행이 필요한 연쇄 티켓 E2E 3개(생성 후 조회·새로고침·삭제)는 삭제하고 단위 테스트로 대신한다
- 리뷰 반영: Notion 본문 섹션당 15항목(초과는 `… 외 N개`) — 긴 Steps 때문에 Actual Result가 잘리지 않게, 티켓 링크는 페이지 id 기반(제목 slug로 `issue_url` 500자 초과 방지), 빈 항목 제외, Notion 오류 메시지 노출(토큰 제외), Close 상태 초록 표시
- 남은 공백: `qa/ui/version.spec.ts`의 `FAIL 상태 변경 시 티켓 다이얼로그 자동 표시`는 기존 `test.fixme` 연쇄로 계속 skip
- 백필 `V202611041000`: v32 이전 FAIL은 priority가 비어 전부 `확인 필요`(NO-GO)가 되므로 빈 값만 채운다 — 티켓이 있으면 마지막 티켓 priority, 없으면 사람·CI FAIL은 TC priority, AI FAIL은 Unknown 유지. 로컬 DB 적용 결과 548·347·763·370 → GO, AI FAIL인 764는 `확인 필요 3건` 유지
- CI 가져오기(`TestResultImportServiceImpl`) FAIL도 TC priority — `확인 필요`는 AI 결과만
- 백필 후 Backend 994건 통과(Testcontainers Postgres에서 마이그레이션 적용 확인). 전체 E2E는 PR CI에서 다시 돈다

## 최종 요약

- **그래프 = 실제 결과**: 오늘 점은 실시간 계산, 스냅샷은 전날 최종 상태, x축은 Phase 시작일 ~ 릴리즈 예정일
- **Fail이 보인다**: 대시보드 Failed TCs(Priority·AI 사유), 결과 행 Priority 선택·AI 사유 표시
- **판정이 Fail을 센다**: TC별 마지막 결과 기준 미해결 FAIL, AI FAIL은 사람이 Priority를 정하기 전까지 NO-GO
- **버그 티켓 → Notion PRD DB**: 버그 리포트 양식으로 발행, Jira는 기존 티켓 상태 갱신만
- **사용 전 할 일**: 로컬·EC2 `.env`에 `NOTION_API_KEY`(notion-sync 통합 토큰), `NOTION_BUG_DATABASE_ID=7ad107b270e8820e90c401aac14ec805` → `docker compose up -d --force-recreate`
