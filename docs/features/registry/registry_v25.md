# Registry v25 — AI 일괄 실행 종료 시 결과 모달이 사라짐

> 변경 유형: 버그 수정  
> 작성일: 2026-10-28  
> 버전: v25  
> 상태: 완료

---

Notion: https://app.notion.com/p/3ba107b270e880008aa6cc52600d700d

## 현상

Phase 상세 → [AI 일괄 실행] → 실행이 끝나는 순간 결과가 담긴 모달이 사라진다.

## 원인

1. `BatchAgentRunModal`이 Job 완료 시 `onDone`(= 페이지 `loadData`)을 호출한다.
2. `loadData`가 `isLoading=true`로 바꾼다.
3. 페이지가 `if (isLoading) return Loading...`으로 조기 반환한다 (`VersionPhaseDetailPage.tsx:575`).
4. 모달이 언마운트되어 결과 state가 사라진다. 로딩이 끝나면 `showBatchModal`이 아직 true라 모달이 **초기 화면(범위 선택)** 으로 다시 뜬다.

단건 모달(`AgentRunModal`)은 `onDone`이 없어 영향 없음.

## 수정

- `loadData(silent)` — 완료 후 재조회는 `isLoading`을 건드리지 않는다 (화면 유지, 데이터만 교체).
- `onDone={() => loadData(true)}`

## 테스트

- Unit (Vitest): 페이지 단위 — Job DONE 이후에도 모달에 결과(`완료 n/n`, TC별 판정)가 남는다.
- E2E (Playwright, 워커 stub): [AI 일괄 실행] → DONE → 모달 유지 + 결과 노출.

## Step

- [x] Step 1 — 코드 수정 (Agent-A) ✅
- [x] Step 2 — Unit 테스트 (Agent-B) ✅ `VersionPhaseDetailPage.test.tsx` 2건
- [x] Step 3 — E2E 테스트 (Agent-C) ✅ `qa/ui/agent-batch-execution.spec.ts` 1건
- [x] Step 4 — 빌드·전체 테스트 검증 (Agent-D) ✅
- [x] Step 5 — 문서 마무리 (registry.md 히스토리 + 최종 요약) ✅

## 테스트 결과

| 항목 | 결과 |
|------|------|
| Frontend lint / Vitest | 0 warnings / 83 passed |
| Backend `./gradlew clean build` | 780 passed |
| E2E 전체 | 364 passed, 2 failed → quarantine, 28 skipped, did-not-run 0 |
| 신규 E2E `agent-batch-execution.spec.ts` | 전체 실행·단독 실행 모두 passed |

Quarantine 2건 (`qa/ui/senior.spec.ts`, 본 수정과 무관): `SeniorChatPage`가 `?q=` 자동 전송 후 URL에서 `q`를 제거(replace)하는 의도된 동작과 URL 단언이 경합. `test.fixme` + 사유 주석. quarantine 후 `senior.spec.ts` 단독 16 passed / 2 skipped.

## [최종 요약]

- 원인: 완료 시 페이지 재조회가 전체 로딩 화면으로 바뀌며 모달을 언마운트.
- 수정: `VersionPhaseDetailPage.tsx` 3줄 — `loadData(silent)` + `onDone={() => loadData(true)}`.
- 테스트: 페이지 단위 회귀 테스트 2건 + E2E 1건.
