# Registry v23 — Jira 티켓 발행 500 에러 (사이트에서 Jira 제품 소실)

> 변경 유형: 버그 수정  
> 작성일: 2026-08-19  
> 버전: v23  
> 상태: 진행 중

---

## 배경 — 왜 필요한가

Notion 버그 리포트 [🐞 Test Fail 후, Ticket 발행 시 500 에러 노출](https://www.notion.so/Test-Fail-Ticket-500-3ba107b270e880d6ae27ef9634112e78) (Scope: Bug · 우선순위: **Highest**).

| 항목 | 내용 |
|------|------|
| 재현 경로 | Product Test Suite > Company `1440` > Product `1119` > Version `764` > Phase `771` → 랜덤 TC를 Fail 처리 → Jira 티켓 발행 모달에서 `티켓 발행` 클릭 |
| Expected | Jira Ticket이 발행되고 모달이 닫힘 |
| Actual | `Jira 연결을 확인하세요: Request failed with status code 500` — 모달이 닫히지 않음 |
| 환경 | **프로덕션** (`youngmi.works`) |

FAIL → Jira 티켓 자동 발행은 registry의 핵심 결함 추적 플로우(`registry.md` L196-198)이고, 현재 **프로덕션에서 완전히 동작하지 않는다.** TC를 Fail로 바꾸는 것 자체는 성공하므로 테스트 결과는 남지만, 결함이 Jira로 넘어가지 않아 추적이 끊긴다.

---

## 스코프

**포함:**
- Jira 연결 복구 — 사이트에 Jira 재부착, 프로젝트 `AT` 재생성
- `jira.issue-type-id` 갱신 (`10042` → `10012`)
- API 토큰 재발급 및 `.env` 교체 (로컬 + EC2)
- 프로덕션에서 Notion 재현 경로 그대로 검증

> `JIRA_BASE_URL`은 **변경 불필요**로 확정됐다. 같은 사이트에 Jira를 다시 붙였기 때문이다.

**제외:**
- 코드 방어 (외부 의존성 예외 매핑, RestTemplate 타임아웃, preflight 연결성 체크, 프론트 에러 메시지 언래핑) → **`registry_v24.md`로 분리**
- `qa/api/ticket.spec.ts`의 500 용인 assertion 교정 → v24
- `.env.example`에 `JIRA_*` 키 추가 → v24

---

## 원인 분석

### 1차 원인 — 사이트에서 **Jira 제품이 제거**됐다

Slack `#aws-logs`에 남은 실제 스택트레이스:

```
org.springframework.web.client.HttpClientErrorException$NotFound:
  404 Not Found on POST request for "https://my-atlas.atlassian.net/rest/api/2/issue":
  "{"errorMessage": "Site temporarily unavailable", "errorCode": "OTHER"}"
    at org.springframework.web.client.RestTemplate.exchange(RestTemplate.java:561)
    at com.myqaweb.feature.JiraServiceImpl.createIssue(JiraServiceImpl.java:57)
    at com.myqaweb.feature.TicketServiceImpl.createTicket
```

직접 검증 (**인증 없이, 루트 URL**):

```
$ curl -sIL https://my-atlas.atlassian.net/
status=404

$ curl -s https://my-atlas.atlassian.net/rest/api/2/serverInfo
<title>Atlassian Cloud Notifications - Page Unavailable</title>
```

인증 헤더 없이 루트 URL을 쳐도 404가 돌아온다. **자격증명 문제라면 401이 떠야 한다** — 즉 API 키 만료가 아니다.

**최종 확인(2026-08-19):** 조직과 사이트는 살아 있었고, **Jira 제품만 사이트에서 빠져 있었다.**
admin 청구 목록에 `Rovo Credits` / `Projects` / `Goals`(모두 Atlassian Home 제품)만 있고 **Jira 구독이 없었다.**
`*.atlassian.net` 호스트네임은 Jira/Confluence가 소유하므로, Jira가 빠지자 그 주소를 서빙할 제품이 없어져
엣지가 `atl-missing-tcs: true`와 함께 404를 반환한 것이다.

> **진단 팁:** `curl https://<site>.atlassian.net/_edge/tenant_info` — **인증 불필요**. cloudId가 나오면 테넌트 존재,
> 빈 404면 테넌트 없음. 자격증명 문제(401)와 사이트/제품 소실(404)을 확실히 구분해준다.

Slack 로그상 동일 에러 발생 이력:

| 발생 시각 (KST) |
|------------------|
| 2026-07-04 11:52 |
| 2026-08-12 00:32 |
| 2026-08-12 13:34 |
| 2026-08-18 16:33 |

`"Site temporarily unavailable"`이라는 문구와 달리 **6주 이상 지속된 영구 상태**다. Jira 관련 코드(`JiraServiceImpl` / `JiraService`)는 2026-04-17 커밋 `576ef47` 이후 변경이 없다 → **코드 리그레션이 아니다.**

### 2차 원인 — 외부 의존성 장애가 500으로 둔갑한다

```
JiraServiceImpl.createIssue:57   restTemplate.exchange(...)      ← try/catch 없음
  └→ HttpClientErrorException$NotFound (uncaught)
     └→ TicketServiceImpl.createTicket:53                        ← catch 없음
        └→ GlobalExceptionHandler:80-85  @ExceptionHandler(Exception.class)
           ├→ log.error("Unexpected error", ex)   → Slack ERROR 알림 발사
           └→ HTTP 500  "Internal server error"
```

`GlobalExceptionHandler`가 매핑하는 예외는 `MethodArgumentNotValidException`(400) · `IllegalArgumentException`(400) · `EntityNotFoundException`(404) · `AccessDeniedException`(403) · `NoResourceFoundException`(404) 뿐이다.
**`RestClientException` / `HttpStatusCodeException` / `IllegalStateException` 핸들러가 없어** 전부 마지막 `Exception.class` 핸들러로 떨어진다. Jira가 응답 본문에 담아 보낸 실제 사유(`errorMessage`)는 로깅조차 되지 않는다.

### 3차 원인 — 백엔드 메시지가 프론트에 도달하지 않는다

```tsx
// frontend/src/pages/features/VersionPhaseDetailPage.tsx:509-511
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Jira 티켓 생성 실패';
  setTicketError(`Jira 연결을 확인하세요: ${msg}`);
}
```

`err.message`는 axios의 기본 문구인 `"Request failed with status code 500"`이다. `response.data.message`를 읽지 않고, `api/client.ts`에도 이를 언래핑하는 인터셉터가 없다. 그래서 사용자에게는 원인을 전혀 알 수 없는 문장만 남는다. 게다가 `Jira 연결을 확인하세요:` 접두사가 **무조건** 붙으므로, summary 누락(400)이나 result 미존재(404)까지 Jira 연결 문제로 오인된다.

### 재발 이력 — 같은 증상이 이미 한 번 "고쳐졌다"

`docs/ops/ops_v20.md`(2026-04-17)가 **완전히 동일한 사용자 증상**을 다뤘다.

| | ops_v20 (2026-04-17) | 이번 v23 (2026-08-19) |
|---|---|---|
| 사용자 증상 | `Jira 연결을 확인하세요: Request failed with status code 500` | **동일** |
| 트리거 | EC2 `.env`에 `JIRA_*` 부재 → 빈 문자열 → `IllegalStateException` | `JIRA_BASE_URL`이 가리키는 사이트 소실 → `HttpClientErrorException` |
| 삼키는 경로 | `GlobalExceptionHandler` 일반 `Exception` 핸들러 → 500 | **동일** |
| 조치 | EC2 `.env` 수정만, **코드 변경 없음** | (이번에도 연결 복구 우선) |

트리거는 달라졌지만 **삼키는 메커니즘이 그대로라 4개월 뒤 똑같은 얼굴로 재발**했다. 연결만 복구하면 세 번째 재발 때 또 같은 화면을 보게 된다 — 그래서 코드 방어를 `registry_v24.md`로 반드시 남긴다.

---

## 구현 절차 (User 승인 단위)

- [x] **Step 1** — ✅ 사이트에 Jira 재부착. `my-atlas.atlassian.net` 복구 확인
      (`tenant_info` → cloudId `3e455159-a323-4257-aa4c-406bff014bb2`, `GET /` → 302, `atl-missing-tcs` 소멸).
      **`JIRA_BASE_URL` 변경 불필요.**
- [x] **Step 2** — ✅ 프로젝트 `AT` 재생성(id 10001). 이슈타입 `버그` = **id 10012** 확인.
      `application.yml:105` `jira.issue-type-id` `"10042"` → `"10012"` 반영.
- [x] **Step 3** — ✅ API 토큰 재발급 + 로컬 `.env` `JIRA_API_KEY` 교체. 인증 200 확인.
- [x] **Step 4** — ✅ 로컬 검증 완료 (아래 [검증 결과] 참조).
- [ ] **Step 5** — EC2 `.env`의 `JIRA_API_KEY` 교체 + `git pull` 후
      `docker compose up -d --force-recreate backend`.
      **`--force-recreate` 필수** — env는 컨테이너 startup 시에만 주입된다.
- [ ] **Step 6** — 프로덕션(`youngmi.works`)에서 Notion 재현 경로 검증 + Slack `#aws-logs` ERROR 미발생 확인.
- [ ] **Step 7** — `registry.md` 버전 히스토리에 v23 추가, 최종 요약 작성, Notion 티켓 Done 처리.

---

## 검증 결과 (Step 4, 2026-08-19)

**변경분:** `backend/src/main/resources/application.yml` 1줄 (`issue-type-id: "10042"` → `"10012"`)

| 단계 | 결과 |
|------|------|
| `./gradlew clean build` | BUILD SUCCESSFUL (55s, 테스트 포함) |
| `docker compose up -d --build` | 백엔드 22초 기동, `status: UP` |
| 컨테이너 Jira env 주입 | `BASE_URL`/`EMAIL`/`API_KEY` 정상 |
| **티켓 발행 (재현 케이스 동일 body)** | **HTTP 201** — `AT-3`, jiraUrl 정상 |
| Jira 실물 | project `AT` / issuetype `버그`(10012) / priority `Medium` / status `해야 할 일` |
| refresh (`getIssueStatus`) | 200, `해야 할 일` |
| E2E 전체 | 393 tests — 365 passed / 3 failed / 25 skipped |

E2E 실패 3건(`ui/kb.spec.ts:296`, `ui/senior.spec.ts:64`, `:123`)은 **이번 변경과 무관**하다.
변경분이 `jira.issue-type-id` 한 줄이라 KB·Senior에 영향을 줄 경로가 없다.
`api/ticket.spec.ts` 5건은 전부 통과했고, 그중 `:135`는 201 분기를 타서 **실제 Jira 이슈 생성을 검증**했다.

> ⚠️ E2E 첫 실행은 `qa/node_modules` 부재로 **한 건도 실행되지 않았는데 exit 0이 떴다.**
> `npm install` + Node 20(로컬 기본은 v18)으로 재실행해야 실제 결과가 나온다.

---

## 리스크 — 검증 결과

| 리스크 | 판정 |
|--------|------|
| `issue-type-id` 하드코딩 | ❌ **현실화** — `10042`는 새 인스턴스에 없었다. `10012`로 갱신 완료 |
| 우선순위 이름 불일치 | ✅ **해소** — 인스턴스 우선순위가 `Highest/High/Medium/Low/Lowest`(영문)라 `toJiraPriorityName` 그대로 동작 |
| team-managed 프로젝트의 priority 필드 | ✅ **해소** — `AT`가 team-managed(next-gen)로 생성돼 `createmeta`에 `priority`가 안 나오지만, **실제로 전송하면 저장된다**(실측). company-managed 재생성 불필요 |
| `.env.example`에 `JIRA_*` 전무 | ❌ 미해결 → v24 |
| CI가 버그를 용인 | ❌ 미해결 — `qa/api/ticket.spec.ts:135`는 500으로 회귀해도 통과 → v24 |
| 연결 복구만으로는 재발 방지 안 됨 | ❌ 미해결 → **v24 필수** |

### 이번 작업 중 새로 발견한 것

| 발견 | 내용 | 처리 |
|------|------|------|
| `isDoneStatus()` 한글 미대응 | Jira가 상태명을 한글로 반환(`해야 할 일`)하는데 `TicketServiceImpl:180-184`는 영문 `DONE/CLOSED/RESOLVED`만 검사 → **티켓 종료 감지·재오픈 카운트가 영원히 미동작** | v24 |
| E2E가 Jira에 실 이슈를 남김 | `deleteTicket:80-82`가 DB 레코드만 지우고 Jira 이슈는 안 지운다 → E2E 실행마다 실 Jira에 이슈 누적 | v24 |
| `/rest/api/2/search` 410 제거 | Atlassian이 삭제(→ `/rest/api/3/search/jql`). 앱 코드는 `POST /issue`·`GET /issue/{key}`만 쓰므로 **영향 없음** | 기록만 |
| 티켓 UI E2E 2건 skip | `ui/version.spec.ts:503,537`이 `if (!phaseId) test.skip()`으로 건너뛴다 → FAIL→다이얼로그 경로가 UI에서 미검증 | v24 |

---

## 참조

- [registry_v15.md](./registry_v15.md) — Jira 티켓 연동 최초 구현 ("Test Result가 Fail일 경우 Ticket 발행")
- [registry.md](./registry.md) — 마스터 명세 (L196-198 FAIL → Jira 자동 티켓 생성, L465 API 표)
- [../../ops/ops_v20.md](../../ops/ops_v20.md) — 동일 증상 1차 발생 및 `.env` 단독 조치 (2026-04-17)
- `registry_v24.md` — 후속: 외부 의존성 예외 매핑 · 타임아웃 · preflight · 프론트 메시지 언래핑 (상태: 예정)
- Notion 버그 리포트: https://www.notion.so/Test-Fail-Ticket-500-3ba107b270e880d6ae27ef9634112e78
