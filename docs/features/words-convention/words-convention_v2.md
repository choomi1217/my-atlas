# Words Convention — 버그 수정 (v2)

> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v0.1  
> 상태: 진행 중

---

## 1. 목적

Words Convention v1 구현 이후 발견된 E2E 간헐적 실패 버그를 수정한다.

---

## 2. 버그 상세 분석

### Convention 생성/수정 후 목록 미반영

**현상:**
- Convention 생성 또는 수정 후 `/conventions` 목록으로 리다이렉트되지만, 변경된 데이터가 카드에 표시되지 않음
- "create and see in list", "edit via card click" E2E 테스트에서 간헐적 실패

**원인:**
- `ConventionFormPage.tsx`는 `conventionApi.create()/update()`를 직접 호출 후 즉시 `navigate('/conventions')` 실행
- `ConventionsPage`의 `useConvention` hook은 컴포넌트 mount 시 `fetchAll()`을 `useEffect`로 호출
- `navigate` → 컴포넌트 mount → `fetchAll()` GET 요청 사이에 타이밍 레이스 발생
- `ConventionFormPage`가 `useConvention` hook의 상태 관리를 우회하여 API를 직접 호출하는 구조적 문제

**영향 범위:**
- `ConventionFormPage.tsx` — create/update 후 navigate 로직
- `ConventionsPage.tsx` — mount 시 데이터 로딩
- `useConvention.ts` — fetchAll 호출 시점

**수정 방향:**
- `ConventionsPage` mount 시마다 최신 데이터를 보장하도록 `fetchAll()`을 location 변경 시 재호출
- React Router의 `useLocation` 활용하여 navigation key 변경 감지 → fetchAll 재트리거

---

## 3. 변경 범위 요약

| 구분 | 변경 내용 |
|------|-----------|
| Frontend | `useConvention.ts` — location 변경 감지 또는 fetchAll 트리거 개선 |
| E2E | 기존 convention E2E 테스트 통과 확인 |

---

## 4. 구현 순서

| Step | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | `useConvention` hook에 location 변경 감지 fetchAll 재호출 추가 | `useConvention.ts` | |
| 2 | 수동 검증 — 브라우저에서 생성/수정 시나리오 확인 | — | |
| 3 | 기존 테스트 통과 확인 — Backend unit + Frontend unit + E2E 전체 | — | |

---

## 5. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | Convention 생성 → 목록 확인 | 새 카드가 즉시 표시됨 |
| 2 | Convention 수정 → 목록 확인 | 수정된 내용이 즉시 반영됨 |
| 3 | E2E "create and see in list" 10회 연속 | 0 실패 |
| 4 | E2E "edit via card click" 10회 연속 | 0 실패 |

---

## 6. Agent Pipeline

본 버그 수정은 4-Agent Pipeline을 따른다.

| Agent | 역할 |
|-------|------|
| Agent-A | B1 코드 수정 |
| Agent-B | 변경된 코드의 Backend 단위 테스트 보강 (필요 시) |
| Agent-C | E2E 테스트 보강 (필요 시) |
| Agent-D | Build & Test 전체 검증 |
