# Platform — 기능 명세서

## 개요

**QA 팀이 축적한 테스트 케이스, 지식 베이스, 용어 컨벤션은 팀의 핵심 자산이다.** 이 자산이 누구에게나 무제한으로 열려 있으면 — 주니어의 실수로 중요한 TC가 삭제되거나, 외부 접근으로 데이터가 유출될 수 있다.

Platform은 my-atlas의 **4개 도메인 기능(Feature Registry, Knowledge Base, My Senior, Words Convention)이 안전하고 일관되게 동작**하도록 횡단 관심사를 책임진다. JWT 인증으로 접근을 제어하고, Role 기반 권한으로 ADMIN(리드/시니어)과 USER(주니어)의 역할을 분리하며, 통합 레이아웃으로 기능 간 빠른 전환을 제공한다.

## 브랜치

- `feature/platform` — worktree(`/.claude/worktrees/platform`)로 격리 작업

---

## QA 시니어가 이 기능을 중요하게 봐야 하는 이유

### 1. QA 자산 보호

테스트 케이스, KB 지식, 용어 컨벤션은 팀이 시간을 들여 축적한 자산이다. JWT 인증은 인가된 사용자만 이 자산에 접근할 수 있도록 보장한다. 특히 KB에 저장된 PDF 도서 임베딩은 재생성 시 API 비용이 발생하므로, 무단 삭제를 방지하는 것이 중요하다.

### 2. 역할 분리로 실수 방지

| Role | 권한 | 대상 |
|------|------|------|
| **ADMIN** | 모든 CRUD (생성, 수정, 삭제) | 리드 QA, 시니어 QA |
| **USER** | 읽기 전용 | 주니어 QA, 신규 입사자 |

주니어 QA가 학습 중에 실수로 데이터를 수정/삭제하는 것을 원천 차단한다. 읽기 전용 권한으로 안전하게 탐색하면서 팀 지식을 학습할 수 있다.

### 3. 일관된 작업 환경

사이드바 네비게이션으로 4개 기능 간 전환이 즉시 가능하다. TC를 작성하다가 용어를 확인하고, KB에서 관련 지식을 찾고, My Senior에게 질문하는 — QA 실무의 자연스러운 흐름을 하나의 앱에서 수행한다.

---

## 실무 활용 시나리오

### 시나리오 1: 신규 QA 온보딩

> "새로 합류한 주니어 QA에게 기존 TC와 KB를 학습시키고 싶어요."

USER 권한 계정을 생성하여 전달 → 주니어가 Feature Registry에서 제품별 TC 구조를 탐색하고, KB에서 팀 지식을 읽으며, My Senior에게 궁금한 점을 질문. 읽기 전용이므로 **실수로 기존 데이터를 수정할 걱정이 없다.**

### 시나리오 2: 리드 QA의 팀 지식 관리

> "팀원들이 반드시 알아야 할 핵심 KB 항목을 고정하고, 불필요한 컨벤션을 정리하고 싶어요."

ADMIN 권한으로 KB Pin 설정(최대 15건 → FAQ 화면에 고정 노출), 오래된 컨벤션 삭제, TC 구조 재정리. 팀의 지식 자산을 **체계적으로 큐레이션**한다.

---

## 다른 기능과의 연계

| 방향 | 연계 기능 | 역할 | QA 의미 |
|------|-----------|------|---------|
| Platform → 전체 | JWT 인증 | 모든 API 요청에 Bearer 토큰 필수 | QA 자산에 대한 접근 제어 |
| Platform → 전체 | Role 기반 권한 | ADMIN만 CUD, USER는 Read-only | 역할별 실수 방지 |
| Platform → Layout | 사이드바 내비게이션 | 4개 기능 + Resume 통합 | 기능 간 빠른 전환 |

---

## 담당 범위

### 1. 인증 / 보안 (Authentication & Security)

> 현재 상태: **v1 구현 완료** — JWT 인증 + Role 기반 권한 + 로그인 페이지

| 항목 | 현황 | 비고 |
|------|------|------|
| 로그인 페이지 | ✅ 구현 | `pages/LoginPage.tsx` |
| Spring Security 설정 | ✅ 구현 | `config/SecurityConfig.java` — JWT stateless |
| JWT / 세션 관리 | ✅ 구현 | `auth/JwtProvider.java` — HMAC-SHA256, 24h 만료 |
| Protected Routes (FE) | ✅ 구현 | `components/ProtectedRoute.tsx` |
| Axios 인터셉터 (토큰 주입) | ✅ 구현 | `api/client.ts` — Bearer 토큰 + 401 리다이렉트 |
| CORS 설정 | ✅ 존재 | `WebConfig.java` — localhost, CloudFront, EC2 IP 허용 |

### 2. 공통 UI / UX

> 현재 상태: **최소 구현** — Layout 셸 + 몇 개 공유 컴포넌트만 존재

| 항목 | 현황 | 파일 |
|------|------|------|
| Layout (사이드바 + 메인) | ✅ 동작 | `frontend/src/components/Layout.tsx` |
| Navigation (4개 메뉴) | ✅ 동작 | Layout.tsx 내부 NavLink |
| Breadcrumb | ✅ Feature 전용 | `components/features/Breadcrumb.tsx` |
| ConfirmDialog | ✅ Feature 전용 | `components/features/ConfirmDialog.tsx` |
| Toast / 알림 시스템 | ❌ 없음 | 에러는 `alert()` 또는 인라인 텍스트 |
| Error Boundary | ❌ 없음 | React Error Boundary 미적용 |
| 글로벌 Loading 상태 | ❌ 없음 | 각 컴포넌트가 개별 관리 |
| 404 / Error 페이지 | ❌ 없음 | |
| 테마 시스템 | ❌ 없음 | Tailwind 기본값만 사용 |

### 3. API 인프라

> 현재 상태: **기본 구조 존재** — 표준화 여지 있음

| 항목 | 현황 | 파일 |
|------|------|------|
| ApiResponse 래퍼 (BE) | ✅ 표준화 | `common/ApiResponse.java` (record: success, message, data) |
| GlobalExceptionHandler (BE) | ✅ 동작 | 400/404/500 매핑 |
| Axios 인스턴스 (FE) | ✅ 기본 | `api/client.ts` — baseURL 빈 문자열 (Vite proxy) |
| 응답 에러 처리 (FE) | ⚠️ 비일관 | 각 hook이 개별 try-catch |
| API 문서 (Swagger) | ❌ 없음 | OpenAPI spec 미생성 |

### 4. 상태 관리

> 현재 상태: **중복 존재** — Context와 Zustand가 같은 역할

| 항목 | 현황 | 파일 |
|------|------|------|
| ActiveCompanyContext | ✅ 존재 | `context/ActiveCompanyContext.tsx` |
| featureStore (Zustand) | ✅ 존재 | `stores/featureStore.ts` |
| **문제** | ⚠️ 중복 | 둘 다 `activeCompany` 상태를 관리 → 통합 필요 |

### 5. 기타 횡단 관심사

| 항목 | 현황 |
|------|------|
| 요청/응답 로깅 (BE) | ✅ `ApiAccessLogFilter` — api_access_log 기록 (ip_address 포함, v9) |
| Rate Limiting | ✅ `AiRateLimitFilter` — IP 기준 Fixed Window (v9, Caffeine 기반) |
| 비로그인 공개 접근 | ✅ `DynamicPublicAccessFilter` — `login_required=false` 시 whitelist 경로만 Anonymous 허용 (v9) |
| 캐싱 (Redis 등) | ❌ 없음 |
| i18n (다국어) | ❌ 한국어 하드코딩 |
| Monitoring / Observability | ⚠️ Actuator health/info + AI 사용량 로그 (api_access_log, ai_usage_log) |
| Audit Trail | ⚠️ createdAt/updatedAt만 존재, 별도 감사 서비스 없음 |

---

## 기존 공유 코드 맵

현재 도메인 간 공유되고 있는 코드 현황:

### Backend (`com.myqaweb.common`)

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `ApiResponse.java` | 응답 래퍼 (record) | 모든 Controller |
| `GlobalExceptionHandler.java` | 전역 예외 → HTTP 상태 매핑 | 전역 |
| `EmbeddingService.java` | OpenAI 임베딩 호출 | FAQ, KB |
| `VectorType.java` | pgvector ↔ Java float[] 변환 | FAQ, KB Entity |

### Backend (`com.myqaweb.config`)

| 파일 | 역할 |
|------|------|
| `WebConfig.java` | CORS 설정 (`/api/**`) |
| `AiConfig.java` | Spring AI ChatModel/ChatClient Bean 등록 |

### Frontend (공유 레이어)

| 파일 | 역할 |
|------|------|
| `components/Layout.tsx` | 사이드바 + 메인 콘텐츠 셸 |
| `api/client.ts` | Axios 인스턴스 (인터셉터 placeholder) |
| `context/ActiveCompanyContext.tsx` | 활성 회사 Context |
| `stores/featureStore.ts` | 활성 회사 Zustand store (Context와 중복) |
| `index.css` | Tailwind 디렉티브 + 시스템 폰트 |

---

## 향후 개발 로드맵 (예정)

우선순위는 사용자와 협의하여 결정.

| 순서 | 기능 | 설명 | 난이도 |
|------|------|------|--------|
| — | 로그인 / JWT 인증 | Spring Security + JWT + 로그인 페이지 + Protected Routes | 높음 |
| — | Toast 알림 시스템 | alert() 대체, 성공/에러/경고 통합 | 낮음 |
| — | Error Boundary | React Error Boundary + Fallback UI | 낮음 |
| — | 404 / Error 페이지 | 라우트 미스매치 처리 | 낮음 |
| — | FE 에러 처리 표준화 | Axios 인터셉터 + 공통 에러 hook | 중간 |
| — | 상태 관리 통합 | Context/Zustand 중복 제거 | 낮음 |
| — | API 문서 (Swagger) | SpringDoc OpenAPI 자동 생성 | 낮음 |
| — | 요청 로깅 미들웨어 | Spring Filter로 요청/응답 로깅 | 중간 |

---

## 버전 히스토리

| 버전 | 날짜 | 유형 | 설명 |
|------|------|------|------|
| v1 | 2026-04-10 | 기능 추가 | 로그인 / JWT 인증 / Role 기반 권한 (Spring Security + React ProtectedRoute) |
| v2 | 2026-04-12 | 기능 추가 | Resume 페이지 (경력기술서/자기소개서 탭 전환, Static Content) |
| v7 | 2026-04-17 | 문서 개선 | QA 시니어 관점 보강. 개요 재작성 + QA 가치/실무 시나리오/기능 연계 섹션 추가 |
| v8 | 2026-04-20 | 기능 추가 | Settings 페이지 + User 등록 + Company 접근 제어 + AI On/Off + Session Timeout + AI Slack 알림 |
| v9 | 2026-04-22 | 기능 추가 | 로그인 필수 토글(비로그인 공개 접근) + IP 기준 AI Rate Limiting + Settings AccessControl 섹션 |
| v10 | 2026-04-21 | 기능 개선 | Feature 상세 페이지 경력자 어필용 리뉴얼 (API/Schema 섹션 제거, Screenshots 갤러리 도입, Test Studio feature 추가) |
