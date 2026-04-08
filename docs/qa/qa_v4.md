# Phase 3: Frontend Unit Test 인프라 + 핵심 로직

> 변경 유형: 기능 추가  
> 작성일: 2026-03-26  
> 버전: v4  
> 상태: 완료

---

## 목표

Frontend Unit Test 환경을 **신규 구축**하고, 가장 복잡한 로직인 **SSE streaming**, **Hook state 관리**, **핵심 컴포넌트 상호작용**을 검증한다.

현재 상태: Frontend Unit Test **0개**, 테스트 인프라 자체 부재

**완료 기준:** Frontend unit test coverage 0% → 40%+

---

## 작업 목록

### 1. Vitest + React Testing Library 설정

**신규 파일:**
- `frontend/vitest.config.ts`
- `frontend/src/test/setup.ts`

**수정 파일:**
- `frontend/package.json` (devDependencies + scripts)

**필요 패키지:**
```
vitest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
jsdom
msw
```

**설정 내용:**
- `vitest.config.ts`: jsdom environment, setup files, coverage reporter
- `setup.ts`: `@testing-library/jest-dom` matchers import
- `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`

---

### 2. useSeniorChat Hook Test

**신규 파일:**
- `frontend/src/hooks/__tests__/useSeniorChat.test.ts`

**참조 파일:**
- `frontend/src/hooks/useSeniorChat.ts`
- `frontend/src/api/senior.ts` (chatApi.streamChat)
- `frontend/src/types/senior.ts` (ChatMessage)

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `초기 상태` | messages=[], isStreaming=false, error=null |
| `sendMessage_transitionsToStreamingState` | 메시지 전송 시 isStreaming=true, user 메시지 추가 |
| `onChunk_appendsToAssistantMessage` | SSE chunk 수신 시 assistant 메시지에 텍스트 누적 |
| `onDone_setsStreamingFalse` | 스트림 완료 시 isStreaming=false |
| `abort_cancelsStreamViaAbortController` | stopStreaming() 호출 시 진행 중 스트림 취소 |
| `sendMessage_withFaqContext_includesInRequest` | faqContext 설정 후 전송 시 API 요청에 포함 |
| `error_setsErrorState` | API 에러 발생 시 error state 설정 |
| `clearChat_resetsMessages` | clearChat() 호출 시 messages=[] 리셋 |

**Mock 전략:** `chatApi.streamChat`을 vi.mock으로 대체, onChunk/onDone 콜백을 수동 호출

---

### 3. chatApi SSE Parsing Test

**신규 파일:**
- `frontend/src/api/__tests__/senior.test.ts`

**참조 파일:**
- `frontend/src/api/senior.ts`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `streamChat_parsesDataPrefix` | `data:Hello` → onChunk("Hello") 호출 |
| `streamChat_handlesMultipleChunks` | 여러 chunk 연속 → onChunk 여러 번 호출 |
| `streamChat_callsOnDone_onStreamEnd` | 스트림 종료 시 onDone 호출 |
| `streamChat_callsOnError_onNetworkFailure` | fetch 실패 시 onError 콜백 실행 |
| `streamChat_sendsCorrectRequestBody` | message + faqContext가 POST body에 포함 |

**Mock 전략:** `global.fetch`를 mock, ReadableStream을 수동 생성하여 SSE 데이터 주입

---

### 4. FaqView + FaqCard Component Tests

**신규 파일:**
- `frontend/src/components/senior/__tests__/FaqView.test.tsx`
- `frontend/src/components/senior/__tests__/FaqCard.test.tsx`

**참조 파일:**
- `frontend/src/components/senior/FaqView.tsx`
- `frontend/src/components/senior/FaqCard.tsx`

**FaqView 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `FAQ 목록 렌더링` | FAQ 3건 전달 → FaqCard 3개 렌더링 |
| `빈 상태 표시` | FAQ 0건 → 빈 상태 메시지 |
| `검색 필터링` | 검색어 입력 → title/content/tags 매칭 결과만 표시 |
| `FAQ 생성 버튼` | "새 FAQ" 버튼 클릭 → FaqFormModal 표시 |

**FaqCard 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `제목/내용 표시` | title, content 텍스트 렌더링 |
| `태그 표시` | tags가 있을 때 태그 chip 렌더링 |
| `Chat에 전송 버튼` | 클릭 시 onSendToChat 콜백 호출 |
| `수정 버튼` | 클릭 시 onEdit 콜백 호출 |
| `삭제 버튼` | 클릭 시 onDelete 콜백 호출 |
| `펼치기/접기` | 카드 클릭 시 content 토글 |

---

### 5. ChatView Component Test

**신규 파일:**
- `frontend/src/components/senior/__tests__/ChatView.test.tsx`

**참조 파일:**
- `frontend/src/components/senior/ChatView.tsx`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `메시지 목록 렌더링` | user/assistant 메시지 렌더링 |
| `빈 상태` | 메시지 0건 → 안내 문구 |
| `입력 + 전송` | textarea 입력 → 전송 버튼 클릭 → onSend 콜백 |
| `Enter 키 전송` | Enter 키 → 전송, Shift+Enter → 줄바꿈 |
| `streaming 중 입력 비활성화` | isStreaming=true → 전송 버튼 disabled |
| `FAQ context 표시` | faqContext 설정 시 context badge 표시 |

---

### 6. SeniorPage View 전환 Test

**신규 파일:**
- `frontend/src/pages/__tests__/SeniorPage.test.tsx`

**참조 파일:**
- `frontend/src/pages/SeniorPage.tsx`

**테스트 시나리오:**

| 테스트 | 설명 |
|--------|------|
| `기본 뷰 표시` | 초기 로드 시 기본 뷰 렌더링 |
| `FAQ → Chat 전환` | Chat 탭 클릭 → ChatView 표시 |
| `Chat → FAQ 전환` | FAQ 탭 클릭 → FaqView 표시 |
| `KB Management 전환` | KB 관리 메뉴 → KbManagementView 표시 |

---

## 검증

```bash
cd frontend && npm install && npm test

# Coverage 확인
cd frontend && npx vitest run --coverage
```

---

## 실행 결과

**실행일:** 2026-03-26
**결과:** 33개 Frontend 테스트 전체 통과

### 생성/수정된 파일

| 파일 | 상태 | 테스트 수 |
|------|------|----------|
| `vitest.config.ts` | 신규 — Vitest + jsdom 설정 | - |
| `src/test/setup.ts` | 신규 — jest-dom matchers + scrollIntoView polyfill | - |
| `package.json` | 수정 — vitest, RTL, user-event, jsdom devDependencies + test scripts | - |
| `hooks/__tests__/useSeniorChat.test.ts` | 신규 — SSE hook state 관리 | 10 |
| `components/senior/__tests__/FaqCard.test.tsx` | 신규 — 카드 렌더링 + 상호작용 | 7 |
| `components/senior/__tests__/ChatView.test.tsx` | 신규 — 채팅 UI 렌더링 + 입력 | 9 |
| `pages/__tests__/SeniorPage.test.tsx` | 신규 — 뷰 전환 로직 | 6 |
