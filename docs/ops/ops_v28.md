# Ops v28 — Deploy 검증·드리프트 방지 레이어 (사후 방어망 구축)

> 변경 유형: 환경 개선
> 작성일: 2026-04-23
> 버전: v28
> 상태: 예정 (계획)

---

## 배경

2026-04-23 hotfix #108/#110/#111/#112 집합으로 프로드가 Platform v8 (02035dd, 2026-04-21) 에 **6일간 멈춰있던** drift 를 해소함 (상세: `ops_v25.md` ~ `ops_v27.md`).

사후 분석 결과, 오늘 사고는 **5 개의 방어선이 연쇄적으로 뚫린** 결과였음:

| # | 방어선 | 기대 동작 | 실제 (실패) |
|---|---|---|---|
| 1 | 서버 수동 편집 방지 | EC2 파일은 repo/CI 를 통해서만 변경 | 누가 `docker-compose.yml` 에 AWS env 3 줄 직접 추가 (ops v17/v18 당시 추정) |
| 2 | CI 의 loud failure | `git pull` 실패 시 CI job 실패 | `set -e` 부재로 exit code 무시, silent 통과 |
| 3 | 실제 새 코드 검증 | 배포 후 실 버전 확인 | `/actuator/health` 만 체크 — UP 이면 OK 판정, 버전은 검증 안 함 |
| 4 | 프로드 smoke test | 핵심 엔드포인트 응답 검증 | 없음 |
| 5 | Drift 알림 | 격차 감지 시 Slack 알림 | 없음 (오히려 "all success" 알림으로 안심시킴) |

#111 이 2번을 닫았음. 이 문서는 **1·3·4·5번을 순차적으로 닫는 계획**.

---

## 변경 내용

### A. Backend `/actuator/info` 에 git SHA 노출 (레이어 3 핵심)

**파일:** `backend/build.gradle` + `backend/src/main/resources/application.yml`

```gradle
plugins {
    id 'com.gorylenko.gradle-git-properties' version '2.4.2'  // 추가
}

gitProperties {
    keys = ['git.commit.id.full', 'git.commit.time', 'git.branch']
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info   # info 추가
  info:
    git:
      mode: full                # full 해야 commit.id.full 노출
```

빌드 시 `build/resources/main/git.properties` 생성됨 → 런타임 `/actuator/info` 가 다음 반환:

```json
{
  "git": {
    "commit": {
      "id": {"full": "18b72fa..."},
      "time": "2026-04-23T06:13:00Z"
    },
    "branch": "main"
  }
}
```

### B. CI — deploy 후 SHA 검증 step (레이어 3)

**파일:** `.github/workflows/e2e.yml` — `deploy-backend` job 에 step 추가

```yaml
- name: Verify deployed commit matches CI commit
  run: |
    set -euo pipefail
    EXPECTED=${{ github.sha }}
    # 백엔드가 기동할 여유 (deploy step 의 health check 이후 실행되므로 이미 UP)
    ACTUAL=$(curl -sf https://api.youngmi.works/actuator/info | jq -r '.git.commit.id.full')
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      echo "❌ Deploy drift: expected $EXPECTED, prod is $ACTUAL"
      exit 1
    fi
    echo "✅ Prod serving commit $ACTUAL"
```

### C. CI — 프로드 smoke test (레이어 4)

**파일:** `.github/workflows/e2e.yml` — `deploy-frontend` 다음에 새 job

```yaml
prod-smoke:
  name: Prod Smoke Tests
  runs-on: ubuntu-latest
  needs: [deploy-backend, deploy-frontend]
  if: needs.deploy-gate.outputs.skip != 'true'
  steps:
    - name: Wait for CloudFront invalidation
      run: sleep 30

    - name: Backend — /api/settings/public returns loginRequired
      run: |
        set -euo pipefail
        curl -sf https://api.youngmi.works/api/settings/public \
          | jq -e '.success == true and .data.loginRequired != null'

    - name: Frontend — feature image returns actual image/*
      run: |
        set -euo pipefail
        CT=$(curl -sI "https://youngmi.works/images/features/senior_01_faq_list.png?$(date +%s)" \
             | awk 'tolower($1) == "content-type:" { print $2 }' | tr -d '\r')
        case "$CT" in
          image/*) echo "OK: $CT" ;;
          *) echo "❌ expected image/*, got $CT (likely SPA fallback)"; exit 1 ;;
        esac

    - name: Backend — demo mode works when loginRequired=false (conditional)
      run: |
        set -euo pipefail
        LR=$(curl -sf https://api.youngmi.works/api/settings/public | jq -r '.data.loginRequired')
        if [ "$LR" = "false" ]; then
          # Anonymous GET /api/companies should return 200 when demo mode
          curl -sf https://api.youngmi.works/api/companies > /dev/null
          echo "Demo mode: anonymous GET /api/companies OK"
        else
          echo "loginRequired=true — skipping demo-mode check"
        fi
```

### D. Daily drift cron (레이어 5 — 안전망)

**신규 파일:** `.github/workflows/prod-drift-check.yml`

```yaml
name: Prod Drift Check (daily)

on:
  schedule:
    - cron: '0 1 * * *'   # 매일 01:00 UTC = KST 10:00
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Compare origin/main vs prod /actuator/info
        run: |
          set -euo pipefail
          MAIN_SHA=$(git rev-parse origin/main)
          PROD_SHA=$(curl -sf https://api.youngmi.works/actuator/info | jq -r '.git.commit.id.full')
          echo "main=$MAIN_SHA"
          echo "prod=$PROD_SHA"
          if [ "$MAIN_SHA" != "$PROD_SHA" ]; then
            echo "drift_detected=true" >> $GITHUB_ENV
            exit 1
          fi
          echo "✅ In sync"

      - name: Notify Slack on drift
        if: failure()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 Prod drift detected — main=$MAIN_SHA, prod=$PROD_SHA. Investigate.\"}"
```

배포 실패를 실시간으로 못 잡아도 **24 시간 안에 알림**. 오늘 사고는 6 일 숨어있었음 — 이것만 있었어도 4-22 아침에 드러남.

### E. 서버 수동 편집 금지 — 문서화 (레이어 1)

`CLAUDE.md` 에 섹션 추가:

```markdown
### 프로덕션 서버 편집 금지

- ❌ EC2 에서 repo 파일(`docker-compose.yml`, `Dockerfile`, application.yml 등) 직접 편집 금지
- ❌ `/home/ec2-user/my-atlas` 에서 `git commit` 금지 (CI deploy 전용)
- ✅ `.env` 만 EC2 에서 환경별로 관리 (repo 에는 `.env.example`)
- ✅ 설정 변경 필요 시 → 로컬 worktree → PR → 머지 → 자동 재배포
- ✅ 긴급 수동 재기동 시에도 `git pull` 이 ff-only 통과해야만 진행 (ops v26 기준)

#### 왜 중요한가
2026-04-23: EC2 의 `docker-compose.yml` 에 AWS env 3 줄 미커밋 local 편집이
있어서 `git pull` 이 조용히 실패 → 프로드가 Platform v8 (02035dd) 에서
6 일간 멈춰있었음. 참조: `docs/ops/ops_v25.md`-`ops_v27.md`.
```

`docker-compose.yml` 상단에도 경고 주석:

```yaml
# ──────────────────────────────────────────────────────────────
# DO NOT EDIT THIS FILE ON THE SERVER.
# All configuration goes through .env (per-environment) or a PR.
# Edits on EC2 cause silent git-pull failures and deploy drift.
# See docs/ops/ops_v27.md for the 2026-04-23 incident.
# ──────────────────────────────────────────────────────────────
version: "3.9"
```

---

## 실행 순서

한 PR (`hotfix/ops-v28-deploy-verification`) 로 묶어도 되고, 아래 두 그룹으로 나눠도 됨.

### Group 1 (필수 — Backend 변경 동반)

A. `/actuator/info` + gradle-git-properties
B. CI SHA 검증

이 둘은 한 세트. A 없이 B 못 함. 첫 배포 때 정상 동작 확인까지 확인해야 하므로 **단독 PR 로 내고 머지 후 다음 deploy 로 검증**.

### Group 2 (보조 — CI·문서만)

C. Prod smoke test job
D. Daily drift cron
E. CLAUDE.md + docker-compose.yml 경고 주석

Group 1 검증 끝난 뒤 추가해도 되고, 같이 내도 OK. 단독 위험도 낮음.

---

## 검증

### Group 1 (A+B) 머지 후

```bash
# 1. 로컬에서 빌드
cd /Users/yeongmi/dev/qa/my-atlas/backend && ./gradlew bootJar
# build/resources/main/git.properties 생성 확인
cat build/resources/main/git.properties

# 2. 로컬 컨테이너 기동 후 /actuator/info 확인
docker compose up -d --force-recreate backend
curl -s http://localhost:8080/actuator/info | jq .git.commit.id.full
# 기대: 현재 HEAD SHA

# 3. 프로드 배포 후 CI 로그에서 "✅ Prod serving commit XXX" 확인

# 4. 일부러 deploy 실패 시나리오 재현 (optional)
#    — EC2 repo 를 이전 SHA 로 reset → deploy 트리거 → CI 가 SHA mismatch 로 실패해야 정상
```

### Group 2 (C+D+E) 머지 후

```bash
# Smoke 가 실제로 실패 시 어떻게 찍히는지 확인
# (drift_check 은 수동으로 실행)
gh workflow run prod-drift-check.yml
gh run watch --exit-status
```

---

## 후속 (이 v28 범위 밖, 장기)

- **Actuator 보안** — `/actuator/info` 는 일반적으로 public OK 지만 `/actuator/env` 는 절대 노출 금지. `management.endpoints.web.exposure.include` 에 명시적으로 health, info 만 두기 — 이미 그렇게 설정돼 있는지 재확인.
- **Blue-green 배포** — `--force-recreate` 는 ~30-60 초 다운타임. 현재 스케일에선 수용 가능하나 이후 zero-downtime 이 필요해지면 검토.
- **Infrastructure as Code** — CloudFront `/images/*` 라우팅이 frontend static 경로와 충돌한 것처럼 인프라 설정이 매뉴얼이라 드리프트 위험. Terraform/CDK 로 옮기면 PR 리뷰에서 눈에 띄고 재현됨. 포트폴리오 가치는 있음.
- **Monitoring 대시보드** — Grafana 등으로 `/actuator/info.git.commit.id.full` 을 주기 수집하여 "현재 프로드가 도는 커밋" 상시 표시. 인시던트 대응 시 첫 질문이 해결됨.

---

## 관련 문서

- 오늘 사고 복기: `ops_v25.md`, `ops_v26.md`, `ops_v27.md`
- Platform v10.1 (Platform v9 핫픽스, 설정 토글·demo mode): `docs/features/platform/platform_v10.1.md`
- TestCase 이미지 URL 수정: `docs/features/registry/registry_v19.md`
- AWS 인프라 원본 설정: `ops_v17.md`, `ops_v18.md`
