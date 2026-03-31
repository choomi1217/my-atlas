# Slack 알림 전환 — 환경 개선 (v2)

> **변경 유형**: 환경 개선
> **날짜**: 2026-03-30
> **관련 기능**: CI/CD 파이프라인 전체 (GitHub Actions → Slack)

---

## 1. 개요

GitHub Actions의 모든 알림(CI, 테스트, 배포)을 Slack으로 전환한다.
기존에는 워크플로우 실패 시에만 Slack 알림이 일부 워크플로우에서 발송되었으나, 이번 변경으로 **모든 워크플로우의 성공/실패 결과가 Slack으로 알림**된다.

### 변경 전

| 워크플로우 | Slack 알림 | 조건 |
|-----------|-----------|------|
| `frontend-ci.yml` | ✅ | 실패 시만 |
| `backend-ci.yml` | ✅ | 실패 시만 |
| `e2e.yml` | ✅ | 실패 시만 |
| `deploy-frontend.yml` | ❌ | 없음 |
| `deploy-backend.yml` | ❌ | 없음 |

### 변경 후

| 워크플로우 | Slack 알림 | 조건 |
|-----------|-----------|------|
| `frontend-ci.yml` | ✅ | **성공 + 실패 모두** |
| `backend-ci.yml` | ✅ | **성공 + 실패 모두** |
| `e2e.yml` | ✅ | **성공 + 실패 모두** |
| `deploy-frontend.yml` | ✅ | **성공 + 실패 모두** |
| `deploy-backend.yml` | ✅ | **성공 + 실패 모두** |

---

## 2. 변경 내용

### 2-1. CI 워크플로우 (frontend-ci, backend-ci, e2e)

**변경 사항:** `notify-slack` job의 실행 조건을 `failure()` → `always()`로 변경하고, 메시지를 성공/실패에 따라 동적 분기.

```yaml
# Before
if: ${{ failure() }}

# After
if: ${{ always() }}
```

메시지 분기 로직:
- 성공: `✅ [Workflow Name] Passed`
- 실패: `❌ [Workflow Name] Failed`

`contains(needs.*.result, 'failure')` 표현식을 사용하여 의존 job들의 결과를 자동 판별.

### 2-2. Deploy 워크플로우 (deploy-frontend, deploy-backend)

**변경 사항:** Slack 알림 step을 신규 추가.

- `slackapi/slack-github-action@v2.0.0` 사용 (CI 워크플로우와 동일)
- `if: always()` 조건으로 성공/실패 모두 알림
- `job.status` 기반으로 메시지 분기:
  - 성공: `✅ Deploy [Frontend/Backend] to ... Succeeded`
  - 실패: `❌ Deploy [Frontend/Backend] to ... Failed`

### 2-3. GitHub 이메일 알림 비활성화 (수동 설정 필요)

GitHub Actions의 이메일 알림을 끄려면 아래 단계를 수행:

1. GitHub.com 접속 → 우측 상단 프로필 → **Settings**
2. 좌측 메뉴 **Notifications** 클릭
3. **Actions** 섹션에서:
   - "Send notifications for failed workflows only" → **체크 해제**
   - 또는 "Email" 체크 해제하여 이메일 알림 완전 비활성화
4. 저장

> 이 설정은 코드로 제어할 수 없으므로 반드시 **수동으로 설정**해야 한다.

---

## 3. 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `.github/workflows/frontend-ci.yml` | notify-slack: `failure()` → `always()`, 성공/실패 메시지 분기 |
| `.github/workflows/backend-ci.yml` | notify-slack: `failure()` → `always()`, 성공/실패 메시지 분기 |
| `.github/workflows/e2e.yml` | notify-slack: `failure()` → `always()`, 성공/실패 메시지 분기 |
| `.github/workflows/deploy-frontend.yml` | Slack 알림 step 신규 추가 |
| `.github/workflows/deploy-backend.yml` | Slack 알림 step 신규 추가 |

---

## 4. 필요 GitHub Secrets

| Secret | 용도 | 상태 |
|--------|------|------|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | ✅ 등록 완료 |

---

## 5. Slack 알림 메시지 형식

모든 워크플로우에서 동일한 Block Kit 형식을 사용:

```
┌─────────────────────────────────────┐
│ ✅ Frontend CI Passed               │  (또는 ❌ ... Failed)
├─────────────────────────────────────┤
│ Repository:  yeongmi/my-atlas       │
│ Branch:      develop                │
│ Commit:      [fix] Resolve...       │
│ Author:      yeongmi                │
├─────────────────────────────────────┤
│ [View Workflow Run]                 │
└─────────────────────────────────────┘
```

---

## 6. 검증 방법

1. `develop` 브랜치에 frontend 또는 backend 코드 push → Deploy 워크플로우 트리거 → Slack 알림 수신 확인
2. PR 생성하여 CI 워크플로우 트리거 → 성공 시 ✅ 알림, 실패 시 ❌ 알림 확인
3. GitHub Settings > Notifications에서 이메일 알림 비활성화 후, 이메일 미수신 확인
