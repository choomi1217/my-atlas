# Platform — Docker 이미지 엑박 + 403 자동 로그아웃 수정 (v4)

> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v0.4  
> 상태: 진행 중

---

## 요구사항

### [BUG-1] Docker 이미지 엑박
Docker를 통해 worktree 코드를 실행한 후 테스트하면, 이미지 관련 기능들이 전부 엑박(broken image)으로 표시된다.

### [BUG-2] 403 Forbidden 시 자동 로그아웃 미동작
Docker 재빌드 시 JWT secret이 변경되어 기존 토큰이 무효화된다. Axios 인터셉터가 401만 처리하고 403은 무시하여 자동 로그아웃이 안 된다.

### [BUG-3] `<img>` 태그 이미지 요청 403
`<img src="/api/convention-images/...">` 같은 브라우저 직접 요청은 Axios를 거치지 않아 Authorization 헤더가 없다. SecurityConfig에서 인증을 요구하므로 403 → 엑박.

---

## 현재 코드 분석 (Context)

### BUG-1: docker-compose.yml 볼륨 마운트 누락

```yaml
# 현재 — 로그만 마운트
backend:
  volumes:
    - ./logs:/app/logs
    # feature-images, kb-images, convention-images → 없음!
```

### BUG-2: Axios 인터셉터 (client.ts)

```typescript
// 현재 — 401만 처리, 403 무시
if (error.response?.status === 401) { ... }
```

### BUG-3: SecurityConfig 이미지 경로 미허용

```java
// 현재 — GET /api/** 는 authenticated 필요
.requestMatchers(HttpMethod.GET, "/api/**").authenticated()
// → <img> 태그의 토큰 없는 요청은 403
```

**검증 결과:**
- `curl` + 토큰 → 200 OK
- `curl` 토큰 없이 → 403 Forbidden
- `<img>` 태그 → 토큰 없이 요청 → 403 → 엑박

---

## 설계

### BUG-1 해결: 이미지 디렉토리 볼륨 마운트 추가

```yaml
backend:
  volumes:
    - ./logs:/app/logs
    - ./feature-images:/app/feature-images
    - ./kb-images:/app/kb-images
    - ./convention-images:/app/convention-images
```

### BUG-2 해결: Axios 인터셉터에 403 처리 추가

```typescript
if (error.response?.status === 401 || error.response?.status === 403) {
  localStorage.removeItem('my-atlas-token');
  localStorage.removeItem('my-atlas-user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}
```

### BUG-3 해결: SecurityConfig에서 이미지 서빙 경로 permitAll

```java
.requestMatchers(HttpMethod.GET, "/api/kb/images/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/convention-images/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/feature-images/**").permitAll()
```

이미지 파일은 UUID 파일명으로 저장되어 URL 추측이 어렵고, 민감 데이터가 아니므로 공개 접근 허용해도 보안 위험이 낮다.

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | docker-compose.yml에 이미지 볼륨 마운트 추가 | `docker-compose.yml` |
| 2 | SecurityConfig에서 이미지 서빙 경로 permitAll | `SecurityConfig.java` |
| 3 | Axios 인터셉터에 403 자동 로그아웃 추가 | `frontend/src/api/client.ts` |

---

### Step 1 — docker-compose.yml 수정

**수정 파일:** `docker-compose.yml` (worktree)

- [x] backend 서비스의 volumes에 이미지 디렉토리 3개 마운트 추가 (이미 완료)

---

### Step 2 — SecurityConfig 이미지 경로 허용

**수정 파일:** `backend/src/main/java/com/myqaweb/config/SecurityConfig.java`

- [ ] `GET /api/kb/images/**` → permitAll
- [ ] `GET /api/convention-images/**` → permitAll
- [ ] `GET /api/feature-images/**` → permitAll

---

### Step 3 — Axios 인터셉터 403 처리

**수정 파일:** `frontend/src/api/client.ts`

- [ ] 응답 인터셉터에서 `401 || 403` 모두 자동 로그아웃 처리

---

## 변경 파일 목록

| 파일 | 구분 | 설명 |
|------|------|------|
| `docker-compose.yml` | 수정 | backend volumes에 이미지 디렉토리 3개 마운트 추가 |
| `SecurityConfig.java` | 수정 | 이미지 서빙 GET 경로 permitAll |
| `frontend/src/api/client.ts` | 수정 | 응답 인터셉터에 403 자동 로그아웃 추가 |

---

## 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | Docker로 실행 후 Convention 이미지 표시 | 이미지 정상 표시 (엑박 아님) |
| 2 | 토큰 없이 이미지 URL 직접 접근 | 200 OK (이미지 표시) |
| 3 | Docker 컨테이너 재시작 후 이미지 접근 | 이미지 유지 |
| 4 | 무효 토큰으로 API 호출 (403 응답) | 자동 로그아웃 → /login |
| 5 | 정상 로그인 후 Convention 페이지 | 이미지 + 데이터 정상 |

---

## [최종 요약]

(모든 Step 완료 후 작성)
