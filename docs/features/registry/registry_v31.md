# Registry v31 — Test Automation 실행 페이지·네트워크·병렬

> 변경 유형: 기능 추가  
> 작성일: 2026-11-01  
> 버전: v31  
> 상태: 진행 중

---

Sprint 4 Doing 항목을 이 문서 하나로 진행한다. Notion: https://app.notion.com/p/40a107b270e8815393faf2245046d67e

| Step | 내용 | Notion 항목 | 브랜치 | 상태 |
|------|------|-------------|--------|------|
| 0 | 신뢰도 PR #176 머지 | AI 실행 신뢰도 개선 워커 반영 | — | ✅ |
| 1 | 실행 페이지 + Step 스크린샷 + 재실행 | 백그라운드 기능 | `feature/agent-job-page` | ✅ |
| 2 | 웹 네트워크 + 시나리오 로그 | 네트워크 탭, 시나리오 로그 | `feature/agent-network-log` | |
| 3 | 병렬 | 병렬 기능 | `feature/agent-parallel` | 방식 C 확정 |
| 4 | Android 네트워크 | 네트워크 탭 (Android 범위) | PoC 뒤 결정 | 공개 테스트 앱으로 진행, Step 1과 병행 |

Step마다 4-Agent Pipeline → PR → User 머지. 모델 비교(v30 4·5단계)는 Step 3 뒤 재개.

## 결정

| # | 항목 | 결정 |
|---|------|------|
| 1 | 재실행 결과 | Phase 결과에 반영. 사람이 입력한 결과도 덮어쓴다 (기존 upsert 동작) |
| 2 | Step 스크린샷 | 저장한다. S3 `/images/*`는 CloudFront 공개 경로라 쓰지 않고 DB에 저장, 인증 API로만 조회 |
| 3 | 화면 | 드릴다운 3단. 화면·Step·API를 나란히 놓지 않는다 |
| 4 | 네트워크 범위 | 웹 먼저, Android는 PoC 성공 뒤 |
| 5 | 보관 | 스크린샷·네트워크 로그는 30일 후 삭제 |
| 6 | 회사 앱 데이터 | 로컬 my-atlas에만 저장. 회사 앱을 돌리는 워커의 `BACKEND_URL`은 localhost |
| 7 | 병렬 방식 | C. 실행 시 N개 Job으로 분할 |
| 8 | Android PoC 대상 | 공개 테스트 앱 `android-ssl-pinning-demo`. 회사 앱은 빌드를 받으면 교체, 패스오더는 쓰지 않는다 |

## 화면

| 경로 | 내용 |
|------|------|
| `/automation` | 대기·실행 중(오래된 순), 완료(최신 순, 페이징), 중지, 연결된 워커 |
| `/automation/jobs/:id` | 진행률, 화면 중계, 탭 [TC 목록] [네트워크] |
| `/automation/jobs/:id/tc/:tcId` | 탭 [Step] [네트워크], 재실행 |

- Phase 실행: 범위 선택 모달 → Job 생성 → `/automation`
- TC 단건 실행: Job 생성 → `/automation/jobs/:id`
- 메뉴명: `Test Automation`
- [네트워크] 탭은 Step 2에서 추가

## Step 1 — 실행 페이지

### 시작 전

- ✅ 웹 회귀 스모크 1건: Job 93, T992 PASS 28초 (Haiku 4.5, Job 81과 동일 판정)
- ✅ 로컬 제품 1119 `exec_base_url` → `http://localhost:5173` (기존 값은 폐기된 컨테이너 주소)
- ✅ 로컬 Job 93은 스모크로 실행, 94는 취소

### DB

`V202611010200__add_agent_job_page.sql`

```sql
ALTER TABLE agent_execution_job
    ADD COLUMN started_at    TIMESTAMP,
    ADD COLUMN worker_id     VARCHAR(100),
    ADD COLUMN test_case_ids BIGINT[];

CREATE TABLE agent_step_screenshot (
    id           BIGSERIAL PRIMARY KEY,
    job_id       BIGINT      NOT NULL REFERENCES agent_execution_job(id) ON DELETE CASCADE,
    test_case_id BIGINT      NOT NULL,
    step_order   INT         NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    data         BYTEA       NOT NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT now(),
    UNIQUE (job_id, test_case_id, step_order)
);
CREATE INDEX idx_agent_step_screenshot_created ON agent_step_screenshot(created_at);
```

### API (`/api/agent-executions`)

| Method | Path | 내용 |
|--------|------|------|
| POST | `/` | 기존. `scope=PHASE_SELECTED`와 `testCaseIds` 추가 |
| POST | `/{id}/claim` | 기존. body `{workerId}` 추가, `started_at` 기록 |
| GET | `/queue?status=&page=&size=` | 전체 Job 목록. 제품명·Phase명, 링크용 `companyId`·`versionId` 포함 |
| PUT | `/workers` | 워커 heartbeat `{workerId, targetKind, productId, deviceName, currentJobId}` |
| GET | `/workers` | 연결된 워커 (마지막 heartbeat 15초 이내) |
| PUT | `/{id}/screenshots?testCaseId=&stepOrder=` | Step 스크린샷 저장 (10MB 이하) |
| GET | `/{id}/screenshots?testCaseId=&stepOrder=` | 스크린샷 조회, 없으면 204 |

### Backend

- ✅ `AgentExecutionScope`: `PHASE_SELECTED` 추가
- ✅ `AgentExecutionDto.CreateJobRequest`: `testCaseIds` 추가. Phase 소속이 아니면 400
- ✅ `AgentExecutionJobEntity`: `startedAt`, `workerId`, `testCaseIds` (`Long[]`, `TestCaseEntity.path`와 같은 매핑)
- ✅ `AgentExecutionServiceImpl.submitJob` (`:38`): TC ID 고정, 개수 계산. 같은 Phase의 대기·실행 중 Job과 TC가 겹치면 409
- ✅ `getExecutionContext` (`:210`): `test_case_ids` 우선, null(기존 Job)이면 기존 로직
- ✅ `claimJob` (`:114`): `startedAt`, `workerId` 저장
- ✅ `AgentWorkerRegistry` 신규: 메모리 저장, `AgentLiveFrameStore`와 같은 방식
- ✅ `AgentStepScreenshotEntity`·Repository 신규. 저장 시 JDK `ImageIO`로 긴 변 1280px JPEG 변환 (Android PNG는 장당 MB 단위)
- ✅ `AgentArtifactRetentionScheduler` 신규: `AccessLogRetentionScheduler` 형식, 30일
- ✅ `ConflictException` + `GlobalExceptionHandler` 409 매핑 (지금 409 없음)
- ✅ `/queue`는 `findAllById`로 제품·Phase 일괄 조회 (`execTargetKindOf`처럼 건별 조회 금지)

### Worker

- ✅ `index.js`: 10초 heartbeat. `runJob` 중에는 폴링이 멈추므로 별도 타이머
- ✅ `index.js:197`: `claim(jobId, workerId)`. workerId = `{hostname}:{ANDROID_DEVICE|web}`
- ✅ `backend.js`: `heartbeat`, `uploadScreenshot`, claim body
- ✅ `agent.js`: 판정 직전·동작 불가·실행 오류·전제조건 미도달 시점에 `agent.capture?.(tc.id, order)` 호출. 실패는 무시, 판정 로직 변경 없음

### Frontend

- ✅ 신규 `pages/automation/AutomationPage.tsx`, `AutomationJobPage.tsx`, `AutomationTestCasePage.tsx`
- ✅ `App.tsx` 라우트, `Layout.tsx` 메뉴
- ✅ `agentExecutionApi` (`api/features.ts:782`), `types/features.ts`
- ✅ 화면 중계는 `AgentLiveView`·`AgentLiveFlow` 재사용
- ✅ TC 목록은 `/context` + `/results` + `/progress` 병합. 대기·실행 중·판정 표시
- ✅ Step 카드: 동작·기대 결과·판정·스크린샷(클릭 확대). 실행 중 TC는 `/progress` 기준
- ✅ 재실행: `phaseId`가 있으면 `PHASE_SELECTED`, 없으면 `SINGLE`
- ✅ 워커 표시: 맡을 워커가 없는 대기 Job은 "연결된 워커 없음", RUNNING인데 `workerId`가 목록에 없으면 "워커 응답 없음"
- ✅ 중지는 `AgentRunModal`의 2단계 확인을 옮겨 사용
- ✅ `BatchAgentRunModal.tsx`: 범위 선택만 남김 (`VersionPhaseDetailPage.tsx:627`)
- ✅ `AgentRunModal.tsx` 삭제 (`TestCasePage.tsx:166`, `:729`)
- ✅ 폴링: 목록 3초, 상세 2초

### 테스트

- ✅ Backend: `AgentExecutionServiceImplTest`, Controller 테스트, 스케줄러 테스트
- ✅ Worker: `agent.test.js` — capture 실패가 실행에 영향 없음
- ✅ Frontend: 신규 페이지 3개, `VersionPhaseDetailPage.test.tsx` 수정
- ✅ E2E: `qa/ui/agent-execution.spec.ts`, `agent-batch-execution.spec.ts`, `agent-live-view.spec.ts` 수정, `qa/api/agent-queue.spec.ts` 신규

### 검증 중 추가 수정

- ✅ heartbeat `PUT /workers`는 접근 로그에서 제외 (워커당 하루 약 8,600행)
- ✅ 파라미터 누락·본문 파싱 실패 400, 지원하지 않는 Content-Type 415, 파라미터 타입 오류 400 (기존엔 500)
- ✅ 실행할 TC가 0건이면 Job을 만들지 않고 400
- ✅ 스크린샷: Job에 없는 TC 저장 거부, 없는 Job 조회 404
- ✅ TC 실행 버튼 더블클릭 시 Job 1개만 생성
- ✅ 취소 응답에 대상 종류 포함
- ✅ 판정 나온 Step은 스크린샷 재조회 안 함, 완료된 Step도 판정 배지 표시
- ✅ 지원하지 않는 HTTP 메서드는 405 (기존엔 500 + ERROR 로그 → Slack 알림)
- ✅ 워커 `HEARTBEAT_INTERVAL_MS=0`이면 heartbeat 끔. 이 PR이 운영에 배포되기 전까지 운영 워커는 0으로 띄운다 (운영에 `/workers`가 없어 10초마다 500·Slack 알림 발생, 2026-11-04 확인)
- 남김: 중복 방지는 조회 후 저장이라 동시 요청 2건은 함께 통과 (`ponytail:` 주석)

### 결과

| 항목 | 결과 |
|------|------|
| Backend `./gradlew clean build` | 902 passed, JaCoCo instruction 74.64% |
| Frontend | Vitest 153 passed, lint 0 warnings, tsc 통과 |
| Worker `node --test` | 18 passed |
| E2E 전체 | 403 passed, 30 skipped (기존 fixme·skip), 0 failed, 0 did not run |
| 신규·수정 스펙 개별 실행 | agent-queue 20, automation 9, agent-execution 4, agent-batch-execution 2, agent-live-view 2, agent-execution-frame 4 — 전부 통과 |
| 스크린샷 변환 (Docker alpine JRE) | PNG → JPEG 1280px 변환 확인, 변환 실패 로그 0건 |

## Step 2 — 웹 네트워크 + 시나리오 로그

### DB

`V{YYYYMMDDHHmm}__create_agent_network_log.sql`

```sql
CREATE TABLE agent_network_log (
    id               BIGSERIAL PRIMARY KEY,
    job_id           BIGINT      NOT NULL REFERENCES agent_execution_job(id) ON DELETE CASCADE,
    test_case_id     BIGINT      NOT NULL,
    step_order       INT         NOT NULL, -- 0 = 앱 진입·전제조건
    started_at       TIMESTAMP   NOT NULL,
    method           VARCHAR(10) NOT NULL,
    url              TEXT        NOT NULL,
    status           INT,                  -- 요청 실패면 null
    duration_ms      INT,
    failure          TEXT,
    request_headers  JSONB,
    request_body     TEXT,
    response_headers JSONB,
    response_body    TEXT,
    created_at       TIMESTAMP   NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_network_log_job_tc ON agent_network_log(job_id, test_case_id, step_order);
CREATE INDEX idx_agent_network_log_created ON agent_network_log(created_at);
```

### API (`/api/agent-executions`)

| Method | Path | 내용 |
|--------|------|------|
| POST | `/{id}/network` | 워커 일괄 저장 (1회 100건 이하). Job 상태와 무관하게 저장 — 중지된 TC의 로그도 남긴다 |
| GET | `/{id}/network?testCaseId=&stepOrder=` | 목록 (body 제외). `testCaseId` 없으면 Job 전체 |
| GET | `/{id}/network/{logId}` | 상세 (header·body) |

### Worker (`agent-worker/src/network.js` 신규)

- [ ] `index.js:212`: context를 변수로 잡아 캡처 시작
- [ ] 헤더 주입: `context.route`로 `TARGET_API_HOSTS`(기본 baseUrl 호스트) 요청에만 `X-Scenario-Id: T3480`, `X-Scenario-Name: <퍼센트 인코딩>`
- [ ] ❌ `setExtraHTTPHeaders` 금지. 교차 출처 API가 CORS로 막혀 앱이 고장 난 것처럼 보인다 (PoC 확인)
- [ ] 수집: `context.on('request' | 'requestfinished' | 'requestfailed')`, XHR·fetch만
- [ ] TC·Step: `index.js:224` 루프에서 TC 지정, `onProgress`의 `currentStep`으로 Step 지정, 요청 시작 시점 기준
- [ ] body: 텍스트 계열만 100KB까지. `text/event-stream`·바이너리는 저장 안 함. `response.body()` 실패는 무시
- [ ] 마스킹 (전송 전): 헤더 `authorization|cookie|set-cookie|*token*|*api-key*`, JSON·폼·쿼리 키 `pass|pwd|secret|token|card|cvc|cvv|rrn`
- [ ] `NETWORK_CAPTURE_BODY=false`면 body 저장 안 함
- [ ] 3초 또는 50건마다 전송, TC 끝·Job 끝에 flush. 전송 실패는 실행에 영향 없음 (`makeProgressReporter` 방식)

### Backend

- [ ] `AgentNetworkLogEntity`·Repository·DTO, `AgentExecutionService`에 저장·조회 추가
- [ ] `AgentArtifactRetentionScheduler`에 네트워크 로그 추가

### Frontend

- [ ] `AgentNetworkPanel` 신규: 목록(Step·메서드·URL·상태·시간) → 행 클릭 → 요청/응답 상세
- [ ] 필터: Step, 호스트, 4xx·5xx·실패만
- [ ] cURL 복사 (마스킹 값 그대로)
- [ ] Job 상세·TC 상세 탭에 배치, 실행 중이면 3초 폴링
- [ ] Android Job은 "미지원" 표시

### 테스트

- [ ] Worker: `network.test.js` — 마스킹, 호스트 판별, 한글 인코딩
- [ ] Backend: 서비스·Controller 테스트
- [ ] E2E: `qa/api/agent-network.spec.ts`, `qa/ui/agent-network.spec.ts`
- [ ] 실기: 제품 1119 Job 1회 — Step별 로그, `X-Scenario-Id`, 비밀번호 마스킹 확인

### 코드 밖

- [ ] 서버 로그 검색은 대상 서비스가 `X-Scenario-Id`를 로그에 남겨야 가능 → 개발팀 협의

## Step 3 — 병렬 (방식 C)

| | A. 한 Job을 여러 대가 나눠 실행 | B. Job당 1대 | C. 실행 시 N개 Job으로 분할 (확정) |
|---|------|------|------|
| Phase 1개 24 TC (지금 25분) | 약 13~15분 (추정) | 25분 그대로 | 약 13~15분 (추정) |
| Phase 2개 동시 | 가능 | 가능 | 가능 |
| 구조 변경 | TC 단위 점유, 카운터 동시 갱신, 중계를 기기별로, Job 종료 판정 | claim 원자화, 기기 고정 | B + 분할 |
| 목록 표시 | 1줄 | 1줄 | N줄 |
| 약점 | 변경량이 가장 큼 | Phase 시간이 안 줄어듦 | 한쪽이 먼저 끝나면 그 기기가 논다 |

공통 조건:

- M1 16GB, 에뮬레이터 3GB → 2대가 상한
- `demo-ready` 복제본은 같은 계정이라 서버 쪽 상태(최근 검색어 등)가 서로 간섭할 수 있다. 예: T3487 `전체 삭제`
- 토큰 재사용으로 한쪽이 로그아웃되는지 실측 필요

할 일:

- [ ] claim 원자화: `UPDATE ... WHERE id=:id AND status='PENDING'`, 0건이면 409 (`AgentExecutionServiceImpl.java:114`). `claimJob_running_isIdempotent` 테스트 변경
- [ ] 워커: claim 409는 건너뜀 (`index.js:280`). 지금 구조면 다른 워커의 Job을 FAILED로 덮어쓴다
- [ ] `mobile.js:226`: `appium:udid`, `appium:systemPort` 추가. `deviceName`만으로는 첫 기기에 붙는다
- [ ] `index.js` config: `SYSTEM_PORT` 추가
- [ ] 실행 모달에 동시 대수 입력 (최대 = 연결된 워커 수). `POST /`에 `parallelCount` → TC를 N개 Job으로 나눠 생성, 응답 `jobIds`
- [ ] DB: `agent_execution_job.run_group VARCHAR(36)` 추가. 같은 실행의 N개 Job에 같은 값, 목록에서 묶어 표시
- [ ] 실측: 2대로 phase 789 1회, 시간·판정을 Job 38과 비교

기동:

```bash
emulator -avd v24-android34 -read-only -snapshot demo-ready -port 5554
emulator -avd v24-android34 -read-only -snapshot demo-ready -port 5556
ANDROID_DEVICE=emulator-5554 SYSTEM_PORT=8200 node src/index.js --poll
ANDROID_DEVICE=emulator-5556 SYSTEM_PORT=8201 node src/index.js --poll
```

## Step 4 — Android 네트워크

회사 앱 테스트 빌드를 당장 받을 수 없어 공개 테스트 앱으로 구조를 먼저 검증한다. 환경 구성은 Step 1과 병행, 워커 연동은 Step 2 뒤.

| 항목 | 값 |
|------|------|
| 앱 | [`android-ssl-pinning-demo`](https://github.com/httptoolkit/android-ssl-pinning-demo) |
| AVD | `poc-proxy` (`system-images;android-33;google_apis;arm64-v8a`). `v24-android34`·`demo-ready`는 건드리지 않는다 |
| 프록시 | mitmproxy + 시스템 CA |

패스오더는 PoC에 쓰지 않는다. 운영 서버 응답을 풀어 저장하게 된다.

### 환경 구성

- ✅ mitmproxy 12.3.1, API 33 이미지, 테스트 앱 준비
- ✅ AVD `poc-proxy` 생성. 프록시 포트는 8088 (8080은 백엔드)
- ✅ 시스템 CA 주입 (API 33 실측 절차는 아래)
- ✅ 테스트 앱 설치, 버튼별 결과 기록

```bash
# 매번 -writable-system으로 기동해야 CA가 유지된다
mitmdump --listen-port 8088 --set block_global=false -w flows.mitm
emulator -avd poc-proxy -writable-system -no-snapshot -port 5570 -http-proxy http://127.0.0.1:8088

# 최초 1회. 해시 파일은 openssl x509 -inform PEM -subject_hash_old 로 만든다
adb -s emulator-5570 root
adb -s emulator-5570 shell avbctl disable-verification
adb -s emulator-5570 reboot                # 부팅 후 root 재실행
adb -s emulator-5570 remount               # 재부팅 요구 시 reboot → root → remount
adb -s emulator-5570 push ~/.mitmproxy/<hash>.0 /system/etc/security/cacerts/
adb -s emulator-5570 shell chmod 644 /system/etc/security/cacerts/<hash>.0
adb -s emulator-5570 reboot
```

| 버튼 | 결과 |
|------|------|
| PLAIN HTTP, UNPINNED, UNPINNED WEBVIEW, UNPINNED HTTP/3 | 성공 |
| CONFIG·CONTEXT·OKHTTP·VOLLEY·TRUSTKIT PINNED | 실패 (정상) |
| NATIVE CT | 성공 |
| APPMATTUS CT 3종 | 실패 |

연동 시 주의 (PoC 관찰):

- 프록시에 기기 전체 트래픽이 잡힌다. 앱 요청은 약 400건 중 8건 → 대상 호스트 필터 필수
- `-http-proxy` 경유 URL은 IP로 보인다 → `flow.request.pretty_host`로 판별
- HTTP/3 요청의 캡처 여부는 미확인

### 워커 연동 (Step 2 뒤)

- [ ] mitmdump addon: TC별 헤더 주입, 요청/응답 JSONL 기록
- [ ] 워커: JSONL을 읽어 Step 2 마스킹을 거쳐 `POST /{id}/network`
- [ ] TC 2~3개로 Job 실행, Step별 로그·헤더 확인
- [ ] Android Job "미지원" 표시 제거
- [ ] 병렬이면 기기별 프록시 포트 분리

### 회사 앱 전환 (빌드를 받은 뒤)

- [ ] 개발팀 요청: 테스트 빌드 APK, 스테이징 서버, 인증서 고정 해제
- [ ] `poc-proxy`에 설치 후 아래 표로 판정

| 결과 | 의미 | 다음 |
|------|------|------|
| API 요청/응답이 mitmproxy에 평문으로 보이고 앱 정상 | 성공 | 대상 호스트 지정 후 Job 실행 |
| TLS 실패, 앱 네트워크 오류 | 인증서 고정 | 개발팀에 해제 요청 |
| 아무것도 안 보임 | 프록시 미경유 | 기동 옵션 확인 |
| 로그인 불가 | 에뮬레이터 탐지·SMS 인증 | 개발팀 문의, 실기기 검토 |
