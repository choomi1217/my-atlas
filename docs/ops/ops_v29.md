# Ops v29 — Git 전략 보강 (hotfix 백포트 자동화 + PR template + env_file 분리)

> 변경 유형: 환경 개선
> 작성일: 2026-04-27
> 버전: v29
> 상태: 계획 (구현 전)

---

## 1. 배경

2026-04-27 PR #119 (release develop → main) 가 false-positive conflict 로 막혔고, 추가 PR #120 라운드가 필요했음. 사후 분석 결과 `git-strategy.md` 에 머지 전략 정책을 명문화. 본 문서는 그 정책을 보조하는 **코드/설정 변경** 만 분리해서 추적.

**`git-strategy.md` 의 머지 전략 정책**:
- feature/bugfix/hotfix → main: Squash
- hotfix → develop (동기화) / develop → main (release): **Create a merge commit**

본 문서는 정책의 **운영 자동화** 와 **재발 방지 구조 변경** 을 다룸.

---

## 2. 변경 항목

| 항목 | 파일 | 역할 |
|------|------|------|
| **A. Hotfix 백포트 자동화** | `.github/workflows/hotfix-backport.yml` | hotfix → main 머지 시 develop 으로 자동 cherry-pick PR 생성 |
| **B. PR template** | `.github/pull_request_template.md` | 머지 옵션·종류 체크리스트로 휴먼 에러 차단 |
| **C. docker-compose env_file 분리** | `docker-compose.yml`, `.env.example` | env 변수 추가 시 docker-compose.yml 충돌 hot zone 제거 |

---

## 3. 구현 상세

### 3.A `.github/workflows/hotfix-backport.yml` (신규)

```yaml
name: Hotfix Backport to develop

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  backport:
    if: |
      github.event.pull_request.merged == true &&
      startsWith(github.event.pull_request.head.ref, 'hotfix/')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: develop

      - name: Configure git
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'

      - name: Create backport branch
        id: branch
        run: |
          BRANCH="backport/${{ github.event.pull_request.head.ref }}-pr${{ github.event.pull_request.number }}"
          git checkout -b "$BRANCH"
          echo "name=$BRANCH" >> $GITHUB_OUTPUT

      - name: Cherry-pick hotfix merge commit
        id: cherry
        run: |
          set +e
          git cherry-pick -m 1 ${{ github.event.pull_request.merge_commit_sha }}
          if [ $? -eq 0 ]; then
            echo "status=ok" >> $GITHUB_OUTPUT
          else
            git cherry-pick --abort
            echo "status=conflict" >> $GITHUB_OUTPUT
          fi

      - name: Push backport branch
        if: steps.cherry.outputs.status == 'ok'
        run: git push origin "${{ steps.branch.outputs.name }}"

      - name: Open backport PR
        if: steps.cherry.outputs.status == 'ok'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr create \
            --base develop \
            --head "${{ steps.branch.outputs.name }}" \
            --title "[backport] ${{ github.event.pull_request.title }}" \
            --body "Auto-backport of #${{ github.event.pull_request.number }} to develop.
          
          ⚠️ 머지 옵션은 **Create a merge commit** 사용 (squash 금지 — git-strategy.md 참조)."

      - name: Notify on cherry-pick conflict
        if: steps.cherry.outputs.status == 'conflict'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"⚠️ Hotfix #${{ github.event.pull_request.number }} 자동 백포트 실패 (cherry-pick conflict). 수동으로 hotfix→develop PR 생성 필요.\"}"
```

**동작**:
1. main 에 `hotfix/*` 브랜치 PR 머지 감지
2. develop 기반 backport 브랜치에 hotfix 의 merge commit 을 cherry-pick
3. 충돌 없으면 자동 PR 생성 (base=develop)
4. 충돌이면 Slack 알림 → 운영자가 수동 백포트

**효과**: `#108`, `#111`, `#112` 같은 hotfix 의 develop 누락 패턴 (3.2 사고) **자동 차단**.

### 3.B `.github/pull_request_template.md` (신규)

```markdown
## 종류 (해당 항목 체크)

- [ ] feature → develop  (Squash 머지)
- [ ] bugfix → develop  (Squash 머지)
- [ ] hotfix → main  (Squash 머지, **백포트 PR 도 같이 또는 자동 생성 확인**)
- [ ] hotfix → develop (백포트)  (**Create a merge commit** ⚠️)
- [ ] release: develop → main  (**Create a merge commit** ⚠️)
- [ ] chore / docs

## 머지 옵션 ⚠️ (PR Reviewer 가 체크)

이 PR 머지 시 GitHub UI 에서 다음 옵션 선택:
- [ ] feature/bugfix/hotfix → main: **Squash and merge**
- [ ] hotfix→develop / release: **Create a merge commit** (squash 금지)

> Squash 잘못 사용 시 다음 release PR 에서 false-positive conflict 발생.
> 자세한 사유: `docs/ops/git-strategy.md`

## Summary

<!-- 무엇을 왜 변경했는가 -->

## Test plan

- [ ] ...
```

**효과**: 휴먼 에러 (3.4 사고 — PR head=main 같은 형식 실수) + 머지 옵션 실수 (3.1 의 squash) 인지 보조.

### 3.C `docker-compose.yml` env_file 분리

**현재 구조** (conflict hot zone):
```yaml
backend:
  environment:
    SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-...}
    SPRING_DATASOURCE_USERNAME: ${SPRING_DATASOURCE_USERNAME:-...}
    SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD:-...}
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    JIRA_BASE_URL: ${JIRA_BASE_URL}
    JIRA_EMAIL: ${JIRA_EMAIL}
    JIRA_API_KEY: ${JIRA_API_KEY}
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}        # #112 가 추가
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY} # #112
    AWS_REGION: ${AWS_REGION:-ap-northeast-2}       # #112
    SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}         # #115 가 같은 영역에 추가 → conflict
    SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"
```

**변경 후**:
```yaml
backend:
  env_file:
    - .env
  environment:
    # default 값이 있는 것만 environment 블록 유지
    SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-jdbc:postgresql://host.docker.internal:5432/myqaweb}
    SPRING_DATASOURCE_USERNAME: ${SPRING_DATASOURCE_USERNAME:-myqaweb}
    SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD:-admin}
    AWS_REGION: ${AWS_REGION:-ap-northeast-2}
    SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"
```

**`.env.example`** (신규, repo 에 commit):
```bash
# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Jira
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_KEY=

# AWS S3 (default region 은 docker-compose.yml 에서 처리)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Slack
SLACK_WEBHOOK_URL=
```

기존 `.env` (`.gitignore` 됨, 로컬/EC2 별도 보관) 는 그대로 사용. docker compose 가 .env 를 자동으로 backend 컨테이너에 주입.

**효과**:
- 새 env 변수 추가 시 `.env.example` 한 줄 추가 + 운영자가 EC2 `.env` 한 줄 추가
- `docker-compose.yml` 의 environment 블록은 **default 값 처리만** 담당 → 거의 안 바뀜
- → docker-compose.yml conflict 거의 zero

**주의 사항**:
- `.env` 는 docker compose 자체의 변수 substitution 도 동시 사용 (예: `${BACKEND_PORT:-8080}`)
- `env_file:` 로 backend 컨테이너에 주입하는 변수와 substitution 변수가 같은 파일에 들어감 → OK (compose 가 두 용도 다 처리)

---

## 4. 검증 방법

### A. Hotfix 백포트 자동화
- [ ] dummy hotfix 브랜치 (`hotfix/test-backport-flow`) 만들어서 main 으로 PR
- [ ] main 머지 후 GitHub Actions 에 `Hotfix Backport to develop` 실행 확인
- [ ] backport branch + PR 자동 생성 확인
- [ ] 의도적 충돌 시나리오 (develop 와 다른 같은 파일 변경) → Slack 알림 수신 확인

### B. PR template
- [ ] 신규 PR 작성 시 template 본문 자동 로드 확인
- [ ] 모바일 / 데스크톱 양쪽 GitHub UI 에서 보이는지

### C. env_file 분리
- [ ] 로컬: `docker compose up -d --build backend` → 정상 기동
- [ ] `docker exec myqaweb-backend env | grep ANTHROPIC` → 값 정상 주입 확인
- [ ] 단위/통합 테스트 통과 (`./gradlew test`)
- [ ] 새 env 변수 추가 시뮬: `.env.example` 에만 한 줄 추가 → docker-compose.yml 변경 없음 확인

---

## 5. Step 진행 체크리스트

- [ ] Step A — `.github/workflows/hotfix-backport.yml` 작성 + 테스트 hotfix PR 로 검증
- [ ] Step B — `.github/pull_request_template.md` 작성
- [ ] Step C — `docker-compose.yml` env_file 분리 + `.env.example` 추가
- [ ] Step C — EC2 `.env` 가 새 형식과 호환되는지 확인 (그대로 호환됨, 변경 없음)
- [ ] 단위 테스트 + 빌드 검증
- [ ] PR 생성 (feature → develop, Squash 머지)
- [ ] 머지 후 다음 hotfix 발생 시 자동 백포트 동작 확인

---

## 6. 영향 범위

- **CI 영향**: 새 workflow 1 개 추가, 기존 워크플로우 영향 없음
- **로컬 개발 영향**: docker compose 명령은 동일, `.env` 위치/내용 변경 없음
- **프로드 영향**: EC2 `.env` 그대로 사용 가능, 재배포 시 동일 동작
- **데이터 영향**: 없음

---

## 7. 향후 확장 (이 v29 범위 밖)

- 머지 옵션을 GitHub Branch Protection rules 로 강제 (UI 옵션이 아닌 server-side enforcement) — 가능 여부 확인 필요
- worktree 의 symlink → 단방향 복사 메커니즘 으로 전환 (3.5 문제 별도 추적)

---

## 참고

- `docs/ops/git-strategy.md` — 머지 전략 정책 + 운영 가이드
- 오늘 사례: PR #117, #118, #119, #120
