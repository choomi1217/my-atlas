# Registry v26 — AI 실행 화면 중계

> 변경 유형: 기능 추가  
> 작성일: 2026-10-28  
> 버전: v26  
> 상태: 완료

---

Notion: https://app.notion.com/p/3ad107b270e880f5a6fae71f2f841dc2

## 목표

AI 실행 중(웹 Playwright / Android 에뮬레이터) 화면을 실행 모달에서 실시간으로 본다.

## 방식 — 최신 화면 1장 폴링

```
워커 ──(1초마다 캡처)──▶ PUT  /api/agent-executions/{id}/frame   백엔드: Job별 최신 1장 메모리 보관
모달 ──(1초마다)───────▶ GET  /api/agent-executions/{id}/frame   → <img>
```

- 새 통신 방식(WebSocket/SSE) 없이 기존 폴링 구조 그대로.
- 저장 안 함 (DB·S3 없음). Job 종료(DONE/FAILED/CANCELLED) 시 비운다.

## 변경

| 위치 | 내용 |
|------|------|
| 워커 `ops.frame()` | 웹: `page.screenshot` (JPEG) / Android: `adb exec-out screencap -p` (PNG, Appium 세션과 분리) |
| 워커 `index.js` | Job 실행 동안 1초 주기로 `frame()` → `PUT frame`. 실패는 무시 (실행에 영향 없음) |
| 백엔드 | `PUT`/`GET /api/agent-executions/{id}/frame` + 인메모리 저장소. 없으면 `204` |
| 프론트 | `AgentLiveView` — 실행 중일 때 단건·일괄 모달에 화면 표시 (세로 배치) |

## 테스트

- Backend: 저장소 put/get/clear, 컨트롤러 PUT→GET 바이트·Content-Type, 미존재 204, 완료 시 삭제.
- Frontend (Vitest): 프레임 있으면 `<img>`, 없으면 대기 문구.
- E2E: API PUT→GET 왕복 / UI 모달에 화면 표시 (frame 라우트 stub).

## Step

- [x] Step 1 — 코드 구현 (Agent-A) ✅ 백엔드·워커·프론트 병렬 구현
- [x] Step 2 — Unit 테스트 (Agent-B) ✅ Backend 3클래스 + Frontend `AgentLiveView.test.tsx`
- [x] Step 3 — E2E 테스트 (Agent-C) ✅ `api/agent-execution-frame.spec.ts` 2건 + `ui/agent-live-view.spec.ts` 1건
- [x] Step 4 — 빌드·전체 테스트 검증 (Agent-D) ✅
- [x] Step 5 — 문서 마무리 + 데모 환경 복구 ✅

## 테스트 결과

| 항목 | 결과 |
|------|------|
| Frontend lint / Vitest | 0 warnings / 87 passed |
| Backend `./gradlew clean build` | 801 passed (`AgentLiveFrameStoreTest` 6, `AgentExecutionControllerTest` 7, `AgentExecutionServiceImplTest` 24) |
| E2E 전체 | 367 passed, 30 skipped(기존 quarantine·조건부), 0 failed, did-not-run 0 |
| 신규 E2E 단독 | `api/agent-execution-frame` 2, `ui/agent-live-view` 1 — passed |
| 실기 스모크 (패스오더 에뮬레이터, TC 3470) | 실행 중 프레임 19장 수신(200, PNG 0.8~1.4MB), 완료 후 204, TC PASS |

## 알려진 사항

- 첫 프레임은 Job 시작 후 약 8초 — Appium 세션 생성 시간. 그 전엔 "화면 수신 대기 중…".
- Android 프레임은 PNG 원본(장당 ~1MB). 원격 환경에서 무거우면 워커에서 축소.
- 지원 외 Content-Type PUT은 415가 아닌 500 — 전역 예외 핸들러가 모든 예외를 잡음 (호출자는 워커뿐이라 미조치).

## [최종 요약]

- 워커가 실행 중 1초마다 화면을 캡처해 `PUT /frame`, 백엔드는 Job별 최신 1장만 메모리에 보관, 단건·일괄 실행 모달이 1초 폴링으로 표시.
- 웹(Playwright JPEG)·Android(`adb screencap` PNG) 공통. 저장 없음, Job 종료 시 삭제.
