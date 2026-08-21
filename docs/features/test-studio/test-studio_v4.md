# Test Studio — v4: Figma/시각 입력 + 자동화 코드 생성

> 변경 유형: 기능 추가  
> 작성일: 2026-07-01  
> 버전: v4  
> 상태: 진행 중 (계획 — v3 완료 후 착수, 미착수)

---

# 배경 — v3에서 분리한 이유

v3(대화형 분석·확정 루프)는 **text/PDF PRD**로 핵심 가치를 먼저 검증하는 데 집중한다. 아래 둘은 가장 비싸고 불확실해 **의도적으로 v4로 미뤘다.**

- Phase 3 — Figma / 시각 입력
- Phase 4 — 자동화 코드 생성

**전제**: v3 완료 + **ops_v32(Boot 4 + Spring AI 2.0) 마이그레이션 완료.** 특히 비전(멀티모달)은 Spring AI 2.0 배선을 전제로 한다.
→ [test-studio_v3.md](./test-studio_v3.md), [ops_v32](../../ops/ops_v32.md)

---

# Phase 3 — Figma / 시각 입력

## 핵심: Figma는 "문서"가 아니다

현재 백엔드는 비전/멀티모달 호출이 **전무**(text-only)다. Figma 투입에는 두 경로가 있고 성격이 완전히 다르다.

| 경로 | 내용 | 장점 | 단점 |
|---|---|---|---|
| Figma REST API → 구조 텍스트 | 노드/텍스트/레이아웃을 JSON으로 받아 **기존 텍스트 파이프라인 재사용** | 비전 배선 불필요, 화면의 **정확한 용어**(admin/SuperUser 등) 추출 → 문제 #1에 더 유리, 저렴 | Figma access token + file key, 파서 필요, 시각/레이아웃 손실 |
| 이미지 export → Claude vision | 스크린샷을 멀티모달로 분석 | 레이아웃·UX 완결성 분석 가능 | 멀티모달 배선 신규, 토큰 비용 큼, 텍스트 정밀도 낮음 |

→ 직관과 달리 **용어·플로우 모순 탐지(v3 문제 #1)에는 비전보다 Figma API 텍스트 추출이 더 정확하고 싸다.** 착수 시 **API 텍스트 경로를 1순위**로, 비전은 레이아웃·UX 완결성 분석이 필요할 때 보조로 붙인다.

## 권장 단계
1. Figma REST API 연동(access token, file key) → 프레임/텍스트 노드 추출 → `SourceType`에 `FIGMA` 추가.
2. 추출 텍스트를 **v3 분석 파이프라인에 그대로 투입**(재사용).
3. (선택) 이미지 export → Spring AI 2.0 멀티모달로 레이아웃 분석 보조.

## 확인 필요
- Figma access token 관리(Secret), 대상 파일이 항상 Figma에 있는지.
- `SourceType` 확장(FIGMA) 시 기존 `test_studio_job` 스키마 영향.
- 비전 경로 시 토큰 비용 상한.

---

# Phase 4 — 자동화 코드 생성 (미설계 · 방향만 기록)

## 목표
확정된 TC(`steps: {order, action, expected}`)를 **실행 가능한 자동화 스크립트로 변환**한다. 최종적으로 "TC 생성 → 실행 → 자동화 코드"까지 잇는 것이 목표(원 요구사항 User Flow 8).

## 재사용 자산
- 기존 `qa/` Playwright E2E 인프라(API 65 + UI 33)와 셀렉터 규칙(Agent-C: TSX Read 후 실제 DOM 기반).

## 열린 질문 (착수 전 상세화 필요)
- **타깃 프레임워크**: 기존 `qa/` Playwright 재사용 vs 별도.
- **steps → 코드 변환**: `{action, expected}` 자연어를 어떻게 셀렉터·assertion으로? → **셀렉터 안정성이 최대 난제.** (Agent-C가 이미 "추측 셀렉터 금지"를 규칙화한 것과 동일 문제 — DOM 접근 없이 생성한 셀렉터는 신뢰 불가.)
- **실행·검증 루프**: 생성 코드가 실제로 도는지 누가 검증? 생성만으론 가치 낮음 — 실행/수정 루프가 필요.
- **대상 앱 접근**: 자동화가 도는 대상이 my-atlas 자신인지 외부 프로덕트인지 → 외부면 접근/인증 문제.

> Phase 4는 아직 **설계 전**이다. v3·Phase 3 완료 후 별도로 상세 스펙을 작성한다. 본 문서는 방향과 난제만 기록.

---

# 참조

- [test-studio_v3.md](./test-studio_v3.md) — 본 v4의 선행 버전(핵심 기능)
- [test-studio.md](./test-studio.md) — 메인 명세서
- [ops_v32](../../ops/ops_v32.md) — Boot 4 + Spring AI 2.0 (비전/멀티모달 배선 전제)
- 자동화 참고: `qa/` Playwright E2E, `qa/CLAUDE.md`(셀렉터 규칙)
