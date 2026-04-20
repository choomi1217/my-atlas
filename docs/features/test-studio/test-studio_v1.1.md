# Test Studio — v1.1: 초기 동작 검증에서 발견된 버그 3건 수정

> 변경 유형: 버그 수정
> 작성일: 2026-04-20
> 버전: v1.1
> 상태: 완료

---

## 배경

v1 구현 후 User 가 `my-atlas` Company 에서 실사용 검증 중 아래 3건의 버그가 드러났다. Unit / Integration / E2E 테스트 전부 통과한 상태에서 발생했으며, 모두 **Mock 기반 테스트로는 잡을 수 없는 런타임·환경 특성 버그**였다. v1.1 은 이 3건을 수정하고, 재발 방지를 위한 회귀 테스트를 보강한다.

---

## 버그 1 — Job 이 PENDING 에서 멈춤 (트랜잭션 가시성)

### 증상

- Frontend 에서 Job 제출 → 201 jobId 반환 → 리스트에 `PENDING` 표시
- 이후 `PROCESSING` / `DONE` 으로 전환되지 않음
- 백엔드 로그: `[task-1] WARN TestStudioGenerator - Test Studio job not found: 10`

### 원인

`TestStudioServiceImpl.submitJob` 에 `@Transactional` 이 적용되어 있었다. 컨트롤러 스레드에서 `jobRepository.save(job)` 후 `generator.generate(...)` 를 호출하지만, `@Async` 스레드(`task-1`)가 **outer transaction 이 아직 커밋되기 전에** 시작된다. 새 스레드 내부의 `jobRepository.findById(jobId)` 는 아직 커밋되지 않은 row 를 볼 수 없어 empty 를 반환 → 조용히 종료.

### 수정

- `TestStudioServiceImpl.java` — `submitJob` 의 `@Transactional` 제거
- Spring Data JPA 의 `save()` 가 자체적으로 REQUIRED 트랜잭션을 열고 커밋하므로 row 는 async 호출 직후 조회 가능
- `PdfPipelineServiceImpl.startUpload` 와 동일한 패턴

### 테스트가 못 잡은 이유

- `TestStudioIntegrationTest` 는 Testcontainers 환경에서 `@MockBean ChatClient` 를 주입 → `@Async` 태스크 디스패처 타이밍이 로컬 Docker 런타임과 달라 커밋 선후 순서가 우연히 성립했음
- 이 유형(트랜잭션-async 타이밍)은 테스트 환경의 스케줄러 특성에 따라 간헐적으로 숨겨지는 전형적 결함

---

## 버그 2 — Claude 응답이 JSON 중간에서 잘림 (max_tokens)

### 증상

- 디자인 스펙 PDF (약 2,300자) 업로드 후 Job 이 `FAILED` 로 전환
- 에러 메시지: `JSON 배열 파싱 실패 — 생성된 TC 없음`
- 로그: `com.fasterxml.jackson.core.io.JsonEOFException: Unexpected end-of-input: was expecting closing quote for a string value` at line 123

### 원인

`application.yml` 의 `spring.ai.anthropic.chat.options.max-tokens: 2048` 이 전역 설정. Test Studio 는 다수의 TC 를 JSON 배열로 생성하는데, 15건 이상 생성 시 응답이 토큰 한도에서 잘려 JSON 미완결.

### 수정

**① Per-call max_tokens override** — `TestStudioGenerator.java`

```java
AnthropicChatOptions options = AnthropicChatOptions.builder()
        .withMaxTokens(8192)
        .build();
String response = chatClient.prompt().user(prompt).options(options).call().content();
```

- 이 호출에만 8192 적용. Senior 챗 / 기존 generate-draft 는 2048 그대로 유지
- Claude 3.5 Sonnet 출력 상한 = 8192 → 다수 TC 생성에 충분

**② Truncated JSON 복구** — `parseDrafts` + 신규 `truncateToLastCompleteObject(jsonStr)`

- 1차 파싱 실패 시 문자열/이스케이프/중첩 뎁스를 추적하며 **마지막 top-level `}` 까지 잘라 `]` 로 재마감**
- 복구된 부분 배열을 재파싱 → 완성된 객체는 저장
- 로그: `"Claude response was truncated — recovered N complete draft(s) from partial JSON"`
- 토큰 한도를 아무리 올려도 미래에 또 잘릴 수 있으므로 방어선으로 유지

### 회귀 테스트 추가

`TestStudioGeneratorTest.generate_markdown_truncatedJson_recoversPartialDrafts`
- 완결 객체 1개 + 잘린 객체 1개로 구성된 응답 → 1건 저장 + Job DONE + `generatedCount=1` 검증

### 테스트가 못 잡은 이유

Unit/Integration 테스트 모두 `ChatClient` 를 Mock 으로 주입하여 **항상 짧고 완결된 JSON 반환** → 실제 API 의 `max_tokens` 경계 조건 재현 불가. E2E 는 "DONE 까지 대기 안 함" 정책이라 파싱 단계 미검증. Claude API 를 실제 호출해야만 드러나는 결함.

---

## 버그 3 — DRAFT TC 가 TestCasePage 에 안 보임 (empty path 스킵)

### 증상

- Generator 로그: `Claude response was truncated — recovered 17 complete draft(s) from partial JSON`
- DB 쿼리: 17건 DRAFT TC 저장 확인 (`test_studio_job_id=13`)
- API `/api/test-cases?productId=1835` 정상 응답
- 그러나 `/features/companies/1440/products/1835?status=DRAFT&jobId=13` 페이지에 **아무것도 안 보임**

### 원인

`TestCasePage.tsx` line 318:

```tsx
testCases.forEach((tc) => {
  if (!tc.path || tc.path.length === 0) return;  // ← empty path TC 전체 스킵
  ...
});
```

Test Studio v1 정책: DRAFT TC 는 **`path=[]` 로 저장** (suggestedSegmentPath 는 LLM 제안만, 실제 ID 매핑은 사용자 검토 시 수동). Path tree 그룹핑 로직이 empty path TC 를 스킵하므로 UI 에 표시될 여지가 아예 없었음. 기존 Product 의 TC 는 전부 path 가 있어서 이 제약이 기존 기능에서는 드러나지 않았다.

### 수정

`TestCasePage.tsx`:

- `unassignedTestCases` memo 추가 — `path` 가 비어있는 TC 필터링
- 우측 컬럼 상단에 **📦 Segment 미지정 (N)** 섹션 추가 (amber 배경)
  - 각 TC 카드 (제목 + status/priority/testType 배지 + Delete 버튼)
  - 카드 클릭 시 기존 `handleOpenEditModal` 로 편집 모달 오픈 → 사용자가 Segment 경로 선택 → 저장 시 일반 path tree 로 이동
  - `data-testid="unassigned-tc-section"`, `data-testid="unassigned-tc-card"` 부여 (E2E 대비)
- pathTree / unassignedTestCases 가 모두 비어있을 때만 "No test cases yet" 빈 상태 표시

### 테스트가 못 잡은 이유

E2E UI 테스트는 Test Studio Job 생성까지만 검증. DRAFT TC 가 실제로 TestCasePage 에 렌더링되는지는 검증하지 않았음 (DONE 대기 안 함 정책 때문). Frontend Vitest 로도 이 integration 상황을 별도로 재현하지 않았다.

---

## 변경 파일 요약

### Backend
- `backend/src/main/java/com/myqaweb/teststudio/TestStudioServiceImpl.java` — `@Transactional` 제거 + 이유 주석
- `backend/src/main/java/com/myqaweb/teststudio/TestStudioGenerator.java`
  - `AnthropicChatOptions.builder().withMaxTokens(8192)` per-call override
  - `parseDrafts` 2-pass: 1차 실패 시 `truncateToLastCompleteObject` 로 복구 재시도
  - `extractJsonArray` 헬퍼 (마크다운 펜스 + 잘림 대응 통합)

### Frontend
- `frontend/src/pages/features/TestCasePage.tsx` — `unassignedTestCases` memo + 📦 Segment 미지정 섹션

### Tests
- `backend/src/test/java/com/myqaweb/teststudio/TestStudioGeneratorTest.java`
  - `stubChatClientContent` mock: `.options(...)` 체인 stub 추가
  - `generate_markdown_truncatedJson_recoversPartialDrafts` 회귀 테스트 추가

---

## 검증

- `./gradlew test --tests com.myqaweb.teststudio.TestStudioGeneratorTest` — **8/8 통과** (기존 7 + 회귀 1)
- Docker 스택 재기동 후 `my-atlas` Company 에서 실제 PDF 업로드 시나리오로 재현 → 17건 DRAFT TC 정상 생성, TestCasePage 에 📦 섹션으로 노출, 사용자 검토 · Segment 지정 가능 확인

---

## 회고 — 테스트 전략의 구조적 한계

v1 의 49개 테스트를 모두 통과한 상태에서 발견된 3건의 버그는 **실제 외부 의존성(Spring Tx Lifecycle, Claude API token limit, UI integration path) 을 Mock 으로 대체한 결과 잡히지 않는 유형**이었다. 각각의 대응:

| 결함 유형 | 현재 안전망 | 강화 방안 (미래 작업) |
|-----------|-------------|----------------------|
| 트랜잭션 타이밍 | 없음 (PdfPipeline 과 동일 패턴 채택으로 경험적 대응) | @Async + DB 커밋 순서 검증하는 TestTemplate |
| LLM 응답 경계 조건 | 회귀 테스트 1건 추가 | 실 API 호출하는 smoke 테스트 (비용 제어 하에) 또는 contract-test 도입 |
| Frontend integration | E2E 는 Job 생성까지만 | DRAFT 렌더링까지 포함한 UI integration test 추가 |

이 표는 v1.1 범위 외이며, 추후 QA 개선 작업에서 참고한다.
