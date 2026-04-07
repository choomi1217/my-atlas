# my-atlas 종합 테스트 플랜

> 변경 유형: 기능 추가  
> 작성일: 2026-03-23  
> 버전: v1  
> 상태: 완료

## Context

my-atlas는 Spring Boot + React + PostgreSQL/pgvector 기반의 QA 지식관리 애플리케이션이다. 
현재 Backend Unit Test 11개, E2E(Playwright) 8개 spec이 존재하나, **Integration Test 0개, Frontend Unit Test 0개, Convention 도메인 테스트 0개, KB Controller 테스트 0개** 등 상당한 테스트 Gap이 있다. 
특히 pgvector similarity search가 Integration Test 없이 운영되고 있어 `bytea → vector` 타입 불일치 버그가 이미 발생한 이력이 있다(commit `b170fdc`).

이 플랜은 **위험도 기반 우선순위**로 테스트를 체계적으로 보강하는 8주 로드맵이다.

---

## 1. 현재 상태 (Test Pyramid)

```
         /\
        /  \        E2E (Playwright): 8 spec files (~45 tests)
       /    \       UI 4 + API 4 (Features 도메인 중심)
      /------\
     /        \     Integration: 0개 ← 가장 큰 Gap
    /----------\
   /            \   Backend Unit: 11 files (~65 tests)
  /   Unit Tests \  Service 중심, Controller는 Senior만
 /________________\ Frontend Unit: 0개 ← 완전 부재
```

---

## 2. Gap 분석 및 위험도 매트릭스

| 기능 | 영향도 | 현재 커버리지 | 위험도 |
|------|--------|--------------|--------|
| pgvector similarity search | HIGH (RAG 핵심) | Integration: 0 | **CRITICAL** |
| PDF upload pipeline | HIGH (데이터 손실 가능) | Unit: partial | **HIGH** |
| SSE chat streaming | HIGH (핵심 UX) | Controller: skipped, FE: 0 | **HIGH** |
| Convention CRUD | MEDIUM | 전체 0 | **HIGH** |
| KB Controller + API E2E | MEDIUM | 0 | **HIGH** |
| Company activation mutex | MEDIUM | Unit: partial | **MEDIUM** |
| AI test case generation | MEDIUM | Unit: error case only | **MEDIUM** |
| Feature hierarchy CRUD | MEDIUM | Unit: good, E2E: good | **LOW** |

### 누락된 Backend Unit Tests

| 클래스 | 상태 |
|--------|------|
| `ConventionServiceImpl` / `ConventionController` | **파일 자체 없음** |
| `KnowledgeBaseController` | **파일 없음** (PDF multipart 포함) |
| `CompanyController`, `ProductController`, `SegmentController`, `TestCaseController` | **파일 없음** |
| `SeniorServiceImpl` - RAG context 조합, embedding 실패 graceful degradation | 부분 누락 |
| `TestCaseServiceImpl.generateDraft()` 성공 케이스 | 누락 |

### 누락된 E2E Tests

| Spec | 상태 |
|------|------|
| `qa/api/kb.spec.ts` (KB CRUD + job status) | **없음** |
| `qa/api/convention.spec.ts` | **없음** |
| `qa/api/senior-faq.spec.ts` | **없음** |
| KB UI E2E (Articles CRUD, source filtering) | 뷰 전환만 테스트 |

---

## 3. 실행 로드맵 (4 Phases, 8주)

### Phase 1: 기초 보강 (Week 1-2)

**목표:** 테스트 0인 도메인 커버

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 1-1 | Convention Service + Controller Test | `ConventionServiceImplTest.java`, `ConventionControllerTest.java` 신규 | 1일 |
| 1-2 | KB Controller Test (PDF multipart 포함) | `KnowledgeBaseControllerTest.java` 신규 | 1일 |
| 1-3 | Feature 도메인 Controller Tests | `CompanyControllerTest`, `ProductControllerTest`, `SegmentControllerTest`, `TestCaseControllerTest` 신규 | 2일 |
| 1-4 | KB API E2E | `qa/api/kb.spec.ts` 신규 | 1일 |
| 1-5 | Convention API E2E | `qa/api/convention.spec.ts` 신규 | 0.5일 |
| 1-6 | Senior FAQ API E2E | `qa/api/senior-faq.spec.ts` 신규 | 0.5일 |

**테스트 시나리오 상세:**

Convention Service Tests:
- `findAll_returnsAllConventions`
- `findAll_returnsEmptyList`
- `findById_returnsWhenExists` / `findById_returnsEmptyWhenNotFound`
- `create_savesAndReturnsResponse`
- `update_updatesAndReturns` / `update_throwsWhenNotFound`
- `delete_deletesWhenExists` / `delete_throwsWhenNotFound`

Convention Controller Tests:
- `list_returnsOk`, `getById_returns404WhenNotFound`
- `create_returns201`, `create_returns400WhenTermBlank`
- `update_returnsOk`, `delete_returnsOk`

KB Controller Tests:
- `list_returnsOkWithItems`, `create_returns201`
- `uploadPdf_returns201WithJobId`, `uploadPdf_returns400WhenFileEmpty`
- `getJob_returnsJobStatus`, `getAllJobs_returnsJobList`
- `deleteBook_deletesChunksAndJob`

KB API E2E (`qa/api/kb.spec.ts`):
- `GET /api/kb` empty state → 200
- `POST /api/kb` create manual entry → 201
- `GET /api/kb/{id}` retrieve → 200
- `PUT /api/kb/{id}` update → 200
- `DELETE /api/kb/{id}` delete → 200
- `GET /api/kb/jobs` list jobs → 200

**Phase 1 완료 기준:** Backend coverage 60% → 75%+, E2E API 4 → 7 도메인

---

### Phase 2: Integration Test 인프라 + pgvector 검증 (Week 3-4)

**목표:** Testcontainers로 pgvector integration test 구축

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 2-1 | Testcontainers 의존성 추가 | `build.gradle` | 0.5일 |
| 2-2 | Base integration test class | `BaseIntegrationTest.java` 신규 (`@SpringBootTest` + `@Testcontainers` + pgvector:pg15) | 0.5일 |
| 2-3 | KB vector search integration test | `KnowledgeBaseIntegrationTest.java` 신규 | 1일 |
| 2-4 | FAQ vector search integration test | `FaqIntegrationTest.java` 신규 | 1일 |
| 2-5 | PDF pipeline integration test | `PdfPipelineIntegrationTest.java` 신규 | 1.5일 |
| 2-6 | Company activation mutex test | `CompanyActivationIntegrationTest.java` 신규 | 0.5일 |

**테스트 시나리오 상세:**

KB Vector Search:
- `findSimilar_withEmbeddedContent_returnsTopKByCosineSimilarity`: 5개 KB entry 저장 후 유사 query vector로 top 3 조회, 순서 검증
- `findSimilar_withNoEmbeddings_returnsEmpty`: embedding이 null인 entry는 결과에 포함되지 않는지
- `findSimilar_vectorTypeCasting_worksWithPgvector`: `cast(:queryVector as vector)` native query가 실제 pgvector에서 동작하는지 (b170fdc 재발 방지)

PDF Pipeline:
- `startUpload_createsJobInPendingState`: upload 호출 시 PENDING job 생성
- `processJob_parsesAndChunksAndStores`: 실제 PDF → chunk → DB 저장 (embedding은 mock)
- `processJob_failureMarksJobAsFailed`: 처리 중 exception 시 job status FAILED

Company Activation Mutex:
- `setActive_deactivatesPreviousAndActivatesNew`: 동시에 1개만 active 보장
- `setActive_firstActivation_succeeds`: 기존 active 없을 때 정상 활성화

**Phase 2 완료 기준:** pgvector 관련 runtime 버그 사전 방지, Integration test layer 확보

---

### Phase 3: Frontend Unit Test 인프라 + 핵심 로직 (Week 5-6)

**목표:** Frontend test 환경 구축 및 SSE/Hook 로직 검증

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 3-1 | Vitest + RTL 설정 | `vitest.config.ts`, `package.json` 수정 | 1일 |
| 3-2 | useSeniorChat hook test | `useSeniorChat.test.ts` 신규 | 1.5일 |
| 3-3 | chatApi SSE parsing test | `senior.test.ts` 신규 | 0.5일 |
| 3-4 | FaqView + FaqCard component test | `FaqView.test.tsx`, `FaqCard.test.tsx` 신규 | 1일 |
| 3-5 | ChatView component test | `ChatView.test.tsx` 신규 | 0.5일 |
| 3-6 | SeniorPage view 전환 test | `SeniorPage.test.tsx` 신규 | 0.5일 |
| 3-7 | Frontend CI strict mode 전환 | `frontend-ci.yml` 수정 (`continue-on-error` 제거) | 0.5일 |

**테스트 시나리오 상세:**

useSeniorChat Hook:
- `sendMessage_transitionsToStreamingState`: 전송 시 `isStreaming=true`
- `onChunk_appendsToAssistantMessage`: SSE chunk 수신 시 메시지 누적
- `onDone_setsStreamingFalse`: 스트림 완료 시 상태 전환
- `abort_cancelsStreamViaAbortController`: abort 호출 시 fetch 취소
- `sendMessage_withFaqContext_includesInRequest`: FAQ context 전달 검증
- `error_setsErrorState`: network error 시 error state 설정

chatApi SSE Parsing:
- `streamChat_parsesDataPrefix_correctly`: `data:` prefix 파싱
- `streamChat_handlesMultipleChunks`: 여러 chunk 연속 수신
- `streamChat_callsOnError_onNetworkFailure`: fetch 실패 시 onError 콜백

**필요 패키지:** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`

**Phase 3 완료 기준:** Frontend unit test coverage 0% → 40%+

---

### Phase 4: 보강 + 비기능 테스트 (Week 7-8)

**목표:** RAG pipeline 보강, 보안/성능 기준선 확립

| # | 작업 | 파일 | 예상 |
|---|------|------|------|
| 4-1 | SeniorServiceImpl RAG context 보강 | `SeniorServiceImplTest.java` 수정 | 1일 |
| 4-2 | generateDraft() 성공 케이스 | `TestCaseServiceImplTest.java` 수정 | 0.5일 |
| 4-3 | PdfProcessingWorker full flow | `PdfProcessingWorkerTest.java` 수정 | 0.5일 |
| 4-4 | KB UI E2E 보강 (CRUD + filtering) | `qa/ui/senior.spec.ts` 수정 | 1일 |
| 4-5 | Security: SQL injection + XSS 검증 | 별도 security test | 1일 |
| 4-6 | JaCoCo 70% threshold strict 전환 | `backend-ci.yml` 수정 | 0.5일 |
| 4-7 | Performance baseline 측정 | chat latency, vector search latency 기록 | 1일 |

**RAG Pipeline 보강 시나리오:**
- `buildRagContext_withActiveCompany_includesProductsAndSegments`
- `buildRagContext_withKbAndFaqResults_combinesAllSources`
- `chat_whenEmbeddingServiceFails_stillStreamsResponse` (graceful degradation)
- `scheduleEmbeddingGeneration_savesEmbeddingAsync`

**Security 시나리오:**
- `findSimilar` vector string에 SQL injection 시도 → parameterized query 방어 확인
- FAQ title/content에 `<script>alert(1)</script>` → React escaping 확인
- PDF upload에 `.exe` 파일 위장 → content-type 검증 확인
- `ANTHROPIC_API_KEY`가 DEBUG 로그에 노출되지 않는지 확인

**Phase 4 완료 기준:** Backend coverage 80%+, JaCoCo strict, 보안 기준선 확보

---

## 4. 테스트 환경 및 도구

| 도구 | 용도 | 상태 |
|------|------|------|
| JUnit 5 + Mockito | Backend Unit | 사용 중 |
| `@WebMvcTest` + MockMvc | Controller Test | Senior만 적용, 나머지 추가 필요 |
| **Testcontainers** (`pgvector/pgvector:pg15`) | Integration Test | Phase 2에서 추가 |
| JaCoCo | Coverage | 사용 중 (soft-fail → Phase 4에서 strict) |
| **Vitest + React Testing Library** | Frontend Unit | Phase 3에서 추가 |
| **MSW** | Frontend API mock | Phase 3에서 추가 |
| Playwright | E2E | 사용 중 |

---

## 5. 검증 방법 (Verification)

각 Phase 완료 시:
```bash
# Backend unit + integration tests
cd backend && ./gradlew test

# Frontend unit tests (Phase 3 이후)
cd frontend && npm test

# E2E tests (full stack)
docker compose up -d && sleep 10
cd qa && npx playwright test
docker compose down
```

Coverage 확인:
```bash
cd backend && ./gradlew test jacocoTestReport
# build/reports/jacoco/test/html/index.html
```
