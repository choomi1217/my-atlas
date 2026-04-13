# Platform — 메인 명세서

## 개요

feature-registry, knowledge-base, my-senior, word-convention이 **각자 해결하지 못하는 횡단 관심사(cross-cutting concerns)**를 담당하는 영역.

도메인 기능이 "무엇을 하느냐"라면, Platform은 "어떻게 안전하고 일관되게 동작하느냐"를 책임진다.

## 브랜치

- `feature/platform` — worktree(`/.claude/worktrees/platform`)로 격리 작업

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
| 요청/응답 로깅 (BE) | ❌ 미들웨어 없음 |
| Rate Limiting | ❌ 없음 |
| 캐싱 (Redis 등) | ❌ 없음 |
| i18n (다국어) | ❌ 한국어 하드코딩 |
| Monitoring / Observability | ⚠️ Actuator health/info만 노출 |
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
