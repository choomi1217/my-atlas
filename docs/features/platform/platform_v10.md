# Platform — Feature 상세 페이지 경력자 어필용 리뉴얼 (v10)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-21  
> 버전: v10  
> 상태: 완료

---

## 배경

`/feature/:slug` 상세 페이지는 서류 심사자(경력 시니어 엔지니어 / QA 리드 / 채용 매니저)가 프로젝트를 3초 안에 파악하는 첫 진입점이다.

### 기존 구조의 문제

| 섹션 | 문제 |
|------|------|
| API Endpoints 표 | 경력자에겐 공기 — 스펙시트 느낌으로 지루함 |
| Database Schema | 위와 동일, 뻔한 CRUD 테이블 나열 |
| 단일 `about.screenshot` | 1장만 표시 — 실제 동작 흐름을 보여주지 못함 |

### 개편 방향

- API / DB 스키마 섹션 **제거** — 심사자 관점에서 차별성 없음
- 스크린샷을 **N장 갤러리 + 캡션**으로 확장 — 시각적 증거가 텍스트보다 빠름
- 캡션은 "기능 설명"이 아닌 **"이 화면에서 보이는 실제 동작과 구현 포인트"** — 경력자에게 구현 깊이를 즉시 전달
- Test Studio 신규 feature entry 추가 (v1 / v1.1 / v2 출시 완료)
- 각 feature의 `tagline`을 **kill-shot 문장**으로 다듬어 어필 강도 상승

---

## 변경 내역

### 1. `frontend/src/data/featureDetails.ts`

**타입 변경**
- 제거: `ApiEndpoint`, `SchemaRow`, `apis`, `schema`, `about.screenshot`
- 추가: `Screenshot { src, caption }`, `FeatureDetail.screenshots: Screenshot[]`

**tagline 리라이트 (kill-shot)**
| feature | Before → After |
|---------|---------------|
| senior | RAG 기반 AI 시니어 QA 챗봇 → **RAG 파이프라인 직접 구현 — pgvector + Spring AI + SSE 스트리밍** |
| kb | PDF 파이프라인 + 벡터 검색 지식 관리 → **PDF → 청킹 → 임베딩 비동기 파이프라인, Virtual Threads + @Async + Rate Limit 대응** |
| test-suite | 계층형 테스트 케이스 관리 시스템 → **TestRail 핵심 기능을 Adjacency List + JSONB로 재구현 — Release Readiness 대시보드까지** |
| qa | 테스트 전략 & 자동화 파이프라인 → **328개 자동화 테스트 · JaCoCo 70% 강제 · Testcontainers pgvector 통합** |
| test-studio | (신규) → **문서 → Claude RAG → DRAFT TestCase 자동 생성 — QA의 반복 작성 노동을 제거** |

**screenshots 매핑 — 총 28장**
- senior: 2장 (faq 목록, 채팅)
- kb: 4장 (목록, PDF 업로드, 글 등록, 글 상세)
- conventions: 2장 (목록, 단어 등록) — 파일명은 `convention_*` 규칙 유지
- test-suite: 15장 (company → product → tc → testrun → version → phase → Jira 연동 플로우 → no-go 대시보드)
- test-studio: 5장 (홈 → 문서 등록 → 진행중 → 완료 → Path 지정)
- qa: 0장 (텍스트 중심 유지)

**test-studio feature entry 신규 추가**
- 테스팅 카운트: Service 18 / Controller 9 / Integration 4 / E2E 11
- versions: v1 (2026-04-19), v1.1 (2026-04-20), v2 (2026-04-20)

### 2. `frontend/src/pages/FeatureDetailPage.tsx`

**섹션 재배열**
```
Before: Hero → About → [screenshot 1장] → Architecture → API → Schema → Testing → Versions
After:  Hero → About → Screenshots 갤러리(N장) → Architecture → Testing → Versions
```

**Screenshots 섹션 구현**
- `<figure>` + `<img loading="lazy">` + `<figcaption>` 구조
- 순번 배지 `#01` + 캡션 본문
- 경계선 + `rounded-2xl` + `bg-gray-50` caption 영역으로 쇼케이스 톤

**제거**
- API Endpoints 테이블 섹션 전체
- Database Schema 섹션 전체
- 위 두 섹션 전용 헬퍼 함수 `methodColor`

### 3. `frontend/src/components/overview/FeaturesSection.tsx`

Overview 페이지 Features 섹션에 Test Studio 카드 신규 추가 (Test Suite → Test Studio → QA Strategy 순).

---

## 이미지 파일 규칙 (공식화)

- **경로:** `frontend/public/images/features/`
- **명명:** `{slug}_{2자리 순번}_{ASCII 설명}.png`
  - slug는 `featureDetails.ts`의 key (`senior`, `kb`, `conventions`, `test-suite`, `test-studio`)
  - 예외: `conventions` feature의 이미지 파일명은 `convention_*` (운영 이미지 유지)
  - ASCII 파일명 필수 — Vite dev server가 한글 파일명을 SPA fallback으로 처리하여 로컬 개발에서 이미지 서빙 실패. 프로덕션(S3+CloudFront)은 한글도 정상 서빙되지만 개발/E2E 일관성을 위해 ASCII 강제.
- **참조:** `/images/features/{파일명}` — Vite 정적 번들 + 프론트 S3 + CloudFront `/*` 라우팅

---

## 검증

- [x] TypeScript 타입 정합 (apis/schema 필드 완전 제거)
- [x] Lint 0 warnings
- [x] Vite build 성공
- [x] 브라우저 실행 — 각 feature 페이지에서 이미지 로딩, 캡션 표시, 섹션 순서 확인

---

## 차후 작업

- QA Strategy(`qa`) 페이지용 스크린샷 추가 예정 (테스트 피라미드 도표, CI 성공 캡처, JaCoCo 리포트)
- 이미지 클릭 시 라이트박스 확대 뷰 (현재는 원본 크기 그대로 노출)
