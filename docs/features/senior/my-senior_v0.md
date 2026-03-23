# My Senior 기능 명세 및 상세 설계 (v1)

## My Senior 개념

AI가 시니어 QA처럼 조언해주는 챗봇.
질문이 들어오면 아래 데이터를 RAG로 참조해서 Claude API가 답변.

## 참조 데이터 (컨텍스트 주입 순서)

1. Company Features - 회사 기능 프롬프트 저장소
2. Knowledge Base - QA 서적 요약 프롬프트
3. FAQ / 개인 위키 - 내가 직접 쓴 QA 경험글
4. Words Conventions - 팀 용어 컨벤션

## RAG 구조

- 질문 → 임베딩 변환 → pgvector 유사 검색 → 관련 청크 Top-K 추출 → System Prompt에 주입 → Claude API 호출 → SSE 스트리밍 응답

## 화면 구성 (3개 탭)

1. Chat - AI 챗봇 인터페이스
2. FAQ 게시판 - 자주 겪는 QA 상황 카드뷰 (직접 작성 가능)
3. Knowledge Base 관리 - QA 서적 프롬프트 등록 / Company Features 연동

---

# 상세 설계

## 1. 데이터베이스 스키마 (V4 마이그레이션)

**파일:** `backend/src/main/resources/db/migration/V4__create_senior_tables.sql`

### 테이블 설계

```sql
-- FAQ 테이블 (개인 QA 경험/위키)
CREATE TABLE faq (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    tags        VARCHAR(500),
    embedding   VECTOR(1536),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base 테이블 (QA 서적 프롬프트)
CREATE TABLE knowledge_base (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    category    VARCHAR(100),
    tags        VARCHAR(500),
    embedding   VECTOR(1536),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Convention 테이블 (팀 용어 컨벤션)
CREATE TABLE convention (
    id          BIGSERIAL PRIMARY KEY,
    term        VARCHAR(200) NOT NULL,
    definition  TEXT NOT NULL,
    category    VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 벡터 검색용 IVFFlat 인덱스
CREATE INDEX idx_faq_embedding ON faq USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kb_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 설계 결정

- `tags`는 VARCHAR(500) — 소규모 QA 도구에서 별도 조인 테이블은 과도
- KB에 company FK 없음 — KB는 글로벌 QA 지식, 회사별이 아님
- Convention에 embedding 없음 — 소량 데이터(전체 조회), 유사 검색 불필요
- IVFFlat lists=100 — V1 기존 패턴과 동일

---

## 2. Backend 아키텍처

### 2.1 패키지 배치

| 엔티티 | 패키지 | 근거 |
|--------|--------|------|
| FAQ | `senior/` | Senior 챗봇 전용 개인 위키 |
| KnowledgeBase | `knowledgebase/` | 기존 스텁 패키지, `/kb` 라우트와 공유 |
| Convention | `convention/` | 기존 스텁 패키지, `/conventions` 라우트와 공유 |
| EmbeddingService | `common/` | FAQ/KB 양쪽에서 공유 |

### 2.2 Senior 패키지 (핵심)

**SeniorController.java** (수정)
```
POST /api/senior/chat          → SseEmitter (SSE 스트리밍)
GET  /api/senior/faq           → ApiResponse<List<FaqResponse>>
GET  /api/senior/faq/{id}      → ApiResponse<FaqResponse>
POST /api/senior/faq           → ApiResponse<FaqResponse>
PUT  /api/senior/faq/{id}      → ApiResponse<FaqResponse>
DELETE /api/senior/faq/{id}    → ApiResponse<Void>
```

**SeniorService.java** (수정 → 인터페이스)
```java
public interface SeniorService {
    SseEmitter chat(String userMessage);
    List<FaqResponse> findAllFaqs();
    Optional<FaqResponse> findFaqById(Long id);
    FaqResponse createFaq(FaqRequest request);
    FaqResponse updateFaq(Long id, FaqRequest request);
    void deleteFaq(Long id);
}
```

**SeniorServiceImpl.java** (신규)
- ChatClient, EmbeddingService, FaqRepository, KnowledgeBaseRepository, CompanyRepository, ConventionRepository 주입
- `chat()` — RAG 파이프라인 + SSE 스트리밍 (섹션 3 참고)
- FAQ CRUD — CompanyServiceImpl 패턴 따름

**FaqEntity.java** (신규) — `@Entity @Table(name = "faq")`
- id, title, content, tags, embedding(`float[]`, `columnDefinition = "VECTOR(1536)"`), createdAt, updatedAt

**FaqRepository.java** (스텁 교체) — `extends JpaRepository<FaqEntity, Long>`
- 네이티브 쿼리: `SELECT * FROM faq WHERE embedding IS NOT NULL ORDER BY embedding <=> cast(:query as vector) LIMIT :topK`

**FaqDto.java** (신규)
```java
public record FaqRequest(@NotBlank String title, @NotBlank String content, String tags) {}
public record FaqResponse(Long id, String title, String content, String tags,
                          LocalDateTime createdAt, LocalDateTime updatedAt) {}
```

**ChatDto.java** (신규)
```java
public record ChatRequest(@NotBlank String message) {}
```

**SeniorRepository.java** — 삭제 (FaqRepository로 대체)

### 2.3 KnowledgeBase 패키지 (스텁 → 구현)

**KnowledgeBaseController.java** (수정)
```
GET    /api/kb           → ApiResponse<List<KbResponse>>
GET    /api/kb/{id}      → ApiResponse<KbResponse>
POST   /api/kb           → ApiResponse<KbResponse>
PUT    /api/kb/{id}      → ApiResponse<KbResponse>
DELETE /api/kb/{id}      → ApiResponse<Void>
```

**KnowledgeBaseService.java** (수정 → 인터페이스)
**KnowledgeBaseServiceImpl.java** (신규) — CRUD + 임베딩 생성
**KnowledgeBaseEntity.java** (신규) — id, title, content, category, tags, embedding, createdAt, updatedAt
**KnowledgeBaseRepository.java** (수정) — JpaRepository + 벡터 검색 네이티브 쿼리
**KnowledgeBaseDto.java** (신규)

### 2.4 Convention 패키지 (스텁 → 구현)

**ConventionController.java** (수정)
```
GET    /api/conventions           → ApiResponse<List<ConventionResponse>>
POST   /api/conventions           → ApiResponse<ConventionResponse>
PUT    /api/conventions/{id}      → ApiResponse<ConventionResponse>
DELETE /api/conventions/{id}      → ApiResponse<Void>
```

**ConventionService.java** (수정 → 인터페이스)
**ConventionServiceImpl.java** (신규)
**ConventionEntity.java** (신규) — id, term, definition, category, createdAt
**ConventionRepository.java** (수정) — JpaRepository
**ConventionDto.java** (신규)

### 2.5 Common 패키지

**EmbeddingService.java** (신규)
- `@Qualifier("openAiEmbeddingModel")` EmbeddingModel 주입
- `float[] embed(String text)` — 임베딩 생성
- FAQ/KB Repository의 네이티브 쿼리가 벡터 검색을 직접 수행

### 2.6 SSE 스트리밍 구현

```java
// SeniorController
@PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter chat(@Valid @RequestBody ChatDto.ChatRequest request) {
    return seniorService.chat(request.message());
}

// SeniorServiceImpl
public SseEmitter chat(String userMessage) {
    SseEmitter emitter = new SseEmitter(120_000L); // 2분 타임아웃

    // 1. RAG 컨텍스트 수집
    String systemPrompt = buildRagContext(userMessage);

    // 2. ChatClient 스트리밍 호출
    Flux<String> stream = chatClient.prompt()
        .system(systemPrompt)
        .user(userMessage)
        .stream()
        .content();

    // 3. Flux → SseEmitter 브릿지
    stream.subscribe(
        chunk -> emitter.send(SseEmitter.event().data(chunk)),
        emitter::completeWithError,
        emitter::complete
    );

    return emitter;
}
```

**선택 근거:** SseEmitter (Spring MVC) — 프로젝트가 spring-boot-starter-web 기반, WebFlux 추가는 과도

---

## 3. RAG 파이프라인 설계

### 3.1 쿼리 흐름

```
사용자 질문 수신
    ↓
1. 임베딩 변환: embeddingService.embed(userMessage) → float[1536]
    ↓
2. 컨텍스트 수집 (병렬):
   a. FAQ: faqRepository.searchSimilar(embedding, topK=3)
   b. KB: kbRepository.searchSimilar(embedding, topK=3)
   c. Features: companyRepository.findByIsActiveTrue() → 제품/세그먼트 트리
   d. Conventions: conventionRepository.findAll()
    ↓
3. 시스템 프롬프트 구성 (buildSystemPrompt)
    ↓
4. ChatClient 스트리밍 호출
    ↓
5. SSE로 프론트엔드에 스트리밍 응답
```

### 3.2 Top-K 전략

| 소스 | 검색 방식 | 개수 |
|------|-----------|------|
| FAQ | pgvector 코사인 유사도 | Top 3 |
| KB | pgvector 코사인 유사도 | Top 3 |
| Features | 활성 회사 전체 조회 (구조화 데이터) | ALL |
| Conventions | 전체 조회 (소량 데이터) | ALL |

### 3.3 임베딩 생성 시점

- FAQ/KB **생성/수정 시** 동기적으로 임베딩 생성 (OpenAI API ~500ms 이내)
- v1에서는 동기 처리, 필요 시 `@Async`로 전환 가능

### 3.4 시스템 프롬프트 템플릿

```
You are a Senior QA Engineer AI assistant.
Answer the user's QA-related questions using the following context.

=== Company Features ===
Company: {name}
Product: {name} ({platform})
  Segments: {hierarchy}

=== QA Knowledge Base ===
- {title}: {content}

=== FAQ / Personal Notes ===
- {title}: {content}

=== Terminology Conventions ===
- {term}: {definition}

Use the above context for accurate, company-specific QA guidance.
If context is insufficient, use general QA expertise.
Always use terminology conventions when applicable.
Respond in the same language as the user's question.
```

---

## 4. Frontend 아키텍처

### 4.1 3탭 레이아웃 (드릴다운 방식)

SeniorPage 내부에 3개 탭이 전체 너비를 사용하는 드릴다운 구조:
- `useState<'chat' | 'faq' | 'kb'>` 로 탭 상태 관리
- 탭 전환 시 해당 뷰가 전체 콘텐츠 영역을 차지

### 4.2 파일 구조

```
frontend/src/
├── types/senior.ts               # ChatMessage, FaqItem, KbItem, 요청 타입
├── api/senior.ts                 # SSE 스트리밍 chat + FAQ CRUD + KB CRUD
├── hooks/
│   ├── useSeniorChat.ts          # 채팅 메시지 상태 + SSE 소비
│   ├── useFaq.ts                 # FAQ CRUD 상태 관리
│   └── useKnowledgeBase.ts       # KB CRUD 상태 관리
├── components/senior/
│   ├── SeniorTabBar.tsx          # 3탭 네비게이션
│   ├── ChatView.tsx              # 채팅 인터페이스 (SSE 스트리밍 표시)
│   ├── FaqListView.tsx           # FAQ 카드 그리드 + CRUD
│   ├── FaqFormModal.tsx          # FAQ 생성/수정 모달
│   ├── KbManagementView.tsx      # KB 목록 + CRUD + Company Features 서브뷰
│   ├── KbFormModal.tsx           # KB 생성/수정 모달
│   └── CompanyFeaturesView.tsx   # 회사 기능 읽기 전용 뷰
└── pages/SeniorPage.tsx          # 탭 컨테이너 (placeholder 교체)
```

### 4.3 SSE 스트리밍 소비 (Frontend)

`EventSource`는 GET만 지원하므로, `fetch()` + `ReadableStream`으로 POST SSE 소비:

```typescript
export const seniorApi = {
  streamChat: (
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void
  ) => {
    fetch(`${API_BASE_URL}/api/senior/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).then(response => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) { onDone(); return; }
          onChunk(decoder.decode(value, { stream: true }));
          read();
        });
      }
      read();
    });
  },
};
```

### 4.4 상태 관리

**로컬 useState + 커스텀 훅** 사용 (Zustand 불필요):
- 채팅 메시지: 일시적(페이지 이동 시 소멸), 영속 불필요
- FAQ/KB 데이터: 탭 활성화 시 API 재조회
- 도메인 간 상태 공유 없음

---

## 5. 구현 순서 (Phase별)

### Phase 1: DB + Entity (기반)

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 1 | `V4__create_senior_tables.sql` | 신규 | Flyway 마이그레이션 |
| 2 | `FaqEntity.java`, `FaqDto.java`, `ChatDto.java` | 신규 | FAQ 엔티티 + DTO |
| 3 | `KnowledgeBaseEntity.java`, `KnowledgeBaseDto.java` | 신규 | KB 엔티티 + DTO |
| 4 | `ConventionEntity.java`, `ConventionDto.java` | 신규 | Convention 엔티티 + DTO |

### Phase 2: Repository + EmbeddingService

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 5 | `FaqRepository.java` | 교체 | JpaRepository + 벡터 검색 |
| 6 | `KnowledgeBaseRepository.java` | 교체 | JpaRepository + 벡터 검색 |
| 7 | `ConventionRepository.java` | 교체 | JpaRepository |
| 8 | `EmbeddingService.java` | 신규 | 공유 임베딩 서비스 |

### Phase 3: Service (비즈니스 로직 + RAG)

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 9 | `SeniorService.java` | 수정 | 인터페이스 변환 |
| 10 | `SeniorServiceImpl.java` | 신규 | RAG + SSE + FAQ CRUD |
| 11 | `KnowledgeBaseService.java` | 수정 | 인터페이스 변환 |
| 12 | `KnowledgeBaseServiceImpl.java` | 신규 | KB CRUD + 임베딩 |
| 13 | `ConventionService.java` | 수정 | 인터페이스 변환 |
| 14 | `ConventionServiceImpl.java` | 신규 | Convention CRUD |

### Phase 4: Controller

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 15 | `SeniorController.java` | 수정 | SSE 채팅 + FAQ CRUD |
| 16 | `KnowledgeBaseController.java` | 수정 | KB CRUD |
| 17 | `ConventionController.java` | 수정 | Convention CRUD |
| 18 | `SeniorRepository.java` | 삭제 | FaqRepository로 대체 |

### Phase 5: Frontend 타입 + API

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 19 | `types/senior.ts` | 신규 | 타입 정의 |
| 20 | `api/senior.ts` | 신규 | API 클라이언트 |

### Phase 6: Frontend 훅

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 21 | `useSeniorChat.ts` | 신규 | 채팅 + SSE 훅 |
| 22 | `useFaq.ts` | 신규 | FAQ CRUD 훅 |
| 23 | `useKnowledgeBase.ts` | 신규 | KB CRUD 훅 |

### Phase 7: Frontend 컴포넌트 + 페이지

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 24 | `SeniorTabBar.tsx` | 신규 | 3탭 네비게이션 |
| 25 | `ChatView.tsx` | 신규 | 채팅 UI |
| 26 | `FaqListView.tsx`, `FaqFormModal.tsx` | 신규 | FAQ 카드뷰 + 모달 |
| 27 | `KbManagementView.tsx`, `KbFormModal.tsx`, `CompanyFeaturesView.tsx` | 신규 | KB 관리 + 회사 기능 뷰 |
| 28 | `SeniorPage.tsx` | 수정 | placeholder → 탭 컨테이너 |

### Phase 8: 테스트

| # | 파일 | 액션 | 설명 |
|---|------|------|------|
| 29 | `SeniorServiceImplTest.java` | 신규 | RAG + FAQ 단위 테스트 |
| 30 | `SeniorControllerTest.java` | 신규 | 컨트롤러 테스트 |
| 31 | `KnowledgeBaseServiceImplTest.java` | 신규 | KB 단위 테스트 |
| 32 | `EmbeddingServiceTest.java` | 신규 | 임베딩 단위 테스트 |
| 33 | `qa/tests/senior.spec.ts` | 신규 | Playwright E2E |

---

## 6. 검증 방법

```bash
# 빌드
cd backend && ./gradlew clean build

# 단위 테스트
cd backend && ./gradlew test

# Full Stack E2E
cd /Users/yeongmi/dev/qa/my-atlas && docker compose up -d && sleep 10
cd qa && npx playwright test
docker compose down
```

### 수동 검증

1. Chat 탭: 질문 입력 → SSE 스트리밍 응답 확인
2. FAQ 탭: 생성/조회/수정/삭제 동작 확인
3. KB 탭: KB CRUD + Company Features 읽기 뷰 확인

