# Registry v27 — 중계 화면에 TC·Step 진행 플로우 표시

> 변경 유형: 기능 개선  
> 작성일: 2026-10-28  
> 버전: v27  
> 상태: 완료

---

Notion: https://app.notion.com/p/3ad107b270e880f5a6fae71f2f841dc2

## 목표

중계 화면(v26)에 지금 어떤 TC의 어떤 Step을 수행 중인지, 그 Step의 동작·기대 결과를 플로우로 표시한다.

```
실행 화면
TC 1/1 · T3471 검색 후 최근 검색어에 남는지 확인
[전제조건 ✓] ⟶ [Step 1 ✓PASS] ⟶ [Step 2 ✕FAIL] ⟶ [Step 3 ⟳판정 중] ⟶ [Step 4 대기] ⟶ [Step 5 대기]
┌ Step 3/5 · 기대 결과 판정 중 ───────────────────────┐
│ 동작      키보드 검색(Enter) 실행                     │
│ 기대 결과  'starbucks' 검색 결과 화면이 표시된다        │
└──────────────────────────────────────────────────┘
[ 화면 ]  ← 클릭 시 확대 보기 (진행 상세와 함께 크게)
```

- 노드 상태: 대기 / 수행 중 / 판정 중 / PASS / FAIL / 판정불가. 완료 노드 hover 시 판정 근거.
- 전제조건 노드는 Segment Path(또는 seed note)가 있을 때만. 상세에 경로 표시.
- Step FAIL이어도 다음 Step은 계속 실행된다 (기존 워커 동작 그대로).
- 플로우는 CSS로 그린다 (Mermaid 미사용 — 1초 갱신마다 전체 재렌더·의존성 부담).

## 방식

- 워커가 진행이 바뀔 때마다(TC 시작·전제조건·Step 수행/판정/완료) `PUT /api/agent-executions/{id}/progress` (JSON).
- 백엔드는 v26 프레임 저장소에 Job별 최신 진행 상태 1건을 함께 보관. Job 종료 시 같이 삭제.
- `AgentLiveView`가 1초 폴링 시 `GET /progress`도 받아 플로우·상세 표시 → 단건·일괄 모달 모두 적용.

진행 상태:

```json
{
  "testCaseId": 3471, "testCaseTitle": "...", "tcIndex": 1, "tcTotal": 1,
  "precondition": { "text": "홈 > 검색", "status": "DONE" },
  "steps": [ { "order": 1, "action": "...", "expected": "...", "status": "PASS", "judgment": "..." } ],
  "currentStep": 3, "phase": "PRECONDITION | ACTING | JUDGING"
}
```

## 테스트

- Backend: progress PUT(RUNNING만)·GET·완료 시 삭제.
- Frontend: 노드 상태별 렌더, 상세(동작·기대 결과/경로), 확대 보기 열기·닫기.
- E2E: API PUT→GET 왕복 / UI 플로우·상세 노출 (stub).

## Step

- [x] Step 1 — 코드 구현 (Agent-A) ✅ 백엔드·워커·프론트 병렬 구현 (`AgentLiveFlow` 신규)
- [x] Step 2 — Unit 테스트 (Agent-B) ✅ Backend 3클래스 확장 + Frontend `AgentLiveFlow.test.tsx` 신규·`AgentLiveView.test.tsx` 확장
- [x] Step 3 — E2E 테스트 (Agent-C) ✅ `api/agent-execution-frame.spec.ts` progress 2건 + `ui/agent-live-view.spec.ts` 플로우·확대 1건
- [x] Step 4 — 빌드·전체 테스트 검증 (Agent-D) ✅
- [x] Step 5 — 문서 마무리 + 데모 환경 복구 ✅

## 테스트 결과

| 항목 | 결과 |
|------|------|
| Frontend lint / Vitest | 0 warnings / 100 passed |
| Backend `./gradlew clean build` | 820 passed (`AgentLiveFrameStoreTest` 10, `AgentExecutionControllerTest` 15, `AgentExecutionServiceImplTest` 31) |
| E2E 전체 | 370 passed, 30 skipped(기존 quarantine·조건부), 0 failed, did-not-run 0 |
| 에이전트 E2E 단독 | `api/agent-execution-frame` 4, `ui/agent-live-view` 2, `ui/agent-batch-execution` 1 — passed |
| 실기 캡처 (패스오더, TC 3470) | 플로우 `[전제조건 이동 중] ⟶ [Step 1 대기]` + 경로 상세 + 화면 표시, 완료 후 PASS·중계 사라짐 |

Agent-D 1차는 `VersionPhaseDetailPage.test.tsx` mock에 `getProgress` 누락(unhandled error)으로 중단 → mock 추가 후 재검증 통과.

검증 후 실기 캡처에서 확대 보기가 낮은 창(높이 ~760px 이하)에서 위쪽이 잘리는 것을 발견 → 이미지 `max-h-[78vh]` → `min-h-0 flex-1 object-contain`(남은 공간만 사용). 높이 720px 캡처로 확인, lint·`AgentLiveView.test.tsx`·에이전트 E2E 7건 재실행 통과 (Agent-D 전체 재실행은 생략 — 클래스 1줄 변경).

## 알려진 사항

- step 증적의 요소 이름에 `&#10;` 같은 숫자 문자 참조가 그대로 보임 (v24 Android XML 파싱, 이번 변경과 무관).

## [최종 요약]

- 워커가 진행이 바뀔 때마다 `PUT /progress`(최신 1건, 순서 보장·병합), 백엔드는 프레임 저장소에 함께 보관하고 Job 종료 시 삭제.
- `AgentLiveFlow`: TC 헤더 + 전제조건·Step 노드 플로우(상태별 색, hover 시 동작·기대 결과·판정) + 현재 Step 상세(동작·기대 결과, 수행/판정 구분).
- 화면 클릭 시 확대 보기(플로우·상세와 함께, 클릭/Esc 닫기). 단건·일괄 모달 공통.
