# ops v34 — Worktree 폐기 및 브랜치 위생 복구

> 변경 유형: 환경 개선  
> 작성일: 2026-08-12  
> 버전: v34  
> 상태: 진행 중

---

## 1. 배경 — 왜 지금 뜯어고치는가

`.claude/worktrees/` 기반 "도메인별 영구 worktree" 모델이 실질적으로 붕괴한 상태다.
12개 worktree 중 실제로 살아있는 건 2개뿐이고, 나머지는 3~4개월간 방치되며 미머지 커밋과
미커밋 작업물을 쌓아두고 있다.

### 1.1 근본 원인 — CLAUDE.md 안의 모순된 두 모델

```
"worktree는 기능 도메인별 영구 작업 공간 (일회성이 아님)"   ← 영구 브랜치를 전제
"모든 작업 → feature/* from develop, PR 머지 후 삭제"        ← 일회성 브랜치를 전제
```

영구 작업 공간과 일회성 브랜치는 양립할 수 없다. 이 둘을 억지로 붙이려고 나온 것이
`wt.sh sync`의 `git reset --hard origin/develop`이다 — 브랜치 이름은 유지한 채 내용만 갈아끼운다.
그 결과 `feature/knowledge-base` 브랜치의 이름과 내용이 아무 관계 없어졌다.

### 1.2 자기잠금 루프 (self-locking loop)

```
공용파일 "양쪽 작성" 규칙 (docs/**, scripts/**, CLAUDE.md, .claude/agents/**)
   ↓ 수동 이중작성이 번거로움
심링크로 우회 (CLAUDE.md ×4, .claude/agents/)
   ↓ git이 typechange(T) + deleted(D)로 인식
worktree가 영구 dirty 상태
   ↓ wt.sh sync_one()의 dirty 체크에서 abort
sync 영원히 불가 → worktree rot → 유령 커밋 누적
```

`wt.sh sync`가 재생성하는 심링크가 다음번 `wt.sh sync`를 막는다.
`ops-env`가 정확히 이 상태다 (`T CLAUDE.md`, `D .claude/agents/*.md ×4`, `?? .claude/agents`).

### 1.3 실측 증거 (2026-08-12 기준)

| 항목 | 실측 |
|---|---|
| worktree 12개 중 살아있는 것 | **2개** — registry(behind 3), test-studio(behind 24) |
| 방치된 worktree | behind 40~89, 마지막 커밋 2026-04-21 ~ 04-29 |
| dirty로 sync 불가 | platform(34), words-convention(11), knowledge-base(10), ops-env(9), resume-ui(9) |
| 로컬 브랜치 30개 중 머지 완료 | **18개** (미삭제). remote 35개 |
| 브랜치 세대 관리 실패 | `feature/platform` / `platform-v9` / `platform-v11` 공존, registry 계열 4개 |
| 디스크 | `.claude/worktrees/` **4.1GB** — 툴 설정 디렉토리 안에 소스 복사본 12벌 |

---

## 2. 결정 사항

| # | 결정 | 근거 |
|---|---|---|
| D1 | **Worktree 전면 폐기** — 단일 레포 + `git switch` 브랜치 전환 | 4.1GB 회수, rot 구조 자체가 소멸. `node_modules/`·`build/`는 gitignore라 브랜치 전환 시에도 유지되므로 재빌드 비용 거의 없음 |
| D2 | **main + develop 2단 구조 유지** | 프로드 배포 게이트를 브랜치로 분리하는 현 구조 유지. `git-strategy.md` Section 2 머지 전략은 **그대로 존치** |
| D3 | **공용파일 "양쪽 작성" 규칙 폐기** | D1의 자동 귀결. worktree가 없으면 이중작성 대상 자체가 없음 |
| D4 | **심링크 전면 제거** | D1로 자동 소멸. 자기잠금 루프의 물리적 원인 |
| D5 | **`wt.sh` 폐기 → `dev.sh`로 축소** | sync/clean-up/fresh-up 중 worktree 전제를 제거하고 스택 up/down/rebuild만 남김 |
| D6 | **병렬 작업은 harness 임시 worktree로 대체** | Claude Code의 `isolation: "worktree"`는 작업 후 자동 정리되므로 rot 불가능 |

> **D2 보충**: `git-strategy.md`는 4/27에 머지 전략(forward-merge/release는 merge commit, 단발성은 squash)을
> 이미 정확히 명문화했다. 이번 작업은 그 문서의 Section 3·4 중 **worktree를 ✅로 평가한 항목만** 정정한다.

---

## 3. 삭제 전 감사 대상 (Step 0에서 판정)

worktree를 지우기 전에 반드시 처리해야 할 항목. **판정 없이 삭제 금지.**

### 3.1 미머지 커밋 감사 결과 (2026-08-12 완료 ✅)

`git cherry`가 미반영(`+`)으로 표시한 3건을 **소스 실물 대조**로 재검증한 결과:

| 브랜치 | 커밋 | 내용 | 실물 대조 결과 |
|---|---|---|---|
| `hotfix/image-urls-and-platform-v9` | `4db4bbd` (04-22) | TestCase 이미지 URL + `/api/settings/public` 500 방어 | ✅ **main·develop 양쪽 완전 반영** |
| `hotfix/image-urls-and-platform-v9` | `6b42b9b` (04-23) | Demo mode write 엔드포인트 익명 허용 (whitelist 제거) | ✅ **main·develop 양쪽 완전 반영** |
| `feature/miridih-bizhows-seed` | `6a34885` (04-27) | `V202604271500__seed_miridih_bizhows_root.sql` (Flyway seed) | ❌ **develop에 실제로 없음** — 유일한 미반영 |

**대조 항목별 검증** (main / develop 모두 동일):

| 조각 | 결과 |
|---|---|
| `TestCaseImageUrlResolver.java` | ✅ 글자 단위 동일 |
| `toImageUrl()` 적용 (`TestCaseController` ×3, `TestCaseServiceImpl` ×2) | ✅ |
| `resolveLoginRequiredSafely()` (필터 500 방어) | ✅ |
| `SettingsController.getPublicSettings` try/catch 폴백 | ✅ |
| whitelist 제거 + `shouldNotFilter()` | ✅ |

> ⚠️ **`git cherry` false negative 주의** — patch-id는 커밋 **전체 diff**의 해시다.
> squash 머지 시 원본 커밋이 docs·테스트 등 다른 파일과 뭉쳐지면 patch-id가 달라져
> 이미 반영된 커밋도 `+`(미반영)로 표시된다. **`git cherry` 결과만으로 유실을 판정하지 말고
> 반드시 소스 실물을 대조할 것.** 이번 건에서 2/3이 false positive였다.

> 나머지 3건(`hotfix/docker-compose-aws-env`, `hotfix/ci-deploy-scripts`, `release/resume-polish`)은
> `git cherry` 판정 결과 develop에 **patch-equivalent로 이미 반영됨**(`-`). 안전하게 삭제 가능.

**결론**: 프로드 유실 없음. 브랜치 폐기를 막는 유일한 항목은 `6a34885` (miridih seed) 하나.

### 3.2 미커밋 작업물

| worktree | 내용 | 판정 |
|---|---|---|
| `registry` | `AgentExecutionServiceImpl.java`(1줄), `.mcp.json`, `agent-worker/package-lock.json` | **살아있는 작업** — 메인 레포로 이전 |
| `platform` | 소스/테스트 28파일 (monitoring, KB 파이프라인, HttpRequestUtils) | **추월당함** — develop에 monitoring 기능이 훨씬 진화된 형태로 이미 존재. patch 아카이브 후 폐기 |
| `knowledge-base` | `docs/features/knowledge-base/knowledge-base_v8.md` (untracked) | 문서 회수 |
| `my-senior` | `docs/features/senior/my-senior_v8.md` (untracked) | 문서 회수 |
| `test-studio` | `.claude/agents` 심링크 잔재 | 폐기 |
| 나머지 | 심링크/설정 잔재, `test-results/` | 폐기 |

---

## 4. 실행 Step

> 각 Step은 User 승인 후 진행한다. 완료 시 이 문서에 ✅ 표기.

### Step 0 — 감사 및 회수 (삭제 전 필수)

- [x] 0-1. ✅ **완료** — `hotfix/image-urls-and-platform-v9` 2커밋 실물 대조 결과 main·develop 양쪽 완전 반영 확인.
      → 백포트 불필요. **브랜치 폐기 가능** (Section 3.1 참조)
- [x] 0-2. ✅ **완료 (User 판정: 아카이브 후 삭제)** — `6a34885` seed 마이그레이션
      - 실물 확인 결과: `V202604271500__seed_miridih_bizhows_root.sql`이 develop에 **없음** (다른 이름으로도 없음)
        → 이번 감사에서 **유일하게 실제 미반영으로 확인된 커밋**
      - 내용: Company `Miridih`(is_active=false) + Product `Bizhows` + Root Segment `Bizhows`
      - 처리: `git format-patch`로 아카이브 → `docs/ops/archive/miridih-bizhows-seed-6a34885-20260812.patch`
        (`git am`으로 복원 가능) 후 로컬·원격 브랜치 삭제
- [x] 0-3. ✅ **완료** — `registry` worktree 미커밋 3파일 판정
      - `.mcp.json` → 메인 레포에 **동일한 변경이 이미 존재** (Playwright MCP Node v20 고정). 이전 불필요
      - `AgentExecutionServiceImpl.java` → 실제 변경은 **들여쓰기 1줄 오염**뿐. 작업물 아님, 폐기
      - `agent-worker/package-lock.json` → Dockerfile이 `package.json`만 COPY 후 `npm install --omit=dev`.
        빌드에 미사용인 로컬 산물이라 회수 불필요 (단, 재현성 관점의 lockfile 커밋은 별도 과제 → Section 7)
- [x] 0-4. ✅ **완료** — `platform` worktree 작업물 아카이브
      - tracked diff (28파일, 3341줄) → `docs/ops/archive/platform-wip-20260812.patch`
      - untracked 소스 6파일 → `docs/ops/archive/platform-wip-untracked-20260812.tar.gz`
      - 판정: develop에 monitoring 기능이 이미 더 진화된 형태로 존재 → **추월당한 WIP**. 아카이브 후 폐기
- [x] 0-5. ✅ **완료** — 미회수 문서 2건 메인 레포로 회수
      - `docs/features/knowledge-base/knowledge-base_v8.md` (268줄) — **저작권 리스크 대응 계획, 상태: 진행 중**
      - `docs/features/senior/my-senior_v8.md` (18줄) — 채팅 기반 TC 피드백 요구사항 초안
- [x] 0-6. ✅ **완료** — worktree `.env` 키 대조: 전용 키는 `BACKEND_PORT`/`FRONTEND_PORT`/`COMPOSE_CONTAINER_PREFIX`
      3개뿐(포트 격리용)이라 폐기와 함께 무의미. **유실되는 설정 없음**

### Step 1 — Worktree 해체

- [x] 1-1. ✅ **완료** — `registry` 스택 3개 + `test-studio` 잔여 컨테이너 down. `myqaweb-db`는 무손상 유지
      - ⚠️ 발견: `agent-worker`는 `profiles: ["worker"]`라 기본 `down`에서 제외됨.
        `docker compose --profile worker down` 필요 (미지정 시 컨테이너가 남아 네트워크를 점유)
- [x] 1-2. ✅ **완료** — `git worktree remove --force` ×13 (내부 12 + `my-atlas-miridih-seed` 1) 전부 성공
- [x] 1-3. ✅ **완료** — `.claude/worktrees/` 제거 → **4.14GB 회수** (4.1GB + miridih 36MB)
- [x] 1-4. ✅ **완료** — `git worktree prune` + `.gitignore`의 `.claude/worktrees/` 라인 제거
- [x] 1-5. ✅ **검증** — `git worktree list` 결과 메인 레포 1개만 잔존. 브랜치·커밋 전부 보존 확인
      (`feature/miridih-bizhows-seed` = 6a34885 도달 가능)

> ⚠️ `docker compose down -v` 금지 — DB 볼륨 보존 (CLAUDE.md Critical Rules).
> 실제로 `docker-compose.yml`에는 db 서비스도 volumes 선언도 없어 `down`이 DB에 영향을 주지 않음을 사전 확인함.

### Step 2 — 브랜치 정리

- [x] 2-1. ✅ **완료** — develop에 머지 완료된 로컬 브랜치 **18개 삭제**
      - 11개는 `-d`로 삭제. 7개는 *"merged to HEAD인데 upstream `origin/X`에는 미머지"* 사유로 거부됨
        → `wt.sh sync`의 `reset --hard` 흔적(로컬만 develop으로 리셋, 원격은 옛 작업물에 정지).
        `git merge-base --is-ancestor`로 develop 포함을 재확인 후 `-D` 처리
- [x] 2-2. ✅ **완료** — 미머지 브랜치 10개 중 **9개 삭제, 1개 보존**
      - 삭제 전 SHA 전량 기록 (reflog 외 복구 대비)
      - `feature/platform`(42커밋) / `feature/platform-v9` → **내용 실물 대조로 develop 반영 확인** 후 삭제
        (`V202604210900__add_login_required_and_ip_rate_limit.sql`, `AiRateLimitFilter.java`, `isLoginRequired` 전부 존재)
      - **보존**: `feature/miridih-bizhows-seed` (0-2 판정 대기)
      - 결과: 로컬 브랜치 **30개 → 3개** (`develop`, `main`, `feature/miridih-bizhows-seed`)
- [x] 2-3. ✅ **완료** — 원격 브랜치 **33개 전량 삭제** (원격 35개 → `develop`, `main` 2개)
      - 16개: ancestry로 develop/main 포함 확인
      - 17개: `git cherry` 상 `+`였으나 **대표 산출물 실물 대조**로 develop 반영 확정
        (`KbContentCleanupService`, `SlackNotificationService`, `sync-db-to-aws-v23.sh`,
        `generate-resume-pdf.mjs`, `docker-compose.db.yml`, `platform_v10.md`, `AiRateLimitFilter` 등)
      - 안전장치: 열린 PR 0건 확인(삭제 시 PR 자동 close 방지) +
        전 브랜치 SHA·복구 명령 기록 → `docs/ops/archive/deleted-remote-branches-20260812.txt`
      - 검증: `origin/develop` = 1256e40 불변, main↔develop divergence(1/2) 세션 시작 시점과 동일
- [x] 2-4. ✅ **완료** — GitHub `delete_branch_on_merge = true` 활성화 (false → true)
      - `allow_squash_merge` / `allow_merge_commit` 둘 다 유지 확인
        (git-strategy.md Section 2의 "forward-merge/release는 merge commit, 단발성은 squash" 정책 유효)

### Step 3 — 규칙·스크립트 정리

- [x] 3-1. ✅ **완료** — `CLAUDE.md` "Worktree Git 생명주기" → **"로컬 개발 워크플로우"**로 교체
- [x] 3-2. ✅ **완료** — `CLAUDE.md` "Worktree 환경에서의 파일 작성 규칙" 섹션 삭제 (**54줄 제거**, D3)
- [x] 3-3. ✅ **완료** — 브랜치 규칙 명문화: 세대 접미사(`-v9`,`-v11`) 금지, 작업 단위 1브랜치, 머지 후 삭제
      - 추가: **`git cherry`로 유실 판정 금지** 경고 (Section 3.1의 false-negative 교훈)
- [x] 3-4. ✅ **완료** — `scripts/wt.sh`(400줄) 삭제 → `scripts/dev.sh`(신규) 로 대체
      - `up` / `fresh` / `down` / `status` 4개 명령만. sync·심링크·worktree resolve 전부 제거
      - `down`은 `--profile worker` 포함, `-v` 미사용(DB 볼륨 보존)
      - `bash -n` 문법 검증 + `status` 실행 검증 완료
- [x] 3-5. ✅ **완료** — `docs/ops/git-strategy.md` 정정
      - Section 3: worktree ✅ 평가 2행 제거 + 정정 사유 명기
      - Section 4.3 (worktree squash residue): 당시 처방이 **실패했음**을 기록하고 현행 패턴으로 교체
      - Section 4.5 (심링크 merge 불가): **해소됨** 표기 + 자기잠금 루프 원인 설명 추가
      - Section 7 참고: `wt.sh` → `dev.sh`, ops_v34 링크 추가
- [x] 3-6. ✅ **확인** — Agent-D 명령은 메인 레포 절대경로만 사용하므로 수정 불필요.
      `.claude/agents/**` 및 `.github/**`에도 worktree 참조 없음
- [x] 3-7. ✅ **완료** — 잔여 worktree 스크립트 처리
      - `scripts/setup-worktree.sh` (tracked, 포트 슬롯 할당) → 삭제
      - `scripts/sync-db-to-aws-v23.sh` → `BACKUP_DIR`이 삭제된 worktree 경로를 가리키던 **실질 breakage** 수정
      - `backend/CLAUDE.md` `ddl-auto` 근거 문구에서 worktree 전제 제거
- [x] 3-8. ✅ **완료** — `CLAUDE.md` Docker 운영 규칙에서 worktree 기동 순서 제거 +
      `agent-worker` 프로파일 주의사항 추가 (1-1에서 실제로 걸린 함정)

### Step 4 — 병렬 작업 대체 수단 확립

- [x] 4-1. ✅ **완료** — harness `isolation: "worktree"` 사용을 CLAUDE.md에 명문화 (자동 정리 → rot 불가)
- [x] 4-2. ✅ **완료** — 수동 worktree 예외 규칙 추가: **레포 바깥에 생성 + 종료 즉시 remove**, 상주 금지

### Step 5 — 재발 방지 점검

- [ ] 5-1. `wt.sh` 참조가 남은 **과거 기록 문서**(`registry_v18.md`, `ops_v13.md` 등)는 **존치**
      — 당시 시점의 사실이므로 수정하지 않는다. 현행 규칙 문서만 정정 완료(3-5, 3-7)
- [x] 5-2. ✅ **검증 완료** — `git worktree list` 1개, 로컬 브랜치 3개
- [ ] 5-3. 미추적 로컬 스크립트 정리 (User 판단) — gitignore 대상이라 레포 영향 없음
      - `scripts/start-all.sh`, `scripts/stop-all.sh` — 삭제된 `.claude/worktrees` 순회 (조건문 덕에 무해하게 no-op)
      - `scripts/prompts/*.txt` — worktree 경로 기반 프롬프트 5개, 현재 무효

---

## 5. 폐기 판단의 트레이드오프

worktree 폐기로 잃는 것과 대안:

| 잃는 것 | 대안 |
|---|---|
| 도메인별 동시 docker 스택 | 단일 스택. 실제로 동시 사용된 건 registry/test-studio 2개뿐이었음 |
| 병렬 Claude 세션 | harness `isolation: "worktree"` — 자동 정리되므로 rot 불가 (D6) |
| 브랜치별 빌드 캐시 | `node_modules/`·`build/`·`.gradle/`은 gitignore 대상이라 브랜치 전환 시 유지됨. 실질 손실 미미 |

| 얻는 것 |
|---|
| 4.1GB 디스크 회수 |
| 자기잠금 루프 소멸 (심링크 → dirty → sync 불가) |
| 공용파일 이중작성 규칙 소멸 (CLAUDE.md 약 40줄 감소) |
| 브랜치 이름과 내용의 일치 회복 |

---

## 6. 실행 결과 (2026-08-12)

| 지표 | Before | After |
|---|---|---|
| worktree | 13개 (내부 12 + 외부 1) | **1개** (메인 레포만) |
| 디스크 | 4.14GB (worktree 사본) | **0** — 전량 회수 |
| 로컬 브랜치 | 30개 | **2개** (`develop`, `main`) |
| 원격 브랜치 | 35개 | **2개** (`origin/develop`, `origin/main`) |
| 머지 후 브랜치 삭제 | 수동 (방치됨) | **자동** (`delete_branch_on_merge`) |
| CLAUDE.md worktree 규칙 | 2개 섹션 (약 90줄) | 삭제 → 로컬 워크플로우 섹션으로 교체 |
| `wt.sh` | 400줄 (sync/심링크/resolve) | `dev.sh` — 스택 관리만 |
| 심링크 (CLAUDE.md ×4, `.claude/agents`) | worktree마다 상주 → 영구 dirty | **소멸** |
| 유실 작업물 | 미확인 | **0** — 감사 후 전량 회수 또는 아카이브 |

**자기잠금 루프 해소**: 공용파일 이중작성 규칙 → 심링크 → 영구 dirty → sync abort → rot.
D3(규칙 폐기)로 체인의 첫 고리를 끊었고, worktree 폐기로 나머지가 함께 소멸했다.

---

## 7. 후속 과제 (본 작업 범위 밖)

| # | 항목 | 근거 |
|---|---|---|
| F1 | `agent-worker/package-lock.json` 커밋 검토 | Dockerfile이 `npm install --omit=dev` + `package.json`만 COPY → 빌드 비재현. `@anthropic-ai/sdk: ^0.27.3`이 caret 범위라 시점에 따라 다른 버전이 설치됨 |
| F2 | `knowledge-base_v8.md` 실행 여부 판단 | 회수한 268줄 계획서, 상태 "진행 중". **저작권 리스크 대응**이라 방치 시 실 리스크 |
| F3 | hotfix 백포트 자동화 (`ops_v29.md` Section A) | git-strategy 4.2의 2차 대응, 미구현 상태로 대기 중 |

---

## 8. 버전 히스토리

| 버전 | 날짜 | 변경 |
|---|---|---|
| v34 | 2026-08-12 | Worktree 폐기 및 브랜치 위생 복구 — Step 0~5 실행 (2-3/2-4는 User 승인 대기) |
