# Senior Chat 403 Forbidden 에러 수정 — v6.1

> 변경 유형: 버그 수정  
> 작성일: 2026-04-10  
> 버전: v6.1  
> 상태: 완료

---

## 배경

`POST /api/senior/chat` 호출 시 **403 Forbidden** 에러가 발생한다.
로그인 후에도 Chat 메시지 전송이 불가능한 상태.

---

## 원인 분석

### 요청 확인

브라우저 네트워크 탭에서 캡처한 fetch 요청:
```
fetch("http://localhost:5176/api/senior/chat", {
  headers: {
    "content-type": "application/json",
    // ❌ Authorization 헤더 없음
  },
  body: '{"message":"협업 기반 접근법은 어떤건가요?\\n","faqContext":null,"sessionId":null}',
  method: "POST",
  credentials: "omit"
});
```

### 근본 원인

| 구분 | API 클라이언트 | JWT 토큰 주입 | 결과 |
|------|---------------|--------------|------|
| faqApi, kbApi, sessionApi 등 | axios (`client.ts`) | ✅ interceptor 자동 주입 | 정상 |
| **chatApi.streamChat()** | **native fetch** (`senior.ts`) | ❌ **누락** | **403** |

- `chatApi.streamChat()`은 SSE 스트리밍을 위해 axios 대신 native `fetch()`를 사용한다 (axios는 response streaming 미지원)
- `client.ts`의 axios interceptor가 `localStorage`에서 JWT 토큰을 읽어 `Authorization` 헤더에 자동 주입하지만, native fetch는 이 interceptor를 거치지 않는다
- `SecurityConfig.java` line 41: `POST /api/**`에 `hasRole("ADMIN")` 요구 → 토큰 없이 요청하면 403 반환

---

## 수정 방안

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/api/senior.ts` | `streamChat()` fetch 호출에 JWT 토큰 주입 |

### 변경 전 (line 22~24)

```typescript
fetch(`${API_BASE_URL}/api/senior/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
```

### 변경 후

```typescript
const token = localStorage.getItem('my-atlas-token');
const headers: HeadersInit = { 'Content-Type': 'application/json' };
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}

fetch(`${API_BASE_URL}/api/senior/chat`, {
  method: 'POST',
  headers,
```

### 수정하지 않는 것

- `SecurityConfig.java` — POST 요청에 ADMIN 역할 요구는 기존 보안 정책이므로 변경하지 않음
- `client.ts` axios interceptor — 이미 정상 동작 중

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | `streamChat()` fetch에 JWT 토큰 주입 | `frontend/src/api/senior.ts` |
| 2 | 빌드 확인 | `cd frontend && npm run build` |
| 3 | 기존 테스트 통과 확인 | `cd frontend && npm test` |

---

## 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 로그인 후 Chat에서 메시지 전송 | SSE 스트리밍 응답 정상 수신 (403 아님) |
| 2 | 네트워크 탭에서 요청 확인 | `Authorization: Bearer {token}` 헤더 포함 |
| 3 | 로그아웃 상태에서 Chat 전송 시도 | 401 또는 로그인 페이지 리다이렉트 |
