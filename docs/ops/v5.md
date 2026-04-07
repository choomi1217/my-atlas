# Ops — 버그 수정 (v5)

> 변경 유형: 버그 수정  
> 작성일: 2026-04-06  
> 버전: v5  
> 상태: 완료

---

## 1. 개요

CI/CD 파이프라인 버그 6건 수정. 모든 E2E 테스트 통과 확인 (98개: API 65 + UI 33).

---

## 2. 수정 내역

### 2-1. Logback 경로 권한 오류

**문제:**
```
mkdir: cannot create directory '/app': Permission denied
```

**원인:** `logback-spring.xml`에서 절대 경로 `/app/logs`를 사용. GitHub Actions 러너에 `/app` 디렉토리 생성 권한 없음.

**해결:**
- `LOG_DIR` 기본값을 `/app/logs` → `./logs` (상대 경로)로 변경
- e2e.yml에서 `mkdir -p /app/logs` 스텝 제거

**변경 파일:**
- `backend/src/main/resources/logback-spring.xml`
- `.github/workflows/e2e.yml`

### 2-2. API 키 누락 시 빌드 실패

**문제:**
```
OpenAI API key must be set
Error creating bean with name 'embeddingService'
```

**원인:** GitHub Actions에 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` Secrets 미등록. Spring AI의 `OpenAiEmbeddingModel` 빈 생성 필수 → 시작 실패.

**해결:**
- `EmbeddingModel`을 `Optional<T>`로 주입하여 선택적으로 동작
- E2E 워크플로우에 더미 키 폴백 추가

**변경 파일:**
- `backend/src/main/java/com/myqaweb/common/EmbeddingService.java`
- `.github/workflows/e2e.yml`

### 2-3. Docker Compose 명령 Deprecation

**문제:**
```
docker-compose: command not found
```

**원인:** GitHub Actions Ubuntu 러너에서 `docker-compose` (대시) 바이너리 제거됨.

**해결:** `docker-compose` → `docker compose` (스페이스)로 변경

**변경 파일:**
- `.github/workflows/e2e.yml`

### 2-4. 테스트 상태코드 불일치 (404 → 400)

**문제:**
```
11 unit tests failing: expected 404, got 400
3 E2E tests failing: expected 404, got 400
```

**원인:** `GlobalExceptionHandler`가 `IllegalArgumentException`에 대해 400 BAD_REQUEST를 반환하도록 변경되었으나, 기존 테스트는 404를 기대.

**해결:** 테스트 기댓값을 404 → 400으로 수정

**변경 파일:**
- 백엔드 컨트롤러 테스트 6개 파일 (11개 테스트)
- E2E 테스트 2개 파일 (3개 테스트)

---

## 3. 테스트 결과

### API E2E (65개)
- Company API (6), Convention API (6), Feature Registry (19)
- Knowledge Base API (7), Product API (10), Segment API (11), Senior FAQ API (6)

### UI E2E (33개)
- Company Panel (7), Convention Panel (4), Feature Panel (5)
- Knowledge Base Panel (5), Senior Page (12)

**전체: 98개 E2E 테스트 통과**

---

## 4. 변경 파일 요약

| 파일 | 변경 | 유형 |
|------|------|------|
| `backend/src/main/resources/logback-spring.xml` | 상대 경로로 변경 | Config |
| `backend/src/main/java/com/myqaweb/common/EmbeddingService.java` | Optional EmbeddingModel | Code |
| `.github/workflows/e2e.yml` | 더미 키 + docker compose 수정 | CI/CD |
| 컨트롤러 테스트 6개 파일 | 404 → 400 기댓값 수정 | Test |
| E2E 테스트 2개 파일 | 404 → 400 기댓값 수정 | Test |

**총 커밋: 6건**
