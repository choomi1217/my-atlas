# ops v35 — Worktree 폐기 및 레포 정리

> 변경 유형: 환경 개선  
> 작성일: 2026-08-18  
> 버전: v35 (v34 통합)  
> 상태: Part 1 완료 / Part 2 예정

---

## 0. 이 문서의 범위

v34(Worktree 폐기)를 이 문서에 흡수하고 `ops_v34.md`는 삭제했다.
v34는 **코드 변경 없이 브랜치·작업공간만 정리한 기록**이라 단독 버전 문서로 남길 만한 무게가 아니다.
worktree 폐기의 후처리가 곧 이번 레포 정리이므로, 두 작업은 하나의 스펙으로 묶는 편이 맞다.

| Part | 내용 | 상태 |
|------|------|------|
| **Part 1** | Worktree 전면 폐기 및 브랜치 위생 복구 | ✅ 완료 (2026-08-12), main 배포 완료 |
| **Part 2** | 레포 정리 — 폐기 모델 잔재 및 죽은 파일 제거 | 예정 (결정 완료, 실행 미착수) |

> `ops_v34.md`(278줄)를 Part 1로 흡수하고 원본은 삭제했다. 참조 7건은 본 문서로 갱신했다 —
> `CLAUDE.md`(`:57`, `:77`, `:118`), `docs/ops/git-strategy.md`(`:64`, `:99`, `:140`, `:196`).
> v34는 Part 1 시점에 이미 main까지 배포됐으므로(PR #145 → #146, 태그 `v2026.08.20`),
> 본 문서가 그 변경의 정본 기록이 된다.

---

# Part 1 — Worktree 폐기 (2026-08-12, 완료)

## 1.1 배경 — 근본 원인

`.claude/worktrees/` 기반 "도메인별 영구 worktree" 모델이 붕괴했다.
12개 중 살아있는 건 2개뿐이고 나머지는 3~4개월간 방치되며 미머지 커밋을 쌓았다.

원인은 CLAUDE.md 안에 모순된 두 모델이 공존한 것이다.

```
"worktree는 기능 도메인별 영구 작업 공간 (일회성이 아님)"   ← 영구 브랜치를 전제
"모든 작업 → feature/* from develop, PR 머지 후 삭제"        ← 일회성 브랜치를 전제
```

이 둘을 억지로 붙이려고 나온 것이 `wt.sh sync`의 `git reset --hard origin/develop`이다.
브랜치 이름은 유지한 채 내용만 갈아끼우니, `feature/knowledge-base` 브랜치의 이름과 내용이
아무 관계 없어졌다.

### 자기잠금 루프

```
공용파일 "양쪽 작성" 규칙 (docs/**, scripts/**, CLAUDE.md, .claude/agents/**)
   ↓ 수동 이중작성이 번거로움
심링크로 우회 (CLAUDE.md ×4, .claude/agents/)
   ↓ git이 typechange(T) + deleted(D)로 인식
worktree가 영구 dirty 상태
   ↓ wt.sh sync_one()의 dirty 체크에서 abort
sync 영원히 불가 → worktree rot → 유령 커밋 누적
```

`wt.sh sync`가 재생성하는 심링크가 다음번 `wt.sh sync`를 막았다.

### 실측 증거 (2026-08-12)

| 항목 | 실측 |
|---|---|
| worktree 12개 중 살아있는 것 | **2개** — registry(behind 3), test-studio(behind 24) |
| 방치된 worktree | behind 40~89, 마지막 커밋 04-21 ~ 04-29 |
| dirty로 sync 불가 | platform(34), words-convention(11), knowledge-base(10), ops-env(9), resume-ui(9) |
| 로컬 브랜치 30개 중 머지 완료 | **18개** (미삭제). remote 35개 |
| 브랜치 세대 관리 실패 | `feature/platform` / `-v9` / `-v11` 공존, registry 계열 4개 |
| 디스크 | `.claude/worktrees/` **4.1GB** — 툴 설정 디렉토리 안에 소스 복사본 12벌 |

## 1.2 결정 사항

| # | 결정 | 근거 |
|---|---|---|
| D1 | **Worktree 전면 폐기** — 단일 레포 + `git switch` | 4.1GB 회수, rot 구조 자체가 소멸. `node_modules/`·`build/`는 gitignore라 브랜치 전환 시 유지되므로 재빌드 비용 거의 없음 |
| D2 | **main + develop 2단 구조 유지** | 프로드 배포 게이트 유지. `git-strategy.md` Section 2 머지 전략은 **그대로 존치** |
| D3 | **공용파일 "양쪽 작성" 규칙 폐기** | D1의 자동 귀결 |
| D4 | **심링크 전면 제거** | 자기잠금 루프의 물리적 원인 |
| D5 | **`wt.sh` 폐기 → `dev.sh`로 축소** | worktree 전제 제거, 스택 up/down/rebuild만 남김 |
| D6 | **병렬 작업은 harness 임시 worktree로 대체** | `isolation: "worktree"`는 작업 후 자동 정리되므로 rot 불가능 |

## 1.3 삭제 전 감사 — `git cherry` false negative

`git cherry`가 미반영(`+`)으로 표시한 3건을 **소스 실물 대조**로 재검증했다.

| 브랜치 | 커밋 | 실물 대조 결과 |
|---|---|---|
| `hotfix/image-urls-and-platform-v9` | `4db4bbd` | ✅ main·develop 양쪽 완전 반영 |
| `hotfix/image-urls-and-platform-v9` | `6b42b9b` | ✅ main·develop 양쪽 완전 반영 |
| `feature/miridih-bizhows-seed` | `6a34885` | ❌ **develop에 실제로 없음** — 유일한 미반영 |

> ⚠️ **`git cherry`로 유실을 판정하지 말 것.** patch-id는 커밋 **전체 diff**의 해시라,
> squash 머지로 다른 파일과 뭉쳐지면 이미 반영된 커밋도 `+`로 표시된다.
> 이번 건에서 **2/3이 false positive**였다. 반드시 소스 실물을 대조한다.
> (이 교훈은 CLAUDE.md Git Branch Strategy에 명문화됨)

**결론**: 프로드 유실 0건. 미반영 1건(`6a34885` seed)은 patch로 아카이브 후 폐기.

## 1.4 실행 결과

| 지표 | Before | After |
|---|---|---|
| worktree | 13개 (내부 12 + 외부 1) | **1개** (메인 레포만) |
| 디스크 | 4.14GB (worktree 사본) | **0** — 전량 회수 |
| 로컬 브랜치 | 30개 | **2개** (`develop`, `main`) |
| 원격 브랜치 | 35개 | **2개** |
| 머지 후 브랜치 삭제 | 수동 (방치됨) | **자동** (`delete_branch_on_merge`) |
| `wt.sh` | 400줄 (sync/심링크/resolve) | `dev.sh` — 스택 관리만 (`up`/`fresh`/`down`/`status`) |
| 심링크 | worktree마다 상주 → 영구 dirty | **소멸** |
| 유실 작업물 | 미확인 | **0** — 감사 후 전량 회수 또는 아카이브 |

**자기잠금 루프 해소**: D3(규칙 폐기)로 체인의 첫 고리를 끊었고, worktree 폐기로 나머지가 함께 소멸했다.

> 실행 중 발견: `agent-worker`는 `profiles: ["worker"]`라 기본 `down`에서 제외된다.
> `docker compose --profile worker down`이 필요하다 (미지정 시 컨테이너가 남아 네트워크를 점유).
> → CLAUDE.md Docker 운영 규칙에 반영됨.

---

# Part 2 — 레포 정리 (2026-08-18, 예정)

## 2.1 정리 원칙

**gitignored 파일은 정리 대상이 아니다.**

`frontend/dist/`, `backend/build/`, `backend/.gradle/`, `.DS_Store`, 로컬 이미지 업로드 폴더,
로컬 편의 스크립트 등은 **의도적으로 `.gitignore`에 등록한 것**이다.
빌드 산출물과 로컬 캐시가 디스크에 존재하는 것은 정상이며, 레포 위생과 무관하다.

따라서 이번 정리 범위는 **git에 올라가 있거나 올라갈 예정인 것**으로 한정한다.

## 2.2 Git 현황

2026-08-21 실측.

| Ref | Commit | 상태 |
|------|--------|------|
| `origin/main` | `c65b2ee` | 최신. 태그 `v2026.08.20` |
| `origin/develop` | `c65b2ee` | **복구 완료** — main과 동일 커밋 |
| local `develop` | `c65b2ee` | origin/develop과 동기 |
| local `main` | `e28141e` | origin보다 6 뒤처짐 (pull만 필요, 무해) |

Part 1(`6e0d243`)은 PR #145(`feature/registry` → `develop`) → PR #146(`develop` → `main`)을 거쳐
**main까지 배포 완료**됐다. `feature/registry`가 develop이 아니라 Part 1 작업 브랜치에서 분기되어
두 작업이 함께 올라갔고, PR #146 제목에 `Ops v34 Worktree 폐기`가 명시돼 리뷰를 거쳤다.

### P-0. `origin/develop` 삭제 사고 ✅ 복구됨 / ⚠️ 재발 방지 미적용

| | |
|---|---|
| **현상** | 2026-08-20, PR #146 머지와 동시에 원격 `develop`이 사라져 `gh api .../branches` 결과가 `main` 하나만 남았다 |
| **원인** | Part 1 Step 2-4에서 켠 `delete_branch_on_merge = true`가 **PR의 head 브랜치를 종류 가리지 않고 삭제**한다. release PR의 head가 `develop`이므로 머지와 동시에 삭제됐다. **머지 방식(merge commit / squash / rebase)과 무관하다** — 방식을 바꿔도 동일하게 삭제된다 |
| **영향** | `feature/* → develop → main` 2단 전략의 통합 브랜치 소실. `default_branch = main`이라 새 PR이 전부 main으로 향한다 |
| **복구** | ✅ 완료 — `origin/develop`이 `c65b2ee`로 복원됐다. main이 develop의 모든 커밋을 부모로 물고 트리도 동일해 **유실 0건**이었다 |
| **재발 방지** | ⚠️ **미적용.** `delete_branch_on_merge`가 여전히 `true`라 다음 release PR에서 똑같이 삭제된다 |
| **권고** | GitHub 브랜치 보호 규칙으로 **`develop` 삭제만 금지**한다. 설정 자체를 끄면 feature 브랜치 자동 정리 편익까지 잃는다 |

> Part 1 Step 2-4는 "머지 후 브랜치 삭제: 수동(방치됨) → 자동"을 개선으로 기록했다.
> 그 개선이 통합 브랜치까지 삭제한다는 부작용은 당시 검토되지 않았다.
> 위 표가 그 부작용의 기록이다.
>
> 탐지 시 주의 — `git branch -r`의 `origin/develop`은 stale 캐시라 삭제를 잡지 못한다.
> `git fetch --prune` 또는 `git ls-remote --heads origin`으로 원격을 직접 조회해야 한다.

## 2.3 정리 항목 (결정 완료)

### P-1. `ops_v34.md` → 본 문서 Part 1로 통합 후 삭제 ✅ 완료

| | |
|---|---|
| **근거** | worktree 폐기의 후처리가 곧 Part 2 레포 정리다. 두 작업을 한 스펙으로 묶는 편이 맞다 |
| **처리** | 278줄 → Part 1 약 100줄로 압축 후 `git rm docs/ops/ops_v34.md` |
| **참조 갱신** | 7건 — `CLAUDE.md`(`:57`, `:77`, `:118`), `docs/ops/git-strategy.md`(`:64`, `:99`, `:140`, `:196`). 잔여 참조 0건 확인 |
| **왜 필수였나** | 갱신 없이 지우면 `ac786b9`(rename 후 링크 미갱신으로 `ops.md` 링크 11건 파손)를 반복한다 |

**흡수 과정에서 v34 사실 관계를 실측 대조했다 (2026-08-20)** — `wt.sh`·`setup-worktree.sh` 삭제 ✅,
`dev.sh` 4개 명령 ✅, 로컬 브랜치 2개 ✅, `delete_branch_on_merge` true ✅. 전부 정확했다.
다만 v34 원본은 상태 표기가 실제와 어긋나 있었고, Part 1에서 바로잡아 흡수했다.

| v34 원본 | Part 1 |
|---------|--------|
| 헤더 `상태: 진행 중` | 완료 — PR #145 → #146 → main 배포, 태그 `v2026.08.20` |
| §8 `(2-3/2-4는 User 승인 대기)` — 본문은 `[x] 완료`라 **문서 내 모순** | 승인 대기 문구 제거 |
| Step 5-1 `[ ]` — 내용은 *"과거 기록 문서 **존치**"* 라는 결정이지 액션이 아님 | 결정 문장으로 전환 |
| Step 5-3 `[ ]` 미체크 | §2.1 "gitignored는 정리 대상 아님"으로 종결 |

### P-1b. `.gitignore` 죽은 항목 제거

```
5: # Docker Compose worktree override (자동 생성)
6: docker-compose.override.yml
```

생성 주체였던 `scripts/setup-worktree.sh`가 v34에서 삭제됐고, `dev.sh`는 override를 만들지 않는다.
아무도 만들지 않는 파일을 무시하는 항목이 남아 있다 → 2줄 제거.

### P-2. `.claude/projects/` — 홈 전용 경로가 레포에 커밋됨

```
.claude/projects/-Users-yeongmi-dev-qa-my-atlas/memory/feedback_no_db_wipe.md
```

| | |
|---|---|
| **근거** | Claude Code의 **홈 디렉토리(`~/.claude/`) 전용 구조**. 경로에 `-Users-yeongmi-` 절대경로 슬러그가 박혀 있어 다른 머신에서는 의미가 없다. `9c5310f`에서 레포에 유입 |
| **현상** | `~/.claude/.../memory/`에는 이 파일이 **없고**, 홈의 `MEMORY.md` 인덱스만 이 이름을 가리켜 **링크가 끊긴 상태**. 실물이 레포 쪽에만 있다 |
| **결정** | DB 삭제 금지는 Claude가 반드시 지켜야 할 규칙이므로 **제 위치로 옮긴다** |
| **처리** | ① 홈 메모리로 복원 → ② 레포에서 `git rm` → ③ `.gitignore`에 `.claude/projects/` 추가 |
| **순서 주의** | ①을 건너뛰고 ②를 하면 메모리 1건이 소실된다 |

### P-3. `scripts/sync-db-to-aws-v23.sh` 삭제

| | |
|---|---|
| **근거** | 스크립트 본문 26-27행이 스스로 밝힌다 — *"이 스크립트는 2026-04-23 v23 마이그레이션 **1회성 작업용**이며, 참조 백업 파일은 보존되어 있지 않을 수 있다."* 실제로 `PROD_BACKUP`/`DEV_BACKUP`이 가리키는 백업 파일은 남아 있지 않다 |
| **추가 위험** | EC2 IP(`3.34.154.147`)와 SSH 키 경로가 하드코딩돼 있고, `TRUNCATE`를 수행하는 서브커맨드를 포함한다. 동작하지 않는 채로 방치할 종류의 스크립트가 아니다 |
| **결정** | 삭제 |
| **유지** | `scripts/sync-db-to-aws.sh`(범용)는 존치 — `ops_v23.md`·`diff.md`가 참조하는 현역 |

### P-4. `docs/ops/ops-issues.md` 삭제

| | |
|---|---|
| **근거** | 헤더가 `최종 업데이트: 2026-04-09` / `기준 버전: ops v8`. 현재 v35다. 10건 중 다수가 이미 해결됨 (#3 모니터링 → v22, #6 JaCoCo → v14/v15, #1 HTTPS → ALB 설정 진행) |
| **판단** | "미해결 이슈 목록"이라는 이름으로 **틀린 현황을 제공**하고 있어, stale 상태로 두는 것이 없는 것보다 나쁘다 |
| **결정** | 삭제 (사용하지 않음) |

### P-5. `docs/ui/` 삭제

| | |
|---|---|
| **근거** | 파일 1개(`ui_v1.md`, 04-01, 상태 "진행 중"). 레포 전체에서 **참조 0건**. CLAUDE.md의 문서 경로 규칙(기능→`docs/features/`, 환경→`docs/ops/`, 테스트→`docs/qa/`)에 `docs/ui/`는 정의돼 있지 않다 — 규칙 밖에서 만들어진 고아 디렉토리 |
| **결정** | 삭제 |

### P-6. 미커밋 문서 5건 커밋

| 파일 | 작성일 | 줄 수 | 문서상 상태 |
|------|--------|-------|------------|
| `docs/qa/qa_v14.md` | 07-13 | 334 | 확정 |
| `docs/qa/testcase_test-studio.md` | 07-01 | 771 | 진행 중 |
| `docs/qa/testcase_test-studio_deployed_v1.md` | 07-01 | 784 | 완료 |
| `docs/features/registry/poc_testplan.md` | 07-13 | 126 | — (Header 양식 미준수) |
| `docs/features/test-studio/test-studio_v4.md` | 07-01 | 70 | 진행 중 (미착수) |

| | |
|---|---|
| **근거** | 7/01~7/13 작성 후 한 달 이상 미커밋. `qa_v14.md`는 "확정", `testcase_..._deployed_v1.md`는 "완료" 상태인데도 git에 존재하지 않는다 |
| **결정** | 5건 모두 이번에 커밋 |
| **비고** | `poc_testplan.md`는 CLAUDE.md Header 양식(변경 유형/작성일/버전/상태) 미준수 — 커밋 시 보강 |

### P-7. `.mcp.json` — 추적 해제

| | |
|---|---|
| **사실 확인** | `.gitignore`에 `mcp` 언급이 **0건**이고, `.mcp.json`은 `673476c`에서 커밋된 **tracked 파일**이다. "올리지 않기로 한" 결정이 실제 설정에 반영된 적이 없다 |
| **현재 변경** | Playwright MCP의 Node v18 `URL.canParse` 오류 회피를 위해 `npx`를 `/Users/yeongmi/.nvm/versions/node/v20.20.2/bin/npx` 절대경로로 고정 + `PATH` env 추가 |
| **문제** | 패치 버전(`v20.20.2`)까지 박혀 있어 nvm 업데이트 시 본인 머신에서도 깨진다. 타 머신·CI에서는 즉시 깨진다 |
| **결정** | 로컬 전용으로 확정 — `.gitignore`에 `.mcp.json` 추가 + `git rm --cached .mcp.json` |
| **효과** | 기억하던 "올리지 않는다"는 결정이 비로소 설정에 반영된다. 이후 로컬 수정이 `git status`를 오염시키지 않는다 |

### P-8. `docs/ops/archive/` 삭제

```
platform-wip-20260812.patch             165KB
platform-wip-untracked-20260812.tar.gz  9.5KB
miridih-bizhows-seed-6a34885-20260812.patch  3.2KB
deleted-remote-branches-20260812.txt    3.9KB
```

| | |
|---|---|
| **근거** | 전부 Part 1의 일회성 구조 작업물이다. platform WIP는 Part 1 감사에서 *"develop에 훨씬 진화된 형태로 이미 존재 — 추월당함"*으로 판정됐다. **이미 불필요하다고 결론난 코드의 patch를 165KB 바이너리로 영구 보관 중** |
| **결정** | 일회성 파일이므로 `archive/` 디렉토리째 삭제 |
| **비고** | 브랜치 삭제·seed 폐기 판정은 Part 1에 기록으로 남으므로, patch 실물이 없어도 이력은 유실되지 않는다 |

### P-9. Stash 9개 전량 삭제

| # | 기반 브랜치 | 규모 |
|---|------------|------|
| 0 | `feature/registry-segment-multi-root` | +45 / −973 |
| 1, 2 | `dev/feature/resume` | +844/−283, +997/−273 |
| 3 | `feature/registry` | +109 / −70 |
| 4 | `feature/test-studio` | +4 / **−2450** |
| 5, 6, 8 | `develop` | +906/−298, +613/−132, +215/−294 |
| 7 | `feature/my-senior` | +373 / −144 |

| | |
|---|---|
| **근거** | 기반 브랜치가 대부분 삭제됐다(`dev/*`는 폐기된 worktree 네이밍). `pop`해도 베이스가 없어 충돌만 난다. 지금까지 한 번도 pop하지 않았다는 것 자체가 불필요하다는 증거 |
| **결정** | 전량 drop |

### P-10. `frontend/public/resume/` PDF 삭제

| | |
|---|---|
| **이력** | `7a384b3`에서 PDF 2건 추가 → `5aeaf2a`에서 삭제. 현재 로컬 파일은 untracked 상태로 재생성돼 있음 |
| **현상** | tracked인 `index.html`/`intro.html`이 여전히 PDF를 참조 → `frontend/public/`이 빌드 시 `dist/`로 복사돼 S3 배포되므로 **배포본 다운로드 링크가 404** |
| **결정** | 구직용으로 만든 기능이고 앞으로 쓰지 않으므로 삭제 |
| **처리** | ① untracked PDF 2건 삭제 (git 영향 없음) → ② `index.html`/`intro.html`의 PDF 다운로드 링크 제거 또는 페이지 자체 폐기 → ③ `scripts/generate-resume-pdf.mjs` 삭제 |
| **주의** | ②는 배포 중인 페이지를 변경한다. ①과 분리해 진행 |

## 2.4 건드리지 않는 것

| 대상 | 이유 |
|------|------|
| **`docs/` 구조 전체** | **설계 문서다. 이동·재배치 금지.** `ops_v*.md` 상호 참조가 19개 파일 64건 존재하고, 이 레포는 이미 rename 후 링크 갱신 누락 전례(`ac786b9` → `ops.md` 11건 파손)가 있다. P-3~P-5의 개별 파일 삭제는 예외이며, **구조 개편은 하지 않는다** |
| **gitignored 파일 일체** | §2.1 참조. 빌드 산출물·로컬 캐시·로컬 편의 스크립트는 정리 대상 아님 |
| `docs/qa/portfolio/` | gitignored 개인 노트. `user_feedback.md`는 TC 방법론 누적 기록소로 유지 필요 |
| `agent-worker/` | `profiles: ["worker"]` opt-in 서비스. registry_v20 에이전트 워커로 현역 |
| `scripts/notion/` | `notion-sync.yml`·`changelog.yml`이 사용하는 현역 스크립트 |
| `docs/qa/test_data/` 입력문서 2번 누락 | `README.md`에 1/3/4 용도가 명시된 의도된 구성 |

## 2.5 실행 순서

각 단계를 **별도 커밋**으로 분리한다.

| 순서 | 항목 | 상태 |
|------|------|------|
| 0 | **P-0** `origin/develop` 복구 | ✅ 완료 (재발 방지 설정은 미적용) |
| 1 | **P-1** v34 → Part 1 통합 + 삭제 + 참조 7건 갱신 | ✅ **본 PR** |
| 2 | **P-6** 미커밋 문서 5건 커밋 | ✅ **본 PR** (`poc_testplan.md` Header 보강 포함) |
| 3 | **P-2 ①** 메모리 파일 홈 복원 | 순서를 틀리면 소실 — 다음 PR의 첫 단계 |
| 4 | P-3, P-4, P-5 파일 삭제 | 전부 develop에 published → `git rm` |
| 5 | P-2 ②③, P-7, P-1b `.gitignore` 정비 | `.claude/projects/`, `.mcp.json`, `docker-compose.override.yml` |
| 6 | P-8 `archive/` 삭제 | |
| 7 | P-9 stash 9건 drop | git 이력 무관 |
| 8 | **P-10 resume** | ①만 먼저. ②③은 배포 영향이 있어 별도 판단 |

> 본 PR은 **1·2번만** 담는다. 3번 이후는 삭제 위주라 성격이 달라 다음 PR로 분리한다.

## 2.6 후속 과제 (본 작업 범위 밖)

| # | 항목 | 근거 |
|---|------|------|
| F1 | **마스터 문서 일괄 갱신 계획 수립** | `docs/ops/ops.md`가 최종 수정 04-20에서 멈춤 — 타임라인이 v22에서 끊기고, 링크 22건 중 11건이 `ac786b9` rename 이후 파손(`[v1.md](v1.md)` → 실제는 `ops_v1.md`). 다른 마스터 문서도 유사 상태로 추정되어 **별도 계획으로 진행** |
| F2 | `agent-worker/package-lock.json` 커밋 검토 | Dockerfile이 `package.json`만 COPY 후 `npm install --omit=dev` → 빌드 비재현. `@anthropic-ai/sdk: ^0.27.3`이 caret 범위 |
| F3 | `knowledge-base_v8.md` 실행 여부 판단 | Part 1에서 회수한 268줄 계획서, 상태 "진행 중". **저작권 리스크 대응**이라 방치 시 실 리스크 |
| F4 | hotfix 백포트 자동화 | `git-strategy.md` 4.2의 2차 대응, 미구현 |

---

## 3. 버전 히스토리

| 버전 | 날짜 | 상태 | 요약 |
|------|------|------|------|
| v35 | 2026-08-18 | Part 1 완료 / Part 2 예정 | Worktree 전면 폐기(v34 통합) + 레포 정리 10건 결정. `wt.sh`→`dev.sh`, 브랜치 30→2, 디스크 4.14GB 회수 |
| ~~v34~~ | 2026-08-12 | v35로 통합됨 | Worktree 폐기 및 브랜치 위생 복구 → 본 문서 Part 1 |
