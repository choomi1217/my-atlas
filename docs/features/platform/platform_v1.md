# Platform — 로그인 / 인증 / 권한 관리 (v1)

> 변경 유형: 기능 추가  
> 작성일: 2026-04-10  
> 버전: v1  
> 상태: 완료

---

## 요구사항

현재 프로젝트에는 AI Credit을 사용하는 my-senior, knowledge-base가 있다.
AI Credit에는 현금이 드는 만큼 외부의 보안이 신경쓰인다.

### [AUTH-1] 로그인 / 로그아웃

- 사용자는 로그인 페이지에서 username/password로 인증한다.
- 인증 성공 시 JWT 토큰을 발급하고, 이후 모든 API 요청에 토큰을 포함한다.
- 로그아웃 시 클라이언트 토큰을 제거한다.

### [AUTH-2] admin 계정 시드

- admin 계정은 Flyway 마이그레이션으로 DB에 직접 삽입한다.
- 비밀번호는 BCrypt 해시 값으로 저장한다.

### [AUTH-3] 계정 생성 권한

- admin만이 새로운 계정을 만들 수 있다.
- 일반 사용자(user)는 계정 생성 불가.

### [AUTH-4] Role 기반 권한

| Role | 권한 |
|------|------|
| `ADMIN` | 모든 기능 (CRUD + 계정 관리) |
| `USER` | 읽기 전용 (GET 요청만 허용) |

---

## 현재 코드 분석 (Context)

### Backend

| 항목 | 현황 | 파일 |
|------|------|------|
| Spring Security | ❌ 미도입 | `build.gradle`에 의존성 없음 |
| 인증 필터 | ❌ 없음 | |
| 사용자 테이블 | ❌ 없음 | Flyway V1~V13까지 user 테이블 없음 |
| CORS | ✅ 설정 완료 | `config/WebConfig.java` |
| GlobalExceptionHandler | ✅ 동작 | `common/GlobalExceptionHandler.java` — 401/403 처리 없음 |
| ApiResponse 래퍼 | ✅ 표준화 | `common/ApiResponse.java` |

### Frontend

| 항목 | 현황 | 파일 |
|------|------|------|
| 로그인 페이지 | ❌ 없음 | |
| Protected Routes | ❌ 없음 | `App.tsx` — 모든 라우트 공개 |
| Axios 인터셉터 | ⚠️ placeholder | `api/client.ts` — 토큰 주입 없음 |
| Auth Context/Store | ❌ 없음 | |
| Layout | ✅ 동작 | `components/Layout.tsx` — 로그아웃 UI 없음 |

### 주요 의존성 현황

- **Backend**: Spring Boot 3.3.1, Java 21, Gradle
- **Frontend**: React 18, TypeScript, Vite 5, axios, react-router-dom v6
- **DB**: PostgreSQL 15 + pgvector, Flyway (현재 V13까지)
- **Test DB**: H2 인메모리 (unit), Flyway 비활성

---

## 설계

### 1. 인증 방식: JWT (Stateless)

```
[로그인 요청]
  POST /api/auth/login { username, password }
       │
       ▼
[서버] BCrypt 비밀번호 검증 → JWT 생성 (sub=username, role=ADMIN|USER)
       │
       ▼
[응답] { token: "eyJ...", username, role }
       │
       ▼
[클라이언트] localStorage에 토큰 저장 → 이후 모든 요청 Header에 포함
  Authorization: Bearer eyJ...
       │
       ▼
[서버] JwtAuthenticationFilter → 토큰 검증 → SecurityContext 설정
```

### 2. DB 스키마

```sql
-- V14__create_app_user.sql
CREATE TABLE app_user (
    id          BIGSERIAL    PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(200) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- admin 시드 (BCrypt hash)
INSERT INTO app_user (username, password, role)
VALUES ('admin', '$2a$10$...hashed...', 'ADMIN');
```

- 테이블명: `app_user` (PostgreSQL 예약어 `user` 회피)
- role: `ADMIN`, `USER` (String, 추후 확장 고려)

### 3. Backend 패키지 구조 (신규)

```
com.myqaweb.auth/
├── AuthController.java         # POST /api/auth/login, POST /api/auth/register
├── AuthService.java            # 인증 로직 인터페이스
├── AuthServiceImpl.java        # 로그인 검증, 계정 생성
├── AppUserEntity.java          # JPA Entity (app_user)
├── AppUserRepository.java      # JpaRepository
├── AuthDto.java                # LoginRequest, RegisterRequest, AuthResponse
├── Role.java                   # enum (ADMIN, USER)
├── JwtProvider.java            # JWT 생성 / 검증 유틸
└── JwtAuthenticationFilter.java # OncePerRequestFilter
```

### 4. Spring Security 설정

```
SecurityFilterChain:
  /api/auth/login    → permitAll (인증 불필요)
  /api/auth/register → ADMIN only
  GET /api/**        → ADMIN, USER 모두 허용
  POST/PUT/DELETE /api/** → ADMIN only
  기타               → authenticated
```

### 5. Frontend 구조 (신규)

```
frontend/src/
├── pages/LoginPage.tsx          # 로그인 폼
├── api/auth.ts                  # login(), register() API
├── types/auth.ts                # AuthUser, LoginRequest, LoginResponse
├── context/AuthContext.tsx       # 인증 상태 (token, user, role)
├── components/ProtectedRoute.tsx # 미인증 시 /login 리다이렉트
```

### 6. 인증 흐름 (Frontend)

```
[앱 시작]
  AuthContext 초기화 → localStorage에서 토큰 확인
       │
  ┌────┴────┐
  │ 토큰 없음 │──→ /login 리다이렉트
  └─────────┘
  │ 토큰 있음 │──→ Axios 인터셉터에 Bearer 설정 → 정상 라우팅
  └─────────┘

[로그인 성공]
  token + user 정보 → AuthContext 저장 + localStorage 저장
  → / 로 리다이렉트

[401 응답 수신 (토큰 만료)]
  Axios 응답 인터셉터 → AuthContext 초기화 → /login 리다이렉트
```

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | Flyway 마이그레이션: `app_user` 테이블 + admin 시드 | `V14__create_app_user.sql` |
| 2 | Backend: Entity, Repository, DTO, Role enum | `auth/` 패키지 신규 |
| 3 | Backend: JWT 유틸 (생성/검증) | `auth/JwtProvider.java` |
| 4 | Backend: Spring Security 설정 + JWT 필터 | `config/SecurityConfig.java`, `auth/JwtAuthenticationFilter.java` |
| 5 | Backend: AuthController + AuthService (login, register) | `auth/AuthController.java`, `auth/AuthServiceImpl.java` |
| 6 | Backend: GlobalExceptionHandler에 401/403 추가 | `common/GlobalExceptionHandler.java` |
| 7 | Frontend: 타입 + API 클라이언트 | `types/auth.ts`, `api/auth.ts` |
| 8 | Frontend: AuthContext + ProtectedRoute | `context/AuthContext.tsx`, `components/ProtectedRoute.tsx` |
| 9 | Frontend: LoginPage UI | `pages/LoginPage.tsx` |
| 10 | Frontend: Axios 인터셉터 (토큰 주입 + 401 처리) | `api/client.ts` |
| 11 | Frontend: Layout에 사용자 정보 + 로그아웃 버튼 | `components/Layout.tsx` |
| 12 | Frontend: App.tsx 라우팅 통합 | `App.tsx`, `main.tsx` |

---

### Step 1 — Flyway 마이그레이션

**변경 파일:** `backend/src/main/resources/db/migration/V14__create_app_user.sql`

- [x] `app_user` 테이블 생성 (id, username, password, role, created_at)
- [x] admin 계정 시드 (BCrypt 해시 비밀번호)

---

### Step 2 — Entity, Repository, DTO, Enum

**변경 파일:**
- `backend/src/main/java/com/myqaweb/auth/Role.java`
- `backend/src/main/java/com/myqaweb/auth/AppUserEntity.java`
- `backend/src/main/java/com/myqaweb/auth/AppUserRepository.java`
- `backend/src/main/java/com/myqaweb/auth/AuthDto.java`

- [x] `Role` enum 생성 (ADMIN, USER)
- [x] `AppUserEntity` — JPA Entity (table: app_user)
- [x] `AppUserRepository` — `findByUsername(String username)`
- [x] `AuthDto` — `LoginRequest`, `RegisterRequest`, `AuthResponse` record

---

### Step 3 — JWT 유틸

**변경 파일:** `backend/src/main/java/com/myqaweb/auth/JwtProvider.java`

- [x] JWT 생성 (subject=username, claim=role, 만료시간)
- [x] JWT 검증 (서명 + 만료 확인)
- [x] JWT에서 username, role 추출
- [x] Secret key: `application.yml`에서 환경변수로 주입 (`${JWT_SECRET}`)

---

### Step 4 — Spring Security 설정 + JWT 필터 + 기존 테스트 호환

**변경 파일:**
- `backend/build.gradle` (spring-boot-starter-security 추가)
- `backend/src/main/java/com/myqaweb/config/SecurityConfig.java`
- `backend/src/main/java/com/myqaweb/auth/JwtAuthenticationFilter.java`
- **기존 @WebMvcTest 12개 파일** (Security 호환 수정)

**4-A. Security 의존성 + 설정:**

- [x] `build.gradle`에 `spring-boot-starter-security`, `spring-security-test` 의존성 추가
- [x] `SecurityConfig` — SecurityFilterChain 설정
  - `/api/auth/login` → permitAll
  - `/api/auth/register` → ADMIN 전용
  - `GET /api/**` → ADMIN, USER 허용
  - `POST/PUT/PATCH/DELETE /api/**` → ADMIN 전용
- [x] `JwtAuthenticationFilter` — OncePerRequestFilter 구현 (SecurityConfig에서 Bean 등록, `@Component` 미사용)
  - Authorization 헤더에서 Bearer 토큰 추출 → 검증 → SecurityContext 설정
- [x] CORS 설정: 기존 `WebConfig.java` 유지 (SecurityConfig에서 별도 CORS 미설정, 충돌 없음)
- [x] CSRF 비활성화 (REST API, stateless)
- [x] 테스트 환경 호환: `test/resources/application.yml`에 JWT secret 추가
- [x] 기존 `@WebMvcTest` 12개에 `@AutoConfigureMockMvc(addFilters = false)` 추가 — 전부 통과

**4-B. 기존 @WebMvcTest 호환 수정 (⚠️ CRITICAL):**

`spring-boot-starter-security` 추가 시 `@WebMvcTest`가 Security auto-config를 로드한다.
기존 12개 Controller 테스트가 모두 401/403으로 실패하게 되므로, 각 테스트에 Security 우회 처리를 추가한다.

**전략:** `@AutoConfigureMockMvc(addFilters = false)` — Security 필터 비활성화
- 기존 테스트는 Controller 비즈니스 로직 검증 목적이므로, Security는 전용 테스트(AuthControllerTest)에서 검증
- 기존 테스트 코드 변경을 최소화

**수정 대상 (12개):**

| # | 테스트 파일 | 변경 내용 |
|---|------------|-----------|
| 1 | `ConventionControllerTest.java` | `@AutoConfigureMockMvc(addFilters = false)` 추가 |
| 2 | `CompanyControllerTest.java` | 동일 |
| 3 | `ProductControllerTest.java` | 동일 |
| 4 | `SegmentControllerTest.java` | 동일 |
| 5 | `TestCaseControllerTest.java` | 동일 |
| 6 | `TestRunControllerTest.java` | 동일 |
| 7 | `TestResultControllerTest.java` | 동일 |
| 8 | `TestResultCommentControllerTest.java` | 동일 |
| 9 | `VersionControllerTest.java` | 동일 |
| 10 | `SeniorControllerTest.java` | 동일 |
| 11 | `KnowledgeBaseControllerTest.java` | 동일 |
| 12 | `KbImageControllerTest.java` | 동일 |

---

### Step 5 — AuthController + AuthService

**변경 파일:**
- `backend/src/main/java/com/myqaweb/auth/AuthService.java`
- `backend/src/main/java/com/myqaweb/auth/AuthServiceImpl.java`
- `backend/src/main/java/com/myqaweb/auth/AuthController.java`

- [x] `AuthService` 인터페이스 — `login()`, `register()`
- [x] `AuthServiceImpl` 구현
  - `login()`: username으로 조회 → BCrypt 비밀번호 검증 → JWT 발급
  - `register()`: 중복 체크 → BCrypt 해싱 → 저장
- [x] `AuthController`
  - `POST /api/auth/login` → `AuthResponse` (token, username, role)
  - `POST /api/auth/register` → `AuthResponse` (ADMIN 권한 필요)

---

### Step 6 — GlobalExceptionHandler 보강

**변경 파일:** `backend/src/main/java/com/myqaweb/common/GlobalExceptionHandler.java`

- [x] `AccessDeniedException` → 403 Forbidden 매핑
- [ ] ~~`AuthenticationException` → 401 Unauthorized 매핑~~ (Spring Security가 401을 직접 처리하므로 불필요)

---

### Step 7 — Frontend 타입 + API 클라이언트

**변경 파일:**
- `frontend/src/types/auth.ts`
- `frontend/src/api/auth.ts`

- [x] `AuthUser` 타입 (username, role)
- [x] `LoginRequest`, `LoginResponse` 타입
- [x] `authApi.login()`, `authApi.register()` 함수

---

### Step 8 — AuthContext + ProtectedRoute

**변경 파일:**
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx`

- [x] `AuthContext` — token, user, isAuthenticated, login(), logout() 제공
- [x] 앱 시작 시 localStorage에서 토큰 복원
- [x] `ProtectedRoute` — 미인증 시 `/login`으로 리다이렉트

---

### Step 9 — LoginPage

**변경 파일:** `frontend/src/pages/LoginPage.tsx`

- [x] username, password 입력 폼
- [x] 로그인 실패 시 에러 메시지 표시
- [x] 로그인 성공 시 `/senior`로 이동
- [x] 심플한 중앙 정렬 카드 레이아웃

---

### Step 10 — Axios 인터셉터 강화

**변경 파일:** `frontend/src/api/client.ts`

- [x] Request 인터셉터: localStorage에서 토큰 → `Authorization: Bearer ...` 헤더 주입
- [x] Response 인터셉터: 401 응답 시 토큰 제거 + `/login` 리다이렉트

---

### Step 11 — Layout 사용자 정보 + 로그아웃

**변경 파일:** `frontend/src/components/Layout.tsx`

- [x] 사이드바 하단에 로그인 사용자 이름 + role 뱃지 표시
- [x] 로그아웃 버튼 → AuthContext.logout() → /login 이동

---

### Step 12 — 라우팅 통합

**변경 파일:** `frontend/src/App.tsx`, `frontend/src/main.tsx`

- [x] `AuthProvider`를 Provider 트리에 추가 (`main.tsx`)
- [x] `/login` 라우트 추가 (Layout 밖, ProtectedRoute 밖)
- [x] 기존 모든 라우트를 `ProtectedRoute`로 감싸기
- [x] 기본 경로 `/` → `/senior` 리다이렉트

---

## 변경 파일 목록

### Backend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `build.gradle` | 수정 | spring-boot-starter-security, jjwt 의존성 추가 |
| `db/migration/V14__create_app_user.sql` | 신규 | app_user 테이블 + admin 시드 |
| `auth/Role.java` | 신규 | ADMIN, USER enum |
| `auth/AppUserEntity.java` | 신규 | JPA Entity |
| `auth/AppUserRepository.java` | 신규 | JpaRepository |
| `auth/AuthDto.java` | 신규 | LoginRequest, RegisterRequest, AuthResponse |
| `auth/JwtProvider.java` | 신규 | JWT 생성/검증 유틸 |
| `auth/JwtAuthenticationFilter.java` | 신규 | OncePerRequestFilter |
| `auth/AuthService.java` | 신규 | 인증 서비스 인터페이스 |
| `auth/AuthServiceImpl.java` | 신규 | 인증 서비스 구현 |
| `auth/AuthController.java` | 신규 | /api/auth/* 엔드포인트 |
| `config/SecurityConfig.java` | 신규 | SecurityFilterChain |
| `common/GlobalExceptionHandler.java` | 수정 | 401/403 핸들러 추가 |

### Backend (테스트)

| 파일 | 구분 | 설명 |
|------|------|------|
| `test/resources/application.yml` | 수정 | Security 테스트 설정 |
| `auth/AuthServiceImplTest.java` | 신규 | 로그인/등록 단위 테스트 |
| `auth/AuthControllerTest.java` | 신규 | 컨트롤러 단위 테스트 |
| 기존 ControllerTest 파일들 | 수정 | Security 컨텍스트 추가 (@WithMockUser 등) |

### Frontend (신규)

| 파일 | 구분 | 설명 |
|------|------|------|
| `types/auth.ts` | 신규 | 인증 타입 정의 |
| `api/auth.ts` | 신규 | login, register API |
| `context/AuthContext.tsx` | 신규 | 인증 상태 관리 |
| `components/ProtectedRoute.tsx` | 신규 | 라우트 보호 |
| `pages/LoginPage.tsx` | 신규 | 로그인 페이지 |

### Frontend (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `api/client.ts` | 수정 | 토큰 인터셉터 추가 |
| `components/Layout.tsx` | 수정 | 사용자 정보 + 로그아웃 |
| `App.tsx` | 수정 | ProtectedRoute 적용, /login 라우트 |
| `main.tsx` | 수정 | AuthProvider 추가 |

### E2E (수정)

| 파일 | 구분 | 설명 |
|------|------|------|
| `qa/helpers/api-helpers.ts` | 수정 | 테스트용 로그인 + 토큰 헤더 |
| `qa/api/auth.spec.ts` | 신규 | 로그인/등록 API E2E 테스트 |
| `qa/ui/login.spec.ts` | 신규 | 로그인 UI E2E 테스트 |

---

## 검증 시나리오

### API 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | POST /api/auth/login (올바른 자격증명) | 200 + JWT 토큰 |
| 2 | POST /api/auth/login (잘못된 비밀번호) | 401 Unauthorized |
| 3 | POST /api/auth/login (존재하지 않는 사용자) | 401 Unauthorized |
| 4 | POST /api/auth/register (ADMIN 토큰) | 201 Created |
| 5 | POST /api/auth/register (USER 토큰) | 403 Forbidden |
| 6 | POST /api/auth/register (토큰 없음) | 401 Unauthorized |
| 7 | POST /api/auth/register (중복 username) | 400 Bad Request |
| 8 | GET /api/kb (USER 토큰) | 200 OK (읽기 허용) |
| 9 | POST /api/kb (USER 토큰) | 403 Forbidden (쓰기 불가) |
| 10 | GET /api/kb (토큰 없음) | 401 Unauthorized |
| 11 | GET /api/kb (만료된 토큰) | 401 Unauthorized |

### UI 검증

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 미인증 상태에서 /senior 접근 | /login으로 리다이렉트 |
| 2 | 올바른 자격증명으로 로그인 | 메인 페이지로 이동 |
| 3 | 잘못된 자격증명으로 로그인 | 에러 메시지 표시 |
| 4 | 로그아웃 클릭 | /login으로 이동, 토큰 제거 |
| 5 | 사이드바에 사용자 이름 표시 | username + role 뱃지 |
| 6 | USER 역할로 쓰기 시도 | UI에서 쓰기 버튼 비활성 또는 403 처리 |

---

## [최종 요약]

(모든 Step 완료 후 작성)
