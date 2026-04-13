> 변경 유형: 환경 개선  
> 작성일: 2026-04-13  
> 버전: v13  
> 상태: 완료

---

# Worktree Git 워크플로우 표준화

## 1. 배경

7개의 영구 worktree(기능 도메인별 작업 공간)가 각각 다른 git 상태에 빠져 있다.

**발견된 문제:**
- 모든 worktree가 remote push 안 됨 (작업이 로컬에만 존재)
- Open PR 0개 — 완료된 기능도 main에 반영 안 됨
- stale worktree 2개 (my-senior, words-convention) — develop과 11커밋 차이
- PR 머지 후 브랜치 리셋을 안 해서 "ahead 57" 같은 유령 커밋 누적
- develop에 uncommitted docs 산재 (worktree들이 메인 레포에 직접 쓴 파일)
- branch 네이밍 불일치 (registry: 로컬 `feature/registry` vs 리모트 `feature-registry`)

**현재 상태 (2026-04-13 기준):**

| Worktree | Branch | Ahead | Behind develop | Dirty | Push 됨? | 상태 |
|----------|--------|-------|----------------|-------|----------|------|
| knowledge-base | `feature/knowledge-base` | 14 | 0 | YES (45 files) | NO | Active WIP |
| my-senior | `feature/my-senior` | 12 | **11** | minimal | NO | STALE |
| ops-env | `feature/ops-env` | 13 | 2 | 1 untracked | NO | 약간 뒤처짐 |
| platform | `feature/platform` | 16 | 0 | CLEAN | NO | 동기화됨 |
| registry | `feature/registry` | 1 | 0 | CLEAN | NO | PR 가능 |
| words-convention | `feature/words-convention` | 12 | **11** | 2 untracked | NO | STALE |

**근본 원인 ①:** 각 worktree(Claude 세션)가 독립적으로 git을 사용하며, 머지 후 리셋/동기화 절차가 없음.

**근본 원인 ②:** 각 worktree가 `CLAUDE.md`와 `.claude/agents/`를 **독립 복사본**으로 보유.
메인 레포에서 규칙을 업데이트해도 worktree에 자동 반영되지 않아, stale worktree의 Claude가 **구버전 규칙**으로 동작함.

```
# 실제 확인 결과 (2026-04-13)
knowledge-base: CLAUDE.md — 메인과 동일 ✅
my-senior:      CLAUDE.md — 메인과 다름 ❌ (693L vs 668L, 타임스탬프 마이그레이션 규칙 누락)
ops-env:        CLAUDE.md — 메인과 동일 ✅
platform:       CLAUDE.md — 메인과 동일 ✅
registry:       CLAUDE.md — 메인과 동일 ✅
words-convention: CLAUDE.md — 메인과 다름 ❌ (693L vs 668L, 동일하게 구버전)
```

---

## 2. 목표

1. `wt.sh sync` 명령 추가: 동기화를 하나의 명령으로 자동화
2. **심링크(symlink)로 공유 파일 단일화**: CLAUDE.md, `.claude/agents/`를 메인 레포로 심링크 → 규칙 드리프트 원천 차단
3. CLAUDE.md 규칙 추가: Worktree Git 생명주기 명문화
4. Agent-D 빌드 검증 프로세스 개선: 중복 빌드 제거 + `--build` 플래그
5. Claude 세션 시작 시 자동 검증 규칙 추가

---

## 3. 구현 계획

### Step 1: `wt.sh`에 `sync` 명령 추가

기존 `wt.sh`에 `clean-up`, `fresh-up` 외에 **`sync`** 명령을 추가한다.

#### 사용법
```bash
./scripts/wt.sh sync <worktree-name>   # 특정 worktree 동기화
./scripts/wt.sh sync --all             # 전체 worktree 동기화
./scripts/wt.sh sync main             # 메인 프로젝트 develop 최신화
```

#### 로직
1. `git fetch origin` (메인 레포에서)
2. 메인 레포 develop 브랜치 최신화: `git checkout develop && git pull`
3. 대상 worktree 디렉토리로 이동
4. uncommitted 변경 확인 → 있으면 **중단 + 경고** (stash는 유저가 직접)
5. `git reset --hard develop` (worktree 브랜치를 develop HEAD로 리셋)
6. 결과 출력: `✅ feature/xxx → develop (abc1234)`

#### `sync`가 해결하는 문제
- 머지 후 리셋 잊는 문제 → 명령 하나로 자동화
- worktree마다 다른 방법 사용 → 통일
- stale worktree 누적 → `sync --all`로 일괄 최신화

---

### Step 2: 심링크로 공유 파일 단일화

#### 문제
각 worktree가 `CLAUDE.md`와 `.claude/agents/`를 독립 복사본으로 보유하면, 메인 레포에서 규칙을 수정해도 worktree의 Claude 세션은 **구버전 규칙을 읽는다.**

#### 해결: 심링크
worktree의 공유 파일을 메인 레포로 심링크하여 **단일 소스(Single Source of Truth)**를 만든다.

```
# Before (독립 복사본 — 드리프트 발생)
.claude/worktrees/platform/CLAUDE.md          ← develop 체크아웃 시점의 복사본
.claude/worktrees/platform/.claude/agents/    ← develop 체크아웃 시점의 복사본

# After (심링크 — 항상 최신)
.claude/worktrees/platform/CLAUDE.md          → /Users/yeongmi/dev/qa/my-atlas/CLAUDE.md
.claude/worktrees/platform/.claude/agents/    → /Users/yeongmi/dev/qa/my-atlas/.claude/agents/
```

#### 심링크 대상 파일

| 파일 | 이유 |
|------|------|
| `CLAUDE.md` | 모든 Claude 세션이 동일한 프로젝트 규칙을 따라야 함 |
| `.claude/agents/` | 4-Agent Pipeline 정의가 모든 worktree에서 동일해야 함 |
| `backend/CLAUDE.md` | Backend 전용 규칙 동기화 |
| `frontend/CLAUDE.md` | Frontend 전용 규칙 동기화 |
| `qa/CLAUDE.md` | E2E 테스트 규칙 동기화 |

#### `wt.sh sync`에서 심링크를 재생성해야 하는 이유

`git reset --hard develop` 실행 시 git이 파일을 체크아웃하면서 **심링크를 일반 파일로 덮어쓴다.**
따라서 sync의 마지막 단계에서 심링크를 재생성해야 한다.

```bash
# sync 내부 흐름
git reset --hard develop              # ① develop으로 리셋 → 심링크가 일반 파일로 덮어씌워짐
                                       
rm CLAUDE.md                          # ② git이 체크아웃한 일반 파일 삭제
ln -sf "$MAIN_PROJECT/CLAUDE.md" .    # ③ 메인 레포로 심링크 재생성

rm -rf .claude/agents                 # ④ agents 디렉토리도 동일하게
ln -sf "$MAIN_PROJECT/.claude/agents" .claude/agents

# backend/frontend/qa CLAUDE.md도 동일하게 처리
```

---

### Step 3: CLAUDE.md에 Worktree Git 생명주기 규칙 추가

기존 "Worktree 환경에서의 파일 작성 규칙" 섹션 위에 추가:

```markdown
## Worktree Git 생명주기

이 프로젝트의 worktree는 기능 도메인별 **영구 작업 공간**이다 (일회성이 아님).

### 작업 사이클
1. **시작**: `./scripts/wt.sh sync <name>` — develop 최신 상태로 동기화
2. **작업**: 코드 수정, 커밋
3. **PR**: push → PR(→develop) 생성
4. **머지 후**: 반드시 `./scripts/wt.sh sync <name>` 실행 — develop으로 리셋

### 규칙
- ❌ 머지 후 리셋 없이 다음 작업 시작 금지 (유령 커밋 누적)
- ❌ develop에서 3일 이상 뒤처진 상태로 작업 금지
- ✅ 작업 시작 전 반드시 sync
- ✅ Claude 세션 시작 시 자동으로 sync 상태 확인
- ✅ PR 머지 후 즉시 sync

### develop → main
- 기능이 완전히 완료되면 develop → main PR 생성
- main PR은 유저가 직접 판단
```

---

### Step 4: Agent-D 빌드 검증 프로세스 개선

#### 문제
1. `docker compose up -d`는 기존 Docker 이미지를 재사용 → 코드 변경이 반영 안 된 채 E2E 테스트 실행
2. 로컬 `./gradlew clean build`와 Docker 내부 `./gradlew bootJar`가 **중복 빌드** — 하지만 역할이 다름

#### 분석: Dockerfile 내부 빌드 과정

**Backend Dockerfile** (멀티스테이지):
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
RUN ./gradlew bootJar -x test    # ← 빌드는 하지만 테스트는 스킵
```

**Frontend Dockerfile**:
```dockerfile
FROM node:20-alpine
RUN npm install                   # ← npm install 포함
CMD ["npm", "run", "dev"]         # ← dev 서버로 실행
```

`docker compose up -d --build`만으로 빌드+기동이 가능하지만, **Docker 내부에서는 테스트를 스킵**(`-x test`)하므로 로컬 테스트는 여전히 필요하다.

#### 개선: 4 Step → 3 Step 통합

```bash
# Before (4 Step — Step 2가 Step 1과 중복)
Step 1: ./gradlew clean build        # 빌드 + 테스트
Step 2: ./gradlew test               # ← Step 1에서 이미 실행됨 (중복)
Step 3: docker compose up -d         # ← 옛날 이미지로 올림
Step 4: npx playwright test

# After (3 Step — 중복 제거 + --build 추가)
Step 1: ./gradlew clean build        # 컴파일 + 유닛/통합 테스트 (조기 실패 감지)
Step 2: docker compose up -d --build # 최신 코드로 이미지 재빌드 + 컨테이너 기동
Step 3: npx playwright test          # E2E 테스트
```

#### 수정 대상

**`.claude/agents/build-verifier.md`:**
- Step 2 (`./gradlew test`) 제거 — Step 1의 `clean build`에 이미 포함
- Step 3 → Step 2: `docker compose up -d` → `docker compose up -d --build`
- Step 4 → Step 3: E2E 테스트

**`CLAUDE.md`** Agent-D 섹션도 동일하게 3 Step으로 변경.

---

### Step 5: Claude 세션 시작 시 자동 검증

CLAUDE.md에 다음 규칙 추가:

```
Claude가 worktree에서 세션을 시작할 때:
1. git fetch origin && git log --oneline develop..HEAD 로 ahead 확인
2. ahead > 0이면 "이 worktree에 미머지 커밋이 있습니다. sync 먼저 할까요?" 안내
3. git log --oneline HEAD..develop 로 behind 확인
4. behind > 3이면 "develop보다 N커밋 뒤처져 있습니다. sync 권장" 안내
```

---

## 4. 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/wt.sh` | `sync` 명령 추가 (git reset + 심링크 재생성) |
| `CLAUDE.md` | "Worktree Git 생명주기" 섹션 추가 + Agent-D `--build` 플래그 반영 |
| `.claude/agents/build-verifier.md` | Step 3: `docker compose up -d` → `docker compose up -d --build` |

---

## 5. 검증

- [x] `./scripts/wt.sh status` 실행 → 전체 worktree 상태 표시 확인
- [x] `./scripts/wt.sh` (help) 실행 → sync, status 명령 표시 확인
- [ ] `./scripts/wt.sh sync platform` 실행 → feature/platform이 develop HEAD로 리셋 확인
- [ ] knowledge-base는 WIP가 있으므로 sync 시 중단되는지 확인
- [ ] 심링크 확인: `ls -la worktree/CLAUDE.md` → 메인 레포를 가리키는지 확인

---

## Steps

- [x] Step 1: `wt.sh`에 `sync` 명령 추가 (sync, status, sync --all)
- [x] Step 2: 심링크 재생성 로직 (`setup_symlinks` 함수, sync에 포함)
- [x] Step 3: CLAUDE.md에 Worktree Git 생명주기 규칙 추가 + 세션 시작 자동 검증
- [x] Step 4: Agent-D 빌드 검증 4 Step → 3 Step (`--build` 플래그, 중복 제거)
- [x] Step 5: Claude 세션 시작 시 자동 검증 규칙 (CLAUDE.md에 포함)

---

## [최종 요약]

### 변경 파일

| 파일 | 변경 |
|------|------|
| `scripts/wt.sh` | `sync`, `status` 명령 추가 + `setup_symlinks` 함수 (CLAUDE.md × 4, .claude/agents/ 심링크 재생성) |
| `CLAUDE.md` | "Worktree Git 생명주기" 섹션 신규 (작업 사이클, 규칙, 세션 시작 자동 검증) + Agent-D 3 Step 반영 |
| `.claude/agents/build-verifier.md` | 4 Step → 3 Step (Step 2 `./gradlew test` 제거, `docker compose up -d --build` 추가) |

### wt.sh 신규 명령

| 명령 | 기능 |
|------|------|
| `wt.sh sync <name>` | 특정 worktree를 develop HEAD로 동기화 (dirty 시 중단 + 경고) |
| `wt.sh sync --all` | 전체 worktree 일괄 동기화 (dirty worktree는 스킵) |
| `wt.sh sync main` | 메인 프로젝트 develop pull |
| `wt.sh status` | 전체 worktree 동기화 상태 테이블 출력 (branch, ahead, behind, dirty, HEAD) |

### sync 내부 흐름
1. `git fetch origin` (최신 remote 정보)
2. dirty 체크 → uncommitted 변경 있으면 **중단** (강제 리셋 안 함)
3. `git reset --hard origin/develop` (clean 상태에서만)
4. 심링크 재생성 (CLAUDE.md × 4, .claude/agents/)

### Agent-D 개선
```
Before: Step 1(build) → Step 2(test, 중복) → Step 3(docker up) → Step 4(E2E)
After:  Step 1(build+test) → Step 2(docker up --build) → Step 3(E2E)
```
