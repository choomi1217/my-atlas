# FAQ Improve — 기능 명세 (v1)

---

## 1. FAQ의 목적

FAQ는 사용자가 Chat으로 자주 질문하는 내용을 카드 형태로 빠르게 탐색할 수 있는 페이지다.
Chat을 열기 전에 원하는 답을 바로 찾거나, FAQ 항목을 Chat 컨텍스트로 넘겨 심화 질문을 이어갈 수 있도록 돕는다.

---

## 2. 진입 흐름 (UI Step)

```
LNB > My Senior 클릭
    ↓
FAQ 화면 진입 (기본 화면)
검색 바 + FAQ 카드 목록 노출
    ↓
(분기 1) FAQ 카드 클릭
    → 카드 Expand
    → 상세 내용 노출
    → 카드 하단에 구분선 + [Chat에서 더 물어보기 →] 버튼 노출 (전체 너비)
    → 버튼 클릭 → FAQ context를 Chat에 넘기고 Chat 화면으로 전환
(분기 2) 원하는 정보 없음 → Header의 [Chat] 버튼 클릭 → Chat 화면으로 직접 이동
```

---

## 3. 화면 구성

### 3-1. Header

| 위치 | 요소 | 동작 |
|------|------|------|
| Header 우측 | [Chat] 버튼 | 클릭 시 Chat 화면으로 전환 |
| Header 중앙 | 페이지 타이틀 "My Senior" | 고정 |

> FAQ가 기본 진입 화면이므로 Header에는 Chat으로 이동하는 버튼을 배치한다.
> Chat 화면에서는 동일 위치에 [FAQ] 버튼이 노출되어 상호 전환이 가능하다.

### 3-2. FAQ 화면 (기본 진입 화면)

- My Senior 진입 시 기본으로 노출되는 화면
- 전체 콘텐츠 영역을 차지 (오버레이/패널 아님)
- 상단 검색 바 + 하단 카드 목록 구조

#### 화면 레이아웃

```
┌─────────────────────────────────────┐
│  My Senior                  [Chat →] │  ← Header
├─────────────────────────────────────┤
│  🔍 [검색 바]                        │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ 태그: #회귀테스트 #TC설계    │   │
│  │ 제목: 회귀 테스트 범위는...  │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ [Expanded 상태]              │   │
│  │ 태그: #회귀테스트 #TC설계    │   │
│  │ 제목: 회귀 테스트 범위는...  │   │
│  │ ─────────────────────────   │   │
│  │ 내용: 회귀 테스트 범위는     │   │
│  │ 변경된 코드와 영향받는       │   │
│  │ 인접 기능을 중심으로...      │   │
│  │ ─────────────────────────   │   │
│  │  [Chat에서 더 물어보기 →]   │   │  ← 전체 너비 버튼
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 4. FAQ 카드 동작 상세

### 4-1. 기본 상태 (Collapsed)

- 태그 뱃지 (쉼표 구분 → 뱃지 렌더링)
- 제목 1줄 표시 (overflow 시 말줄임)
- 클릭 시 Expand

### 4-2. Expanded 상태

- 태그 뱃지
- 제목 (전체 표시)
- 구분선
- 내용 (전체 표시, 최대 높이 없음)
- **[Chat에서 더 물어보기 →] 버튼** (하단 우측 고정)
- 다시 클릭 시 Collapse

### 4-3. [Chat에서 더 물어보기] 버튼 동작

1. FAQ 패널 닫기
2. Chat 입력창 초기화
3. 아래 형식의 system context를 Chat 메시지 히스토리에 `role: system` 또는 초기 user 메시지로 주입

```
[FAQ 참고]
제목: {faq.title}
내용: {faq.content}

위 내용을 참고하여 추가 질문에 답변해주세요.
```

4. Chat 입력창 포커스 자동 이동 (사용자가 바로 질문 입력 가능한 상태)

> **구현 참고**: Chat의 `useSeniorChat` hook에 `setFaqContext(faq: FaqItem | null)` 함수를 추가하여, context가 있으면 첫 메시지 전송 시 시스템 프롬프트에 병합한다.

---

## 5. 검색 기능

- 검색 바 입력 시 **클라이언트 사이드 필터링** (API 재호출 없음)
- 검색 대상: `title` + `content` + `tags` (부분 일치)
- 검색 결과 없을 경우: "일치하는 FAQ가 없습니다. Chat에서 직접 질문해보세요." 안내 문구 + [Chat으로 이동] 버튼 표시

---

## 6. FAQ CRUD

FAQ 패널 내에서 직접 작성/수정/삭제 가능하다.

| 액션 | 진입점 | 동작 |
|------|--------|------|
| 생성 | 패널 우측 상단 [+ 추가] 버튼 | 인라인 폼 또는 모달 |
| 수정 | 카드 Expanded 상태의 [✏️ 수정] 버튼 | 동일 모달 재사용 |
| 삭제 | 카드 Expanded 상태의 [🗑️ 삭제] 버튼 | 확인 없이 즉시 삭제 (Undo 미지원 v1) |

### 생성/수정 폼 필드

| 필드 | 타입 | 필수 |
|------|------|------|
| 제목 | text input | ✅ |
| 내용 | textarea | ✅ |
| 태그 | text input (쉼표 구분 입력) | ❌ |

---

## 7. Chat 연계 흐름 (시퀀스)

```
사용자
  │
  ├─ [FAQ] 버튼 클릭
  │       ↓
  │   FAQ 패널 오픈
  │   GET /api/senior/faq → 카드 목록 렌더링
  │       ↓
  ├─ 카드 클릭 → Expand
  │       ↓
  ├─ [Chat에서 더 물어보기] 클릭
  │       ↓
  │   useSeniorChat.setFaqContext(faqItem) 호출
  │   FAQ 패널 닫기
  │   Chat 입력창 포커스
  │       ↓
  ├─ 사용자 추가 질문 입력 후 전송
  │       ↓
  │   POST /api/senior/chat
  │   body: { message: "사용자 질문", faqContext: { title, content } }
  │       ↓
  │   Backend: faqContext를 System Prompt에 병합 후 Claude API 호출
  │       ↓
  │   SSE 스트리밍 응답
  │       ↓
  └─ Chat 화면에 응답 렌더링
```

---

## 8. Backend 변경 사항

### 8-1. ChatRequest DTO 변경

```java
// 기존
public record ChatRequest(@NotBlank String message) {}

// 변경
public record ChatRequest(
    @NotBlank String message,
    FaqContext faqContext       // nullable
) {}

public record FaqContext(String title, String content) {}
```

### 8-2. SeniorServiceImpl — RAG 파이프라인 변경

`buildSystemPrompt()` 내에 faqContext 섹션 추가:

```
(기존 섹션들 동일)

=== FAQ 참고 항목 (사용자가 선택한 항목) ===
제목: {faqContext.title}
내용: {faqContext.content}
```

- `faqContext`가 null이면 해당 섹션 생략
- 기존 pgvector 유사 검색 결과(Top 3)와 중복되더라도 명시적으로 주입 (사용자가 선택한 항목이므로 우선 노출)

---

## 9. Frontend 변경 사항

### 9-1. useSeniorChat.ts 변경

```typescript
// 추가 상태
const [faqContext, setFaqContext] = useState<FaqItem | null>(null);

// sendMessage 내부: faqContext가 있으면 request body에 포함
const body = {
  message,
  faqContext: faqContext ? { title: faqContext.title, content: faqContext.content } : null
};

// 메시지 전송 후 faqContext 초기화
setFaqContext(null);
```

### 9-2. 신규/변경 컴포넌트

| 컴포넌트 | 변경 구분 | 설명 |
|----------|-----------|------|
| `FaqView.tsx` | 신규 | FAQ 기본 화면 (검색 바 + 카드 목록) |
| `FaqCard.tsx` | 신규 | 단일 FAQ 카드 (Collapsed / Expanded 상태, B안 버튼 포함) |
| `FaqFormModal.tsx` | 기존 유지 | 생성/수정 모달 재사용 |
| `ChatView.tsx` | 수정 | faqContext 주입 로직 추가 |
| `SeniorPage.tsx` | 수정 | 기본 화면을 FaqView로 변경, Header 버튼 FAQ ↔ Chat 전환 |

### 9-3. FaqView Props

```typescript
interface FaqViewProps {
  onSendToChat: (faq: FaqItem) => void; // [Chat에서 더 물어보기] 클릭 핸들러
}
```

---

## 10. API 변경 없음 (FAQ CRUD)

기존 `/api/senior/faq` CRUD endpoint는 변경 없이 그대로 사용한다.
Chat endpoint (`POST /api/senior/chat`)만 request body에 `faqContext` 필드 추가.

---

## 11. 구현 순서

| Phase | 작업 | 파일 |
|-------|------|------|
| 1 | ChatRequest DTO에 FaqContext 추가 | `ChatDto.java` |
| 2 | System Prompt에 faqContext 섹션 병합 | `SeniorServiceImpl.java` |
| 3 | useSeniorChat에 faqContext 상태 추가 | `useSeniorChat.ts` |
| 4 | FaqCard 컴포넌트 구현 (Collapse/Expand + B안 버튼) | `FaqCard.tsx` |
| 5 | FaqView 컴포넌트 구현 (검색 + 카드 목록 + CRUD 진입) | `FaqView.tsx` |
| 6 | SeniorPage 기본 화면을 FaqView로 변경, Header 버튼 전환 로직 | `SeniorPage.tsx` |
| 7 | ChatView에 faqContext 주입 연결 | `ChatView.tsx` |

---

## 12. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | My Senior 진입 | FAQ 화면 기본 노출, Header에 [Chat →] 버튼 표시 |
| 2 | Header [Chat →] 버튼 클릭 | Chat 화면으로 전환, Header에 [FAQ] 버튼 표시 |
| 3 | Chat 화면에서 [FAQ] 버튼 클릭 | FAQ 화면으로 전환 |
| 4 | FAQ 카드 클릭 | 해당 카드 Expand, 내용 및 구분선 + 전체 너비 버튼 노출 |
| 5 | 같은 카드 재클릭 | Collapse |
| 6 | 검색 바 입력 | 실시간 필터링, 일치 항목만 표시 |
| 7 | 검색 결과 없음 | 안내 문구 + [Chat으로 이동] 버튼 표시 |
| 8 | [Chat에서 더 물어보기] 클릭 | Chat 화면으로 전환, Chat 입력창 포커스, faqContext 세팅 확인 |
| 9 | faqContext 세팅 후 질문 전송 | Network 탭에서 request body에 faqContext 포함 확인 |
| 10 | FAQ 추가 | 카드 목록에 즉시 반영 |
| 11 | FAQ 수정 | 수정 내용 카드에 반영 |
| 12 | FAQ 삭제 | 카드 목록에서 제거 |