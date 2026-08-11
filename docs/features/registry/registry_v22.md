# Registry v22 — 에이전트 실행 관측성 (스크린샷 증적 · 실행 이력 뷰 · 브라우저 가시화)

> 변경 유형: 기능 개선
> 작성일: 2026-07-23
> 버전: v22
> 상태: 예정 (계획 — registry_v20 실행 엔진의 관측성 보강)

---

## 배경 — 왜 필요한가

registry_v20 에이전트 실행을 실제로 써보니 **"무슨 일이 일어났는지 보이지 않아 불편하다."**

현재 관측 수단:
- `AgentRunModal`에 **step별 판정 텍스트**(actionTaken + judgment)는 표시됨 → "왜 FAIL인지"의 **텍스트 근거**는 있음
- 그러나:
  1. **브라우저 화면이 안 보인다** — 워커는 도커 컨테이너에서 **headless**로 돌아 실행 과정을 시각적으로 볼 수 없음
  2. **스크린샷 증적이 없다** — `AgentStepLog.screenshotKey` 필드는 설계돼 있으나 **항상 null**(미구현). step별 화면 캡처가 없어 텍스트만으로 판단
  3. **실행 이력 뷰가 없다** — dry run 결과는 TestResult에 기록 안 함(설계상). 모달을 닫으면 **다시 볼 UI가 없음**(데이터는 `agent_execution_result`에 있으나 API로만 조회)

→ "왜 FAIL/INCONCLUSIVE인지"를 **눈으로** 확인하고, 지난 실행을 **다시 열어보는** 관측성이 필요하다.

---

## 스코프

**포함:**
- step별 **스크린샷 캡처 + 저장(S3) + 모달 표시** (`screenshotKey` 채우기)
- **실행 이력 뷰** — 과거 Job/결과를 TC/Product별로 다시 조회하는 UI
- **브라우저 가시화** — 실행 과정을 볼 수단 (Playwright trace/video 또는 headed 모드)

**제외:**
- 라이브 스트리밍(실시간 화면 중계)은 범위 밖 — trace/screenshot으로 대체
- Phase 일괄 실행의 대량 증적 최적화는 후속

---

## 설계 (초안)

### 1. step별 스크린샷 증적

- 워커 `agent.js`에서 각 step 판정 시점에 `page.screenshot()` → S3 업로드(기존 `my-atlas-images` 재사용 or 분리 — v20 "확인 필요") → 키를 `AgentStepLog.screenshotKey`에 저장
- `AgentRunModal`의 step 증적에 **썸네일/확대 이미지** 렌더 (기존 이미지 참조 패턴 재사용)
- 비용/용량: step마다 캡처는 저장량↑ → FAIL/INCONCLUSIVE step만 캡처하는 옵션 검토

### 2. 실행 이력 뷰

- API는 이미 있음: `GET /api/agent-executions?productId=`, `/{jobId}`, `/{jobId}/results/{tcId}`
- 신규 UI: TC 상세 또는 Product 레벨에 **"AI 실행 이력"** 목록 → Job 클릭 → verdict + step 증적(스크린샷 포함) 재조회
- 드릴다운 레이아웃 규칙 준수

### 3. 브라우저 가시화

| 안 | 방식 | 장단 |
|----|------|------|
| A. Playwright **trace** | 실행당 trace.zip 저장 → 다운로드/뷰어 | 표준, 타임라인+DOM 스냅샷. 용량 |
| B. **video** 녹화 | context video 녹화 → S3 | 직관적. 용량 큼 |
| C. **headed** 로컬 실행 | 워커를 로컬 headed로 | 즉시 육안 확인. 도커/상시성 불리 |

→ 기본 **A(trace) 또는 FAIL만 video**, 개발 중 육안 확인은 C.

---

## 구현 절차 (User 승인 단위)

- [ ] **Step 1** — 워커 step별 스크린샷 캡처 + S3 업로드 + `screenshotKey` 저장
- [ ] **Step 2** — `AgentRunModal` step 증적에 스크린샷 렌더
- [ ] **Step 3** — 실행 이력 뷰 UI (Job 목록 → 결과·증적 재조회)
- [ ] **Step 4** — 브라우저 가시화 (trace 저장 + 다운로드, 필요 시 video)
- [ ] **Step 5** — 테스트 + 문서 갱신

---

## 참조

- [registry_v20.md](./registry_v20.md) — 실행 엔진 (`AgentStepLog.screenshotKey` 미구현 상태, "증적 뷰"는 Phase 3 Step 6에 일부 계획)
- [registry_v21.md](./registry_v21.md) — 자격증명 + 외부 제품 지원
- [registry.md](./registry.md) — 메인 명세서
