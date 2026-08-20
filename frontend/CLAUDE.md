# Frontend: React 18 + TypeScript + Vite

This file governs all frontend development. **Always reference this when making changes to `/frontend`.**

> 기술 스택·의존성은 `package.json`이, 빌드 설정은 `vite.config.ts` / `tailwind.config.js`가,
> 디렉토리 구조는 레포 트리가 소유한다. 표준 npm 스크립트(`dev`, `build`, `preview`, `test`, `lint`)도
> `package.json`에 있다. **여기에는 규칙과 함정만 둔다.**

---

## 🏗️ Naming & Code Conventions

### Files
- **Components / Pages:** PascalCase (`SeniorChat.tsx`, `SeniorPage.tsx`)
- **Hooks:** `use` 접두어 + camelCase (`useSenior.ts`)
- **Utilities / API modules:** camelCase (`formatters.ts`, `knowledgeBase.ts`)
- **Types:** 도메인별로 `types/{domain}.ts`

### Components
- **함수형 컴포넌트만 사용한다** — class 컴포넌트 금지
- **한 컴포넌트에 하나의 주 책임** (Single Responsibility)
- **Props는 `interface`로 타입 정의**
- **인라인 스타일 금지** — Tailwind 유틸리티 클래스를 사용한다
  ```tsx
  <div style={{ color: 'red' }}>   // ❌
  <div className="text-red-500">   // ✅
  ```

### TypeScript
- **`any` 금지** — `unknown` + 타입 가드를 사용한다
- API 응답은 그대로 신뢰하지 말고 형태를 검증한다

### State & Data
- 전역 상태는 **zustand** (`stores/`), 화면 지역 상태는 `useState`
- API 호출은 `api/` 모듈로 분리 — 컴포넌트에서 직접 `axios` 호출 금지
- `useEffect` / `useCallback` / `useMemo`의 **의존성 배열을 정확히 채운다**
- 리스트 `key`에 배열 index 사용 금지 — 안정적인 id를 사용한다
- 상태를 직접 변형(mutate)하지 않는다

---

## 🎨 Layout 규칙 (CRITICAL)

- 모든 Frontend 개발은 **드릴다운 방식**을 사용한다
- **다중 패널을 나란히 표시하지 않는다** — 한 번에 하나의 뷰가 전체 콘텐츠 영역을 차지한다

---

## 🔐 Security

- **`dangerouslySetInnerHTML` 금지** — 마크다운 등은 `react-markdown` 사용
- API 키·시크릿은 `.env.local`(gitignored)에 두고 `import.meta.env.VITE_*`로 접근
- 토큰을 `localStorage`에 저장하지 않는다

---

## ✅ Testing & Lint

- **Vitest + React Testing Library** — 테스트는 `src/**/__tests__/`
- **`npm run lint`는 0 warnings여야 한다** (`--max-warnings 0`) — 커밋 전 반드시 실행
- 커밋 전 `npm test` 통과 확인

---

## 🔗 Related Files

- Vite 설정: `vite.config.ts`
- Tailwind 설정: `tailwind.config.js`
- 환경변수 템플릿: `.env` (체크인), 로컬 값: `.env.local` (gitignored)
- Root context: `/my-atlas/CLAUDE.md`
