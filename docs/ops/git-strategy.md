# my-atlas Git 전략

> 작성일: 2026-04-27
> 작성 동기: PR #117/#118/#119 흐름에서 squash 머지로 인한 false-positive conflict 가 반복 노출됨. 머지 전략 + 운영 가이드를 명문화.

---

## 1. 브랜치 구조

```
main          ← 프로덕션 배포 대상. youngmi.works / api.youngmi.works
  ▲
  │ release PR (merge commit) / hotfix PR (squash)
  │
develop       ← 통합 브랜치. 로컬 개발/CI 의 진짜 baseline
  ▲
  │ feature/bugfix PR (squash) / hotfix backport PR (merge commit)
  │
feature/*     ← 기능별 작업 브랜치 (develop 에서 분기)
bugfix/*      ← 버그 수정 브랜치 (develop 에서 분기)
hotfix/*      ← 긴급 수정 브랜치 (main 에서 분기, main + develop 양쪽 머지)
```

**규칙**:
- main 은 read-only — direct commit/push 금지
- 모든 feature/bugfix → `feature/*` 또는 `bugfix/*` from `develop`
- Hotfix 는 `main` 에서 분기 → main 머지 + develop 백포트 (자동화는 `ops_v29.md` 참조)
- PR 최소 1 reviewer (현실에선 단독 운영이라 self-review 비율 높음)

---

## 2. 머지 전략 (정책)

| 머지 방향 | 옵션 | 이유 |
|---|---|---|
| `feature/*` → `develop` | **Squash** | history 깔끔, 추적 필요 없음 |
| `bugfix/*` → `develop` | **Squash** | 위와 동일 |
| `hotfix/*` → `main` | **Squash** | 운영 commit log 를 PR 단위로 깔끔하게 유지 |
| `hotfix/*` → `develop` (동기화) | **Create a merge commit** | 핵심 — main 의 history 가 develop 의 조상으로 들어가야 다음 release 시 false-positive conflict 안 남 |
| `develop` → `main` (release) | **Create a merge commit** | release 단위 history 보존 + develop 와 main 의 조상 관계 유지 |

**핵심 원칙**: 
- **history 가 끊어지면 안 되는 머지는 merge commit**, **단발성 변경은 squash**.
- forward-merge / release 는 양쪽 브랜치 history 를 잇는 게 본질 → squash 금지.

**이 전략으로 해결되는 문제**:
- ✅ False-positive conflict (squash 로 history 단절돼서 발생) — release / 백포트 가 merge commit 이라 자연 해결
- ✅ Hotfix 백포트 누락 — 정책에 명문화 (자동화는 `ops_v29.md` Section A)

---

## 3. 잘 작동하는 부분

| 항목 | 평가 |
|---|---|
| Feature 격리 | ✅ worktree 로 도메인별 동시 작업 가능 |
| 코드 리뷰 PR 흐름 | ✅ feature → develop → main 흐름 명확 |
| CI 강제 | ✅ JaCoCo 70%, ESLint, E2E 통과 필수 |
| 자동 배포 | ✅ main push → S3/EC2 자동 배포 |
| Slack 알림 | ✅ 모든 워크플로우에 Block Kit 포맷 |
| Worktree 동기화 스크립트 | ✅ `wt.sh sync` 로 reset 자동화 |

---

## 4. 노출된 문제와 대응

### 4.1 ⚠️ Squash 머지로 인한 false-positive conflict (오늘 사례)

**증상**: PR #119 (release) 가 docker-compose.yml 에서 false-positive conflict.

**원인**: PR #118 forward-merge 가 squash 됨 → develop 의 history 가 main 의 hotfix 를 조상으로 인식 못 함 → release 시 같은 영역 변경이 충돌로 보임.

**대응**: → **Section 2 머지 전략** (forward-merge / release 는 merge commit). 정책 적용 후 재발 zero.

### 4.2 Hotfix 백포트 누락

**증상**: 4-23 의 `#108`, `#111`, `#112` hotfix 중 `#108` 은 #110 으로 백포트됐지만 `#111` / `#112` 는 누락. 4 일 뒤 발견.

**대응**:
- 1차: **Section 2 정책 명문화** — hotfix → develop 백포트 단계가 흐름의 일부
- 2차: **`ops_v29.md` Section A** — GitHub Action 으로 hotfix → develop 자동 cherry-pick PR 생성 (휴먼 에러 zero)

### 4.3 Worktree 재사용 시 squash residue

**증상**: feature/ops-env worktree 에서 v23/v24 작업 시작 시 push 가 non-fast-forward 거부. remote 에 과거 머지된 squash 잔재 commit 들이 누적.

**원인**: worktree 가 영구 작업 공간이라 같은 브랜치명을 재사용. squash 머지 후 develop 만 정리되고 feature/ops-env 는 옛 commit 들을 그대로 보유.

**대응 (운영 가이드)**:
- **Worktree 는 영구로 유지하되, 브랜치는 일회성 사용**
- 새 작업 시 develop 기반 새 브랜치 생성 (예: `feature/v24-slack`, `feature/kb-v8`)
- 머지 완료 후 `wt.sh sync <name>` 으로 worktree 를 develop HEAD 로 reset

```bash
# ❌ 잘못된 패턴 — worktree 의 fixed branch 재사용
cd worktrees/ops-env  # 이미 feature/ops-env 에 옛 작업 잔재
# 새 작업 시작 → push 거부

# ✅ 권장 패턴 — 매번 새 브랜치
cd worktrees/ops-env
./scripts/wt.sh sync ops-env  # develop HEAD 로 reset
git checkout -b feature/v24-slack origin/develop  # 새 브랜치
# 작업, 커밋, push
gh pr create --base develop ...
```

이 가이드는 CLAUDE.md 의 "Branch Hygiene — Squash Merge 주의" 섹션에도 반영.

### 4.4 PR head=main 같은 잘못된 PR (#117 사례)

**증상**: forward-merge 의도로 `gh pr create --base develop --head main` 실행. PR 은 만들어졌지만 충돌 해결 commit 을 main 에 push 해야 하는 구조 → close.

**원인**: `--head main` 은 "main 자체를 develop 에 머지" 의미. 충돌 해결이 main 오염을 동반.

**대응 (운영 가이드)**: forward-merge 는 별도 브랜치 (`chore/forward-merge-*`) 에서 미리 충돌 해결한 뒤 PR.

```bash
# ❌ 잘못된 패턴
gh pr create --base develop --head main  # 충돌 해결이 main 오염

# ✅ 권장 패턴
git checkout -b chore/forward-merge-main-to-develop origin/develop
git merge origin/main --no-ff -m "..."
# 충돌 해결, commit, push
gh pr create --base develop --head chore/forward-merge-main-to-develop
```

→ `ops_v29.md` Section B 의 PR template 가 이 인지 보조 역할도 수행.

### 4.5 Symlink 으로 인한 worktree merge 불가

**증상**: worktree 에서 `git merge` 또는 `git stash` 시 `'.claude/agents/build-verifier.md' is beyond a symbolic link` 에러.

**원인**: `wt.sh` 가 worktree 의 `.claude/agents` 를 메인 레포로의 심볼릭 링크로 설정. git 은 보안상 심볼릭 링크 너머의 tracked 파일을 수정하지 않음.

**현재 우회**: `/tmp` 에 별도 clone 해서 머지 작업 수행 후 push. worktree 는 머지 작업에 사용하지 않음.

**대응**: 향후 `wt.sh` 리팩으로 symlink → 단방향 복사 메커니즘 전환 (별도 진행, `ops_v29.md` 의 Section 7 향후 확장 참조).

### 4.6 docker-compose.yml 의 반복 충돌

**증상**: 다양한 PR 이 environment 섹션 같은 위치에 새 env 변수를 추가 → 매번 충돌.

**노출 사례**: #112 가 AWS env 3줄 + #115 가 SLACK env 1줄 → 충돌.

**대응**: → **`ops_v29.md` Section C** — `env_file:` 분리. 새 env 변수는 `.env.example` 에 한 줄 추가만 — `docker-compose.yml` 자체는 거의 안 바뀜.

---

## 5. 코드/설정 변경 (별도 추적)

본 문서는 정책·가이드 차원. 실제 코드/설정 변경은 **`docs/ops/ops_v29.md`** 에 분리:

- `.github/workflows/hotfix-backport.yml` (신규) — hotfix 백포트 자동화
- `.github/pull_request_template.md` (신규) — PR 종류·머지 옵션 체크리스트
- `docker-compose.yml` env_file 분리 + `.env.example` (신규)

---

## 6. 오늘 (2026-04-27) 까지의 PR 흐름 (사례 정리)

```
[2026-04-23]
  #115 [feat] ops v23 + v24            (feature → develop)        ✅ squash 머지
  ↓
  ⚠️ 4 일 갭 (휴가/업무 복귀 안함)
  ↓
[2026-04-27]
  #116 [feat] Miridih seed             (feature → develop)        🚫 closed
  #117 [chore] forward-merge head=main (구조 결함)                🚫 closed
  #118 [chore] forward-merge proper    (chore/* → develop)        ⚠️ squash 머지 ← history 단절
  #119 [release] ops v23 + v24         (develop → main)           ⚠️ false-positive CONFLICT
  #120 [chore] resolve PR #119 conflict (chore/* → develop)       ⏳ open, "Create a merge commit" 필요
  ↓
  (#120 머지 후) #119 자동 mergeable → 머지 → 릴리즈 완료
```

**핵심 학습**: forward-merge 는 squash 하면 안 된다. 그 한 줄 규칙만 지켜도 #119/#120 라운드 트립을 통째로 절약.

→ Section 2 의 머지 전략 정책으로 명문화 + `ops_v29.md` Section A 의 자동화로 영구 차단.

---

## 7. 참고

- `CLAUDE.md` — Branch Strategy / Branch Hygiene / Squash Merge 주의 섹션
- `scripts/wt.sh` — worktree sync 스크립트
- `docs/ops/ops_v29.md` — 본 전략의 코드/설정 변경
- `docs/ops/ops_v6.md` ~ `ops_v15.md` — Worktree Docker / DB 분리 진화 과정
- 오늘 사례: PR #115, #117, #118, #119, #120
