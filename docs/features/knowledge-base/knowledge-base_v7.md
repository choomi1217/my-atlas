# Knowledge Base v7 — PDF 업스트림 정제 (Haiku 기반)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-21  
> 버전: v7  
> 상태: 완료

---

## 배경

PDF 업로드 파이프라인(v4~v6)으로 저장된 청크의 **가독성·의미 밀도**가 부족했다.

| 문제 | 증상 |
|------|------|
| 한국어 어절 깨짐 | `테스트 설\n계` → `테스트 설`·`계` 로 분리되어 저장됨 |
| 페이지 푸터 혼입 | 본문 중간에 `Korean Software Testing Qualifications Board 16 of 75` 껴있음 |
| 리스트 마크 유실 | ``, `●`, `▶` 이 공백으로 날아가서 번호/불릿 구조 사라짐 |
| 목차 노이즈 청크 | `CHAPTER_PATTERN`이 목차 dot-leaders(`1.1 ... 15`) 라인도 섹션 헤더로 잡아 목차·학습목표·본문이 각각 별개 섹션으로 분리됨 |
| 문단 경계 유실 | 물리적 줄끝 기준 `\n` 만 남고 문단 경계가 사라져 KbDetailPage에서 Markdown 렌더링이 무의미 |

v7 초안은 "DB에 이미 저장된 청크를 사후 정제"였으나, User가 **DB를 비우고 재업로드**하기로 결정함에 따라 **업스트림 정제(PDF 업로드 시점)** 로 전략을 전환했다.

---

## PoC 결과

ISTQB PDF의 실제 PDFBox 추출 결과 3개 샘플(목차 / 학습목표 / 본문 4.3KB)을 **Claude Haiku 4.5** 에 투입한 수동 검증(`docs/features/knowledge-base/result.json`):

| 체크리스트 | 결과 |
|-----------|------|
| 원문 의미 보존 | ✅ 7개 활동·ISO 표준·원칙 모두 유지 |
| 한국어 어절 복원 | ✅ 완벽 (`테스트 설\n계` → `테스트 설계`) |
| 번호/불릿 복원 | ✅ 빈 불릿 → Markdown `-` 리스트 |
| 핵심 용어 볼드 | ✅ `실러버스`·`SDLC`·`테일러링` 등 |
| `meaningful` 판정 | ✅ 목차=false / 학습목표=true / 본문=true 모두 정확 |
| JSON 유효성 | ✅ 중첩 배열·이스케이프 완벽 |
| 청크 경계 자동 분할 | ✅ 4.3KB 입력을 2개 청크로 의미 단위 분할 |
| 페이지 푸터 제거 | ✅ |

**결론**: Haiku 4.5로 충분. Sonnet 승격 불필요.

Haiku가 원문에 없던 소제목을 자발적으로 추가함 → **A안(허용)** 으로 결정 (가독성·RAG 인덱싱 이점).

---

## 설계

### 파이프라인 (After)

```
PDFBox extract
  → cleanExtractedText  (+ 목차 dot-leader 라인 제거 추가)
  → parseSections
  → mergeSections
  → KbContentCleanupService.refine(section)  ← Haiku 1 API 호출 / 섹션
       반환: List<RefinedChunk> { title, markdown, meaningful, reason }
       내부:
         - max_tokens=8192, temperature=0
         - JSON 파싱 + truncation 복구
         - 재시도 3회 + 70% 길이 검증
         - AiUsageLogService.logUsage(PDF_CLEANUP, ...) 호출별 기록
         - Safety rail: 3000자 초과 분할 / 100자 미만 병합
  → filter(meaningful=true)
  → save (title/content=markdown/source/embedding=stripMarkdown→embed)
```

### 의사결정 사항

| 항목 | 결정 |
|------|------|
| 모델 | `claude-haiku-4-5-20251001` |
| `max_tokens` | 8192 (per-call override, 기본 2048 override) |
| `temperature` | 0.0 |
| 소제목 추가 | 허용 (A안) |
| 호출 단위 | 섹션 1개당 1 API 호출 |
| 큰 섹션 처리 | 30,000자 초과 시 문단 경계로 사전 분할 |
| 의미 필터 | `meaningful=false` 는 저장하지 않음 |
| Feature Flag | `kb.pdf.cleanup.enabled` (기본 `true`, false → v6 경로) |

### Safety rail (구현됨)

| 이상 징후 | 대응 |
|-----------|------|
| JSON 파싱 실패 | 3회 재시도 + `truncateToLastCompleteObject` 복구 |
| 청크 > 3,000자 | `splitOversized()` — 공백 경계 기준 재분할 |
| 청크 < 100자 | `mergeUndersized()` — 이전 청크에 병합 |
| 전체 출력 < 입력 70% | 절단 의심 → 재시도 → 실패 시 섹션 skip |
| Claude 429 | 5초 sleep 후 재시도 |

재시도마다 `ai_usage_log` 엔트리 생성 (성공·실패 모두) → 재시도 비용이 집계에 자연 반영.

---

## AI 사용량 모니터링 연동

| 요소 | 상세 |
|------|------|
| 테이블 | `ai_usage_log` (기존, v6.2 도입) |
| Feature | **`AiFeature.PDF_CLEANUP`** (v7 신규) |
| Provider | `ANTHROPIC` |
| Model | `claude-haiku-4-5-20251001` (비용 테이블 이미 등록: 입력 $1.00/M, 출력 $5.00/M) |
| 인덱스 | `idx_ai_usage_log_feature`, `idx_ai_usage_log_created_at` 이미 존재 (v6.2에서 생성) — **추가 마이그레이션 불필요** |
| 대시보드 | frontend `/monitoring` 에서 자동 반영 (feature 문자열 기반 집계) |

### 로그 Volume 영향

| 시나리오 | 섹션 수 | ai_usage_log 신규 레코드 |
|---------|--------|--------------------------|
| 소형 PDF (ISTQB, 75p) | ~50 | ~50 |
| 중형 PDF (200p) | ~100 | ~100 |
| 대형 PDF (500p) | ~200~300 | ~200~300 |

보존 정책(예: 90일 TTL)은 별도 이슈(v7.1)로 분리.

---

## Phase별 실행 결과

### Phase 1 — parseSections 업스트림 버그 수정 ✅

#### Step 1.1 — cleanExtractedText에 목차 라인 제거 추가 ✅
- [x] `PdfProcessingWorker.cleanExtractedText()` 에 `removeTocLines()` 추가
- [x] 패턴: `^.+?\s*\.{5,}\s*\d{1,4}\s*$` (Multiline)
- [x] `removeRepeatingHeaders` 이전에 실행

#### Step 1.2 — 단위 테스트 ✅
- [x] `removeTocLines_removesDotLeaderLines` — 목차 라인 제거
- [x] `removeTocLines_preservesBodyWithInlineDots` — 본문 내 짧은 점 유지
- [x] `removeTocLines_preservesPageNumberOnlyLines` — 페이지 번호 라인은 건드리지 않음

---

### Phase 2 — KbContentCleanupService 신규 ✅

#### Step 2.1 — 서비스 + 프롬프트 + JSON 파서 ✅
- [x] `KbContentCleanupService.java` 생성 (@Service, Lombok `@RequiredArgsConstructor`)
- [x] `record RefinedChunk(title, markdown, meaningful, reason)` (+ `@JsonIgnoreProperties(ignoreUnknown = true)`)
- [x] `refine(bookTitle, sectionName, content)` public 메서드
- [x] 프롬프트 상수 `PROMPT_TEMPLATE` — PoC 버전 그대로
- [x] `AnthropicChatOptions.builder().withMaxTokens(8192).withTemperature(0.0f)` per-call override
- [x] Jackson `TypeReference<List<RefinedChunk>>` 파싱

#### Step 2.2 — Safety rail + 재시도 ✅
- [x] 재시도 3회 (temperature=0 유지)
- [x] 70% recall 검증 (실패 시 retry 유도)
- [x] 3000자 초과 → `splitOversized` (공백 경계)
- [x] 100자 미만 → `mergeUndersized` (이전 청크 병합)
- [x] `truncateToLastCompleteObject` JSON 복구 유틸 (TestStudioGenerator 패턴 재사용)

#### Step 2.3 — 큰 섹션 사전 분할 ✅
- [x] 30,000자 초과 섹션 → `refineLargeSection` → 문단 경계(`\n\n+`) 기준 분할
- [x] 분할 청크들 순서 보존

#### Step 2.4 — AI 사용량 모니터링 통합 ⭐ ✅
- [x] `AiFeature` enum 에 `PDF_CLEANUP` 추가
- [x] `AiUsageLogService` 주입
- [x] `finally` 블록에서 매 호출(성공·재시도·실패) 기록
- [x] 토큰 추출: `ChatResponse.getMetadata().getUsage().getPromptTokens/getGenerationTokens`
- [x] duration: `System.currentTimeMillis()` 래핑
- [x] errorMessage: 예외 메시지 (500자 truncate는 기존 서비스 담당)

#### Step 2.5 — 단위 테스트 ✅
- [x] `KbContentCleanupServiceTest.java` — 15개 테스트
- [x] JSON 파싱: 정상 / 코드 펜스 / 빈 입력 / 배열 없음 / 절단 복구
- [x] `truncateToLastCompleteObject`: 이스케이프 처리 / 복구 불가
- [x] Safety rail: 오버사이즈 분할 / 정상 유지 / 언더사이즈 병합 / 빈 입력 / null 항목
- [x] 모니터링: 성공 시 1회 로그 / 재시도 시 3회 로그 / blank 입력 시 0회

---

### Phase 3 — PdfProcessingWorker 통합 ✅

#### Step 3.1 — Worker 리팩터링 ✅
- [x] `KbContentCleanupService` 주입
- [x] `processPdf()` 내부 분기: `processWithCleanup()` vs `processLegacy()`
- [x] `processWithCleanup`: refine → filter(meaningful) → `saveRefinedChunkWithRetry`
- [x] `saveRefinedChunkWithRetry`: 제목+Markdown 저장, 임베딩은 `KnowledgeBaseServiceImpl.stripMarkdown` 활용
- [x] 섹션 간 + 청크 간 200ms sleep
- [x] Job 완료 시 요약 로그 (`saved={}, skipSections={}, skipUnmeaningful={}`)

#### Step 3.2 — Feature Flag ✅
- [x] `application.yml` 에 `kb.pdf.cleanup.enabled: ${KB_PDF_CLEANUP_ENABLED:true}`
- [x] flag=false → `processLegacy()` (v6 chunkText/enforceMaxSize 경로)

#### Step 3.3 — 에러 처리 ✅
- [x] Cleanup 실패 섹션은 skip + 로그
- [x] Job 레벨 집계 (정제/스킵/의미없음 카운트)

#### Step 3.4 — 통합 테스트 ✅
- [x] `PdfPipelineIntegrationTest.processPdf_withCleanup_savesRefinedChunksAndLogsAiUsage`
- [x] `@MockBean ChatClient` 으로 Haiku 호출 가로채기
- [x] Awaitility로 @Async 완료 대기
- [x] knowledge_base 저장 검증 (Markdown 포함, meaningful=false 누락 확인)
- [x] ai_usage_log 검증 (feature=PDF_CLEANUP, provider=ANTHROPIC, success=true)

---

### Phase 4 — 모니터링 인덱스 + E2E

#### Step 4.1 — ai_usage_log 인덱스 확인·보강 ✅ (스킵)
- [x] V202604201000 마이그레이션에 `idx_ai_usage_log_feature`, `idx_ai_usage_log_created_at` **이미 존재**
- [x] 추가 마이그레이션 불필요 — 조건부 단계였고 조건 미충족으로 스킵

#### Step 4.2 — 기존 E2E 수정 ✅ (스킵 결정)
- [x] **결정**: PDF 업로드 E2E는 **Integration test (Phase 3.4)로 충분**
- 이유: E2E에서 실 Haiku 호출은 비용·시간(책당 수 분)·비결정성 문제 → CI 불가
- Integration test가 Mock ChatClient + Awaitility로 동일 경로 검증하므로 중복 제거

#### Step 4.3 — 4-Agent Pipeline (Agent-D) ✅
- [x] `./gradlew clean build` — unit + integration 테스트 전부 통과
- [x] `docker compose up -d --build` — 앱 재빌드
- [x] `npx playwright test` — E2E 전체 실행
- [x] `docker compose down` — 무조건 teardown

---

### Phase 5 — 문서 + 정리 ✅

#### Step 5.1 — 메인 명세서 업데이트 ✅
- [x] `knowledge-base.md` 제목 v6 → v7
- [x] PDF 업로드 파이프라인 섹션에 Haiku 정제 단계 추가
- [x] 백엔드 파일 구조에 `KbContentCleanupService` 추가
- [x] 기술 스택 표에 `PDF 정제 (v7): Claude Haiku 4.5` + `AI 사용량 모니터링: PDF_CLEANUP` 추가
- [x] 테스트 표에 `KbContentCleanupServiceTest` 추가, PdfPipelineIntegrationTest에 v7 시나리오 주석
- [x] application.yml 요약에 `kb.pdf.cleanup.enabled` 추가
- [x] 버전 히스토리 타임라인에 v7 추가

#### Step 5.2 — PoC 파일 정리 ✅
- [x] `PdfExtractionDebugTest.java` **삭제** (Phase 3.4에서 앞당겨 실행)
- [x] `docs/features/knowledge-base/result.json` **보존** (PoC 증거, 추후 프롬프트 튜닝 시 재사용 가능)
- [x] `/tmp/istqb-sections/`, `/tmp/ISTQB.pdf` 보존 (User 로컬)

#### Step 5.3 — v7 문서 마무리 ✅
- [x] 이 문서 체크박스 ✅ 일괄 갱신
- [x] 상태 `진행 중` → `완료`
- [x] 최종 요약 섹션 추가 (아래)

---

## 변경 파일 최종 목록

| 파일 | 변경 |
|------|------|
| `PdfProcessingWorker.java` | `removeTocLines()` 추가, `processWithCleanup`/`processLegacy` 분기, `saveRefinedChunkWithRetry` 신규 |
| `KbContentCleanupService.java` (신규) | Haiku 정제 + JSON 복구 + Safety rail + AI 모니터링 |
| `KbContentCleanupServiceTest.java` (신규) | 단위 테스트 15개 |
| `PdfProcessingWorkerTest.java` | `removeTocLines` 3개 테스트 추가 |
| `PdfPipelineIntegrationTest.java` | `@MockBean ChatClient` + cleanup 통합 시나리오 |
| `AiFeature.java` | `PDF_CLEANUP` enum 추가 |
| `application.yml` | `kb.pdf.cleanup.enabled` flag 추가 |
| `knowledge-base.md` | 전반 갱신 (제목/파이프라인/구조/기술스택/테스트/버전) |
| `PdfExtractionDebugTest.java` | 삭제 (PoC 종료) |

---

## [최종 요약]

### 구현 결과

Knowledge Base v7은 **PDF 업로드 파이프라인에 Claude Haiku 4.5 기반 정제 단계를 삽입**하여 청크 품질을 근본적으로 개선했다.

**핵심 개선**:
1. **한국어 어절 복원** — PDFBox의 물리적 줄끝 기준 깨진 텍스트를 자연스러운 문장으로 복원
2. **Markdown 구조 회복** — 유실된 불릿/번호 리스트를 Markdown 리스트로 재구성, 핵심 용어 볼드
3. **의미 없는 청크 필터링** — 목차 dot-leaders / 페이지 푸터 / UI 조작 설명을 `meaningful=false`로 자동 제외
4. **목차 노이즈 선제거** — `removeTocLines()`가 `parseSections`에 진입하기 전에 dot-leader 패턴 제거
5. **의미 단위 청크 경계** — Haiku가 주제 일관 단위(500~1500자)로 청크를 분할

### 설계 원칙

- **업스트림에서 해결**: 사후 정제(v7 초안)를 폐기하고 업로드 시점에 한 번만 투자 → 재업로드에도 동일 품질
- **비용 예측 가능**: 섹션 1개 = Haiku 1회 호출, 책 1권당 약 $0.50~$6
- **모니터링 통합**: 매 호출을 `ai_usage_log` 에 기록 → 대시보드에서 실시간 비용 추적
- **롤백 가능**: `kb.pdf.cleanup.enabled=false` 로 v6 경로로 즉시 복귀
- **Safety 우선**: JSON 절단 복구 / 3회 재시도 / 70% recall 검증 / 청크 크기 sanity

### 모니터링 운영 가이드

- **Feature name**: `PDF_CLEANUP`
- **Provider**: `ANTHROPIC`
- **Model**: `claude-haiku-4-5-20251001`
- **Volume 예상**: 책 업로드 1회당 50~300 엔트리 (섹션 수 × 재시도)
- **이상 감지 포인트**:
  - 성공률(Success %) < 95% → 프롬프트 또는 모델 문제 의심
  - 평균 duration > 30초 → Anthropic API 지연 또는 입력 크기 이상
  - 비용 급증 → feature flag off 후 원인 분석

### 향후 개선 (v7.1+ 검토)

- `ai_usage_log` 보존 정책 (90일 이후 집계 보존 + raw row 삭제)
- Job 레벨 비용 요약 view
- 프롬프트 튜닝 (Haiku가 소제목 과다 추가 시 보수적 모드 제공)
- PDF 재처리 엔드포인트 (기존 Job 재정제)

### 테스트 커버리지

- 단위 테스트 **18건 신규** (PdfProcessingWorker 3 + KbContentCleanupService 15)
- 통합 테스트 **1건 신규** (PdfPipeline Haiku mock cleanup)
- 기존 테스트 모두 유지 및 통과

### 롤아웃 상태

- ✅ 코드 작성 완료
- ✅ 단위·통합 테스트 통과
- ✅ Feature Flag 기본 on
- ⏳ Agent-D 최종 검증 후 PR 생성 (User 지시 시)
