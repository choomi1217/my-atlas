# My Senior — 기능 명세서

## 이 기능이 QA에게 주는 가치

**My Senior는 "경험 많은 시니어 QA가 옆에 앉아서 바로 답해주는" 경험을 AI로 구현한 것이다.**

QA 엔지니어가 실무에서 마주치는 핵심 문제 3가지를 해결한다:

### 1. "이 상황에서 어떻게 테스트해야 하지?"

주니어 QA가 결제 모듈 회귀 테스트 범위를 정하지 못해 30분을 고민하는 대신, My Senior에 질문하면 **팀이 축적한 QA 지식(KB)을 기반으로** 즉시 가이드를 받는다. 일반 ChatGPT와 다른 점은 **우리 팀의 제품 구조, 테스트 전략, 과거 경험이 답변에 녹아있다**는 것이다.

### 2. "예전에 비슷한 이슈 처리했는데, 어떻게 했더라?"

QA 지식은 개인의 머릿속이나 흩어진 문서에 갇혀 있다. My Senior의 **Knowledge Base**는 QA 서적 요약, 팀 경험, PDF 도서 청크를 벡터 임베딩으로 저장하여 **의미 기반 검색**을 제공한다. "회귀 테스트"라고 검색하면 "리그레션", "변경 영향 분석" 등 유사 개념도 함께 찾아준다.

### 3. "좋은 답변을 받았는데, 나중에 다시 찾을 수 없다"

AI에게 받은 유용한 답변은 대화가 끝나면 사라진다. My Senior는 **채팅 기록을 세션 단위로 영구 저장**하고, 특히 가치 있는 답변은 **"KB에 저장" 한 번의 클릭으로 팀 지식으로 전환**할 수 있다. 이렇게 저장된 지식은 다음 질문의 RAG 컨텍스트로 활용되어 **답변 품질이 누적적으로 향상**된다.

### QA 지식 선순환 구조

```
팀 경험/서적 → KB 등록 → 임베딩 생성 → 벡터 DB 저장
                                              ↓
질문 → 벡터 유사 검색 → 관련 지식 추출 → AI 답변 생성
                                              ↓
유용한 답변 → "KB에 저장" → KB 등록 → 임베딩 생성 → ...
                                              ↑
                             지식이 쌓일수록 답변 품질 향상
```

---

## 화면 구성

### 내비게이션 구조

**기본 진입 화면: FAQ** — QA가 자주 필요로 하는 지식을 먼저 보여준다.

| 뷰 | 진입 | QA 활용 시나리오 |
|----|------|-----------------|
| **FAQ** (기본) | My Senior 클릭 | 자주 조회되는 QA 지식을 카드로 빠르게 탐색. 검색으로 필터링 가능 |
| **Chat** | Header [Chat] 버튼 | FAQ에서 답을 못 찾았거나, 더 깊은 질문이 필요할 때 AI와 직접 대화 |

### FAQ 화면 — "가장 많이 찾는 QA 지식을 한눈에"

```
┌─────────────────────────────────────┐
│  My Senior                  [Chat →]│  Header
├─────────────────────────────────────┤
│  [검색 바]                           │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ 카테고리: 테스트 전략         │   │  Collapsed 카드
│  │ 제목: 회귀 테스트 범위 설정법 │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 카테고리: API 테스트          │   │  Expanded 카드
│  │ 제목: REST API 응답 검증 체크 │   │
│  │ ─────────────────────────── │   │
│  │ 내용 전문 표시...             │   │
│  │ ─────────────────────────── │   │
│  │  [Chat에서 더 물어보기 →]    │   │  컨텍스트 전달 버튼
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**FAQ 큐레이션 알고리즘** (v7) — 운영자가 의도적으로 큐레이션한 항목만 노출:

| 구분 | 조건 | 최대 수 | QA 의미 |
|------|------|---------|---------|
| **고정(Pinned)** | 관리자가 `/kb` 페이지에서 Pin 설정 | **10건** | 반드시 알아야 할 핵심 QA 지식 — 운영자 직접 큐레이션 |

> v7부터 hit_count 기반 자동 큐레이션은 제거됨. `hit_count` 컬럼/인덱스는 DB에 보존되나 코드에서 미참조(소프트 폐기).

- FAQ 데이터 소스는 `knowledge_base` 테이블 (KB에서 큐레이션)
- 검색은 클라이언트 사이드 필터링 (title + content 부분 일치)
- 검색 결과 없을 시 Chat으로 이동 유도

### Chat 화면 — "AI 시니어에게 직접 질문"

```
┌─────────────────────────────────────────┐
│  My Senior                    [← FAQ]   │  Header
├──────────┬──────────────────────────────┤
│ Sessions │  채팅 영역                    │
│──────────│                              │
│ ● 현재   │  [FAQ 컨텍스트 배너]          │  선택한 FAQ 표시
│ 어제     │                              │
│  세션1   │  User: 회귀 테스트 범위는?    │
│  세션2   │                              │
│ 지난주   │  AI: (Markdown 렌더링)        │
│  세션3   │     **1단계: 변경 분석**      │
│          │     - 코드 변경 영향도...     │  [KB에 저장]
│          │                              │
│ [새 채팅] │  ┌──────────────────────┐    │
│          │  │ 질문 입력             │    │
│          │  └──────────────────────┘    │
└──────────┴──────────────────────────────┘
```

**핵심 기능:**
- **세션 기록 영구 저장**: 페이지 이동/새로고침해도 대화 내역 보존. 세션 사이드바에서 과거 대화 열람
- **Markdown 렌더링**: AI 응답의 제목, 목록, 코드 블록, 테이블을 깔끔하게 표시
- **KB에 저장**: assistant 메시지 hover 시 버튼 노출. 유용한 답변을 KB로 영구 저장
- **FAQ 컨텍스트 전달**: FAQ에서 "Chat에서 더 물어보기" 클릭 시 해당 지식을 대화 맥락에 주입

### FAQ → Chat 컨텍스트 전달 흐름

QA가 FAQ 카드를 읽다가 추가 질문이 생길 때, **해당 FAQ의 맥락을 AI가 이해한 상태에서 대화를 시작**할 수 있다.

```
FAQ 카드 [Chat에서 더 물어보기] 클릭
    ↓
faqContext 세팅 (title + content)
    ↓
Chat 화면 전환 + 입력창 자동 포커스 + 컨텍스트 배너 표시
    ↓
사용자 질문 전송 → faqContext를 System Prompt에 최우선 병합
    ↓
AI가 해당 FAQ 내용을 참고하여 답변 생성
    ↓
전송 후 faqContext 자동 초기화
```

---

## RAG 파이프라인 — "AI가 우리 팀 지식을 참고하는 방법"

**일반 AI 챗봇과의 차이**: My Senior는 질문에 답하기 전에 팀의 Knowledge Base에서 관련 지식을 검색하여 System Prompt에 주입한다. 이를 통해 **일반적인 QA 조언이 아닌, 우리 팀 맥락에 맞는 구체적 가이드**를 제공한다.

### 동작 흐름

```
사용자 질문 + (optional) faqContext
    ↓
① 임베딩 변환: OpenAI text-embedding-3-small → 1536차원 벡터
    ↓
② 컨텍스트 수집 (우선순위 순):
   0. [사용자 선택 FAQ] — faqContext가 있으면 최우선 주입
   1. [KB 수동 작성] — pgvector 코사인 유사도 Top 3 (팀이 직접 정리한 지식)
   2. [KB PDF 청크] — pgvector 코사인 유사도 Top 2 (QA 서적 참고)
    ↓
③ System Prompt 구성 → Claude API 호출
    ↓
④ SSE 스트리밍 응답 → 채팅 세션에 자동 저장
```

> v7부터 RAG 조회 시 `hit_count` 증가 로직 제거 — FAQ 큐레이션이 핀 기반으로 단순화되어 자동 카운팅 불필요.

### 컨텍스트 수집 전략

| 소스 | 검색 방식 | 상위 N건 | QA 활용 |
|------|-----------|----------|---------|
| 사용자 선택 FAQ | 직접 주입 (최우선) | 1건 | FAQ에서 선택한 지식을 맥락으로 심화 질문 |
| KB 수동 작성 | pgvector 코사인 유사도 | Top 3 | 팀이 정리한 핵심 QA 경험/전략 |
| KB PDF 청크 | pgvector 코사인 유사도 | Top 2 | QA 서적(ISTQB, 실무 가이드 등) 참고 |

**비용 최적화**: Chat 요청당 OpenAI 임베딩 API 호출 1회만 수행 (v4에서 FAQ 벡터 검색 제거로 2회→1회 절감)

### System Prompt 구조

```
You are a Senior QA Engineer AI assistant.
Answer the user's QA-related questions using the following context.

=== FAQ 참고 항목 (사용자가 선택한 항목) ===    ← faqContext (있을 때만)
제목: {title}
내용: {content}

=== QA Knowledge Base (직접 작성, 우선 참고) === ← 수동 KB Top 3
- {title}: {content}

=== QA Knowledge Base (도서 참고) ===            ← PDF KB Top 2
- {title}: {content}

Use the above context for accurate QA guidance.
If the context doesn't contain relevant information, use your general QA expertise.
Respond in the same language as the user's question.
```

---

## 채팅 세션 관리 — "대화를 잃어버리지 않는다"

QA가 AI에게 질문하고 받은 유용한 답변은 **크레딧을 소모한 자산**이다. My Senior는 모든 대화를 세션 단위로 DB에 영구 저장한다.

### 세션 생명주기

| 단계 | 동작 | 자동/수동 |
|------|------|-----------|
| 생성 | 첫 메시지 전송 시 새 세션 자동 생성 | 자동 |
| 제목 | 첫 사용자 메시지의 앞 50자로 자동 설정 | 자동 (이후 수정 가능) |
| 저장 | SSE 스트리밍 완료 후 user/assistant 메시지 모두 DB 저장 | 자동 |
| 열람 | 사이드바에서 과거 세션 클릭 → 전체 대화 로드 | 수동 |
| 삭제 | 세션 삭제 → 모든 메시지 CASCADE 삭제 | 수동 |

### 채팅 → KB 전환 — "좋은 답변을 팀 지식으로"

AI의 답변 중 **재사용 가치가 높은 것**을 KB에 저장하면, 다음 질문의 RAG 컨텍스트로 활용된다.

```
assistant 메시지 hover → [KB에 저장] 버튼 표시
    ↓
인라인 폼 열림:
  - 제목: 직전 user 질문 (자동 채움, 수정 가능)
  - 내용: assistant 응답 전문 (자동 채움, 수정 가능)
  - 카테고리: 직접 입력
    ↓
저장 → POST /api/kb → 비동기 임베딩 생성
    ↓
성공 토스트 → KB에 추가됨 → 다음 Chat에서 RAG 컨텍스트로 활용
```

---

## Knowledge Base — "팀 QA 지식의 중앙 저장소"

### 지식 등록 방법

| 방법 | 경로 | QA 활용 |
|------|------|---------|
| **수동 작성** | KB Management → + 추가 | 팀 경험, 테스트 전략, 트러블슈팅 가이드 직접 작성 |
| **PDF 업로드** | KB Management → PDF 업로드 | QA 서적, ISTQB 교재 등을 자동 청킹하여 등록 |
| **Chat에서 전환** | Chat → assistant 메시지 [KB에 저장] | AI의 유용한 답변을 즉시 KB로 저장 |

### KB 관리 기능

| 기능 | 설명 | QA 의미 |
|------|------|---------|
| **Pin (고정)** | 최대 **10건**까지 FAQ에 고정 노출 (v7), `/kb` 페이지에서 토글 | 신입 QA가 반드시 읽어야 할 핵심 지식 고정 |
| **Hit Count** | Chat RAG에서 조회된 횟수 자동 추적 | 팀이 실제로 많이 찾는 지식 = 실무에서 중요한 지식 |
| **카테고리** | 자유 분류 (자동완성 지원) | 테스트 전략, API 테스트, 성능 등 영역별 정리 |
| **Source 구분** | 수동 작성 vs PDF 청크 | 원본 출처 추적 가능 |

### PDF 업로드 파이프라인

```
PDF 파일 + 책 제목 업로드
    ↓
Job 생성 (PENDING → PROCESSING → DONE/FAILED)
    ↓
PDF → 텍스트 추출 → 청크 분할 → 각 청크별 임베딩 생성
    ↓
knowledge_base 테이블에 source={책 제목}으로 저장
    ↓
Chat RAG에서 벡터 검색 대상으로 활용
```

---

## Backend API

### Senior (채팅 + FAQ 큐레이션 + 세션)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/senior/chat` | SSE 스트리밍 AI 채팅 (body: `{ message, faqContext?, sessionId? }`) |
| GET | `/api/senior/faq` | 큐레이션된 FAQ 목록 (v7: 핀된 항목만, 최대 10건, 응답에 `snippet` 포함) |
| GET | `/api/senior/sessions` | 채팅 세션 목록 (최신순) |
| GET | `/api/senior/sessions/{id}` | 세션 상세 (메시지 포함) |
| POST | `/api/senior/sessions` | 새 세션 생성 |
| PATCH | `/api/senior/sessions/{id}` | 세션 제목 수정 |
| DELETE | `/api/senior/sessions/{id}` | 세션 삭제 (메시지 CASCADE) |

### Knowledge Base

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb` | KB 전체 조회 (검색, 정렬 지원) |
| GET | `/api/kb/{id}` | KB 단건 조회 |
| POST | `/api/kb` | KB 생성 (+ 비동기 임베딩) |
| PUT | `/api/kb/{id}` | KB 수정 (+ 비동기 임베딩) |
| DELETE | `/api/kb/{id}` | KB 삭제 (수동: 하드 삭제, PDF: 소프트 삭제) |
| PATCH | `/api/kb/{id}/pin` | KB 항목 고정 (v7: 최대 10건 제한) |
| PATCH | `/api/kb/{id}/unpin` | KB 항목 고정 해제 |
| POST | `/api/kb/upload-pdf` | PDF 업로드 (multipart: file, bookTitle) → jobId |
| GET | `/api/kb/jobs/{jobId}` | Job 상태 조회 |
| GET | `/api/kb/jobs` | 전체 Job 목록 |
| DELETE | `/api/kb/books/{source}` | 책 단위 전체 청크 + Job 삭제 |

---

## 데이터베이스 스키마

### knowledge_base (핵심 — FAQ + RAG의 데이터 소스)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| title | VARCHAR(200) NOT NULL | 제목 |
| content | TEXT NOT NULL | 내용 |
| category | VARCHAR(100) | 카테고리 |
| tags | VARCHAR(500) | 쉼표 구분 태그 |
| source | VARCHAR(200) | NULL=수동 작성, NOT NULL=PDF 청크(책 제목) |
| embedding | VECTOR(1536) | pgvector 임베딩 (OpenAI text-embedding-3-small) |
| hit_count | INTEGER NOT NULL DEFAULT 0 | Chat RAG 조회 횟수 (FAQ 큐레이션용) |
| pinned_at | TIMESTAMP DEFAULT NULL | 고정 시각 (NULL=미고정) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | 소프트 삭제 (PDF 청크용) |

### chat_session

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| title | VARCHAR(200) | 세션 제목 (첫 메시지 앞 50자 자동 설정) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### chat_message

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| session_id | BIGINT NOT NULL FK | chat_session 참조 (CASCADE 삭제) |
| role | VARCHAR(20) NOT NULL | 'user' 또는 'assistant' |
| content | TEXT NOT NULL | 메시지 내용 |
| created_at | TIMESTAMP | |

### faq (소프트 폐기)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| title | VARCHAR(200) NOT NULL | 제목 |
| content | TEXT NOT NULL | 내용 |
| tags | VARCHAR(500) | 쉼표 구분 태그 |
| embedding | VECTOR(1536) | pgvector 임베딩 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **참고**: v4에서 FAQ 데이터 소스가 `faq` → `knowledge_base` 테이블로 전환됨. `faq` 테이블은 기존 데이터 보존을 위해 DROP하지 않고 코드에서만 참조 제거 (소프트 폐기)

### 인덱스

| 인덱스 | 테이블 | 용도 |
|--------|--------|------|
| IVFFlat (vector_cosine_ops, lists=100) | `knowledge_base.embedding` | 벡터 유사 검색 |
| IVFFlat (vector_cosine_ops, lists=100) | `faq.embedding` | (소프트 폐기, 기존 유지) |
| Partial (pinned_at IS NOT NULL) | `knowledge_base.pinned_at` | 고정 항목 빠른 조회 |
| DESC | `knowledge_base.hit_count` | 조회수 정렬 |
| Standard | `chat_message.session_id` | 세션별 메시지 조회 |

---

## 파일 구조

### Backend (`backend/src/main/java/com/myqaweb/`)

```
senior/
├── SeniorController.java         # SSE 채팅 + 큐레이션 FAQ 조회
├── SeniorService.java            # 인터페이스
├── SeniorServiceImpl.java        # RAG 파이프라인 + 큐레이션 위임
├── ChatDto.java                  # ChatRequest (message, faqContext, sessionId)
├── ChatSessionEntity.java        # 채팅 세션 JPA 엔티티
├── ChatMessageEntity.java        # 채팅 메시지 JPA 엔티티
├── ChatSessionRepository.java    # 세션 JpaRepository
├── ChatSessionDto.java           # 세션 요청/응답 DTO
├── ChatSessionService.java       # 세션 서비스 인터페이스
├── ChatSessionServiceImpl.java   # 세션 CRUD + 메시지 저장
└── ChatSessionController.java    # 세션 REST 엔드포인트

knowledgebase/
├── KnowledgeBaseController.java  # KB CRUD + Pin/Unpin + PDF 업로드
├── KnowledgeBaseService.java     # 인터페이스 (getCuratedFaqs 포함)
├── KnowledgeBaseServiceImpl.java # KB CRUD + 큐레이션 알고리즘 + 임베딩
├── KnowledgeBaseEntity.java      # JPA 엔티티 (hitCount, pinnedAt 포함)
├── KnowledgeBaseRepository.java  # JpaRepository + 벡터 검색 + 큐레이션 쿼리
├── KnowledgeBaseDto.java         # 요청/응답 DTO
├── PdfUploadJobEntity.java       # PDF 업로드 Job 엔티티
└── PdfUploadJobRepository.java   # Job JpaRepository

common/
├── EmbeddingService.java         # OpenAI 임베딩 생성 + 벡터 문자열 변환
└── VectorType.java               # Hibernate UserType (pgvector PGobject ↔ float[] 변환)
```

### Frontend (`frontend/src/`)

```
pages/
└── SeniorPage.tsx                # FAQ/Chat 뷰 전환 + Header 토글

components/senior/
├── ChatView.tsx                  # SSE 채팅 UI + 세션 사이드바 + Markdown + KB 저장
├── FaqView.tsx                   # 큐레이션 FAQ 화면 (검색 + 카드 목록, 읽기 전용)
├── FaqCard.tsx                   # FAQ 카드 (Collapse/Expand + "Chat에서 더 물어보기")
├── KbManagementView.tsx          # KB 관리 (CRUD + Pin 토글 + hitCount 표시)
├── KbFormModal.tsx               # KB 생성/수정 모달
└── CompanyFeaturesView.tsx       # 회사/제품 읽기 전용 뷰

hooks/
├── useSeniorChat.ts              # 채팅 상태 + SSE 소비 + faqContext + sessionId
├── useCuratedFaq.ts              # 큐레이션 FAQ 조회 (읽기 전용)
├── useChatSessions.ts            # 세션 목록 CRUD
└── useKnowledgeBase.ts           # KB CRUD + Pin/Unpin

api/
└── senior.ts                     # chatApi (fetch SSE), faqApi, kbApi, sessionApi (axios)

types/
└── senior.ts                     # ChatMessage, FaqContext, KbItem, ChatSession 등
```

---

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| AI 채팅 | Spring AI ChatClient + Claude | Spring 생태계 통합, 안정적 스트리밍 |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) | 비용 효율 + 충분한 정확도 |
| 벡터 검색 | pgvector (PostgreSQL 15) + IVFFlat 코사인 유사도 | 별도 벡터 DB 불필요, PostgreSQL과 통합 |
| 스트리밍 | Backend: SseEmitter (Spring MVC) / Frontend: fetch + ReadableStream | WebFlux 도입 불필요, POST SSE 지원 |
| 임베딩 생성 | Java 21 Virtual Thread (비동기, 논블로킹) | 응답 지연 없이 백그라운드 임베딩 |
| Markdown | react-markdown + remark-gfm + @tailwindcss/typography | AI 응답의 서식 렌더링 |
| 타입 매핑 | VectorType (커스텀 Hibernate UserType) | Hibernate 6 + pgvector 호환성 해결 |

---

## 테스트

### Backend 단위 테스트

| 파일 | 테스트 수 | 대상 |
|------|-----------|------|
| `SeniorServiceImplTest.java` | ~13개 | RAG 파이프라인, 큐레이션 위임, hit_count, faqContext |
| `SeniorControllerTest.java` | ~16개 | REST 엔드포인트 (채팅, 큐레이션 FAQ, 세션) |
| `ChatSessionServiceImplTest.java` | ~13개 | 세션 CRUD, 메시지 저장 |
| `KnowledgeBaseServiceImplTest.java` | ~11개 | KB CRUD, Pin/Unpin, 큐레이션 알고리즘 |
| `EmbeddingServiceTest.java` | 6개 | 임베딩 생성, 벡터 변환 |

### E2E 테스트 (Playwright)

| 파일 | 테스트 수 | 대상 |
|------|-----------|------|
| `qa/api/senior-faq.spec.ts` | 2개 | 큐레이션 FAQ API |
| `qa/api/senior-session.spec.ts` | 8개 | 세션 CRUD API |
| `qa/api/kb-pin.spec.ts` | - | KB Pin/Unpin API |
| `qa/ui/senior.spec.ts` | 7개 + 2 skip | FAQ 진입, 뷰 전환, 세션 관리, KB 서브뷰 |

---

## 버전 히스토리

My Senior 관련 변경 이력을 시간순으로 기록한다. 각 버전 문서는 `docs/features/senior/` 디렉토리에 별도 파일로 존재한다.

### 타임라인

| 날짜 | 버전 문서 | 변경 유형 | 요약 |
|------|-----------|-----------|------|
| 2026-03-20 | [my-senior_v0.md](my-senior_v0.md) | 기능 추가 | My Senior 초기 설계. AI 시니어 QA 챗봇 + FAQ + KB 3탭 구조, RAG 파이프라인, SSE 스트리밍 |
| 2026-03-22 | [my-senior_v1.md](my-senior_v1.md) | 기능 추가 | FAQ 개선. 기본 진입 화면을 Chat → FAQ로 변경, FAQ → Chat 컨텍스트 전달, faqContext System Prompt 병합 |
| 2026-03-28 | [my-senior_v2.md](my-senior_v2.md) | 테스트 보강 | E2E 테스트 보강. API 5개 + UI 3개 추가 (수정 검증, 검색 필터링, Chat 컨텍스트 전달) |
| 2026-04-07 | [my-senior_v3.md](my-senior_v3.md) | 버그 수정 | Hibernate 6 + pgvector VECTOR 타입 매핑 오류 수정. 커스텀 VectorType UserType으로 PGobject ↔ float[] 변환 처리 |
| 2026-04-08 | [my-senior_v4.md](my-senior_v4.md) | 기능 개선 | FAQ → KB 기반 큐레이션 전환. 고정 15 + 조회수 Top 5 알고리즘, FAQ CRUD 제거, RAG에서 FAQ 벡터 검색 제거 (임베딩 2회→1회) |
| 2026-04-08 | [my-senior_v5.md](my-senior_v5.md) | 기능 개선 | RAG 컨텍스트에서 Company Features / Conventions 제거. 불필요한 노이즈 감소, KB 검색 결과 비중 강화 |
| 2026-04-10 | [my-senior_v6.md](my-senior_v6.md) | 기능 개선 | Chat 개선 3종: Markdown 렌더링(react-markdown), 채팅 기록 DB 저장(chat_session/chat_message), 채팅→KB 전환 기능 |
| 2026-04-10 | [my-senior_v6.1.md](my-senior_v6.1.md) | 버그 수정 | Senior Chat 403 Forbidden 에러 수정. native fetch에 JWT 토큰 누락 → Authorization 헤더 주입 |
| 2026-04-21 | [my-senior_v7.md](my-senior_v7.md) | 기능 개선 | UI Chat-First 재설계 (Hero/Chips/FAQ Section + 인라인 expand), FAQ 큐레이션 단순화 (핀 10건만), Chat Markdown 즉시 렌더링 보강, Chat→KB 저장 Category 자동완성, KB 관리 UI를 `/kb`로 통합 |
