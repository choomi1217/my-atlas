# My Senior — 기능 요약서

## 개요

AI 시니어 QA 챗봇 기능. 사용자 질문에 대해 RAG(Retrieval-Augmented Generation) 파이프라인으로 사내 QA 데이터를 참조한 뒤, Claude API를 통해 SSE 스트리밍으로 답변을 생성한다.

---

## 화면 구성 (3탭 드릴다운)

| 탭 | 설명 |
|----|------|
| **Chat** | Claude AI 챗봇 인터페이스 (SSE 실시간 스트리밍) |
| **FAQ** | 개인 QA 경험/위키 카드뷰 (CRUD) |
| **KB Management** | QA 서적 프롬프트 등록 + Company Features 읽기 뷰 |

---

## RAG 파이프라인

```
사용자 질문
    ↓
1. 임베딩 변환 (OpenAI text-embedding-3-small → 1536차원)
    ↓
2. 컨텍스트 수집:
   a. Company Features — 활성 회사의 제품/세그먼트 트리 (전체 조회)
   b. Knowledge Base — pgvector 코사인 유사도 Top 3
   c. FAQ — pgvector 코사인 유사도 Top 3
   d. Conventions — 팀 용어 컨벤션 (전체 조회)
    ↓
3. System Prompt 구성 → Claude API 호출
    ↓
4. SSE 스트리밍 응답
```

---

## Backend API

### Senior (채팅 + FAQ)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/senior/chat` | SSE 스트리밍 AI 채팅 |
| GET | `/api/senior/faq` | FAQ 전체 조회 |
| GET | `/api/senior/faq/{id}` | FAQ 단건 조회 |
| POST | `/api/senior/faq` | FAQ 생성 (+ 비동기 임베딩) |
| PUT | `/api/senior/faq/{id}` | FAQ 수정 (+ 비동기 임베딩) |
| DELETE | `/api/senior/faq/{id}` | FAQ 삭제 |

### Knowledge Base

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/kb` | KB 전체 조회 |
| GET | `/api/kb/{id}` | KB 단건 조회 |
| POST | `/api/kb` | KB 생성 (+ 비동기 임베딩) |
| PUT | `/api/kb/{id}` | KB 수정 (+ 비동기 임베딩) |
| DELETE | `/api/kb/{id}` | KB 삭제 |

### Convention

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/conventions` | Convention 전체 조회 |
| GET | `/api/conventions/{id}` | Convention 단건 조회 |
| POST | `/api/conventions` | Convention 생성 |
| PUT | `/api/conventions/{id}` | Convention 수정 |
| DELETE | `/api/conventions/{id}` | Convention 삭제 |

---

## 데이터베이스 스키마 (V4)

### faq
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| title | VARCHAR(200) NOT NULL | 제목 |
| content | TEXT NOT NULL | 내용 |
| tags | VARCHAR(500) | 쉼표 구분 태그 |
| embedding | VECTOR(1536) | pgvector 임베딩 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### knowledge_base
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| title | VARCHAR(200) NOT NULL | 제목 |
| content | TEXT NOT NULL | 내용 |
| category | VARCHAR(100) | 카테고리 |
| tags | VARCHAR(500) | 쉼표 구분 태그 |
| embedding | VECTOR(1536) | pgvector 임베딩 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### convention
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL PK | |
| term | VARCHAR(200) NOT NULL | 용어 |
| definition | TEXT NOT NULL | 정의 |
| category | VARCHAR(100) | 카테고리 |
| created_at | TIMESTAMP | |

**인덱스:** `faq.embedding`, `knowledge_base.embedding` — IVFFlat (vector_cosine_ops, lists=100)

---

## 파일 구조

### Backend (`backend/src/main/java/com/myqaweb/`)

```
senior/
├── SeniorController.java      # SSE 채팅 + FAQ CRUD 엔드포인트
├── SeniorService.java         # 인터페이스
├── SeniorServiceImpl.java     # RAG 파이프라인 + FAQ CRUD + 비동기 임베딩
├── FaqEntity.java             # JPA 엔티티
├── FaqRepository.java         # JpaRepository + pgvector 유사 검색
├── FaqDto.java                # FaqRequest / FaqResponse 레코드
└── ChatDto.java               # ChatRequest 레코드

knowledgebase/
├── KnowledgeBaseController.java
├── KnowledgeBaseService.java
├── KnowledgeBaseServiceImpl.java
├── KnowledgeBaseEntity.java
├── KnowledgeBaseRepository.java
└── KnowledgeBaseDto.java

convention/
├── ConventionController.java
├── ConventionService.java
├── ConventionServiceImpl.java
├── ConventionEntity.java
├── ConventionRepository.java
└── ConventionDto.java

common/
└── EmbeddingService.java      # OpenAI 임베딩 생성 + 벡터 문자열 변환
```

### Frontend (`frontend/src/`)

```
pages/
└── SeniorPage.tsx             # 3탭 컨테이너

components/senior/
├── SeniorTabBar.tsx           # Chat | FAQ | KB Management 탭
├── ChatView.tsx               # SSE 스트리밍 채팅 UI
├── FaqListView.tsx            # FAQ 카드 그리드 + CRUD
├── FaqFormModal.tsx           # FAQ 생성/수정 모달
├── KbManagementView.tsx       # KB 목록 + Company Features 서브뷰
├── KbFormModal.tsx            # KB 생성/수정 모달
└── CompanyFeaturesView.tsx    # 회사/제품 읽기 전용 뷰

hooks/
├── useSeniorChat.ts           # 채팅 상태 + SSE 소비
├── useFaq.ts                  # FAQ CRUD 상태
└── useKnowledgeBase.ts        # KB CRUD 상태

api/
└── senior.ts                  # chatApi (fetch SSE), faqApi, kbApi (axios)

types/
└── senior.ts                  # ChatMessage, FaqItem, KbItem, ConventionItem
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| AI 채팅 | Spring AI ChatClient + Claude claude-3-5-sonnet-20241022 |
| 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| 벡터 검색 | pgvector (PostgreSQL 15) + IVFFlat 코사인 유사도 |
| 스트리밍 | Backend: SseEmitter (Spring MVC) / Frontend: fetch + ReadableStream |
| 임베딩 생성 | Java 21 Virtual Thread (비동기, 논블로킹) |
| 상태 관리 | React hooks (useState/useCallback), Zustand 미사용 |

---

## 테스트

### Backend 단위 테스트
- `SeniorServiceImplTest.java` — FAQ CRUD 8개 테스트
- `SeniorControllerTest.java` — REST 엔드포인트 12개 테스트
- `KnowledgeBaseServiceImplTest.java` — KB CRUD 8개 테스트
- `EmbeddingServiceTest.java` — 임베딩 + 벡터 변환 6개 테스트

### E2E 테스트 (Playwright)
- `qa/ui/senior.spec.ts` — 페이지 로드, 탭 전환, FAQ CRUD, KB 서브뷰 (8개 시나리오)

### 검증 결과
- `./gradlew clean build` — PASSED
- `./gradlew test` — 65 passed, 0 failed
- `npx playwright test` — 60 passed, 0 failed
