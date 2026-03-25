# Log File Output — 환경 개선 (v1)

> **변경 유형**: 환경 개선
> **날짜**: 2026-03-25

---

## 1. 변경 배경

사용자가 실제 데이터로 테스트하다 에러를 발견했을 때, 매번 터미널에서 `docker logs`를 긁어서 전달하는 과정이 번거로움.
Backend 로그를 프로젝트 내 파일에 자동 저장하면, "에러 났어"라고만 말해도 Claude Code가 로그 파일을 읽어서 분석 가능.

---

## 2. 변경 내용

### 변경 파일 목록

| 파일 | 변경 사항 |
|------|-----------|
| `backend/src/main/resources/application.yml` | `logging.file.name` + `logging.level` 설정 추가 |
| `docker-compose.yml` | backend 서비스에 `./logs:/app/logs` 볼륨 마운트 추가 |

### 상세

**application.yml 추가:**
```yaml
logging:
  file:
    name: /app/logs/backend.log
  level:
    root: INFO
    com.myqaweb: DEBUG
```

**docker-compose.yml backend 서비스:**
```yaml
volumes:
  - ./logs:/app/logs
```

**결과:**
- Docker 컨테이너 기동 시 `./logs/backend.log`에 모든 백엔드 로그가 자동 저장
- `.gitignore`에 `logs/` 이미 등록되어 있어 Git 추적 안 됨
- 에러 발생 시 Claude Code가 `/Users/yeongmi/dev/qa/my-atlas/logs/backend.log` 를 읽어서 분석

---

## 3. 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | `docker compose up -d --build backend` 후 API 호출 | `./logs/backend.log` 파일 생성, 로그 기록 확인 |
| 2 | PDF 업로드 등 에러 유발 | 에러 스택트레이스가 `backend.log`에 기록됨 |
| 3 | "에러 났어" → Claude Code가 로그 파일 읽기 | 로그 파일에서 에러 원인 분석 가능 |
