> 변경 유형: 기능 개선  
> 작성일: 2026-04-10  
> 버전: v6  
> 상태: 완료

---

# My Senior Chat 개선 — Markdown 렌더링 + 채팅 기록 + KB 전환

## 개선 목록

| # | 개선 | 문제 | 해결 |
|---|------|------|------|
| 1 | Markdown 렌더링 | AI 응답의 `#`, `**`, `-` 등이 raw text로 표시됨 | `react-markdown`으로 렌더링 |
| 2 | 채팅 기록 저장 | 페이지 이동/새로고침 시 채팅 내역 소멸 (크레딧 낭비) | DB에 채팅 세션/메시지 저장 |
| 3 | 채팅 → KB 전환 | 유용한 AI 답변을 장기 보존할 방법이 없음 | 채팅 메시지를 KB로 저장하는 기능 |

---

## 개선 1: Markdown 렌더링

### 현재 문제

`ChatView.tsx` Line 84에서 `{msg.content}`를 plain text로 출력.
Claude는 Markdown으로 응답하지만 `#`, `**`, `-` 등이 그대로 노출됨.

### 변경 방안

assistant 메시지에 `react-markdown`을 적용. user 메시지는 기존대로 plain text 유지.

### 필요 라이브러리

| 패키지 | 용도 |
|--------|------|
| `react-markdown` | Markdown → React 컴포넌트 변환 |
| `remark-gfm` | GFM 지원 (테이블, 취소선, task list) |
| `@tailwindcss/typography` | `prose` 클래스로 Markdown HTML 스타일링 |

### 변경 파일

- `frontend/package.json` — 의존성 추가
- `frontend/tailwind.config.js` — typography 플러그인 추가
- `frontend/src/components/senior/ChatView.tsx` — assistant 메시지 렌더링 변경

### 변경 후 코드 (안)

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// assistant 메시지
{msg.role === 'assistant' ? (
  <div className="prose prose-sm max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {msg.content || (isStreaming ? '...' : '')}
    </ReactMarkdown>
  </div>
) : (
  msg.content || ''
)}
```

### SSE 스트리밍 중 동작

- 스트리밍 중에도 ReactMarkdown이 실시간 부분 렌더링
- 불완전한 Markdown(`**볼드` — 닫는 `**` 미도착)은 일시적으로 raw 표시
- 스트리밍 완료 후 전체 정상 렌더링 → 허용 가능

---

## 개선 2: 채팅 기록 저장

### 현재 문제

- `useSeniorChat.ts`에서 `useState<ChatMessage[]>([])`로만 관리
- 페이지 이동, FAQ↔Chat 뷰 전환, 새로고침 시 대화 내역 소멸
- 크레딧을 써서 받은 답변이 영구 손실됨

### 설계 방향

채팅 세션(ChatSession)과 메시지(ChatMessage)를 DB에 저장한다.

### DB 스키마 (Flyway 마이그레이션 추가)

```sql
-- 채팅 세션
CREATE TABLE chat_session (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200),          -- 첫 번째 사용자 메시지 요약 또는 직접 입력
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 채팅 메시지
CREATE TABLE chat_message (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,    -- 'user' | 'assistant'
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_message_session ON chat_message(session_id);
```

### Backend API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/senior/sessions` | 세션 목록 조회 (최신순, 페이지네이션) |
| GET | `/api/senior/sessions/{id}` | 세션 상세 (메시지 포함) |
| POST | `/api/senior/sessions` | 새 세션 생성 |
| DELETE | `/api/senior/sessions/{id}` | 세션 삭제 (메시지 CASCADE) |
| PATCH | `/api/senior/sessions/{id}` | 세션 제목 수정 |

### chat 엔드포인트 변경

`POST /api/senior/chat` 요청에 `sessionId` 필드 추가:

```java
public record ChatRequest(
    @NotBlank String message,
    FaqContext faqContext,       // 기존
    Long sessionId              // 신규: null이면 새 세션 자동 생성
) {}
```

- SSE 스트리밍 완료 후 user 메시지와 assistant 메시지를 DB에 저장
- 응답 헤더 또는 첫 SSE 이벤트로 `sessionId` 반환

### Frontend 변경

#### 화면 구조

```
┌─────────────────────────────────────────┐
│  My Senior                    [+ FAQ]   │  ← Header
├──────────┬──────────────────────────────┤
│ Sessions │  채팅 영역                    │
│──────────│                              │
│ ● 현재   │  [메시지들...]               │
│ 어제     │                              │
│  세션1   │                              │
│  세션2   │                              │
│ 지난주    │                              │
│  세션3   │  ┌──────────────────────┐    │
│          │  │ 입력창               │    │
│ [새 채팅] │  └──────────────────────┘    │
└──────────┴──────────────────────────────┘
```

- Chat 뷰 좌측에 세션 사이드바 추가
- 세션 클릭 시 해당 세션의 메시지 로드
- "새 채팅" 버튼으로 새 세션 시작
- 세션 제목: 첫 사용자 메시지의 앞 50자 자동 설정 (이후 수정 가능)

#### 새 컴포넌트/훅

| 파일 | 용도 |
|------|------|
| `components/senior/ChatSessionList.tsx` | 세션 목록 사이드바 |
| `hooks/useChatSessions.ts` | 세션 CRUD 상태 관리 |

#### useSeniorChat 변경

- `sessionId` 상태 추가
- `sendMessage` 시 `sessionId`를 request에 포함
- 세션 전환 시 해당 세션 메시지 로드

---

## 개선 3: 채팅 메시지 → Knowledge Base 전환

### 현재 문제

- 유용한 AI 답변을 장기 보존할 방법이 없음
- 나중에 같은 질문을 다시 해야 함 (크레딧 추가 소모)

### 설계 방향

채팅 메시지(주로 assistant 응답)를 선택하여 KB 항목으로 저장한다.
기존 `POST /api/kb` API를 그대로 활용.

### UI 동작

```
채팅 메시지 (assistant)
  ↓
메시지 호버 시 [KB에 저장] 버튼 노출
  ↓
클릭 → KB 저장 모달 표시
  ├─ 제목: 해당 세션의 user 질문 (자동 채움, 수정 가능)
  ├─ 내용: assistant 응답 전문 (자동 채움, 수정 가능)
  ├─ 카테고리: 직접 입력
  └─ 태그: 직접 입력
  ↓
저장 → POST /api/kb → 비동기 임베딩 생성
  ↓
성공 토스트: "Knowledge Base에 저장되었습니다"
```

### 변경 파일

| 파일 | 변경 |
|------|------|
| `ChatView.tsx` | assistant 메시지에 [KB에 저장] 버튼 추가 |
| `KbFormModal.tsx` | 기존 KB 생성 모달 재사용 (초기값 주입) |

### 상세 동작

- [KB에 저장] 버튼은 assistant 메시지에만 표시
- 스트리밍 중에는 버튼 비표시 (완료 후 표시)
- 모달 열 때 자동 채움:
  - `title`: 직전 user 메시지 내용 (앞 100자)
  - `content`: 해당 assistant 메시지 전체
- 저장은 기존 `kbApi.create()` 호출 → 새 엔드포인트 불필요
- 저장 후 임베딩은 기존 비동기 Virtual Thread 로직이 처리

---

## 영향 범위 종합

| 영역 | 개선 1 (Markdown) | 개선 2 (채팅 기록) | 개선 3 (KB 전환) |
|------|-------------------|-------------------|-----------------|
| DB | - | Flyway V8 (chat_session, chat_message) | - |
| Backend | - | ChatSession CRUD + chat 엔드포인트 수정 | - (기존 KB API 활용) |
| Frontend | ChatView.tsx | ChatSessionList, useChatSessions, ChatView, useSeniorChat | ChatView + KbFormModal |
| 패키지 | react-markdown, remark-gfm, @tailwindcss/typography | - | - |
| 테스트 | 프론트엔드 단위 테스트 | Backend 단위 + E2E | E2E (UI) |

## Steps

### Phase 1: Markdown 렌더링
- [x] Step 1: `react-markdown`, `remark-gfm`, `@tailwindcss/typography` 설치
- [x] Step 2: tailwind.config에 typography 플러그인 추가
- [x] Step 3: `ChatView.tsx` assistant 메시지에 ReactMarkdown 적용
- [x] Step 4: 스타일링 조정 + 스트리밍 동작 확인

### Phase 2: 채팅 기록 저장
- [x] Step 5: Flyway V14 마이그레이션 (chat_session, chat_message 테이블)
- [x] Step 6: ChatSession/ChatMessage Entity, Repository, DTO 생성
- [x] Step 7: ChatSessionService + ChatSessionController 구현
- [x] Step 8: `SeniorServiceImpl.chat()` 수정 — 스트리밍 완료 후 메시지 DB 저장
- [x] Step 9: Frontend `useChatSessions` 훅 + API 추가
- [x] Step 10: 세션 사이드바를 ChatView에 통합 구현
- [x] Step 11: `ChatView.tsx` + `useSeniorChat.ts` 세션 연동

### Phase 3: 채팅 → KB 전환
- [x] Step 12: `ChatView.tsx`에 assistant 메시지 [KB에 저장] 버튼 추가
- [x] Step 13: KbSaveForm 인라인 폼 구현 — 초기값(title/content) 자동 채움
- [x] Step 14: 저장 성공 토스트 표시

### Phase 4: 테스트
- [x] Step 15: Backend 단위 테스트 (ChatSessionServiceImplTest 13개, SeniorControllerTest 세션 5개 추가)
- [x] Step 16: Backend 기존 테스트 수정 (ChatRequest 3-arg 호환, ChatSessionService mock 추가)
- [x] Step 17: E2E 테스트 (API senior-session 8개, UI senior 3개 추가)

## [최종 요약]

### 구현 완료 항목

| 개선 | 구현 | 테스트 |
|------|------|--------|
| Markdown 렌더링 | `react-markdown` + `remark-gfm` + `@tailwindcss/typography`, prose 클래스 적용 | Frontend build 통과 |
| 채팅 기록 저장 | Flyway V14, ChatSession/ChatMessage CRUD, SSE 스트리밍 후 DB 저장, 세션 사이드바 | Backend 단위 18개, API E2E 8개, UI E2E 3개 |
| 채팅 → KB 전환 | assistant 메시지 hover시 "KB에 저장" 버튼, KbSaveForm 인라인 폼, 성공 토스트 | kbApi.create() 재활용 |

### 검증 결과
- `./gradlew clean build` — **PASSED**
- `./gradlew test` — **ALL PASSED** (기존 + 신규)
- `npx playwright test api/senior-session.spec.ts` — **8/8 PASSED**
- `npx playwright test api/senior-faq.spec.ts` — **2/2 PASSED**
- `npx playwright test ui/senior.spec.ts` — **7/7 PASSED** + 2 skipped
