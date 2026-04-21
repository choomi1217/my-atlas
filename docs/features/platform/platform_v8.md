# Platform — Settings 페이지 + 접근 제어 + AI 보안 (v8)

> 변경 유형: 기능 추가  
> 작성일: 2026-04-20  
> 버전: v8  
> 상태: 완료

---

## 요구사항

### [FEAT-1] Settings 페이지 + User 등록 + Company 접근 제어
- 배달의민족, Toss, Luxrobo 등 외부 회사 관계자가 Resume을 보기 위해 로그인 필요
- ADMIN이 Settings 페이지에서 사용자 계정 등록 (username/password + Company 할당)
- USER: 모든 기능 사용 가능 (CRUD), 단 설정에서 할당된 Company만 표시
- ADMIN: 모든 Company 표시, 사용자 관리 가능

### [FEAT-2] AI 토큰 On/Off 토글
- Settings 페이지에서 AI 기능 (Senior Chat, KB 임베딩) 전체 On/Off
- Off 시 AI 관련 API 호출 차단 (503 응답)

### [FEAT-3] Session Timeout 설정
- 기본값 1h, Settings 페이지에서 1h / 30m / 10m / 10s(테스트용) 선택
- 설정한 시간 후 자동 로그아웃

### [FEAT-4] AI 토큰 사용 Slack 알림
- AI 토큰 사용 시 Slack webhook으로 알림
- 포함 정보: 사용자명, 토큰 사용량, 사용 시점

### 현재 조금 특수한 케이스로 몇개의 회사에 지원서를 넣어야 하는데
내 프로젝트에 접근시, 어느 회사이십니까? 라고 여쭙고 셀렉트 박스나 뭔가 선택지를 통해 회사를 선택할 수 있게 해줘야 할 거 같아.
우선 그렇게 해서 접속시 해당 company name을 조회해서 거기로 이동시켜주자
ex) 우아한 선택 -> WooWaHan Company 로 이동 ->  https://youngmi.works/features/companies/2142 

---

## 현재 코드 분석 (Context)

### SecurityConfig (권한 체계)

```java
// 현재 — USER는 GET(읽기)만 허용
GET /api/**                    → authenticated (ADMIN + USER)
POST/PUT/PATCH/DELETE /api/**  → hasRole("ADMIN")
```

USER 역할은 현재 **읽기 전용**. 외부 방문자가 기능을 사용해보려면 CRUD 권한이 필요하다.

### Company API (필터링 없음)

```java
// CompanyServiceImpl.findAll() — 전체 조회, 사용자별 필터링 없음
companyRepository.findAll()
```

### JwtProvider (고정 만료)

```java
// 현재 — 24시간 고정, 런타임 변경 불가
@Value("${jwt.expiration-ms:86400000}")
private long expirationMs;
```

### AI 서비스 (토글/추적 없음)

```java
// SeniorServiceImpl — 토글 체크 없음, 사용량 추적 없음
chatClient.prompt().system(systemPrompt).user(userMessage).stream().content()

// EmbeddingService — 토글 체크 없음
embeddingModel.get().embedForResponse(List.of(text))
```

- `FEATURE_EMBEDDING_ENABLED` 환경변수로 임베딩 Bean 존재 여부만 제어 (런타임 토글 아님)

### Slack 연동 (애플리케이션 미사용)

- `SLACK_WEBHOOK_URL`은 GitHub Secrets에만 존재 (CI/CD 전용)
- `application.yml`에 Slack 설정 없음, 백엔드 코드에 Slack 관련 로직 없음

### Frontend AuthContext (타임아웃 없음)

```typescript
// 현재 — localStorage 기반, 만료 타이머 없음
localStorage.setItem('my-atlas-token', response.token)
// JWT 만료 시 서버 401 → Axios 인터셉터가 로그아웃 처리 (사후 대응)
```

---

## 설계

### FEAT-1: User 등록 + Company 접근 제어

**DB 스키마 (신규):**

```sql
CREATE TABLE user_company_access (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    company_id  BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);
```

**SecurityConfig 변경:**

```
/api/auth/login              → permitAll
/api/auth/register           → hasRole("ADMIN")
/api/settings/**             → hasRole("ADMIN")    ← 신규
/actuator/**                 → permitAll
GET /api/**/images/**        → permitAll
기타 모든 /api/**            → authenticated        ← USER도 CRUD 가능
```

**Company 필터링 로직:**

```java
// CompanyServiceImpl.findAll(String username) — 변경
if (currentUser.role == ADMIN) → companyRepository.findAll()
else → user_company_access에 매핑된 Company만 반환
```

**Settings User 관리 API:**

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/settings/users` | 사용자 목록 (회사 매핑 포함) |
| POST | `/api/settings/users` | 사용자 등록 + 회사 할당 |
| PUT | `/api/settings/users/{id}/companies` | 회사 할당 변경 |
| DELETE | `/api/settings/users/{id}` | 사용자 삭제 (CASCADE) |

### FEAT-2: AI 토큰 On/Off

**DB 스키마 (신규):**

```sql
CREATE TABLE system_settings (
    id            BIGSERIAL    PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(500) NOT NULL,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value) VALUES
('ai_enabled', 'true'),
('session_timeout_seconds', '3600');
```

**Backend 가드:** SeniorServiceImpl.chat() 진입 시 `ai_enabled` 확인 → false면 503 응답. EmbeddingService 동일.

**Settings API:**

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/settings` | 전체 설정 조회 |
| PATCH | `/api/settings` | 설정 변경 (ai_enabled, session_timeout_seconds) |

### FEAT-3: Session Timeout

**Backend:**
- JwtProvider.generateToken() 시 `system_settings.session_timeout_seconds` 값 사용
- 로그인 응답(`AuthResponse`)에 `sessionTimeoutSeconds` 필드 추가

**Frontend:**
- AuthContext에 setTimeout 로직: 로그인 시 타이머 시작 → 만료 시 자동 logout
- 설정 변경 시 재로그인 필요 (새 JWT 발급 시 적용)

**선택지:** 1h (3600) / 30m (1800) / 10m (600) / 10s (10, 테스트용)

### FEAT-4: Slack AI 알림

**Backend:**

```
common/SlackNotificationService.java
  → RestTemplate POST to ${slack.webhook.url}
  → @Async — AI 응답 지연 방지
```

**호출 시점:**
- SeniorServiceImpl: SSE 스트림 onComplete 시 (전체 응답 완료 후)
- EmbeddingService: embed() 완료 시

**토큰 추정:** 프롬프트 + 응답 문자열 길이 기반 (chars / 4 ≈ tokens)

**Slack 메시지:**

```
AI Token Usage — my-atlas
User: woowa
Endpoint: Senior Chat
Estimated Tokens: ~1,200
Time: 2026-04-20 14:30:00
```

**application.yml 추가:** `slack.webhook.url: ${SLACK_WEBHOOK_URL:}`

### Settings 페이지 UI

```
/settings (ADMIN 전용)

┌─────────────────────────────────────┐
│  Settings                           │
├─────────────────────────────────────┤
│                                     │
│  User Management                    │
│  ┌─────────────────────────────────┐│
│  │ [+ Register User]              ││
│  │ Username | Companies | Actions  ││
│  │ admin   | 전체       | -       ││
│  │ woowa   | 배달의민족  | Edit/Del││
│  └─────────────────────────────────┘│
│                                     │
│  AI Settings                        │
│  ┌─────────────────────────────────┐│
│  │ AI 기능 활성화    [ON] / [OFF]  ││
│  └─────────────────────────────────┘│
│                                     │
│  Session Settings                   │
│  ┌─────────────────────────────────┐│
│  │ Session Timeout   [ 1h  ▼ ]    ││
│  │ (1h / 30m / 10m / 10s)         ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | Flyway 마이그레이션 (system_settings + user_company_access) | `V202604201100__create_settings_tables.sql` |
| 2 | Backend Settings 도메인 (Entity, Repository, DTO) | `settings/*.java` |
| 3 | Backend SettingsService + SettingsController | `settings/SettingsServiceImpl.java`, `SettingsController.java` |
| 4 | Backend SecurityConfig 수정 + Company 필터링 | `SecurityConfig.java`, `CompanyServiceImpl.java` |
| 5 | Backend JWT 타임아웃 설정 연동 + AuthResponse 확장 | `JwtProvider.java`, `AuthDto.java` |
| 6 | Backend AI 토글 가드 + SlackNotificationService | `SeniorServiceImpl.java`, `SlackNotificationService.java` |
| 7 | Frontend Settings 페이지 (User + AI + Session 3개 섹션) | `pages/SettingsPage.tsx`, `api/settings.ts` |
| 8 | Frontend 세션 타임아웃 + 라우팅 통합 | `AuthContext.tsx`, `App.tsx`, `Layout.tsx` |

---

### Step 1 — Flyway 마이그레이션 ✅

**신규 파일:** `backend/src/main/resources/db/migration/V202604201100__create_settings_tables.sql`

- [x] `system_settings` 테이블 생성 (setting_key UNIQUE, setting_value, updated_at)
- [x] 초기 데이터 시드: `ai_enabled=true`, `session_timeout_seconds=3600`
- [x] `user_company_access` 테이블 생성 (user_id FK → app_user, company_id FK → company, UNIQUE 제약)

---

### Step 2 — Backend Settings 도메인 ✅

**신규 파일:**
- `backend/src/main/java/com/myqaweb/settings/SystemSettingsEntity.java`
- `backend/src/main/java/com/myqaweb/settings/SystemSettingsRepository.java`
- `backend/src/main/java/com/myqaweb/settings/UserCompanyAccessEntity.java`
- `backend/src/main/java/com/myqaweb/settings/UserCompanyAccessRepository.java`
- `backend/src/main/java/com/myqaweb/settings/SettingsDto.java`

- [x] `SystemSettingsEntity` — JPA Entity (id, settingKey, settingValue, updatedAt)
- [x] `SystemSettingsRepository` — `findBySettingKey(String key)`
- [x] `UserCompanyAccessEntity` — JPA Entity (id, userId, companyId, createdAt)
- [x] `UserCompanyAccessRepository` — `findByUserId(Long)`, `deleteByUserId(Long)`, `findCompanyIdsByUserId(Long)`
- [x] `SettingsDto` — SystemSettingsResponse, UserWithCompaniesResponse, RegisterUserRequest, UpdateSettingsRequest

---

### Step 3 — SettingsService + SettingsController ✅

**신규 파일:**
- `backend/src/main/java/com/myqaweb/settings/SettingsService.java`
- `backend/src/main/java/com/myqaweb/settings/SettingsServiceImpl.java`
- `backend/src/main/java/com/myqaweb/settings/SettingsController.java`

- [x] `SettingsService` 인터페이스: getSettings(), updateSettings(), getUsers(), registerUser(), updateUserCompanies(), deleteUser()
- [x] `SettingsServiceImpl` 구현
  - getSettings() → ai_enabled, session_timeout_seconds 조회
  - updateSettings() → key-value 업데이트 + updatedAt 갱신
  - getUsers() → 전체 사용자 + 할당된 Company 목록
  - registerUser() → 사용자 생성 (BCrypt) + 회사 할당 (단일 트랜잭션)
  - updateUserCompanies() → 기존 매핑 삭제 후 재생성
  - deleteUser() → 사용자 삭제 (user_company_access CASCADE)
- [x] `SettingsController` — ADMIN 전용, 6개 엔드포인트

---

### Step 4 — SecurityConfig + Company 필터링 ✅

**수정 파일:**
- `backend/src/main/java/com/myqaweb/config/SecurityConfig.java`
- `backend/src/main/java/com/myqaweb/feature/CompanyServiceImpl.java`
- `backend/src/main/java/com/myqaweb/feature/CompanyController.java`

- [x] SecurityConfig: USER 역할에 POST/PUT/PATCH/DELETE 허용 (도메인 API)
- [x] SecurityConfig: `/api/settings/**` → hasRole("ADMIN") 추가
- [x] CompanyController.getCompanies() → SecurityContextHolder에서 username 추출하여 서비스 전달
- [x] CompanyServiceImpl.findAllForUser(String username) → ADMIN: 전체 / USER: user_company_access 기반 필터링

---

### Step 5 — JWT 타임아웃 설정 연동 ✅

**수정 파일:**
- `backend/src/main/java/com/myqaweb/auth/JwtProvider.java`
- `backend/src/main/java/com/myqaweb/auth/AuthDto.java`
- `backend/src/main/java/com/myqaweb/auth/AuthServiceImpl.java`

- [x] JwtProvider: generateToken() 시 SettingsService에서 `session_timeout_seconds` 조회하여 만료 시간 설정
- [x] AuthDto.AuthResponse: `sessionTimeoutSeconds` (long) 필드 추가
- [x] AuthServiceImpl: login()/register() 응답에 현재 session_timeout_seconds 값 포함

---

### Step 6 — AI 토글 가드 + Slack 알림 ✅

**신규 파일:**
- `backend/src/main/java/com/myqaweb/common/SlackNotificationService.java`

**수정 파일:**
- `backend/src/main/java/com/myqaweb/senior/SeniorServiceImpl.java`
- `backend/src/main/java/com/myqaweb/common/EmbeddingService.java`
- `backend/src/main/resources/application.yml`

- [x] `application.yml` — `slack.webhook.url: ${SLACK_WEBHOOK_URL:}` 추가
- [x] `SlackNotificationService` — RestTemplate + @Async, Slack webhook POST (사용자명, 엔드포인트, 추정 토큰, 시간)
- [x] SeniorServiceImpl.chat() — 진입 시 `ai_enabled` 체크 (false → ResponseStatusException 503), 스트림 완료 시 Slack 알림
- [x] EmbeddingService.embed() — `ai_enabled` 체크 (false → ResponseStatusException 503), 완료 시 Slack 알림
- [x] SecurityContext에서 현재 사용자 username 추출하여 Slack 메시지에 포함

---

### Step 7 — Frontend Settings 페이지 ✅

**신규 파일:**
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/settings/UserManagementSection.tsx`
- `frontend/src/components/settings/AiSettingsSection.tsx`
- `frontend/src/components/settings/SessionSettingsSection.tsx`
- `frontend/src/api/settings.ts`
- `frontend/src/types/settings.ts`

- [x] `types/settings.ts` — SystemSettings, UserWithCompanies, RegisterUserRequest 타입 정의
- [x] `api/settings.ts` — getSettings, updateSettings, getUsers, registerUser, updateUserCompanies, deleteUser
- [x] `UserManagementSection` — 사용자 목록 테이블, 등록 폼 (username + password + Company 다중 선택), 회사 할당 편집, 삭제
- [x] `AiSettingsSection` — AI On/Off 토글 스위치 + 현재 상태 표시
- [x] `SessionSettingsSection` — 타임아웃 셀렉트 드롭다운 (1h/30m/10m/10s) + 현재 값 표시
- [x] `SettingsPage` — 3개 섹션 조합, 상단 제목

---

### Step 8 — Frontend 세션 타임아웃 + 라우팅 통합 ✅

**수정 파일:**
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/types/auth.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`

- [x] `types/auth.ts` — LoginResponse에 `sessionTimeoutSeconds` 필드 추가
- [x] `AuthContext` — 로그인 시 sessionTimeoutSeconds 기반 setTimeout 등록, 만료 시 자동 logout + /login 이동
- [x] `App.tsx` — `/settings` 라우트 추가 (ProtectedRoute 내)
- [x] `Layout.tsx` — ADMIN 역할일 때만 Settings 내비게이션 항목 표시

---

## 변경 파일 목록

### Backend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `db/migration/V202604201100__create_settings_tables.sql` | 신규 | system_settings + user_company_access 테이블 |
| `settings/SystemSettingsEntity.java` | 신규 | 시스템 설정 JPA Entity |
| `settings/SystemSettingsRepository.java` | 신규 | JpaRepository |
| `settings/UserCompanyAccessEntity.java` | 신규 | 사용자-회사 매핑 Entity |
| `settings/UserCompanyAccessRepository.java` | 신규 | JpaRepository |
| `settings/SettingsDto.java` | 신규 | 요청/응답 DTO |
| `settings/SettingsService.java` | 신규 | 서비스 인터페이스 |
| `settings/SettingsServiceImpl.java` | 신규 | 서비스 구현 |
| `settings/SettingsController.java` | 신규 | REST 컨트롤러 (ADMIN 전용) |
| `common/SlackNotificationService.java` | 신규 | Slack webhook 비동기 전송 |

### Backend (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `config/SecurityConfig.java` | 수정 | USER CRUD 허용, /api/settings ADMIN 전용 |
| `feature/CompanyServiceImpl.java` | 수정 | 사용자별 Company 필터링 |
| `feature/CompanyController.java` | 수정 | SecurityContext username 전달 |
| `auth/JwtProvider.java` | 수정 | system_settings 기반 만료 시간 |
| `auth/AuthDto.java` | 수정 | AuthResponse에 sessionTimeoutSeconds 추가 |
| `auth/AuthServiceImpl.java` | 수정 | 응답에 sessionTimeoutSeconds 포함 |
| `senior/SeniorServiceImpl.java` | 수정 | AI 토글 체크 + Slack 알림 |
| `common/EmbeddingService.java` | 수정 | AI 토글 체크 + Slack 알림 |
| `application.yml` | 수정 | slack.webhook.url 추가 |

### Frontend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `pages/SettingsPage.tsx` | 신규 | Settings 메인 페이지 |
| `components/settings/UserManagementSection.tsx` | 신규 | 사용자 관리 섹션 |
| `components/settings/AiSettingsSection.tsx` | 신규 | AI 토글 섹션 |
| `components/settings/SessionSettingsSection.tsx` | 신규 | 세션 타임아웃 섹션 |
| `api/settings.ts` | 신규 | Settings API 모듈 |
| `types/settings.ts` | 신규 | Settings 타입 정의 |

### Frontend (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `context/AuthContext.tsx` | 수정 | 세션 타임아웃 타이머 추가 |
| `types/auth.ts` | 수정 | LoginResponse에 sessionTimeoutSeconds |
| `App.tsx` | 수정 | /settings 라우트 추가 |
| `components/Layout.tsx` | 수정 | Settings 내비게이션 (ADMIN 전용) |

---

## 검증 시나리오

### API 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ADMIN: GET /api/settings | 200 + {aiEnabled, sessionTimeoutSeconds} |
| 2 | USER: GET /api/settings | 403 Forbidden |
| 3 | ADMIN: POST /api/settings/users (woowa, companyIds=[1]) | 201 Created |
| 4 | ADMIN: GET /api/settings/users | 200 + 사용자 목록 (회사 매핑 포함) |
| 5 | ADMIN: PUT /api/settings/users/{id}/companies | 200 + 회사 매핑 업데이트 |
| 6 | ADMIN: DELETE /api/settings/users/{id} | 200 + 삭제 완료 |
| 7 | woowa 로그인 → GET /api/companies | 매핑된 Company만 반환 |
| 8 | admin 로그인 → GET /api/companies | 전체 Company 반환 |
| 9 | ADMIN: PATCH /api/settings {aiEnabled: false} | AI 비활성화 |
| 10 | AI 비활성 → POST /api/senior/chat | 503 Service Unavailable |
| 11 | AI 활성 → POST /api/senior/chat | 200 + SSE + Slack 알림 전송 |
| 12 | session_timeout=10s → 로그인 → 10초 후 API 호출 | 401 Unauthorized |

### UI 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | ADMIN 로그인 → GNB | Settings 메뉴 표시 |
| 2 | USER 로그인 → GNB | Settings 메뉴 미표시 |
| 3 | Settings → User Management | 사용자 목록 + 등록 버튼 |
| 4 | 사용자 등록 (username + password + 회사 선택) | 목록에 추가됨 |
| 5 | AI 토글 OFF → Senior Chat 시도 | 에러 메시지 표시 |
| 6 | Session Timeout 10s → 재로그인 → 10초 대기 | 자동 로그아웃 |
| 7 | woowa 로그인 → Product Test Suite | 할당된 Company만 표시 |

---

## [최종 요약]

### 구현 범위

FEAT-1 ~ FEAT-4 전 항목 완료. Settings 페이지(ADMIN 전용)에서 사용자 관리, AI 토글, 세션 타임아웃을 한 곳에서 제어하도록 통합. Company는 ADMIN은 전체, USER는 `user_company_access` 매핑만 표시되도록 필터링. AI 호출 시 Slack webhook으로 사용자/엔드포인트/추정 토큰을 비동기 전송.

### 결과

- **Backend 신규 10 + 수정 9**: `settings/` 도메인 일체(Entity/Repository/DTO/Service/Controller), `SlackNotificationService`, Flyway `V202604201100__create_settings_tables.sql`(Words Convention의 `V202604200900`과 충돌 회피), `SecurityConfig`/`CompanyServiceImpl`/`JwtProvider`/`AuthDto`/`AuthServiceImpl`/`SeniorServiceImpl`/`EmbeddingService`/`application.yml` 수정
- **Frontend 신규 6 + 수정 4**: `SettingsPage` + 3개 섹션(User/AI/Session), `api/settings.ts`, `types/settings.ts`, `AuthContext` 세션 타이머, `App.tsx` 라우트, `Layout.tsx` ADMIN 전용 메뉴 노출
- **테스트 신규 20+ (Backend) + API 10 + UI 6 (E2E)**: `SettingsServiceImplTest`, `SettingsControllerTest`, `qa/api/settings.spec.ts`, `qa/ui/settings.spec.ts`
- **Agent-D 검증**: `./gradlew build` BUILD SUCCESSFUL, Playwright E2E 262 passed (Settings 신규 16/16 통과)
- **커밋 전 재검증**: `./gradlew test` BUILD SUCCESSFUL, `npm run lint` 0 warnings

### 주요 설계 포인트

- **권한 체계 재편**: USER도 CRUD 가능(`GET/POST/PUT/PATCH/DELETE /api/**` authenticated). 단, `/api/settings/**`는 ADMIN 전용. Company 필터링은 application layer(`CompanyServiceImpl.findAllForUser`)에서 수행.
- **AI 토글은 runtime**: `FEATURE_EMBEDDING_ENABLED`(Bean 존재 토글) 대신 `system_settings.ai_enabled`로 런타임 체크. 비활성 시 `ResponseStatusException` 503.
- **세션 타임아웃은 로그인 시 반영**: JWT 발급 시점의 `session_timeout_seconds` 값 사용. `AuthResponse.sessionTimeoutSeconds`로 프론트에 전달 → `AuthContext`에서 `setTimeout` 기반 자동 로그아웃.
- **Slack 알림은 @Async**: AI 응답 지연 방지. 토큰 추정은 `chars / 4` 근사치.
- **마이그레이션 버전**: `V202604201100` 선택 이유 — `feature/words-convention`이 같은 날 `V202604201000 → V202604200900`으로 내려오는 충돌을 겪어서, platform은 이후 타임스탬프로 확보.
