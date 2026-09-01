# ops v36 — api_access_log 정리 (폴링 로그 제외 + 보존 정책)

> 변경 유형: 환경 개선
> 작성일: 2026-09-01
> 버전: v36
> 상태: 구현 완료 (기존 누적분 정리는 User 실행 대기)

---

## 1. 배경

운영 서버 접근 현황을 점검하다 `api_access_log` 테이블이 **하루 29,000행씩 무한 증가**하는 것을 발견했다.

원인은 두 가지가 겹친 것이다.

1. `agent-worker`가 `POLL_INTERVAL_MS=3000`으로 **3초마다** `GET /api/agent-executions`를 호출한다
2. `ApiAccessLogFilter`가 `/api/**` 전체를 예외 없이 기록한다

### 1-1. 핵심 — 이 데이터를 읽는 쪽이 없다

`ApiAccessLogRepository`의 소비자 쿼리는 2개뿐인데, 둘 다 이 데이터를 원하지 않는다.

| 쿼리 | worker 행 취급 |
|---|---|
| `countByFeature` | `WHERE feature IS NOT NULL` — `/api/agent-executions`는 `URI_FEATURE_MAP`에 없어 `feature=null`이므로 **이미 100% 제외되고 있다** |
| `topEndpoints` | `GROUP BY method, uri ORDER BY cnt DESC LIMIT 20` — worker 행이 순위를 독점해 **"인기 엔드포인트" 통계를 오염시키고 있다** |

즉 전체의 95%가 **한쪽에서는 버려지고 다른 쪽에서는 결과를 망치는 중**이다.
저장할 이유가 없으므로 애초에 쌓지 않는 것이 해법이다.

### 1-2. 실측 (2026-08-31 기준)

| 항목 | 값 |
|---|---|
| 전체 | 594,758행 / 133MB / 2026-04-20~ |
| worker 행 | 564,461행 (**95%**) |
| 일일 증가 | 29,000행 ≈ 6.8MB |
| 오늘 내역 | 총 19,747행 중 worker 17,508행 |
| 조치 후 예상 | 약 2,239행/일 ≈ 0.5MB |

### 1-3. 디스크는 위험하지 않다

| 항목 | 값 |
|---|---|
| EC2 디스크 | 30GB 중 16GB 사용, **15GB 여유 (53%)** |
| DB 전체 | 168MB (그중 `api_access_log` 133MB) |
| 이 테이블만으로 15GB를 채우는 데 걸리는 시간 | 약 6년 |

**이 작업의 목적은 용량 확보가 아니라 통계 신뢰도 회복과 무한 증가 차단이다.**

> 참고: 실제 디스크를 점유하는 것은 이 테이블이 아니라 `/var/lib/docker`(14GB)다.
> Docker build cache 4.33GB(전량 회수 가능) + dangling 이미지 2.15GB(배포 1회당 약 400MB 적립) +
> journald 1.7GB(`SystemMaxUse` 미설정). **이번 범위 밖이며 별도 판단이 필요하다.**

---

## 2. 설계

### 2-1. 폴링 GET만 제외한다

`shouldNotFilter()`에 제외 조건을 추가하되 **GET만** 걸러낸다.

| 메서드 | 경로 | 로그 |
|---|---|---|
| GET | `/api/agent-executions**` | ❌ 제외 — 3초마다 반복되는 폴링, 통계 가치 없음 |
| POST | `/api/agent-executions/{id}/claim` | ✅ 유지 |
| POST | `/api/agent-executions/{id}/results` | ✅ 유지 |
| POST | `/api/agent-executions/{id}/complete` | ✅ 유지 |

POST는 **실제 실행 이력**이라 반드시 남겨야 추적이 된다. 현재 이 POST들은 극소수라 통계를 오염시키지 않는다.

### 2-2. 보존 정책은 롤백 가능한 플래그로 둔다

`kb.pdf.cleanup.enabled`와 같은 패턴을 따라, 코드 배포 없이 중단할 수 있게 한다.

```yaml
monitoring:
  access-log:
    retention:
      # v36: 오래된 API 접근 로그 자동 삭제. false 로 두면 삭제하지 않는다.
      enabled: ${ACCESS_LOG_RETENTION_ENABLED:true}
      days: ${ACCESS_LOG_RETENTION_DAYS:90}
```

스케줄러는 `statistics/SnapshotScheduler.java` 패턴을 그대로 따른다.
`@EnableScheduling`은 `MyQaWebApplication`에 이미 있어 추가 설정이 필요 없다.
실행 시각은 스냅샷 스케줄러(`0 0 0 * * *`)와 겹치지 않게 `0 30 3 * * *`로 둔다.

### 2-3. ⚠️ DB 삭제 규칙에 대한 근거

CLAUDE.md의 **"스키마 변경 없는 작업에서 DB 데이터 삭제 금지"** 에 해당하는 변경이므로 근거를 남긴다.

- 대상은 `api_access_log` **하나뿐**이다. 보호 대상인 `knowledge_base` / `pdf_upload_job`은 **일절 건드리지 않는다**
- 대시보드 쿼리 2개가 모두 `created_at BETWEEN :from AND :to` 범위 기반이라 90일 보존으로 **기능 영향이 없다**
- 90일은 기본값이고 환경변수로 조정·비활성화할 수 있다
- **이미 쌓인 누적분은 Claude가 삭제하지 않는다** (§4)

---

## 3. 실행 절차

### Step 1 — 문서 정리

- [x] 1-1. 기존 `ops_v36.md`(prod ↔ dev 왕복 파이프라인) 삭제
  - 핵심 산출물 `scripts/sync-product-from-aws.sh`가 레포에 없음 (커밋된 적 없음)
  - Step 1~3 체크리스트 전부 미완 (`/images` 프록시 없음, `uploads` 마운트 없음, `backups/` 없음)
  - 참조하는 문서 없음 → 삭제 안전. 미해결 이슈 2건은 §6으로 이월
- [x] 1-2. 본 문서 작성

### Step 2 — 폴링 GET 제외 (Agent-A)

- [x] 2-1. `ApiAccessLogFilter`에 `POLLING_GET_PREFIXES` 상수 추가 (기존 `URI_FEATURE_MAP` 스타일 유지)
- [x] 2-2. `shouldNotFilter()`에 GET 한정 제외 조건 추가

### Step 3 — 보존 정책 (Agent-A)

- [x] 3-1. `ApiAccessLogRepository`에 `deleteOlderThan(cutoff)` 추가 (`@Modifying` + nativeQuery)
- [x] 3-2. `AccessLogRetentionScheduler` 신규 작성 (`SnapshotScheduler` 패턴)
- [x] 3-3. `application.yml`에 `monitoring.access-log.retention.*` 추가

### Step 4 — 단위 테스트 (Agent-B)

- [x] 4-1. `ApiAccessLogFilterTest`에 케이스 추가
  - `GET /api/agent-executions` → `save()` 호출 안 됨
  - `GET /api/agent-executions/123` → 호출 안 됨
  - `POST /api/agent-executions/123/claim` → **호출됨** (이력 보존)
  - `GET /api/test-cases` → 호출됨 (회귀 방지)
- [x] 4-2. `AccessLogRetentionSchedulerTest` 신규
  - `enabled=true` → `deleteOlderThan()` 호출, cutoff를 `ArgumentCaptor`로 검증
  - `enabled=false` → 호출되지 않음

### Step 5 — E2E (Agent-C)

- [x] 5-1. 에이전트 실행 플로우 회귀 확인 (`qa/ui/agent-execution.spec.ts` 기존 파일 활용)
- [x] 5-2. 모니터링 대시보드가 여전히 데이터 반환하는지 확인

> 셀렉터는 추측 금지. 대상 TSX를 반드시 Read 후 작성한다.

### Step 6 — Agent-D 검증

- [x] 6-1. `cd backend && ./gradlew clean build`
- [x] 6-2. `docker compose up -d --build && sleep 10`
- [x] 6-3. `cd qa && npx playwright test` (필터 없이 전체 실행)
- [x] 6-4. `docker compose down` (무조건 실행, `agent-worker`는 `--profile worker` 필요)

**판정 규칙**: "0 failed"만으로 성공 선언하지 않는다. "did not run"이 있으면 원인을 조사하고,
새로 추가한 테스트는 개별 지정 실행으로 실제 동작을 확인한다.

---

## 3-A. 검증 결과 (2026-09-01 실측)

### 단위 테스트 — 21건 전부 통과, skip 0

| 파일 | 결과 |
|---|---|
| `ApiAccessLogFilterTest` | 16건 (기존 8 + 신규 8) 전부 통과 |
| `AccessLogRetentionSchedulerTest` | 5건 전부 통과 |

### E2E — 제 변경으로 인한 회귀 없음

동일 조건(전체 스위트)에서 기준선과 대조했다.

| 대상 | passed | skipped | failed |
|---|---|---|---|
| `origin/develop` (기준선) | 368 | 25 | 3 |
| `feature/access_log` | 368 | 25 | 3 |

**결과가 정확히 일치한다.** 정의된 396건이 전부 계정되며 "did not run"은 없다.
skip 25건은 전부 기존 `test.fixme()` / 조건부 skip이다.

잔존 실패 3건(`ui/kb.spec.ts:296`, `ui/senior.spec.ts:64`, `ui/senior.spec.ts:123`)은
**develop에서도 동일하게 실패**하므로 이번 변경과 무관하다. 다만 develop의 CI e2e는
계속 green이라 **로컬 환경 특유의 실패**로 보이며, 원인은 senior/kb 도메인 사안이라
이번 범위에서 다루지 않는다. (§6 참조)

> Agent-D 1차 실행에서 `ui/convention.spec.ts:238`이 추가로 실패했으나,
> 동일 코드 재실행에서 통과해 **flaky**로 판정했다. develop에서도 통과한다.

### E2E 스펙 자체의 판별력 검증

작성된 `qa/api/access-log.spec.ts`가 **수정 여부와 무관하게 통과**하는 문제가 있어 고쳤다.

원인은 `topEndpoints`가 `ORDER BY count DESC LIMIT 20`이라는 점이다. 폴링을 5회만 치면
로그가 기록되더라도 20위 문턱(실측 **51**) 아래라 창에 못 들어와 관측되지 않는다.
실제로 초기 버전은 **수정 없는 develop 백엔드에서도 3/3 통과**했다.

현재 창의 20위 값을 읽어 그보다 많이 호출하도록 바꾼 뒤 양쪽에서 실증했다.

| 백엔드 | 결과 |
|---|---|
| `origin/develop` (미수정) | ❌ 실패 — `count rose from 0 after 56 polling calls (20th place was 51)` |
| `feature/access_log` (수정) | ✅ 3/3 통과 |

---

## 4. 기존 누적분 정리 — User가 직접 실행

이미 쌓인 564,461행은 **Claude가 삭제하지 않는다.** 운영 DB 삭제이므로 SQL만 제공한다.

```sql
-- 1) 실행 전 건수 확인
SELECT count(*) FROM api_access_log
 WHERE method = 'GET' AND uri LIKE '/api/agent-executions%';

-- 2) 삭제 (약 564,000행)
DELETE FROM api_access_log
 WHERE method = 'GET' AND uri LIKE '/api/agent-executions%';

-- 3) 통계 갱신
VACUUM ANALYZE api_access_log;
```

> ⚠️ `VACUUM FULL`을 쓰지 않는다. 테이블 전체 잠금이 걸려 운영 중 API가 멈춘다.
> 디스크 실물 반환이 필요하면 트래픽 없는 시간에 별도로 판단한다.

---

## 5. 검증 (배포 후 실측)

조치 효과는 **다음 날 운영 DB에서 직접 확인**한다.

```sql
-- 일자별 증가량: 조치일 이후 하루 2,000행대로 떨어져야 한다
SELECT created_at::date AS day,
       count(*) AS rows,
       count(*) FILTER (WHERE uri LIKE '/api/agent-executions%') AS agent_rows
  FROM api_access_log
 WHERE created_at > now() - interval '7 days'
 GROUP BY 1 ORDER BY 1 DESC;

-- topEndpoints 정상화: worker 폴링이 1위에서 사라져야 한다
SELECT method, uri, count(*) FROM api_access_log
 WHERE created_at > now() - interval '1 day'
 GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;
```

**기대값**: `agent_rows`가 POST 몇 건 수준으로만 남고, 일일 총 행수가 29,000 → 2,200 근처.

---

## 6. 이번 범위에서 제외한 것

| 항목 | 내용 | 사유 |
|---|---|---|
| 폴링 간격 상향 | `POLL_INTERVAL_MS` 3초→15초 | Step 2로 로그 문제는 해소됨. 운영 재기동(`--force-recreate`)과 잡 픽업 지연이 따로 붙는 사안 |
| 동기 INSERT 제거 | `logAccessAsync`가 이름과 달리 request thread에서 `repository.save()`를 실행. 모든 API 요청이 응답 전 INSERT 1회를 기다린다 | `@Async`+`@Transactional` 주의사항(비동기 스레드가 uncommitted row를 못 봄)에 걸려 설계 검토 필요 |
| `username` 99.1% null | 594,758행 중 5,084행만 채워짐. 필터 체인상(`jwt → dynamicPublicAccess → aiRateLimit → apiAccessLog`) 정상이어야 하는데 null | `DynamicPublicAccessFilter` / `login_required` 설정 확인이 선행되어야 함. **원인 미확인** |
| Docker/journald 용량 | build cache 4.33GB, dangling 이미지 2.15GB, journald 1.7GB 상한 미설정 | 인프라 정리 사안으로 별도 버전에서 다룸 |
| E2E 실패 3건 | `ui/kb.spec.ts:296`, `ui/senior.spec.ts:64`, `ui/senior.spec.ts:123` — develop에서도 동일 실패하나 develop CI e2e는 green. 로컬 환경 특유 실패로 보임 | senior/kb 도메인 사안. **quarantine 하지 않았다** — CI에서 통과하는 테스트를 죽이게 되므로 |

### 6-1. 구 ops_v36에서 이월된 미해결 이슈

삭제한 문서 §2에 기록돼 있던 **레포에 아직 남아있는 실제 버그 2건**. 이번 작업 범위는 아니다.

1. **로컬 이미지 전량 404** — `TestCaseImageUrlResolver`가 `/images/feature/{filename}` 상대경로를 반환하는데
   `frontend/vite.config.ts`는 `/api`만 프록시한다. 백엔드에 `/images/**` 핸들러가 있어도 Vite가 넘기지 않는다
2. **로컬 업로드 파일 휘발** — `docker-compose.yml`의 backend 볼륨에 `./backend/uploads:/app/uploads` 마운트가 없어,
   로컬에서 올린 이미지가 컨테이너 수명과 함께 사라진다

---

## 7. 변경 파일

| 구분 | 경로 |
|---|---|
| 수정 | `backend/src/main/java/com/myqaweb/monitoring/ApiAccessLogFilter.java` |
| 수정 | `backend/src/main/java/com/myqaweb/monitoring/ApiAccessLogRepository.java` |
| 신규 | `backend/src/main/java/com/myqaweb/monitoring/AccessLogRetentionScheduler.java` |
| 수정 | `backend/src/main/resources/application.yml` |
| 수정 | `backend/src/test/java/com/myqaweb/monitoring/ApiAccessLogFilterTest.java` |
| 신규 | `backend/src/test/java/com/myqaweb/monitoring/AccessLogRetentionSchedulerTest.java` |
| 삭제 → 재작성 | `docs/ops/ops_v36.md` |

**마이그레이션 파일 없음** — 스키마 변경이 없다.

---

## 8. 버전 히스토리

| 버전 | 날짜 | 내용 |
|------|------|------|
| v36 (구) | 2026-08-20 | prod ↔ dev 왕복 파이프라인 설계 — 중단, 2026-09-01 삭제 |
| v36 | 2026-09-01 | api_access_log 폴링 로그 제외 + 90일 보존 정책 (구현·검증 완료) |

---

## 9. 최종 요약

`api_access_log`의 무한 증가를 **원인 지점에서** 차단했다. 데이터를 지워 대응하는 대신,
읽는 쪽이 없는 데이터를 애초에 쓰지 않도록 바꾼 것이 이번 작업의 핵심이다.

### 반영된 변경

| 구분 | 내용 |
|---|---|
| 필터 | GET `/api/agent-executions**`를 기록 대상에서 제외. POST(claim/results/complete)는 유지 |
| 스케줄러 | 매일 03:30, 90일 경과 행 삭제. 환경변수로 비활성화 가능 |
| 안전장치 | `retentionDays <= 0`이면 삭제하지 않음 (설정 실수로 전체 삭제 방지) |
| 테스트 | 단위 21건 + E2E 3건 |

### 예상 효과

하루 **29,000행 → 약 2,200행**. 90일 보존이 붙으므로 약 50MB 수준에서 평형을 이룬다.
현재는 133MB에서 무한 증가 중이다.

### 이번 작업에서 건진 것 두 가지

**1. 프록시 self-invocation 함정** — `@Scheduled`가 같은 클래스의 `@Transactional` 메서드를
호출하면 프록시를 우회해 트랜잭션이 걸리지 않는다. 컴파일·단위테스트·E2E를 전부 통과하고
운영에서만 실패한다. 리뷰에서 잡아 커밋 전에 수정했고, 탐지 규칙을
`docs/qa/bugs/spring-proxy-self-invocation.md`에 남겼다.

**2. 통과하지만 아무것도 검증하지 않는 E2E** — 처음 작성한 `access-log.spec.ts`는
`topEndpoints`의 `LIMIT 20` 때문에 수정 여부와 무관하게 통과했다. 미수정 백엔드에서
그대로 통과하는 것을 확인하고 나서야 드러났다. **"테스트가 통과한다"와 "테스트가 무언가를
검증한다"는 다르다** — 새 회귀 테스트는 고쳐야 할 코드에서 실제로 실패하는지 확인해야 한다.

### 남은 일

- 기존 누적 564,461행 정리 — **User가 §4의 SQL을 직접 실행**
- 배포 다음 날 §5의 쿼리로 일일 증가량이 실제로 떨어졌는지 실측
