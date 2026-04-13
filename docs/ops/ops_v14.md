> 변경 유형: 환경 개선  
> 작성일: 2026-04-13  
> 버전: v14  
> 상태: 진행 중

---

# 로깅 개선 + 빌드 품질 게이트 + 환경 변수 정리

## 1. 배경

ops-issues.md의 미해결 이슈 중 즉시 실행 가능한 3개 번들을 묶어 환경 개선을 진행한다.

| 번들 | 대상 이슈 | 핵심 목표 |
|------|-----------|-----------|
| A. 로깅 개선 | #8 로그 로테이션, #4 로그 JSON 포맷 | 디스크 풀 예방 + 로그 파싱 가능 |
| B. 빌드 품질 게이트 | #6 JaCoCo | Backend 코드 커버리지 측정/강제 |
| C. 환경 변수 정리 | #7 API URL 하드코딩 | IP 하드코딩 제거, 환경별 분리 |

---

## 2. 현재 상태

### 2-1. 로깅 (`logback-spring.xml`)

- `FileAppender` 사용 — 파일이 무한히 커짐, 로테이션 없음
- 세션별 파일명 (`backend_{SESSION_TS}.log`) — 오래된 파일 자동 삭제 없음
- 텍스트 포맷 — 로그 집계/검색 시 파싱 필요
- JSON 로깅 의존성(`logstash-logback-encoder`) 없음

### 2-2. JaCoCo (`build.gradle` + `backend-ci.yml`)

- `build.gradle`에 JaCoCo 플러그인 미등록
- `backend-ci.yml`에 JaCoCo 스텝 3개 주석 처리 상태 (커버리지 리포트, 70% 검증, Codecov 업로드)
- 179개 테스트가 있지만 커버리지 수치 미측정

### 2-3. API URL 하드코딩

| 파일 | 하드코딩 값 | 용도 |
|------|------------|------|
| `e2e.yml:233` | `http://3.34.154.147:8080` | 프로덕션 배포 시 프론트엔드 빌드 |
| `e2e.yml:100` | `http://localhost:8080` | E2E 테스트 환경 |
| `frontend-ci.yml:55` | `http://localhost:8080` | CI 빌드 |
| `frontend-ci.yml:100` | `http://backend:8080` | Docker 빌드 |
| `WebConfig.java:13` | `http://3.34.154.147:*` | CORS 허용 origin |

---

## 3. 구현 계획

### Step 1: 로그 로테이션 적용 (#8)

**변경 파일:** `backend/src/main/resources/logback-spring.xml`

- `FileAppender` → `RollingFileAppender` 변경
- `SizeAndTimeBasedRollingPolicy` 적용 (일별 로테이션 + 100MB 단위 분할)
- `maxHistory: 30` (30일 보관 후 자동 삭제)
- `totalSizeCap: 1GB` (전체 로그 최대 용량)

```xml
<!-- Before -->
<appender name="FILE" class="ch.qos.logback.core.FileAppender">
    <file>${LOG_DIR}/backend_${SESSION_TS}.log</file>
    ...
</appender>

<!-- After -->
<appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>${LOG_DIR}/backend.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
        <fileNamePattern>${LOG_DIR}/backend.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
        <maxFileSize>100MB</maxFileSize>
        <maxHistory>30</maxHistory>
        <totalSizeCap>1GB</totalSizeCap>
    </rollingPolicy>
    ...
</appender>
```

### Step 2: 로그 JSON 포맷 추가 (#4)

**변경 파일:** `backend/build.gradle`, `backend/src/main/resources/logback-spring.xml`

- `logstash-logback-encoder` 의존성 추가
- JSON 전용 `RollingFileAppender` 추가 (기존 텍스트 appender 유지)
- 텍스트 로그(사람 읽기용) + JSON 로그(기계 파싱용) 병행 출력

```xml
<appender name="JSON_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>${LOG_DIR}/backend-json.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
        <fileNamePattern>${LOG_DIR}/backend-json.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
        <maxFileSize>100MB</maxFileSize>
        <maxHistory>30</maxHistory>
        <totalSizeCap>1GB</totalSizeCap>
    </rollingPolicy>
    <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
</appender>
```

### Step 3: JaCoCo 플러그인 추가 (#6)

**변경 파일:** `backend/build.gradle`

- `id 'jacoco'` 플러그인 등록
- `jacocoTestReport` task 설정 (HTML + XML 리포트)
- `jacocoTestCoverageVerification` task — 최소 70% line coverage 강제
- `test` task 종료 후 자동 리포트 생성 (`finalizedBy jacocoTestReport`)

### Step 4: CI JaCoCo 스텝 활성화

**변경 파일:** `.github/workflows/backend-ci.yml`

- 주석 처리된 JaCoCo 스텝 3개 주석 해제:
  1. Generate coverage report + verify 70% minimum
  2. Upload to Codecov
  3. Publish JaCoCo Coverage Report artifact

### Step 5: API URL 환경변수화 (#7)

**변경 파일:** `.github/workflows/e2e.yml`, `backend/src/main/java/com/myqaweb/config/WebConfig.java`, `backend/src/main/resources/application.yml`

#### 5-1. CI/CD 파이프라인

- `e2e.yml`의 프로덕션 배포 스텝: `VITE_API_BASE_URL`을 GitHub Secret (`${{ secrets.BACKEND_API_URL }}`)으로 교체
- E2E 테스트/CI 빌드의 `localhost:8080`은 그대로 유지 (로컬 환경이므로 정상)

#### 5-2. CORS 환경변수화

- `WebConfig.java`: CORS origin에 하드코딩된 IP를 `application.yml`의 설정값으로 교체

```java
// Before
.allowedOrigins("http://localhost:*", "http://127.0.0.1:*",
    "https://*.cloudfront.net", "http://3.34.154.147:*")

// After — application.yml에서 주입
@Value("${app.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*,https://*.cloudfront.net}")
private String[] corsAllowedOriginPatterns;
```

#### 5-3. Worktree / EC2 환경별 영향

| 환경 | CORS origin | 설정 위치 | 영향 |
|------|------------|-----------|------|
| 로컬 (메인) | `http://localhost:*` | `application.yml` default | 변경 없음 |
| Worktree (6개) | `http://localhost:*` | 동일 default 사용 | **영향 없음** — 모든 worktree frontend가 localhost로 접속 |
| EC2 프로덕션 | `http://localhost:*` + `https://*.cloudfront.net` + `http://3.34.154.147:*` | docker-compose.yml environment 또는 `.env` | `CORS_ALLOWED_ORIGIN_PATTERNS` 환경변수 추가 필요 |

**EC2 추가 설정 (배포 시):**
```yaml
# EC2 docker-compose.yml environment에 추가
CORS_ALLOWED_ORIGIN_PATTERNS: "http://localhost:*,http://127.0.0.1:*,https://*.cloudfront.net,http://3.34.154.147:*"
```

> **GitHub Secret 추가 필요:** `BACKEND_API_URL` (값: `http://3.34.154.147:8080`, 추후 도메인 연결 시 변경)

### Step 6: 검증

| 항목 | 검증 방법 |
|------|-----------|
| 로그 로테이션 | `./gradlew bootRun` → 로그 파일 생성 확인, 로테이션 설정 검증 |
| JSON 로그 | `backend-json.log` 파일 생성 + JSON 파싱 가능 확인 |
| JaCoCo | `./gradlew test jacocoTestReport` → `build/reports/jacoco/` 리포트 생성 확인 |
| JaCoCo CI | `backend-ci.yml` dry-run 또는 PR 생성 후 CI 통과 확인 |
| API URL | `e2e.yml`에 Secret 참조 확인, `WebConfig`에 IP 직접 참조 없음 확인 |
| CORS | 로컬 환경에서 API 호출 정상 동작 확인 |

### Step 7: 문서 업데이트

- [ ] ops_v13.md 최종 요약 작성
- [ ] ops.md 버전 히스토리에 v13 추가
- [ ] ops-issues.md에서 #4, #6, #7, #8 상태 업데이트

---

## 4. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `backend/src/main/resources/logback-spring.xml` | FileAppender → RollingFileAppender + JSON appender 추가 |
| `backend/build.gradle` | logstash-logback-encoder 의존성 + JaCoCo 플러그인 추가 |
| `.github/workflows/backend-ci.yml` | JaCoCo 스텝 3개 주석 해제 |
| `.github/workflows/e2e.yml` | VITE_API_BASE_URL → GitHub Secret 참조 |
| `backend/src/main/java/com/myqaweb/config/WebConfig.java` | CORS origin 환경변수화 |
| `backend/src/main/resources/application.yml` | CORS allowed-origins 설정 추가 |

---

## Steps

- [ ] Step 1: 로그 로테이션 적용
- [ ] Step 2: 로그 JSON 포맷 추가
- [ ] Step 3: JaCoCo 플러그인 추가
- [ ] Step 4: CI JaCoCo 스텝 활성화
- [ ] Step 5: API URL 환경변수화
- [ ] Step 6: 검증
- [ ] Step 7: 문서 업데이트
