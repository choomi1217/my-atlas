# Platform — v9+KB v7 통합 후속 개선 (v11)

> 변경 유형: 기능 개선
> 작성일: 2026-04-22
> 버전: v11
> 상태: 예정 (미구현)

---

## 배경

Platform v9 (로그인 필수 토글 + IP 기준 AI Rate Limiting) 릴리즈 시점에 `origin/develop`으로 merge된 Knowledge Base v7 (PDF Haiku 청킹) 코드를 `feature/platform` worktree로 병합하면서 드러난 통합 이슈와 개선 여지. 릴리즈 블로킹 사항은 아니며 다음 사이클에서 순차 처리.

---

## 개선 항목

### 1. Haiku 청킹에 `isAiEnabled()` 가드 추가

- **현재**: `common/EmbeddingService.embed()`에만 AI 토글 체크가 존재. `knowledgebase/KbContentCleanupService.refine()`(Haiku 호출)은 토글 OFF 상태에서도 실행됨.
- **영향**: ADMIN이 Settings에서 AI 기능을 껐는데 PDF 업로드가 진행 중이면 Haiku 호출이 계속 발생 → 비용/토큰 낭비 + 토글 신뢰성 훼손.
- **처리 위치**: `backend/src/main/java/com/myqaweb/knowledgebase/KbContentCleanupService.java` — `refine()` 진입 시 `settingsService.isAiEnabled()` 체크. false면 청킹 skip하고 `PdfProcessingWorker`가 job을 `SERVICE_UNAVAILABLE` 상태로 종료하도록.
- **테스트**: `KbContentCleanupServiceTest`에 토글 OFF 케이스 추가.

### 2. Slack AI 사용 알림 batching

- **현재**: `EmbeddingService.embed()`가 성공할 때마다 `SlackNotificationService.notifyAiUsage()`를 `@Async`로 호출. PDF 책 1권(50~200 청크) 업로드 시 Slack 채널에 동일 양의 알림이 쏟아짐.
- **영향**: Slack 채널 noise, webhook rate limit(분당 1건 권장) 저촉 가능.
- **처리 위치**:
  - `PdfProcessingWorker`에서 업로드 건(jobId) 단위로 호출 수/토큰/추정 비용 집계
  - Job 완료 시 1회 통합 알림 전송
  - `SlackNotificationService.notifyAiUsageBatch(jobId, totalCalls, totalTokens, estimatedCost)` 신규 메서드 추가
  - 기존 per-call `notifyAiUsage()`는 Senior Chat 등 단일 호출 경로에서만 유지

### 3. `@Async` 경로의 IP 전파

- **현재**: `EmbeddingService.extractClientIp()`는 `RequestContextHolder`에서 IP를 읽음. `PdfProcessingWorker.processPdf()`가 `@Async`로 실행되면 별도 스레드에서 `RequestContextHolder`가 null → `ai_usage_log.ip_address`가 PDF 청킹 건에 대해 항상 null로 저장됨.
- **영향**: 비로그인(익명) PDF 업로드는 v9 whitelist 차단으로 어차피 없으므로 실질 피해는 제한적. 모니터링 일관성 차원에서 IP-별 사용량 집계 시 공백.
- **처리 위치**:
  - `backend/src/main/java/com/myqaweb/knowledgebase/KnowledgeBaseController.java` — `uploadPdf()` 동기 구간에서 `extractClientIp(request)` 호출하여 클로저로 캡처
  - `PdfProcessingWorker.processPdf(..., String clientIp)` 시그니처에 IP 파라미터 추가
  - `EmbeddingService.embed(text, feature, clientIp)` 오버로드 추가 (기존 오버로드는 내부에서 `extractClientIp()` 호출하는 편의 메서드로 유지)

### 4. E2E flake — `ui/product-panel.spec.ts:54`

- **현재**: `should delete product via confirm dialog` 테스트가 isolated/full 실행 모두에서 실패. Platform v9 Agent-D 검증 중 발견된 pre-existing flake(v9과 무관).
- **증상**: ConfirmDialog "Delete" 클릭 후 5초 대기 내에 product text가 DOM에서 사라지지 않음.
- **처리 위치**:
  - `frontend/src/pages/features/ProductListPage.tsx` or `components/features/ProductCard.tsx` — delete 성공 후 목록 refetch 타이밍 조사
  - 또는 E2E 안정성 개선: `qa/pages/features-page.ts` `deleteProduct()`에서 `waitForResponse(DELETE)` 이후 `waitForLoadState('networkidle')` 추가
  - 원인 분석 후 실제 버그면 FE 수정, 아니면 테스트 대기 조건 보강

---

## 우선순위 제안

| 항목 | 우선순위 | 근거 |
|------|----------|------|
| #1 Haiku 가드 | **High** | AI 토글 신뢰성 훼손. 운영 중 비용 제어 영향 직접적 |
| #4 E2E flake | **High** | CI 안정성. 릴리즈 게이트에 영향 |
| #2 Slack batching | Medium | Noise 수준, 기능 동작엔 영향 없음 |
| #3 IP 전파 | Low | 비로그인 PDF 업로드는 차단되어 있어 실질 데이터 손실 없음. 관측성 개선만 |

---

## 관련 문서

- `docs/features/platform/platform_v9.md` — v9 원본 + "후속 작업: KB v7 통합" 섹션
- `docs/features/knowledge-base/knowledge-base_v7.md` — KB PDF Haiku 청킹 설계
