# Platform — Overview 페이지 + GNB + Feature 상세 페이지 (v6)

> 변경 유형: 기능 추가  
> 작성일: 2026-04-17  
> 버전: v6  
> 상태: 완료

---

## 요구사항

### [FEAT-1] 프로젝트 개요 정리 페이지
my-atlas 프로젝트 전체를 한눈에 파악할 수 있는 개요 페이지가 필요하다.
- 어떤 기능들이 개발되었는지
- Ops는 어떤 구성인지
- QA Release 하는 Process는 어떻게 되는지

### [BUG-7] Resume 이메일 수정
`choomi1217@gmail.com` → `whdudal1217@naver.com`

### [FEAT-2] Notion MCP 연결
Resume과 자기소개서 내용을 Notion에 옮겨 적어야 한다.

---

## 설계

### FEAT-1: Overview 페이지 구조

**라우트:** `/` (루트)  
**진입점:** GNB 로고 ("my-atlas") 클릭 → `/` 이동

**페이지 구성 — 5개 섹션:**
1. Hero (QA Toolkit, 프로젝트 설명, 기술 스택 태그)
2. Features (5개 기능 카드 → `/feature/:slug` 상세 페이지 링크)
3. Release Process (브랜치 전략 + 테스트 파이프라인 310 tests)
4. Infrastructure (AWS 구성 + CI/CD 5개 워크플로우)
5. Roadmap (향후 개발 계획 8개)

### LNB → GNB 전환

기존 사이드바(LNB)를 제거하고, tossplace.com 참고 상단 GNB(Sticky) 방식으로 전환.
- `backdrop-blur-md` + 반투명 배경
- 로고 | 네비게이션 | 유저정보+로그아웃
- `max-w-6xl mx-auto` 중앙정렬

### Feature 상세 페이지 (`/feature/:slug`)

| 섹션 | 내용 |
|------|------|
| About | 왜 만들었는가 / 어떤 기능인가 / QA에게 좋은 점 (3컬럼 카드) |
| Architecture | 번호 매긴 플로우 |
| API Endpoints | 메서드별 컬러 코딩 테이블 |
| Database Schema | 테이블별 카드 |
| Testing | 테스트 수 카드 |
| Version History | 최신순 버전 목록 → `/feature/:slug/:version` 링크 |

### Feature 버전 페이지 (`/feature/:slug/:version`)

버전별 변경 내역 (Breadcrumb, 변경 유형 뱃지, Changes 목록, 이전/다음 네비게이션).

### 폰트 변경

Spoqa Han Sans Neo (CDN) + Tailwind 기본 sans 오버라이드.

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | OverviewPage + 4개 섹션 컴포넌트 생성 | `pages/OverviewPage.tsx`, `components/overview/*.tsx` |
| 2 | App.tsx `/` 라우트 변경 + Layout.tsx GNB 전환 | `App.tsx`, `Layout.tsx` |
| 3 | Resume 이메일 수정 | `ResumeHeader.tsx`, `IntroTab.tsx` |
| 4 | Feature 상세/버전 페이지 + 데이터 | `FeatureDetailPage.tsx`, `FeatureVersionPage.tsx`, `featureDetails.ts` |
| 5 | Notion MCP 동기화 | — (미진행, 다음 세션에서) |

---

### Step 1 — OverviewPage + 섹션 컴포넌트 ✅

- [x] OverviewPage: Hero + 5개 섹션 단일 스크롤
- [x] FeaturesSection: 5개 기능 카드 (QA Strategy 추가)
- [x] ReleaseProcessSection: 브랜치 플로우 + 테스트 파이프라인
- [x] OpsSection: 인프라 5항목 + CI/CD 테이블
- [x] FuturePlansSection: 향후 개발 계획 8개 (난이도 뱃지)

### Step 2 — GNB + 라우트 ✅

- [x] Layout.tsx: LNB 제거, GNB(Sticky) 전환 (backdrop-blur, 반투명)
- [x] App.tsx: `/` → OverviewPage, `/feature/:slug`, `/feature/:slug/:version` 라우트 추가
- [x] LoginPage.tsx: 로그인 후 `/`로 이동
- [x] Spoqa Han Sans Neo 폰트 적용 (index.html CDN, tailwind.config.js, index.css)

### Step 3 — Resume 이메일 수정 ✅

- [x] ResumeHeader.tsx: `choomi1217@gmail.com` → `whdudal1217@naver.com`
- [x] IntroTab.tsx: footer 이메일 수정

### Step 4 — Feature 상세/버전 페이지 ✅

- [x] featureDetails.ts: 5개 기능 데이터 (About, Architecture, API, Schema, Testing, Versions)
- [x] FeatureDetailPage.tsx: About(3컬럼) + Architecture + API + Schema + Testing + Version History
- [x] FeatureVersionPage.tsx: 버전별 변경 내역 + 이전/다음 네비게이션
- [x] 전체 폰트 크기 상향 (QA 임팩트 순위 기반)
- [x] Resume 페이지 폰트 크기 상향 (WorkExpTab, IntroTab, ResumePage)

### Step 5 — Notion MCP 동기화 (미진행)

- [ ] Notion MCP API 개요 확인
- [ ] Resume/자기소개서 Notion 페이지 생성

---

## 변경 파일 목록

| 파일 | 구분 | 설명 |
|------|------|------|
| `frontend/src/pages/OverviewPage.tsx` | 신규 | 프로젝트 개요 페이지 |
| `frontend/src/components/overview/FeaturesSection.tsx` | 신규 | 기능 카드 (5개 + QA) |
| `frontend/src/components/overview/ReleaseProcessSection.tsx` | 신규 | 릴리즈 프로세스 |
| `frontend/src/components/overview/OpsSection.tsx` | 신규 | 인프라 구성 |
| `frontend/src/components/overview/FuturePlansSection.tsx` | 신규 | 향후 개발 계획 |
| `frontend/src/data/featureDetails.ts` | 신규 | Feature 상세 데이터 |
| `frontend/src/pages/FeatureDetailPage.tsx` | 신규 | Feature 상세 페이지 |
| `frontend/src/pages/FeatureVersionPage.tsx` | 신규 | Feature 버전 페이지 |
| `frontend/src/App.tsx` | 수정 | 라우트 추가, 기본 랜딩 변경 |
| `frontend/src/components/Layout.tsx` | 수정 | LNB → GNB(Sticky) 전환 |
| `frontend/src/pages/LoginPage.tsx` | 수정 | 로그인 후 `/`로 이동 |
| `frontend/index.html` | 수정 | Spoqa Han Sans Neo CDN 추가 |
| `frontend/tailwind.config.js` | 수정 | fontFamily sans 오버라이드 |
| `frontend/src/index.css` | 수정 | font-family 변경 |
| `frontend/src/components/resume/ResumeHeader.tsx` | 수정 | 이메일 + 폰트 크기 |
| `frontend/src/components/resume/IntroTab.tsx` | 수정 | 이메일 + 폰트 크기 |
| `frontend/src/components/resume/WorkExpTab.tsx` | 수정 | 폰트 크기 상향 |
| `frontend/src/pages/ResumePage.tsx` | 수정 | 탭 버튼 폰트 크기 |

---

## [최종 요약]

LNB → GNB 전환, Overview 페이지 신규, Feature 상세/버전 페이지 구현, Spoqa Han Sans Neo 폰트 적용, 전체 폰트 크기 QA 임팩트 기반 상향. 총 18개 파일 변경 (+1100 / -144 lines). Notion MCP 동기화는 다음 세션에서 진행.
