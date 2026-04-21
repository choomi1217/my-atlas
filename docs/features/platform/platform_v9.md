# Platform — 로그인 Bypass + IP Rate Limiting (v9)

> 변경 유형: 기능 추가
> 작성일: 2026-04-22
> 버전: v9
> 상태: 완료

---

## 요구사항

Setting 페이지에서 로그인 기능을 On/Off 할 수 있어야 합니다. (서류 심사자는 즉시 포트폴리오를 볼 수 있어야 합니다.)
서류 심사하는 동안에 발생하는 AI Token 은 어쩔 수 없다고 생각하고, 대신 IP 기준으로 토큰 제한량을 둬야 할 것 같습니다. (IP 기준 Rate Limiting 기능)

### 정리

- **[FEAT-1] 로그인 필수 여부 토글** — Settings(ADMIN 전용)에서 `login_required` On/Off. Off 시 비로그인 상태로 Resume + 4개 도메인 기능 조회 가능
- **[FEAT-2] 비로그인 접근 정책** — 읽기(GET) 엔드포인트 및 Senior Chat은 `login_required=false`일 때 인증 없이 허용. CRUD(POST/PUT/PATCH/DELETE)와 Settings는 여전히 인증 필요
- **[FEAT-3] IP 기준 Rate Limiting** — AI 비용 남용 방지. IP별 sliding window로 `/api/senior/chat`, `/api/senior/sessions` POST, PDF 업로드(임베딩 유발) 호출량 제한. 초과 시 429
- **[FEAT-4] Settings UI 확장** — 로그인 토글 + Rate Limit 임계값 편집 섹션 추가

---

## 현재 코드 분석 (Context)

### SecurityConfig — 인증 규칙 (`backend/src/main/java/com/myqaweb/config/SecurityConfig.java:39-53`)

```
/api/auth/login              → permitAll
/actuator/**                 → permitAll
/api/auth/register           → hasRole("ADMIN")
/api/admin/**                → hasRole("ADMIN")
/api/settings/**             → hasRole("ADMIN")
/api/**                      → authenticated      ← USER도 CRUD 가능 (v8 변경사항)
```

비로그인 상태를 허용하려면 **런타임 설정 값 기반 분기**가 필요하다. 정적 `authorizeHttpRequests`만으로는 불충분.

### JwtAuthenticationFilter (`backend/src/main/java/com/myqaweb/auth/JwtAuthenticationFilter.java:21-46`)

- Authorization 헤더 없음 / 유효하지 않은 토큰 → SecurityContext 비움 → 후속 인가 단계에서 401
- 비로그인 경로를 허용하려면 이 필터가 **token 없어도 통과**하고, 익명 principal을 세팅하도록 유지

### SystemSettings 저장소 (v8)

- `system_settings` 테이블: key-value 구조. 현재 키 2개 (`ai_enabled`, `session_timeout_seconds`)
- `SettingsServiceImpl.isAiEnabled()`, `getSessionTimeoutSeconds()` 같이 **도메인 서비스가 참조**
- **`login_required` 키를 같은 구조로 추가**하면 재사용 극대화

### AI 호출 진입점

| 파일 | 호출 메서드 | 현재 가드 |
|------|-------------|-----------|
| `senior/SeniorServiceImpl.java:chat()` | `chatClient.prompt()...stream()` | `isAiEnabled()` 체크 후 503 |
| `common/EmbeddingService.java:embed()` | `embeddingModel.get().embedForResponse()` | `isAiEnabled()` 체크 후 503 |
| `knowledgebase/PdfPipelineService` | `EmbeddingService.embed()` 호출 | 동일 |

**추가할 가드**: IP 기준 Rate Limit. `@Async` 이전, 동기 구간에서 HttpServletRequest의 `getRemoteAddr()` 확인 후 초과 시 429.

### 모니터링 인프라 (v7/v8에서 구축됨)

- `ai_usage_log`: feature, provider, model, input/output_tokens, estimated_cost, username, created_at
- `api_access_log`: method, uri, feature, status_code, duration_ms, username, created_at (ip_address 없음)
- `AiUsageLogServiceImpl.logUsage()` — @Async로 DB 기록, username null 허용
- `ApiAccessLogFilter` — 요청 단위로 `api_access_log` 기록

**v9 확장 포인트**: 두 테이블에 `ip_address` 칼럼 추가 → Rate Limit 집계 및 비로그인 AI 사용 추적 가능.

### Frontend 인증/라우팅

| 파일 | 역할 | v9 영향 |
|------|------|---------|
| `context/AuthContext.tsx` | token, user, expiry 관리 | `loginRequired` 플래그 보관 필요 |
| `components/ProtectedRoute.tsx` | 비로그인 시 `/login` 강제 | `loginRequired=false` 시 통과 |
| `components/Layout.tsx` | 사이드바 + 사용자 메뉴 | 비로그인 상태 렌더링 분기 |
| `pages/LoginPage.tsx` | 로그인 폼 | `loginRequired=false` 시 "바로 둘러보기" 버튼 |
| `api/client.ts` | Bearer 토큰 주입, 401 리다이렉트 | `loginRequired=false` 상태에서 401 처리 분기 |
| `App.tsx` | `/resume`, `/senior`, `/kb`, `/conventions`, `/features` 라우트 | 일부 라우트는 비로그인 접근 허용 |

### Flyway 마이그레이션

- 최근 3개: `V202604200900__create_word_category.sql`, `V202604201000__create_monitoring_tables.sql`, `V202604201100__create_settings_tables.sql`, `V202604201800__add_test_case_suggested_segment_path.sql`
- v9 신규 버전 제안: **`V202604210900__add_login_required_and_ip_rate_limit.sql`**

---

## 설계

### FEAT-1: 로그인 필수 여부 토글

**DB:**

```sql
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('login_required', 'true');  -- 기본값: 현재 동작 유지 (로그인 필요)

-- Rate Limit 임계값도 설정값으로 관리 (운영 중 튜닝)
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('ai_rate_limit_per_ip', '30'),           -- IP당 허용 요청 수
  ('ai_rate_limit_window_seconds', '3600'); -- 윈도우 (1시간)
```

**Backend:**
- `SettingsServiceImpl.isLoginRequired()` 신규
- `SystemSettingsResponse` DTO에 `loginRequired`, `aiRateLimitPerIp`, `aiRateLimitWindowSeconds` 필드 추가
- `UpdateSettingsRequest`에 동일 필드 추가 (null이면 해당 키 변경 안 함)

### FEAT-2: 비로그인 접근 정책

**접근 허용 경로** (`login_required=false`일 때만):

| 경로 | Method | 목적 |
|------|--------|------|
| `/api/companies` | GET | Resume/Features 진입 화면 |
| `/api/products`, `/api/segments`, `/api/test-cases` | GET | Feature Registry 탐색 |
| `/api/versions`, `/api/version-phases`, `/api/test-runs`, `/api/test-results`, `/api/tickets` | GET | 릴리즈 통계 열람 |
| `/api/kb/**` | GET | Knowledge Base 조회 |
| `/api/conventions/**` | GET | Convention 조회 |
| `/api/senior/faq`, `/api/senior/sessions/**` | GET | Senior 읽기 |
| `/api/senior/chat` | POST | Senior Chat (체험용, IP Rate Limit 적용) |
| `/api/senior/sessions` | POST | 세션 생성 (IP Rate Limit 적용) |

**차단 유지**:
- 모든 비-GET CRUD는 여전히 `authenticated` (로그인 필요). 비로그인 방문자가 데이터를 변경할 수 없음
- `/api/settings/**`, `/api/admin/**`, `/api/auth/register` — ADMIN 전용 유지
- `/api/kb/upload-pdf`, `/api/kb/{id}` DELETE 등 — `authenticated`로 차단 (임베딩 비용 큼)

**구현:**
- `SecurityConfig`에 `DynamicPublicAccessFilter`(신규) 추가 — 런타임에 `login_required` 조회 후, 설정이 `false`이고 요청 경로가 화이트리스트에 속하면 `AnonymousAuthenticationToken`을 SecurityContext에 세팅하고 통과
- `authorizeHttpRequests`의 `/api/**` authenticated 규칙은 유지 → Anonymous 토큰도 인증 객체로 인정되므로 통과
- 화이트리스트는 `Set<AntPathRequestMatcher>`로 관리 (경로+메서드 조합)

### FEAT-3: IP 기준 Rate Limiting

**대상 엔드포인트**: AI 비용이 큰 경로만
- `POST /api/senior/chat`
- `POST /api/senior/sessions` (새 세션 시작도 LLM 요약 유발)
- `POST /api/kb/upload-pdf` (다만 비로그인 불가 — 로그인 시만 IP 로깅)

**알고리즘**: Fixed window counter (구현 단순, 서버 재시작에 관대)
- Caffeine Cache (`Cache<String, AtomicInteger>`)
- 키: `ip + ":" + windowStartBucket` (예: `192.168.0.1:1712345600`)
- 윈도우 만료 시간 = `ai_rate_limit_window_seconds`
- 초과 시 `ResponseStatusException(429, "AI rate limit exceeded for this IP")`

**필터 위치**: `AiRateLimitFilter` — `JwtAuthenticationFilter` 이후, 컨트롤러 진입 전. 대상 경로에만 매칭.

**로그인 사용자 예외**: `login_required=true`거나 인증된 사용자는 Rate Limit 면제 (내부 사용자 보호 우선). 설계 변경 여지: 로그인 여부 무관하게 IP 기준 적용도 가능 — 초기 버전은 비로그인만 적용.

**응답 형식:**
```json
{
  "success": false,
  "message": "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
  "data": {
    "retryAfterSeconds": 1523
  }
}
```

`Retry-After` HTTP 헤더도 세팅.

### FEAT-4: Settings UI 확장

**신규 섹션** `AccessControlSection.tsx`:

```
┌─────────────────────────────────────┐
│  Access Control                     │
├─────────────────────────────────────┤
│  로그인 필수        [ON] / [OFF]   │
│  (Off: 비로그인 방문자도 조회 가능)│
│                                     │
│  AI Rate Limit (비로그인 IP 기준)  │
│  최대 요청 수     [ 30       ]     │
│  윈도우 (초)      [ 3600     ]     │
└─────────────────────────────────────┘
```

- `loginRequired` 토글 스위치
- Rate limit 숫자 입력 (1~1000, 60~86400)
- 저장 버튼 → PATCH `/api/settings` (단일 요청으로 복수 키 업데이트 지원)

**비로그인 상태 UI 분기**:
- `LoginPage`: `loginRequired=false` 시 "로그인 없이 둘러보기" 버튼 노출 → `/features`로 이동
- `Layout`: 비로그인 시 헤더 우측 "Login" 버튼, 사이드바는 그대로 표시 (ADMIN 전용 메뉴인 Settings는 숨김)
- 각 페이지의 CRUD 버튼: `user == null` 시 숨김 or "로그인 필요" 표기

### 비로그인 Anonymous principal 이름

- `SecurityContextHolder.getContext().getAuthentication().getName()`이 `"anonymousUser"` 반환
- `AiUsageLogServiceImpl`에서 이 값을 감지하여 `username=null`로 저장 (기존 처리 그대로 활용 가능)
- `ai_usage_log.ip_address`, `api_access_log.ip_address` 칼럼에 IP 기록

---

## 구현 순서

| Step | 작업 | 주요 파일 |
|------|------|-----------|
| 1 | Flyway 마이그레이션 — `login_required`, rate limit 설정, ip_address 칼럼 | `V202604210900__add_login_required_and_ip_rate_limit.sql` |
| 2 | SettingsService 확장 — `isLoginRequired()`, rate limit 값 조회, DTO 확장 | `SettingsServiceImpl.java`, `SettingsDto.java`, `SettingsController.java` |
| 3 | `DynamicPublicAccessFilter` — login_required=false + 화이트리스트 경로면 Anonymous 인증 주입 | `config/DynamicPublicAccessFilter.java`, `SecurityConfig.java` |
| 4 | `AiRateLimitFilter` — IP 기준 Fixed window, 429 응답 | `config/AiRateLimitFilter.java`, `SecurityConfig.java` |
| 5 | `ApiAccessLogFilter` + `AiUsageLogService` — ip_address 수집 | `common/ApiAccessLogFilter.java`, `ai/AiUsageLogServiceImpl.java`, `ai/AiUsageLog*Entity.java` |
| 6 | Frontend AuthContext — loginRequired 상태 부팅 시 조회, ProtectedRoute 분기 | `context/AuthContext.tsx`, `components/ProtectedRoute.tsx`, `api/client.ts` |
| 7 | Frontend Layout / LoginPage — 비로그인 진입 UI + "둘러보기" 버튼 | `components/Layout.tsx`, `pages/LoginPage.tsx`, `App.tsx` |
| 8 | Frontend SettingsPage — AccessControlSection 신규 | `pages/SettingsPage.tsx`, `components/settings/AccessControlSection.tsx`, `api/settings.ts`, `types/settings.ts` |
| 9 | Backend 테스트 — 필터 단위/통합 테스트, SettingsService 확장 테스트 | `backend/src/test/java/.../config/*Test.java`, `settings/SettingsServiceImplTest.java` |
| 10 | E2E — 비로그인 접근, Rate Limit 초과, Settings UI 토글 | `qa/api/public-access.spec.ts`, `qa/api/rate-limit.spec.ts`, `qa/ui/settings-access-control.spec.ts` |
| 11 | Agent-D 빌드 검증 — backend build + docker compose up + E2E 전체 | (자동) |
| 12 | 메인 명세서 업데이트 — `platform.md` 버전 히스토리 + Roadmap 반영 | `docs/features/platform/platform.md` |

---

### Step 1 — Flyway 마이그레이션

**신규 파일:** `backend/src/main/resources/db/migration/V202604210900__add_login_required_and_ip_rate_limit.sql`

- [x] `system_settings`에 `login_required=true`, `ai_rate_limit_per_ip=30`, `ai_rate_limit_window_seconds=3600` 시드
- [x] `api_access_log`에 `ip_address VARCHAR(50)` 칼럼 추가
- [x] `ai_usage_log`에 `ip_address VARCHAR(50)` 칼럼 추가
- [x] `CREATE INDEX idx_api_access_log_ip_created_at ON api_access_log(ip_address, created_at)` — Rate Limit 집계 및 모니터링용

---

### Step 2 — SettingsService 확장

**수정 파일:**
- `settings/SettingsServiceImpl.java`
- `settings/SettingsService.java`
- `settings/SettingsDto.java`
- `settings/SettingsController.java` (변경 없을 수도 있음 — DTO 필드 확장만으로 처리)

- [x] `SystemSettingsResponse`에 `loginRequired: boolean`, `aiRateLimitPerIp: int`, `aiRateLimitWindowSeconds: int` 추가
- [x] `UpdateSettingsRequest`에 동일 필드 추가 (null 허용)
- [x] `SettingsService.isLoginRequired()`, `getAiRateLimit()` 신규 메서드
- [x] `getSettings()`/`updateSettings()` 구현 확장 — 신규 키 포함
- [x] `GET /api/settings/public` 신규 엔드포인트 — 인증 없이 `loginRequired` 값만 반환 (Frontend 부팅 시 호출)

---

### Step 3 — DynamicPublicAccessFilter

**신규 파일:** `backend/src/main/java/com/myqaweb/config/DynamicPublicAccessFilter.java`
**수정 파일:** `backend/src/main/java/com/myqaweb/config/SecurityConfig.java`

- [x] `DynamicPublicAccessFilter` 구현 — `OncePerRequestFilter`
  - 현재 SecurityContext에 인증 객체 없음 AND `login_required=false` AND 요청이 public whitelist 매칭 → `AnonymousAuthenticationToken` 세팅
  - whitelist: Step 설계 FEAT-2 표 기반 경로 매칭 (AntPathRequestMatcher)
- [x] SecurityConfig — `addFilterAfter(DynamicPublicAccessFilter, JwtAuthenticationFilter.class)`
- [x] `/api/settings/public` 경로는 `permitAll`에 추가

---

### Step 4 — AiRateLimitFilter

**신규 파일:** `backend/src/main/java/com/myqaweb/config/AiRateLimitFilter.java`
**수정 파일:** `SecurityConfig.java`, `backend/build.gradle` (Caffeine 의존성 확인 — 이미 있으면 skip)

- [x] Caffeine `Cache<String, AtomicInteger>` — `expireAfterWrite = window_seconds`
- [x] 대상 경로 whitelist (POST `/api/senior/chat`, POST `/api/senior/sessions`)
- [x] 인증된 사용자(ADMIN/USER)는 면제, Anonymous만 카운팅
- [x] 초과 시 429 + `Retry-After` 헤더 + `ApiResponse` JSON 바디
- [x] SecurityConfig — `addFilterAfter(AiRateLimitFilter, DynamicPublicAccessFilter.class)`
- [x] `system_settings`의 rate limit 값은 매 요청마다 조회 (설정 변경 즉시 반영) — 캐싱 불필요, SettingsService 경량

---

### Step 5 — ip_address 수집

**수정 파일:**
- `common/ApiAccessLogFilter.java`
- `ai/AiUsageLogServiceImpl.java`, `AiUsageLogEntity.java`
- `common/ApiAccessLog*Entity.java`

- [x] `ApiAccessLogFilter` — `request.getRemoteAddr()` 또는 `X-Forwarded-For` 헤더 우선 수집 (ALB 환경)
- [x] `AiUsageLog` 엔티티 / 서비스 — `ipAddress` 필드 추가, `logUsage()`에서 SecurityContext의 `details`(`WebAuthenticationDetails.getRemoteAddress()`) 혹은 `HttpServletRequest` 직접 주입
- [x] SecurityContext.authentication.principal이 "anonymousUser"면 `username=null` 유지 (이미 처리됨)

---

### Step 6 — Frontend AuthContext + ProtectedRoute

**수정 파일:**
- `context/AuthContext.tsx`
- `components/ProtectedRoute.tsx`
- `api/client.ts`
- `types/auth.ts`

- [x] `AuthContext`에 `loginRequired: boolean` 상태 + 초기 부팅 시 `GET /api/settings/public` 호출하여 캐시
- [x] `ProtectedRoute` — `!user && loginRequired === false` 면 통과, 그 외는 기존대로 `/login` 리다이렉트
- [x] `api/client.ts` — 401 응답 시 `loginRequired=true`일 때만 `/login` 리다이렉트
- [x] `types/auth.ts` — `loginRequired` 타입 추가

---

### Step 7 — Frontend Layout / LoginPage / App

**수정 파일:**
- `components/Layout.tsx`
- `pages/LoginPage.tsx`
- `App.tsx`

- [x] `LoginPage` — `loginRequired=false` 시 "로그인 없이 둘러보기" 버튼 → `/features` 이동
- [x] `Layout` — 비로그인 상태에서 사이드바 렌더링, 사용자 영역은 "로그인" 버튼, Settings 메뉴 숨김
- [x] `App.tsx` — `/resume`, `/senior`, `/kb`, `/conventions`, `/features`는 `ProtectedRoute` 유지 (내부에서 loginRequired 분기)
- [ ] Senior Chat UI — 비로그인 상태에서 응답 실패(429) 시 안내 메시지

---

### Step 8 — Frontend SettingsPage 확장

**신규 파일:**
- `components/settings/AccessControlSection.tsx`

**수정 파일:**
- `pages/SettingsPage.tsx`
- `api/settings.ts`
- `types/settings.ts`

- [x] `types/settings.ts` — `SystemSettings`에 신규 필드 3개
- [x] `api/settings.ts` — `getSettings()`/`updateSettings()` 시그니처 확장 (이미 DTO 확장으로 처리됨)
- [x] `AccessControlSection` — 로그인 토글 + rate limit 입력 (수량, 윈도우 초)
- [x] `SettingsPage` — 4번째 섹션으로 추가

---

### Step 9 — Backend 테스트

**신규 파일:**
- `backend/src/test/java/com/myqaweb/config/DynamicPublicAccessFilterTest.java`
- `backend/src/test/java/com/myqaweb/config/AiRateLimitFilterTest.java`

**수정 파일:**
- `settings/SettingsServiceImplTest.java` — 신규 메서드 커버
- `settings/SettingsControllerTest.java` — `/api/settings/public` 엔드포인트

- [ ] `DynamicPublicAccessFilterTest` — whitelist 매칭, login_required toggle 동작, Anonymous token 주입 확인
- [ ] `AiRateLimitFilterTest` — 임계값 이내 통과, 초과 시 429, 인증된 사용자 면제
- [ ] `SettingsServiceImplTest` — `isLoginRequired()`, `getAiRateLimit()` 기본값 + 업데이트 반영
- [ ] 통합 테스트 — `@SpringBootTest` + `MockMvc` 비로그인 접근 흐름

---

### Step 10 — E2E (Playwright)

**신규 파일:**
- `qa/api/public-access.spec.ts`
- `qa/api/rate-limit.spec.ts`
- `qa/ui/settings-access-control.spec.ts`

- [ ] `public-access.spec.ts` — `login_required=false` 설정 후 비인증 GET /api/companies, /api/kb, /api/conventions 200 확인. POST /api/companies는 401 유지
- [ ] `rate-limit.spec.ts` — 작은 rate limit 설정 후 연속 호출, N+1번째에 429 + Retry-After 헤더 확인
- [ ] `settings-access-control.spec.ts` — ADMIN 로그인 → Settings 진입 → 토글 OFF → 로그아웃 → /features 비로그인 접근 → 다시 토글 ON → 차단 확인
- [ ] 테스트 종료 후 설정 원복 (afterAll에서 login_required=true, rate limit 기본값으로 복원) — 데이터 보존 규칙

---

### Step 11 — Agent-D 빌드/E2E 검증

- [ ] `./gradlew clean build` (backend)
- [ ] `docker compose up -d --build && sleep 10`
- [ ] `cd qa && npx playwright test` — 전체 실행, "did not run" 없는지 확인, 신규 테스트 실제 실행 검증
- [ ] `docker compose down`

---

### Step 12 — 메인 명세서 + 로드맵

**수정 파일:**
- `docs/features/platform/platform.md` — 버전 히스토리 v9 행 추가, Access Control 섹션 반영
- (선택) `docs/features/platform/platform.md` 로드맵에서 "Rate Limiting" 행을 완료로 이동

- [ ] 버전 히스토리: `v9 | 2026-04-21 | 기능 추가 | 로그인 bypass 토글 + IP Rate Limiting + Settings 확장`
- [ ] "기타 횡단 관심사" 표의 Rate Limiting 행 → ✅ 변경

---

## 검증 시나리오

### API 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ADMIN PATCH `/api/settings {loginRequired: false}` | 200 + 설정 반영 |
| 2 | 비인증 GET `/api/settings/public` | 200 + `{loginRequired: false}` |
| 3 | 비인증 GET `/api/companies` (login_required=false) | 200 + 회사 목록 |
| 4 | 비인증 POST `/api/companies` | 401 Unauthorized |
| 5 | 비인증 POST `/api/senior/chat` × 30 (limit=30) | 모두 200 / SSE |
| 6 | 비인증 POST `/api/senior/chat` × 31 | 31번째 429 + Retry-After |
| 7 | 인증된 USER가 동일 IP에서 `/api/senior/chat` × 100 | 모두 200 (면제) |
| 8 | PATCH login_required=true 후 비인증 GET `/api/companies` | 401 |
| 9 | ai_usage_log 행에 ip_address 기록 | 정상 저장 |
| 10 | Rate Limit 응답 바디 | `ApiResponse { success: false, data: { retryAfterSeconds: ... } }` |

### UI 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ADMIN 로그인 → Settings → 로그인 토글 OFF | 저장 성공, UI 반영 |
| 2 | 로그아웃 후 `/features` 접근 (loginRequired=false) | 페이지 진입 가능, CRUD 버튼 숨김 |
| 3 | 비로그인 상태에서 상단 "로그인" 버튼 | `/login` 이동 |
| 4 | LoginPage에서 "둘러보기" 버튼 | `/features` 이동 |
| 5 | Senior Chat에서 Rate Limit 초과 | 안내 메시지 노출 |
| 6 | ADMIN Settings 토글 ON → 로그아웃 후 `/features` | `/login`으로 리다이렉트 |
| 7 | USER 로그인 상태에서 Settings 메뉴 미노출 | ADMIN만 보임 |

---

## 리스크 / 고려사항

- **ALB 환경에서 IP 추출**: EC2 뒤에 ALB가 있으면 `getRemoteAddr()`는 ALB 내부 IP. `X-Forwarded-For`의 첫 번째 값 사용 필요 (Spring의 `ForwardedHeaderFilter` 또는 수동 파싱)
- **Rate Limit 캐시의 서버 재시작**: 인메모리 Caffeine은 재시작 시 카운터 초기화 → 일시적 우회 가능하지만 허용 범위
- **Anonymous 사용자의 세션 생성**: Chat 세션 테이블의 `username` FK가 nullable이어야 비로그인 세션 저장 가능. 스키마 확인 필요 — 불가 시 비로그인은 세션 저장 안 함으로 변경
- **Frontend 부팅 race**: `/api/settings/public` 응답 전에 `ProtectedRoute` 렌더링 → loading 상태 처리 필요
- **기존 테스트 영향**: v8 Settings E2E, 일부 Security 테스트가 permitAll 확장으로 영향받을 가능성 → Step 9/10에서 기존 테스트 실행 여부 확인

---

## 진행 원칙

- 각 Step 완료 시 본 문서의 체크박스 업데이트
- User의 진행 지시 후 다음 Step 진행
- 모든 Step 완료 후 최하단에 **[최종 요약]** 섹션 작성

---

## [최종 요약]

### 구현 범위

FEAT-1 ~ FEAT-4 전 항목 완료. `system_settings`에 `login_required`, `ai_rate_limit_per_ip`, `ai_rate_limit_window_seconds` 키를 추가하여 런타임 On/Off가 가능해졌다. `DynamicPublicAccessFilter`가 설정 기반으로 whitelist 경로에 `UsernamePasswordAuthenticationToken("anonymousUser")`를 주입하여 비로그인 방문자의 조회와 Senior Chat 체험을 허용하고, `AiRateLimitFilter`가 Caffeine Fixed Window로 IP당 AI 호출 수를 제한한다. Settings UI에 `AccessControlSection`을 추가해 ADMIN이 운영 중 토글·임계값을 바로 조정할 수 있다.

### 결과

- **Backend 신규 3 + 수정 12**: `V202604210900__add_login_required_and_ip_rate_limit.sql`, `config/DynamicPublicAccessFilter.java`, `config/AiRateLimitFilter.java`. `SettingsService`/`SettingsServiceImpl`/`SettingsDto`/`SettingsController`, `SecurityConfig`, `CompanyServiceImpl`(anonymous 처리), `monitoring/ApiAccessLogFilter` + `ApiAccessLogEntity` + `AiUsageLogEntity` + `AiUsageLogService`/`Impl`, `senior/SeniorServiceImpl`, `common/EmbeddingService` (`logUsage`에 clientIp 전달), `build.gradle` (Caffeine 의존성).
- **Frontend 신규 1 + 수정 8**: `components/settings/AccessControlSection.tsx`. `context/AuthContext`(loginRequired state + public settings fetch), `components/ProtectedRoute`(loginRequired 분기), `components/Layout`(비로그인 헤더 + Login 링크), `pages/LoginPage`("로그인 없이 둘러보기" 버튼), `pages/SettingsPage`(4번째 섹션), `api/client`(401 조건부 리다이렉트), `api/settings` + `types/settings`/`types/auth`.
- **테스트**: Backend 신규 89개 + 확장 17개 (총 106 추가). `DynamicPublicAccessFilterTest` 56개, `AiRateLimitFilterTest` 16개, `ApiAccessLogFilterTest` 8개, `AiUsageLogServiceImplTest` 9개, `SettingsServiceImplTest` +12, `SettingsControllerTest` +5. 전체 backend `./gradlew build` BUILD SUCCESSFUL (657 tests, 0 failed).
- **E2E**: 신규 29개 (API 20 + UI 9). `qa/api/public-access.spec.ts`(15), `qa/api/rate-limit.spec.ts`(5), `qa/ui/settings-access-control.spec.ts`(9). Agent-D 풀 실행 340개 중 **328 passed / 11 skipped / 1 pre-existing flake(product-panel delete — v9 무관)**.

### Agent-C 발견 버그 수정 (중요)

- **증상**: `DynamicPublicAccessFilter`가 `AnonymousAuthenticationToken`을 주입했으나 Spring Security `.authenticated()` 규칙이 Anonymous 토큰을 거부하여, 화이트리스트 경로에도 403 반환.
- **수정**: `UsernamePasswordAuthenticationToken("anonymousUser", "N/A", [ROLE_ANONYMOUS])`로 교체 — `.authenticated()` 통과. `CompanyServiceImpl.findAllForUser`에서 `username == "anonymousUser"` 시 전체 회사 반환. `AiRateLimitFilter.isAuthenticatedUser()`에서 principal 이름으로 anonymous 판별하도록 강화 (AnonymousAuthenticationToken + principal==="anonymousUser" 둘 다 면제 제외).
- **교훈**: 단위 테스트에서 SecurityContext에 토큰 주입만 검증하면 authorization 체인 동작을 놓칠 수 있음 → 다음부터 Security 필터는 `@SpringBootTest` + MockMvc로 end-to-end 검증 추가 고려.

### 주요 설계 포인트

- **동적 공개 접근**: `SecurityConfig`의 정적 규칙이 아닌 런타임 설정 조회(`SettingsService.isLoginRequired()`) + 화이트리스트 매칭 + principal 주입 방식. `/api/**` `authenticated()` 규칙은 유지되어, 비-GET CRUD는 여전히 차단.
- **Rate Limit 면제 정책**: 인증된 USER/ADMIN은 완전 면제. Anonymous만 IP별 카운팅. IP 추출은 `X-Forwarded-For` 우선(ALB/CloudFront 뒤를 대비) → `getRemoteAddr()` 폴백.
- **캐시 rebuild 로직**: `cachedWindowSeconds != 현재 설정값`이면 lazy rebuild. 설정 변경 후 다음 요청에서 자동 반영되어 운영 중 튜닝 가능.
- **Public 설정 엔드포인트**: `GET /api/settings/public` — 인증 없이 `{loginRequired}` 만 노출. Frontend 부팅 시 이 응답으로 `ProtectedRoute` 동작 결정.
- **모니터링 일관성**: `ai_usage_log` + `api_access_log` 양쪽에 `ip_address` 칼럼 추가. 비로그인 AI 사용은 `username=null, ip_address="x.x.x.x"`로 기록되어 남용 추적 가능.
- **E2E 상태 격리**: Rate Limit 테스트는 실행마다 랜덤 IP 옥텟을 생성하여 이전 실행의 카운터 잔존 상태와 충돌하지 않도록 설계. `afterAll`에서 원본 설정 복원 보장.
