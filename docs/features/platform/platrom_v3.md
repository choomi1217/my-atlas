# Platform — 자기소개서 개선 (v3)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-13  
> 버전: v3  
> 상태: 진행 중

---

## 요구사항

현재 IntroTab(자기소개서)이 placeholder 상태. Notion에 정리된 자기소개 데이터를 React 컴포넌트로 이동.

### [INTRO-1] 간단한 자기소개 (5줄)
- 자기소개서 상단에 본인 소개를 간결하게 5줄 정도 작성

### [INTRO-2] 졸업장·자격증 원본 제외 (보안)
- 대학교 졸업장, 자격증 PDF 등 실물 파일은 옮기지 않음
- 텍스트 정보만 표시 (취득일, 명칭 등)

### [INTRO-3] 시각적 타임라인 그래프
- 대학교 졸업, 자격증 취득, 교육 수료, 회사 근무 이력을 **역사표(타임라인)** 형태로 시각화
- 한눈에 경력 흐름을 파악할 수 있도록 그래프 형태

---

## 현재 코드 분석 (Context)

### IntroTab.tsx (현재 상태)

| 항목 | 현황 |
|------|------|
| About Me 섹션 | 4개 카드 (지원동기, QA 전환, 강점, 방향) — **모두 placeholder** |
| 자기소개 텍스트 | ❌ 없음 |
| 타임라인/그래프 | ❌ 없음 |
| 자격증/교육 | ❌ 없음 |
| Contact | footer에 이메일만 존재 |

### Notion 원본 데이터 (정리)

**Certification:**
| 명칭 | 취득일 |
|------|--------|
| 정보처리기사 | 2021.11 |
| SQLD | 2021.12 |

**Education:**
| 교육 | 기간 |
|------|------|
| 대전보건대학교 컴퓨터정보과 (4.05/4.5) | 2017.02 — 2021.02 |
| 빅데이터 분석가 양성과정 | 2019.09 — 2019.10 |
| DBian 「친절한 SQL 튜닝」 | 2020.01 — 2020.02 |
| TDD, Clean Code with Java 17기 | 2023.10 — 2023.12 |
| AWS 기초와 Terraform으로 Provision하기 | 2023.05 |

**Work Experience (WorkExpTab에서 참조):**
| 회사 | 직무 | 기간 |
|------|------|------|
| 도로명주소단 | Java 백엔드 개발자 | 2020.12 — 2023.03 |
| NFLUX | Java 백엔드 개발자 | 2024.01 — 2024.10 |
| Studio XID | Test Engineer | 2025.03 — 2026.03 |

**Contact:**
| 항목 | 값 |
|------|-----|
| Phone | 010-4449-6558 |
| Email | whdudal1217@naver.com |
| Blog | https://choomi1217.github.io/ |
| GitHub | https://github.com/choomi1217 |

---

## 설계

### 1. IntroTab 구조 재설계

기존 4개 placeholder 카드 → 3개 섹션으로 교체:

```
IntroTab
  ┌────────────────────────────────┐
  │  INTRODUCE                     │
  │  간단한 자기소개 (5줄)          │
  ├────────────────────────────────┤
  │  TIMELINE                      │
  │  ┌──────────────────────┐      │
  │  │ 2017 ━━━━━━━━━━━━━━ 2026  │ ← 가로 타임라인 그래프
  │  │  대학교  회사  자격증 ...   │
  │  └──────────────────────┘      │
  ├────────────────────────────────┤
  │  CONTACT                       │
  │  Phone · Email · Blog · GitHub │
  └────────────────────────────────┘
```

### 2. 타임라인 시각화 방식

**가로 바(bar) 타임라인** — 순수 CSS(Tailwind)로 구현, 외부 라이브러리 없음.

- 시간축: 2017 ~ 2026 (약 10년)
- 카테고리별 색상 구분:
  - 교육(Education): `violet-300`
  - 근무(Work): `violet-500`
  - 자격증(Certification): `amber-400` (포인트 마커)
  - 교육과정(Course): `violet-200` (얇은 바)
- 각 항목은 시작~종료 기간에 비례한 가로 바로 표현
- 자격증 같은 단일 시점 이벤트는 원형 마커(dot)로 표현

### 3. 컴포넌트 구조

```
components/resume/
├── IntroTab.tsx         ← 전면 재작성 (Introduce + Timeline + Contact)
└── CareerTimeline.tsx   ← 신규 (타임라인 그래프 컴포넌트)
```

- `CareerTimeline` — 타임라인 데이터를 받아 가로 바 그래프 렌더링
- `IntroTab` — 3개 섹션 조합

### 4. 스타일링

- 기존 WorkExpTab의 보라색 테마(violet) 유지
- 섹션 헤더: `font-mono uppercase tracking-widest` + 구분선 (WorkExpTab 패턴 재사용)
- 반응형: `md:` breakpoint로 모바일 대응

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | CareerTimeline 컴포넌트 생성 (타임라인 그래프) | `components/resume/CareerTimeline.tsx` |
| 2 | IntroTab 전면 재작성 (Introduce + Timeline + Contact) | `components/resume/IntroTab.tsx` |
| 3 | E2E 테스트 업데이트 | `qa/ui/resume.spec.ts` |

---

### Step 1 — CareerTimeline 컴포넌트

**신규 파일:** `frontend/src/components/resume/CareerTimeline.tsx`

- [ ] 타임라인 데이터 정의 (type: 'education' | 'work' | 'certification' | 'course')
- [ ] 시간축 2017~2026 가로 바 렌더링
- [ ] 카테고리별 색상 구분 (education: violet-300, work: violet-500, cert: amber-400, course: violet-200)
- [ ] 기간 항목 → 가로 바, 단일 시점 항목 → 원형 마커
- [ ] 범례(legend) 표시
- [ ] 반응형 대응

**타임라인 데이터:**
```
2017.02 — 2021.02  대전보건대학교 컴퓨터정보과     [education]
2019.09 — 2019.10  빅데이터 분석가 양성과정          [course]
2020.01 — 2020.02  DBian SQL 튜닝                   [course]
2020.12 — 2023.03  도로명주소단                      [work]
2021.11            정보처리기사                       [certification]
2021.12            SQLD                              [certification]
2023.05            AWS Terraform 교육                [course]
2023.10 — 2023.12  TDD Clean Code Java              [course]
2024.01 — 2024.10  NFLUX                            [work]
2025.03 — 2026.03  Studio XID (QA)                  [work]
2026.02 — 현재     my-atlas (Side Project)           [work]
```

---

### Step 2 — IntroTab 재작성

**수정 파일:** `frontend/src/components/resume/IntroTab.tsx`

- [ ] Introduce 섹션: 5줄 자기소개 텍스트
- [ ] Timeline 섹션: CareerTimeline 컴포넌트 삽입
- [ ] Contact 섹션: Phone, Email, Blog, GitHub 링크
- [ ] 기존 4개 placeholder 카드 제거

---

### Step 3 — E2E 테스트 업데이트

**수정 파일:** `qa/ui/resume.spec.ts`

- [ ] 자기소개서 탭 → Introduce 텍스트 표시 확인
- [ ] 타임라인 렌더링 확인 (주요 항목 텍스트 존재)
- [ ] Contact 정보 표시 확인

---

## 변경 파일 목록

### Frontend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `components/resume/CareerTimeline.tsx` | 신규 | 가로 바 타임라인 그래프 |

### Frontend (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `components/resume/IntroTab.tsx` | 수정 | placeholder → Introduce + Timeline + Contact |

### E2E (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `qa/ui/resume.spec.ts` | 수정 | 자기소개서 탭 테스트 업데이트 |

### Backend

변경 없음

---

## 검증 시나리오

### UI 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 자기소개서 탭 클릭 | Introduce + Timeline + Contact 3개 섹션 표시 |
| 2 | Introduce 섹션 | 5줄 자기소개 텍스트 표시 |
| 3 | Timeline 그래프 | 2017~2026 가로 타임라인 렌더링, 카테고리별 색상 구분 |
| 4 | Timeline 항목 | 대학교, 회사, 자격증, 교육과정 항목 모두 표시 |
| 5 | Contact 섹션 | Phone, Email, Blog, GitHub 표시 |
| 6 | 모바일 반응형 | 좁은 화면에서 타임라인 깨지지 않음 |

---

## [최종 요약]

(모든 Step 완료 후 작성)
