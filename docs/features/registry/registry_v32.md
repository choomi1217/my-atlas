# Registry v32 — Test Result 통계 버그 수정 + Fail 결과 개선

> 변경 유형: 버그 수정, 기능 개선  
> 작성일: 2026-11-04  
> 버전: v32  
> 상태: 진행 중

---

| Step | 내용 | Notion 항목 | 브랜치 | 상태 |
|------|------|-------------|--------|------|
| 1 | Trend 그래프: 오늘 결과 반영 · 시작일~릴리즈일 범위 | [🐞 통계 / Phase 속, Test Result 통계가 실제 결과와 상이함](https://app.notion.com/p/3ba107b270e8809abf65df78d24ac4aa) | `bugfix/trend-today` | |
| 2 | Fail 결과 Priority · AI 사유 표시 · Failed 목록 | [Test Result 통계 개선](https://app.notion.com/p/40d107b270e880788e36c29e5d5b0043) | `feature/registry-fail-ticket` | |
| 3 | 버그 티켓 Notion 발행 | 〃 | 〃 | |

- Step마다 4-Agent Pipeline. Step 2·3은 같은 Notion 항목이라 한 PR로 올린다 (먼저 머지하면 notion-sync가 항목을 Done 처리).
- Step 2·3은 v31 Step 1과 같은 파일(`AgentExecutionServiceImpl`, `VersionPhaseDetailPage`, `types/features.ts`, `api/features.ts`)을 고치고 v31의 `utils/apiError.ts`를 쓰므로 **v31 PR 머지 후** develop에서 시작한다. Step 1은 겹치는 파일이 없다.

## 결정

| # | 항목 | 결정 |
|---|------|------|
| 1 | 결과 Priority | 5단계(HIGHEST~LOWEST) + **Unknown**. AI가 쓴 결과는 항상 Unknown이고, 사람이 Priority를 골라야 확정된다. 사람이 FAIL로 바꾸면 TC Priority로 자동 입력(HIGH→HIGH, MEDIUM→MEDIUM, LOW→LOW), 수정 가능 |
| 2 | 그래프 범위 | x축 = Phase 시작일 ~ 릴리즈 예정일 (릴리즈일이 없으면 오늘). 범위 밖 점은 그리지 않는다. 릴리즈일 뒤 변경은 그래프에 안 나온다 (771: 릴리즈 10-31, 결과 변경 11-03) |
| 3 | Notion 발행 위치 | [PRD DB](https://app.notion.com/p/7ad107b270e8820e90c401aac14ec805?v=3ba107b270e880a8aab8000c94d0c55a)(Bug List 뷰)에 `Scope=Bug`로 발행. 본문은 [🐞 버그 리포트 양식](https://app.notion.com/p/3ba107b270e8805a8e14dceaf8bba0b1) |
| 4 | Jira | 새 티켓은 Notion만. Jira 코드는 기존 Jira 티켓 상태 갱신용으로 남긴다 |
| 5 | 릴리즈 판정 (버전 화면 맨 위 초록 박스) | "Highest/High 미해결 버그"는 FAIL 결과가 아니라 **발행된 티켓**만 센다. 지금은 티켓이 0건이라 Fail이 있어도 GO (771 Fail 3, 772 Fail 7). 추천: 그대로 둔다 — Step 3 뒤 Notion 티켓을 발행하면 그 티켓부터 집계되고, Done·Close가 되면 빠진다. FAIL 결과를 직접 세려면 "1차 FAIL → 재테스트 PASS"를 해결로 보는 규칙이 같이 필요하다 |
| 6 | 기존 통계 방식 반영 | 추천: Bug 추이 탭에 "테스트 기간 50% 시점까지 등록된 버그 비율(전체 · High 이상)" 1줄과 50% 기준선만 추가 (프론트만). 초기:통합 테스트 발견 비율, TC로 찾은 버그 비율은 다음 버전 |

1~4는 확정 (2026-11-04). 5·6은 확인 대기.

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
6. (결정 6 확정 시) Bug 추이 탭: 50% 시점 기준선 + 비율 1줄

- 기존 스냅샷은 하루 밀린 채로 둔다 (보정 안 함)

### 테스트

- Unit: 오늘 점 = 실시간 값, 릴리즈일 뒤 점 제외, 스케줄러가 어제 날짜로 호출, 전날 생성 티켓이 신규 버그로 집계
- E2E: 결과 변경 직후 그래프에 오늘 점, x축 끝 = 릴리즈 예정일

## Step 2 — Fail 결과 Priority · AI 사유 · Failed 목록

### 현재

| 항목 | 현재 |
|------|------|
| 결과 Priority | `test_result`에 없음. TC Priority(3단계)와 티켓 Priority(5단계)만 있다 |
| Fail 노출 | 버전 대시보드에 Aging Bugs·Blocked TCs만 있고 Failed 목록이 없다. Fail은 진행률의 "Fail 3" 글자뿐 |
| AI 사유 | 워커가 `test_result.comment`에 `[AI FAIL] #2 FAIL: …`로 저장 중 (`AgentExecutionServiceImpl.java:472-474`). **프론트가 `result.comment`를 어디에도 그리지 않는다** |
| AI 사유 소실 | 수동 상태 변경(`TestResultServiceImpl.java:126`)이 comment를 null로 덮고 `executedBy`는 AGENT로 남긴다. 771 결과 2216은 FAIL·AGENT인데 사유가 비어 있다. AI 재실행 PASS는 이전 FAIL 사유를 지우지 않는다 |

워커 수정은 없다.

### DB

`V{구현시각}__add_test_result_priority.sql` — null = Unknown

```sql
ALTER TABLE test_result ADD COLUMN priority VARCHAR(20);
```

### Backend

- `TestResultEntity.priority` (`TicketPriority`, null = Unknown). 결과 응답·PATCH에 `priority` 추가
- AI(`upsertAgentTestResult`): priority는 항상 Unknown. comment는 항상 덮어쓴다 (PASS면 null)
- 수동(`updateResult`): FAIL인데 priority가 없으면 TC Priority로 채운다. comment는 요청에 있을 때만 바꾸고 `executedBy=HUMAN`
- 티켓 생성 시 결과 Priority가 Unknown이면 티켓 Priority로 확정
- 대시보드에 `failedTcs` 추가 — `getBlockedTcs`(`StatisticsServiceImpl.java:246`)를 상태 인자로 일반화, 항목에 phaseId·priority·comment. 정렬: Unknown → HIGHEST → … → LOWEST

### Frontend

- `VersionDetailPage`: Readiness 카드 바로 아래 전체 폭 **Failed TCs** — Priority 배지(Unknown은 `확인 필요`), TC, Phase, AI 사유 1줄, 헤더에 확인 필요 건수. 클릭하면 해당 Phase로 이동
- `BlockedTcList`를 Blocked·Failed 공용으로 일반화
- `VersionPhaseDetailPage` 결과 행: FAIL이면 Priority 선택(Unknown이면 `확인 필요`). comment는 펼친 화면에 전체, 접힌 행에 1줄
- 티켓 생성 Priority 기본값 = 결과 Priority, Unknown이면 직접 골라야 생성된다 (`VersionPhaseDetailPage.tsx:325` MEDIUM 고정)

### 테스트

- Unit: AI 결과 Priority = Unknown, 사람 FAIL → TC Priority, 수동 변경이 comment 유지·HUMAN 전환, AI PASS가 comment 비움, 티켓 생성이 Unknown 확정, failedTcs 정렬
- E2E: AI FAIL → Failed 목록에 `확인 필요` → Priority 선택 후 해제. 사람 FAIL → TC Priority 표시

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
