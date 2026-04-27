> 변경 유형: 기능 추가
> 작성일: 2026-04-23
> 버전: v24
> 상태: 구현 완료 (배포 전)

---

# Ops v24 — 서버 에러 Slack 실시간 알림

## 1. 배경

### 현재 문제
- AWS EC2 에서 500 에러나 ERROR 로그 발생 시 **아무도 모름**
- CI/CD Slack 알림은 있지만, **런타임 에러 알림은 전무**
- 장애 인지 시점 = 유저가 직접 발견할 때 (너무 늦음)
- 2026-04-23 drift 사고가 단적인 예 — 프로드가 Platform v8 에 6 일간 멈춰있었지만 실시간 알림이 없어 유저가 발견할 때까지 전혀 인지 못함

### 목표
- ERROR 레벨 로그 발생 즉시 Slack 알림
- HTTP 500 뿐 아니라 백그라운드 작업(PDF 처리, AI 호출 등) 에러도 포착
- 비용 $0, 인프라 추가 없이 애플리케이션 레벨에서 해결

---

## 2. 접근 방식 비교

| 방식 | 비용 | 커버리지 | 실시간성 | 복잡도 |
|------|------|----------|----------|--------|
| **✅ Logback Appender** | $0 | 모든 ERROR | 즉시 | 낮음 |
| CloudWatch + SNS | $5-15/월 | 모든 ERROR | 1-2 분 | 높음 |
| Cron 로그 감시 | $0 | 모든 ERROR | cron 간격 | 중간 |
| AOP/Filter | $0 | HTTP 500 만 | 즉시 | 중간 |

**선택: Logback Slack Appender**
- `GlobalExceptionHandler` 에서 `log.error()` 로 모든 500 을 잡고 있음
- 비동기 PDF 처리, AI API 호출 실패 등 백그라운드 에러도 모두 ERROR 로그로 찍힘
- → Logback ERROR 레벨만 잡으면 100% 커버

---

## 3. 아키텍처

```
[Spring Boot Application]
    │
    │  log.error("message", exception)
    ▼
[Logback ROOT Logger]
    ├── CONSOLE (기존)
    ├── FILE (기존, backend.log)
    ├── JSON_FILE (기존, backend-json.log)
    └── SLACK (신규, SlackLogbackAppender)
         │  ERROR 레벨만 필터
         ▼
[SlackNotifierService]
    │  ├─ Rate Limit: 분당 5 건
    │  ├─ Dedup: 동일 메시지 5 분 차단
    │  └─ 비동기 전송 (daemon thread)
    ▼
[Slack Incoming Webhook]
    │
    ▼
[#alerts 채널]
```

---

## 4. 구현 상세

### 4.0 선행 조치 — NoResourceFoundException 강등 (Step 0)

**문제**: `GlobalExceptionHandler.handleGeneralException` 이 `NoResourceFoundException` 까지 `log.error()` 로 기록.
인터넷 노출 서버는 PHPUnit RCE probe, `/actuator/env` enumeration 같은 봇 스캔이 상시 들어옴.
그대로 두면 Slack Appender 가 등록된 즉시 봇 스캔마다 Slack 도배.

**조치**: `NoResourceFoundException` 전용 핸들러 추가 — `log.warn()` + 404 응답.

```java
@ExceptionHandler(NoResourceFoundException.class)
public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
    log.warn("No static resource: {}", ex.getResourcePath());
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.error("Not found"));
}
```

### 4.1 신규 파일

| 파일 | 역할 |
|------|------|
| `config/slack/SlackNotifierService.java` | Webhook POST + rate limit + dedup + 비동기 executor |
| `config/slack/SlackLogbackAppender.java` | Logback AppenderBase → Service 브릿지 |
| `config/slack/SlackAppenderRegistrar.java` | ApplicationReady 이벤트에서 ROOT logger 에 appender attach |

### 4.2 SlackNotifierService 핵심 로직

```java
@Component
public class SlackNotifierService {
    static final int MAX_PER_MINUTE = 5;
    static final Duration DEDUP_WINDOW = Duration.ofMinutes(5);
    static final int STACK_TRACE_MAX = 1000;

    private final String webhookUrl;
    private final boolean enabled;

    private final AtomicInteger minuteCounter = new AtomicInteger(0);
    private final AtomicReference<Instant> minuteResetAt;
    private final Map<String, Instant> recentErrors = new ConcurrentHashMap<>();

    private final HttpClient httpClient;
    private final ExecutorService executor;  // daemon single thread
    private final ObjectMapper objectMapper;

    public SlackNotifierService(@Value("${slack.webhook.url:}") String webhookUrl,
                                ObjectMapper objectMapper) { ... }

    public void notify(String loggerName, String message, String stackTrace) {
        if (!enabled) return;
        if (!acquireSlot()) return;
        if (isDuplicate(loggerName, message)) return;
        executor.submit(() -> sendSafely(loggerName, message, stackTrace));
    }
}
```

피드백 루프 방지: `sendSafely` 의 실패 경로는 `log.warn()` 만 사용 (`log.error` 금지 — Slack appender 재귀 호출).

### 4.3 Slack 메시지 포맷

```
🚨 *ERROR* on `my-qa-web`
*Logger:* `com.myqaweb.senior.SeniorService`
*Message:* Failed to call Claude API: timeout
```java
java.net.SocketTimeoutException: Read timed out
    at sun.nio.ch.SocketChannelImpl.read(...)
    ... (1000 자 초과 시 truncated)
```
```

### 4.4 설정 (코드 변경)

`application.yml` — 이미 존재하는 `slack.webhook.url` 키 재사용 (AI 사용량 알림과 공유):

```yaml
slack:
  webhook:
    url: ${SLACK_WEBHOOK_URL:}
```

`docker-compose.yml` — backend 서비스 environment 블록에 pass-through 추가:

```yaml
environment:
  ...
  JIRA_API_KEY: ${JIRA_API_KEY}
  SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
  SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"
```

---

## 5. 안전장치

| 장치 | 설명 |
|------|------|
| Rate Limit | 분당 최대 5 건 (폭주 방지) |
| Dedup | 같은 logger+message 5 분 내 중복 차단 |
| 비동기 | daemon thread, 로그 호출에 영향 없음 |
| Graceful 비활성 | URL 미설정 시 early return (로컬 개발 영향 없음) |
| Failure 무시 | Slack 전송 실패해도 앱에 영향 없음 |
| 피드백 루프 차단 | `sendSafely` 실패 경로는 `log.warn` 만 사용 (`log.error` 금지) |
| Stack trace 절삭 | 1000 자 초과 시 truncate |
| 봇 스캔 노이즈 제거 | Step 0 — `NoResourceFoundException` → WARN 404 로 강등 |

---

## 6. 유저 배포 절차

### Step A: Slack Webhook 생성
1. Slack App 생성 (또는 기존 앱) 에 Incoming Webhook 추가
2. 알림 받을 채널 선택 (예: `#my-atlas-alerts`)
3. Webhook URL 복사

### Step B: EC2 환경변수 추가
```bash
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
# .env 파일에 SLACK_WEBHOOK_URL 추가 (또는 이미 있는 AI 사용량 알림 키 재사용)
echo 'SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx' >> ~/my-atlas/.env
```

### Step C: 재배포
- 이 PR 머지 시 `e2e.yml` 이 deploy-backend 자동 실행 → 새 환경변수로 재기동
- 수동 재배포가 필요하면:
  ```bash
  cd /home/ec2-user/my-atlas
  git pull origin main
  docker compose up -d --build --force-recreate backend
  ```

---

## 7. 검증 방법

### 로컬 검증 (Agent-D)
| 항목 | 방법 |
|------|------|
| 빌드 | `cd backend && ./gradlew clean build` 통과 |
| 단위 테스트 | `SlackNotifierServiceTest`, `SlackLogbackAppenderTest`, `GlobalExceptionHandlerTest` 통과 |
| 비활성 모드 | `SLACK_WEBHOOK_URL` 없이 기동 → `SlackNotifierService.enabled=false`, 에러 없이 정상 동작 |

### 프로드 검증 (배포 후 유저)
| 항목 | 방법 |
|------|------|
| 비활성 → 활성 전환 | `.env` 에 URL 추가 → 컨테이너 재기동 → Slack 에서 단일 test 메시지 수신 확인 |
| 알림 수신 | 의도적 ERROR 유발 (예: admin 전용 경로에 잘못된 요청) → Slack 수신 확인 |
| Rate limit | 1 분 내 의도적 10 건 ERROR → 5 건만 수신 확인 |
| Dedup | 동일 에러 반복 → 5 분 내 1 건만 수신 확인 |
| 봇 스캔 무시 | `/actuator/env` 같은 존재하지 않는 경로 요청 → Slack 에 알림 안 옴 (WARN 으로 강등됨) |

---

## 8. Step 진행 체크리스트

- [x] Step 0 — `NoResourceFoundException` → WARN 404 분리
- [x] Step 1 — `SlackNotifierService` 구현
- [x] Step 2 — `SlackLogbackAppender` 구현
- [x] Step 3 — `SlackAppenderRegistrar` 구현
- [x] Step 4 — 설정 (`application.yml` 재사용, `docker-compose.yml` 업데이트)
- [x] Step 5 — 단위 테스트 (3 개 테스트 클래스)
- [x] Step 6 — ops_v24.md 업데이트 (이 문서)
- [ ] Step 7 — Agent-D 빌드/테스트 검증
- [ ] Step A~C — 유저 배포 (PR 머지 + EC2 `.env` 세팅)

---

## 9. 향후 확장 (이 v24 범위 밖, 후보)

- WARN 레벨 별도 채널 전송 (e.g. `#my-atlas-warnings`)
- Block Kit 포맷으로 시각화 개선 (색상, 섹션 블록)
- 에러 빈도 통계 (시간당 에러 수 추이)
- CloudWatch Logs Agent 연동

---

## 10. 최종 요약

2026-04-23 세션에서 ops v23(로컬 DB → 프로드 마이그레이션) 와 함께 같은 세션에서 구현 완료.

- 신규 파일 3 개 (`config/slack/*`) + `GlobalExceptionHandler` 핸들러 1 개 추가
- 단위 테스트 3 개 파일 (18 cases)
- `application.yml` 은 기존 `slack.webhook.url` 키 재사용 (AI 사용량 알림과 공유)
- `docker-compose.yml` 양쪽(메인+worktree) SLACK_WEBHOOK_URL env pass-through 추가

코드 레벨 구현 끝. 나머지는 유저가 PR 머지 + EC2 `.env` 에 Slack Webhook URL 추가하면 자동 활성.
