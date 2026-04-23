# Platform — v12: `/api/settings/public` 500 방어 (Platform v9 핫픽스)

> 변경 유형: 버그 수정
> 작성일: 2026-04-22
> 버전: v12
> 상태: 완료 (로컬 검증)

---

## 배경

Platform v9 로 도입된 로그인 on/off 토글이 프로드에서 동작하지 않는 증상이 관측됨.

| 관측 | 의미 |
|---|---|
| Admin 이 Settings 에서 PATCH `/api/settings {loginRequired: true}` 시도 | 200 OK, DB 저장은 됨 |
| 시크릿창에서 GET `/api/settings/public` 호출 | 500 Internal Server Error |
| 프론트 `AuthContext.refreshPublicSettings()` 의 catch 블록 | safe default `loginRequired=true` 로 폴백 |
| 결과 | 관리자가 Off 로 설정해도 항상 로그인 강제 |

GET 만 500 이고 PATCH 는 200 OK 라는 점에서 **인증 여부에 따라 갈리는 경로가 원인**. 인증 토큰이 있는 요청은 `JwtAuthenticationFilter` 에서 auth 가 세팅되어 `DynamicPublicAccessFilter.doFilterInternal` 의 `isLoginRequired()` 호출이 short-circuit 되지만, 비인증 `/api/settings/public` 요청은 반드시 `isLoginRequired()` 를 호출함 — 이 시점에서 예외가 던져지면 Spring 이 500 으로 전파.

유력한 근본 원인:
- `V202604210900__add_login_required_and_ip_rate_limit.sql` 마이그레이션이 프로드에 적용되지 않아 `system_settings.login_required` row 부재 및 `api_access_log.ip_address` 컬럼 부재 상태일 가능성.
- 또는 배포 자체가 실패/skip 되어 Platform v9 코드가 실행되지 않는 상태.

근본 원인은 Ops v25 의 배포/마이그레이션 조치로 해결하되, **앱 레벨에서도 500 이 브라우저로 전파되지 않도록 방어 레이어를 추가**한다.

---

## 수정 내용

### 0) Demo mode 의미 확장 — whitelist 제거

Platform v9 의 `DynamicPublicAccessFilter` 는 `login_required=false` 일 때 read-only GET + 일부 AI POST 만 허용하는 whitelist 방식. 하지만 실사용 테스트 결과 "visitors 가 기능 전체를 체험" 이라는 의도에 부합하지 않음 — 비로그인 상태에서 이미지 업로드/Convention 등록/TestCase 작성 등 write 기능이 403 으로 막혀 데모가 의미 없어지는 UX.

해결: **whitelist 를 제거**. `login_required=false` 면 모든 unauthenticated `/api/**` 요청에 anonymous auth 주입. ADMIN-only 경로 (`/api/settings/**`, `/api/admin/**`, `/api/auth/register`) 는 SecurityConfig 의 `.hasRole("ADMIN")` 매처가 `/api/**` `.authenticated()` 매처보다 먼저 평가되므로 `ROLE_ANONYMOUS` 권한으로는 통과 못 함 — 보호 유지.

Before (whitelist):
- GET `/api/companies` → 익명 허용
- POST `/api/convention-images` → **403** (whitelist 밖)

After (demo mode):
- GET `/api/companies` → 익명 허용 (동일)
- POST `/api/convention-images` → **201** (익명 허용)
- GET `/api/settings` → **403** (ADMIN 보호 유지)
- POST `/api/auth/register` → **403** (ADMIN 보호 유지)

`shouldNotFilter` 로 `/api/` 외 경로는 필터 자체 스킵.

### 1) `DynamicPublicAccessFilter` — 필터 체인 폴백

`backend/src/main/java/com/myqaweb/config/DynamicPublicAccessFilter.java`

```java
private boolean resolveLoginRequiredSafely() {
    try {
        return settingsService.isLoginRequired();
    } catch (Exception ex) {
        log.warn("isLoginRequired() failed — defaulting to true", ex);
        return true;
    }
}
```

`doFilterInternal` 에서 직접 호출하던 `settingsService.isLoginRequired()` 를 이 헬퍼로 교체. 예외 발생 시 `true` (로그인 필수) 로 폴백하므로 기존 `/api/**` `.authenticated()` 규칙이 정상적으로 거절 처리 → 500 전파 차단.

### 2) `SettingsController.getPublicSettings` — 엔드포인트 폴백

`backend/src/main/java/com/myqaweb/settings/SettingsController.java`

```java
@GetMapping("/public")
public ResponseEntity<ApiResponse<SettingsDto.PublicSettingsResponse>> getPublicSettings() {
    boolean loginRequired;
    try {
        loginRequired = settingsService.isLoginRequired();
    } catch (Exception ex) {
        log.warn("isLoginRequired() failed — defaulting to true", ex);
        loginRequired = true;
    }
    return ResponseEntity.ok(ApiResponse.ok(new SettingsDto.PublicSettingsResponse(loginRequired)));
}
```

프론트 `AuthContext` 가 200 응답을 받을 수 있도록 보장. 200 + `loginRequired=true` 는 앱의 안전한 기본 상태 (로그인 요구).

---

## 테스트

### Unit

- `backend/src/test/java/com/myqaweb/settings/SettingsControllerTest.java`
  - 추가: `getPublicSettings_whenServiceThrows_fallsBackToLoginRequiredTrue` — service 가 `RuntimeException` 을 던져도 200 + `loginRequired=true` 응답 검증.
- `backend/src/test/java/com/myqaweb/config/DynamicPublicAccessFilterTest.java`
  - 추가: `isLoginRequiredThrows_fallsBackToTrueAndDoesNotThrow` — `isLoginRequired()` 가 예외를 던질 때 필터가 500 을 전파하지 않고 chain 을 이어가는지 검증.
  - 재작성: ParameterizedTest `anyApiPath_getsAnonymousInjectedInDemoMode` — `login_required=false` 에서 read + write (POST convention-images, feature-images, kb-upload-pdf, senior-chat 등) 모두에 anonymous 주입되는지 검증.
  - 재작성: ParameterizedTest `loginRequiredTrue_noInjectionRegardlessOfPath` — `login_required=true` 면 어떤 경로도 주입 안 함.
  - 추가: `nonApiPath_skippedViaShouldNotFilter` — `/api/` 외 경로는 필터 스킵.

### E2E

- `qa/api/public-access.spec.ts` 갱신 — write 엔드포인트에 대한 기대값을 데모 모드 기준으로 수정:
  - `POST /api/companies` anonymous → 201 (생성), 기존 401/403 기대 제거
  - `DELETE /api/companies/{id}` anonymous → 200
  - `PUT /api/kb/{id}` anonymous → 400/404 (핸들러 도달, 존재하지 않는 id)
  - `GET /api/settings`, `GET /api/settings/users`, `POST /api/auth/register` → 401/403 (ADMIN 보호 유지)
- 신규 `qa/api/test-case-image.spec.ts` 3건 pass — 이미지 업로드 응답 URL 이 `/images/feature/` prefix.
- 로컬 실행: `api/public-access + test-case-image + settings` 28/28 pass.

---

## 주의

- 이 패치만으로는 **근본 원인이 수정되지 않음**. Admin 이 토글을 Off 로 내렸을 때 실제로 `login_required=false` 가 읽히도록 하려면 Ops v25 의 Flyway/배포 조치가 선행되어야 함.
- 이 패치는 "최악의 경우에도 브라우저가 500 을 보지 않고 로그인 화면으로 fall-through 한다" 는 보장만 제공.

---

## 관련 문서

- Platform v9: `docs/features/platform/platform_v9.md`
- Ops v25 (배포/마이그레이션 조치): `docs/ops/ops_v25.md`
