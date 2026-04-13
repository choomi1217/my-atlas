# Platform — Resume 페이지 (v2)

> 변경 유형: 기능 추가  
> 작성일: 2026-04-10  
> 버전: v2  
> 상태: 완료

---

## 요구사항

1. `/resume` 라우트로 진입 시 Resume 페이지가 표시되어야 한다.
2. Resume Header에 이름과 직종이 표시된다.
3. Header 하단에 두 개의 탭 버튼(경력기술서 / 자기소개서)이 있다.
4. 탭 클릭 시 work-exp(경력기술서)과 intro(자기소개서) 두 뷰가 전환된다.

---

## 현재 코드 분석 (Context)

### 기존 Static HTML (참조 원본)

| 파일 | 설명 |
|------|------|
| `frontend/public/resume/index.html` | 경력기술서 (QA 경력, 개발 경력, Side Project, Skills) |
| `frontend/public/resume/intro.html` | 자기소개서 (지원 동기, QA로의 전환, 강점, 앞으로의 방향) |

- 두 파일 모두 독립 HTML로 존재 (`<a href="intro.html">` / `<a href="./">` 링크로 전환)
- React 라우팅과 무관하게 `public/` 디렉토리에서 직접 서빙
- 보라색 계열 디자인 (`--accent: #8B5CF6`) + Noto Sans KR + DM Mono 폰트

### Frontend 현황

| 항목 | 현황 | 파일 |
|------|------|------|
| `/resume` 라우트 | ❌ 없음 | `App.tsx` — 4개 도메인 라우트만 존재 |
| ResumePage 컴포넌트 | ❌ 없음 | |
| Resume 컴포넌트 | ❌ 없음 | |
| 사이드바 Resume 메뉴 | ❌ 없음 | `Layout.tsx` — 4개 NavItem만 존재 |
| 탭 전환 패턴 | ✅ 참조 가능 | `SeniorPage.tsx` — FAQ/Chat/KB 뷰 전환 (useState) |

### Backend

- 변경 불필요 — 콘텐츠가 정적(static)이므로 API/DB 불필요

---

## 설계

### 1. 아키텍처: Frontend Only (Static Content)

Resume 콘텐츠는 기존 HTML의 내용을 React 컴포넌트로 변환한다.
Backend API 없이 프론트엔드에서 직접 렌더링한다.

```
/resume
  ┌────────────────────────────────┐
  │  ResumeHeader                  │
  │  이름: 조영미 / QA Engineer    │
  │  경력: 4Y 4M / 이메일          │
  ├────────────────────────────────┤
  │  [경력기술서]  [자기소개서]     │  ← 탭 버튼
  ├────────────────────────────────┤
  │                                │
  │  WorkExpTab 또는 IntroTab      │  ← 탭 전환 (useState)
  │                                │
  └────────────────────────────────┘
```

### 2. 탭 전환 방식: `useState` (로컬 상태)

- React Router 서브라우트(`/resume/work-exp`, `/resume/intro`) 대신 `useState`로 전환
- 이유: 콘텐츠가 정적이고 URL 공유 필요성 없음, SeniorPage 탭 패턴과 일관성 유지

### 3. 스타일링: Tailwind CSS

- 기존 HTML의 인라인 CSS를 Tailwind 유틸리티 클래스로 변환
- 보라색 accent 컬러 → Tailwind `violet-500` / `violet-50` 계열 활용
- 반응형 대응: `md:` breakpoint로 모바일 레이아웃 지원

### 4. Frontend 파일 구조 (신규)

```
frontend/src/
├── pages/ResumePage.tsx            # 메인 페이지 (탭 상태 관리)
└── components/resume/
    ├── ResumeHeader.tsx            # 이름, 직종, 경력, 이메일
    ├── WorkExpTab.tsx              # 경력기술서 (QA + 개발 + Side Project + Skills)
    └── IntroTab.tsx                # 자기소개서 (지원 동기, 전환, 강점, 방향)
```

### 5. 라우팅 / 네비게이션 변경

| 파일 | 변경 |
|------|------|
| `App.tsx` | `/resume` 라우트 추가 |
| `Layout.tsx` | `navItems`에 `{ to: '/resume', label: 'Resume' }` 추가 |

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | Resume 컴포넌트 생성: ResumeHeader, WorkExpTab, IntroTab | `components/resume/*.tsx` |
| 2 | ResumePage 생성: 탭 상태 관리 + 컴포넌트 조합 | `pages/ResumePage.tsx` |
| 3 | 라우팅 + 네비게이션 통합 | `App.tsx`, `Layout.tsx` |

---

### Step 1 — Resume 컴포넌트 생성

**신규 파일:**
- `frontend/src/components/resume/ResumeHeader.tsx`
- `frontend/src/components/resume/WorkExpTab.tsx`
- `frontend/src/components/resume/IntroTab.tsx`

**ResumeHeader:**
- [x] 이름 (조영미) + 직종 뱃지 (QA Engineer)
- [x] 경력 기간 (4Y 4M), 세부 (개발 3년 · QA 1년)
- [x] 이메일
- [x] 보라색 하단 보더 (`border-b-2 border-violet-500`)

**WorkExpTab (경력기술서):**
- [x] QA Experience 섹션 — Studio XID (타임라인 + 프로젝트 카드 7개)
- [x] Development Experience 섹션 — NFLUX, 도로명주소단
- [x] Side Project 섹션 — my-atlas
- [x] Skills 섹션 — 테이블 형식 (Test Automation, AI/Tools, Languages, Frameworks, Infrastructure)

**IntroTab (자기소개서):**
- [x] About Me 섹션
- [x] 지원 동기 카드
- [x] QA로의 전환 카드
- [x] 강점 카드
- [x] 앞으로의 방향 카드

---

### Step 2 — ResumePage 생성

**신규 파일:** `frontend/src/pages/ResumePage.tsx`

- [x] `useState<'work-exp' | 'intro'>('work-exp')` — 탭 상태 관리
- [x] ResumeHeader 렌더링
- [x] 탭 바: 경력기술서 / 자기소개서 버튼 (active 상태 스타일 구분)
- [x] 탭에 따라 WorkExpTab / IntroTab 조건부 렌더링

---

### Step 3 — 라우팅 + 네비게이션 통합

**수정 파일:**
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`

- [x] `App.tsx`: `/resume` 라우트 추가 (`<Route path="/resume" element={<ResumePage />} />`)
- [x] `Layout.tsx`: `navItems`에 `{ to: '/resume', label: 'Resume' }` 추가

---

## 변경 파일 목록

### Frontend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `components/resume/ResumeHeader.tsx` | 신규 | 이름 + 직종 + 경력 헤더 |
| `components/resume/WorkExpTab.tsx` | 신규 | 경력기술서 탭 콘텐츠 |
| `components/resume/IntroTab.tsx` | 신규 | 자기소개서 탭 콘텐츠 |
| `pages/ResumePage.tsx` | 신규 | Resume 메인 페이지 (탭 관리) |

### Frontend (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `App.tsx` | 수정 | `/resume` 라우트 추가 |
| `Layout.tsx` | 수정 | 사이드바 Resume 메뉴 추가 |

### Backend

변경 없음

### E2E (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `qa/ui/resume.spec.ts` | 신규 | Resume UI E2E 테스트 |

---

## 검증 시나리오

### UI 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 사이드바 Resume 메뉴 클릭 | `/resume` 이동, Resume 페이지 표시 |
| 2 | ResumeHeader 표시 | 이름(조영미), 직종(QA Engineer), 경력(4Y 4M) 표시 |
| 3 | 기본 탭 상태 | 경력기술서 탭이 기본 활성 상태 |
| 4 | 자기소개서 탭 클릭 | IntroTab 콘텐츠로 전환 |
| 5 | 경력기술서 탭 클릭 | WorkExpTab 콘텐츠로 복귀 |
| 6 | 경력기술서 콘텐츠 | QA Experience, Dev Experience, Side Project, Skills 섹션 표시 |
| 7 | 자기소개서 콘텐츠 | 지원 동기, QA로의 전환, 강점, 앞으로의 방향 카드 표시 |
| 8 | 미인증 상태에서 /resume 접근 | /login 리다이렉트 (ProtectedRoute) |

---

## [최종 요약]

### 구현 완료 항목
- `/resume` 라우트에 Resume 페이지 추가 (ProtectedRoute 내)
- ResumeHeader: 이름(조영미), 직종(QA Engineer), 경력(4Y 4M), 이메일
- 탭 바: 경력기술서 / 자기소개서 (useState로 전환)
- WorkExpTab: QA Experience(Studio XID, 7개 프로젝트), Development Experience(NFLUX, 도로명주소단), Side Project(my-atlas), Skills 섹션
- IntroTab: 지원 동기, QA로의 전환, 강점, 앞으로의 방향 카드 (placeholder)
- Layout 사이드바에 Resume 메뉴 추가

### 검증 결과
- Backend build: BUILD SUCCESSFUL
- Backend test: 전체 통과
- E2E resume.spec.ts: **8/8 통과**
- E2E 전체: 222 passed, 2 failed (기존 이슈, Resume 무관)

### 신규 파일 (4개)
- `frontend/src/components/resume/ResumeHeader.tsx`
- `frontend/src/components/resume/WorkExpTab.tsx`
- `frontend/src/components/resume/IntroTab.tsx`
- `frontend/src/pages/ResumePage.tsx`
- `qa/ui/resume.spec.ts`

### 수정 파일 (2개)
- `frontend/src/App.tsx` — `/resume` 라우트 추가
- `frontend/src/components/Layout.tsx` — Resume 네비게이션 추가
