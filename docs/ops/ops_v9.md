> 변경 유형: 환경 개선  
> 작성일: 2026-04-09  
> 버전: v9  
> 상태: 완료

---

## 배경

프론트엔드 CI 파이프라인(`frontend-ci.yml`)에서 lint와 test 스텝에 `continue-on-error: true`가 설정되어 있어 실패해도 CI가 통과로 표시되었다. 원인은 ESLint 설정 파일이 존재하지 않아 `npm run lint` 실행 시 즉시 에러가 발생하는 상태였기 때문이다.

**변경 전:**
- ESLint 의존성(eslint 8, @typescript-eslint, react-hooks, react-refresh)은 설치되어 있으나 설정 파일(`.eslintrc.*`) 없음
- `npm run lint` → `ESLint couldn't find a configuration file` 에러
- CI에서 lint/test 실패를 `continue-on-error: true`로 무시

---

## 변경 내용

### Step 1: ESLint 설정 파일 생성

**신규 파일:** `frontend/.eslintrc.cjs`

| 설정 | 값 |
|------|-----|
| parser | `@typescript-eslint/parser` |
| extends | `eslint:recommended`, `@typescript-eslint/recommended`, `react-hooks/recommended` |
| plugins | `react-refresh` |
| 주요 규칙 | `react-refresh/only-export-components` (warn), `@typescript-eslint/no-unused-vars` (warn, `_` 접두사 허용) |

### Step 2: Lint warning 4건 수정

| 파일 | warning | 수정 방법 |
|------|---------|----------|
| `src/components/features/TestCaseGroupSelector.tsx:69` | `useMemo` missing dependency `expanded.size` | eslint-disable (초기화 전용, 의도적 제외) |
| `src/pages/features/TestRunDetailPage.tsx:94` | `useMemo` missing dependency `resolvePath` | eslint-disable (`segmentMap`으로 동일 의미 추적) |
| `src/context/ActiveCompanyContext.tsx:11,44` | react-refresh: non-component exports | 파일 상단 eslint-disable (Context + Hook 동일 파일 패턴) |

### Step 3: CI `continue-on-error` 제거

**변경 파일:** `.github/workflows/frontend-ci.yml`

```yaml
# Before
- name: Run Linter (if configured)
  run: npm run lint --if-present
  continue-on-error: true

- name: Run Tests (if configured)
  run: npm test -- --run --coverage
  continue-on-error: true

# After
- name: Run Linter
  run: npm run lint

- name: Run Tests
  run: npm test -- --run --coverage
```

---

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `frontend/.eslintrc.cjs` | 신규 — ESLint 설정 (TS + React + Vite) |
| `frontend/src/components/features/TestCaseGroupSelector.tsx` | eslint-disable 추가 (1줄) |
| `frontend/src/pages/features/TestRunDetailPage.tsx` | eslint-disable 추가 (1줄) |
| `frontend/src/context/ActiveCompanyContext.tsx` | eslint-disable 추가 (1줄) |
| `.github/workflows/frontend-ci.yml` | lint/test `continue-on-error` 제거 |

---

## 검증 결과

| 항목 | 결과 |
|------|------|
| `npm run lint` | 0 errors, 0 warnings |
| `npm test -- --run` | 31 tests passed (4 files) |
| `npm run build` | 정상 빌드 |
