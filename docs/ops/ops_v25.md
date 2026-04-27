# Ops v25 — Prod 핫픽스: 이미지 URL + Platform v9 방어

> 변경 유형: 환경 개선
> 작성일: 2026-04-22
> 버전: v25
> 상태: 완료 (로컬 검증)

---

## 배경

프로덕션(`youngmi.works` / `api.youngmi.works`) 에 세 가지 증상이 동시에 관측됨.

1. **TestCase 첨부 이미지 엑박** — `https://youngmi.works/api/feature-images/{uuid}.png` 경로로 응답이 내려옴. `/api/feature-images/` 는 `V202604171158__migrate_image_urls_to_s3.sql` 이후 더 이상 핸들러가 없는 경로 (실제 이미지는 `/images/feature/` 로 S3/CloudFront 에 서빙). 백엔드가 응답 URL 을 하드코딩으로 조립하면서 마이그레이션 이후에도 옛 경로를 그대로 붙이고 있었음.

2. **Feature 상세 페이지 스크린샷 엑박** — `https://youngmi.works/images/features/senior_01_faq_list.png` 등 27장. 파일 자체는 `origin/main` `frontend/public/images/features/` 에 커밋돼 있음. 따라서 **CI deploy-frontend 가 실패했거나 S3 sync 결과에 해당 디렉터리가 반영되지 않은 배포 이슈**.

3. **`/api/settings/public` 500 + 로그인 on/off 토글 미동작** — Platform v9 기능. PATCH 는 200 OK 로 저장되지만 GET 이 500. 프론트 `AuthContext` 의 catch 블록이 safe default `loginRequired=true` 로 폴백하면서 "Off 로 설정했는데도 로그인 강제" 증상 발생.

   **프로드 진단 결과 (docs/ops/sh.log, 2026-04-22)** — **PR #107 이 main 에 머지됐으나 deploy-backend 가 프로드에 반영되지 않음. 프로드는 Platform v8 코드로 동작 중**:
   - Flyway 최신 적용 버전 `202604201800` (v8), `V202604210900` 미적용.
   - `api_access_log` 테이블에 `ip_address` 컬럼 없음.
   - `system_settings` row 2개만 (`ai_enabled`, `session_timeout_seconds`) — v9 seed(`login_required`, `ai_rate_limit_per_ip`, `ai_rate_limit_window_seconds`) 부재.
   - 로그의 `SettingsServiceImpl.updateSettings` 포맷이 v8 포맷 (v9 는 loginRequired 등도 출력).
   - 필터 체인 스택트레이스에 `DynamicPublicAccessFilter`, `AiRateLimitFilter` 없음.

   즉 500 의 근본 원인은 "엔드포인트가 배포 코드에 존재하지 않음" — `/api/settings/**` 전체가 ADMIN 전용(v8 SecurityConfig) 이라 비인증 GET `/api/settings/public` 요청이 SecurityContext 단계에서 거절되며 500 으로 전파.

---

## 조치

### 코드 수정 (hotfix/image-urls-and-platform-v9)

| 파일 | 변경 |
|---|---|
| `backend/src/main/java/com/myqaweb/feature/TestCaseImageUrlResolver.java` (신규) | bare filename 은 `/images/feature/` prefix 추가, 이미 `/` 로 시작하는 값(마이그레이션으로 경로가 박힌 row, legacy `/api/feature-images/...`) 은 그대로 통과 |
| `backend/src/main/java/com/myqaweb/feature/TestCaseController.java` (L75, L101) | 하드코딩 `"/api/feature-images/" +` → `toImageUrl()` 호출 |
| `backend/src/main/java/com/myqaweb/feature/TestCaseServiceImpl.java` (L329) | 동일 |
| `backend/src/main/java/com/myqaweb/config/DynamicPublicAccessFilter.java` | `isLoginRequired()` 를 try/catch 로 감싸 예외 시 `true` 폴백 (500 전파 차단) |
| `backend/src/main/java/com/myqaweb/settings/SettingsController.java` | `/api/settings/public` 도 동일한 방어 — `isLoginRequired()` 실패 시 `{loginRequired: true}` 로 200 응답 |

### 운영 조치 (배포 단계 — sh.log 진단에 따른 실제 복구 순서)

**STEP 1 (최우선): main 재배포**
- GitHub Actions `e2e.yml` 에서 deploy-backend job 을 재실행 (`gh workflow run e2e.yml --ref main` 또는 failed run → "Re-run failed jobs").
- 배포 직후 백엔드 기동 시 Flyway 가 `V202604210900` 을 자동 적용 → `api_access_log.ip_address` 컬럼 추가 + `system_settings` 에 `login_required=true` 등 seed.
- 이 단계만으로 `/api/settings/public` 500 과 로그인 토글 미동작이 복구됨.

**STEP 2: 프론트엔드 배포 검증** — `/images/features/` 엑박 복구.
- main 에 이미지 파일 27장 커밋 확인 완료. deploy-frontend 재실행만 하면 됨.

**STEP 3 (선택): hotfix PR 머지** — Platform v9 500 방어 + TestCase 이미지 URL 수정.
- Step 1 만으로 500 은 해결되지만, hotfix 의 try/catch 폴백이 있으면 향후 동일 유형 장애 시 브라우저가 500 을 보지 않고 graceful degrade.
- TestCase 이미지 URL 수정 (registry_v19) 은 반드시 이 hotfix 를 통해야만 프로드 적용됨 (main 에는 아직 없음).

---

### 진단 명령 (참고 — 이미 수행됨)

1. **Flyway 히스토리 검증**
   ```bash
   ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
   docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
     "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;"
   docker exec myqaweb-db psql -U myqaweb -d myqaweb -c "\d api_access_log"
   docker exec myqaweb-db psql -U myqaweb -d myqaweb -c "SELECT setting_key, setting_value FROM system_settings;"
   ```
   `V202604210900` 가 `success=f` 상태면 `DELETE FROM flyway_schema_history WHERE version='202604210900' AND success=false;` 후 backend 재기동. sh.log 결과상으로는 `success=f` row 자체가 없어서 단순 미적용 — 재배포만으로 해결됨.

2. **프론트엔드 배포 검증**
   ```bash
   aws s3 ls s3://my-atlas-frontend/images/features/ --recursive | wc -l   # 27 이상이어야 함
   gh workflow run e2e.yml --ref main                                       # 누락 시 재실행
   aws cloudfront create-invalidation --distribution-id EVMWQ4ZH85AXV --paths "/images/features/*"
   ```

---

## 검증

### 로컬 (Agent-D 완료)

- `./gradlew clean build` — 10 tasks executed, SUCCESS (1m 35s)
- `docker compose up -d --build` — 성공
- `curl http://localhost:8087/api/settings/public` — `{"success":true,"data":{"loginRequired":false}}` 정상 응답
- Playwright E2E: 316 passed, 24 skipped, 3 pre-existing flakes (인접 테스트가 `public-access.spec.ts` 의 snapshot→restore 사이에서 남긴 DB 상태 영향 — CI 에서는 fresh DB 로 재현 안 됨, 로컬에서도 DB 를 `login_required=true` 로 리셋하면 모두 pass)
- 신규 `qa/api/test-case-image.spec.ts` 3 건 모두 pass — 이미지 업로드→TC 연결→조회 응답 url 이 `/images/feature/` 로 시작하는지 검증

### 프로드 (배포 후 User 확인)

```bash
curl -i https://api.youngmi.works/api/settings/public
# 기대: 200 OK + {"success":true,"data":{"loginRequired": <실제값>}}

curl -I https://youngmi.works/images/features/senior_01_faq_list.png
# 기대: 200 OK (이전: 404/403)

# Admin 로그인 → Settings → loginRequired=false PATCH →
# 시크릿창에서 https://youngmi.works/resume 접속 → 로그인 없이 진입 가능해야 함

# 기존 TestCase 의 첨부 이미지가 UI 에서 엑박 없이 렌더링되는지 확인
```

---

## 후속

- public-access.spec.ts 의 snapshot→restore 패턴이 로컬에서 DB 상태 leak 발생 시 인접 테스트를 깨뜨림. 안전한 기본값(`loginRequired=true`) 으로 항상 복원하도록 리팩토링 검토 (qa 후속 v10 또는 v11 에서 처리).
- 프론트엔드 배포 검증 자동화 — deploy 후 `/images/features/` 기대 파일 개수를 확인하는 smoke 스텝 추가 검토.
