> 변경 유형: 환경 개선  
> 작성일: 2026-04-08  
> 버전: v7  
> 상태: 완료

---

## 개요

my-atlas는 **Claude Code**를 핵심 개발 도구로 사용한다.
코드 구현, 테스트 작성, 빌드 검증, 문서화까지 Claude가 담당하며,
User는 요구사항 작성, 진행 지시, 코드 리뷰, 머지 승인을 담당한다.

이 문서는 Claude Code 기반 개발 워크플로우 전체를 정리한다.

---

## 1. 4-Agent Pipeline

모든 기능 구현은 4개의 전문 Agent가 순서대로 실행한다.

### Agent 역할

| Agent | 역할 | 모델 | 도구 | 금지 |
|-------|------|------|------|------|
| **Agent-A** | 코드 구현 | Sonnet | Read, Write, Edit, Glob, Grep | 테스트 작성, 빌드 실행 |
| **Agent-B** | 단위/통합 테스트 | - | Read, Write, Edit, Glob, Grep | E2E 테스트, 프로덕션 코드 수정 |
| **Agent-C** | E2E 테스트 (Playwright) | - | Read, Write, Edit, Glob, Grep | 단위 테스트, 프로덕션 코드 수정 |
| **Agent-D** | 빌드 & 테스트 검증 | Haiku | Bash, Read, Glob, Grep | **Write/Edit 비활성** |

### 실행 흐름

```
User 요구사항
    │
    ▼
Agent-A (코드 구현)
    │
    ▼
Agent-B (단위/통합 테스트 작성)
    │
    ▼
Agent-C (E2E 테스트 작성)
    │
    ▼
Agent-D (4-Step 검증)
    ├── Step 1: ./gradlew clean build
    ├── Step 2: ./gradlew test
    ├── Step 3: docker compose up -d
    ├── Step 4: npx playwright test
    └── Teardown: docker compose down (무조건 실행)
    │
    ├── 전부 통과 → 구현 완료
    └── 실패 → 해당 Agent(A/B/C)가 수정 → Agent-D 재실행
```

### 절대 규칙

- Agent-D의 4단계가 모두 통과해야만 "구현 완료"
- E2E 테스트는 선택이 아닌 필수
- Agent-C/D는 User 승인 없이 자동 진행
- `docker compose down`은 성공/실패 무관하게 항상 실행

### Agent 정의 파일

```
.claude/agents/
├── code-implementor.md      # Agent-A
├── unit-test-writer.md      # Agent-B
├── e2e-test-writer.md       # Agent-C
└── build-verifier.md        # Agent-D
```

---

## 2. Git Worktree 전략

### 왜 Worktree를 사용하는가

my-atlas는 4개 기능(Feature Registry, Knowledge Base, My Senior, Ops)을 **병렬 개발**한다.
각 기능의 Claude가 독립된 worktree에서 작업하여 서로의 코드에 간섭하지 않는다.

### 현재 구조

```
my-atlas/                                              # 메인 repo (develop, feature/ops-env)
.claude/worktrees/
  ├── registry/                                         # feature/registry 브랜치
  ├── knowledge-base/                                  # feature/knowledge-base 브랜치
  └── my-senior/                                       # feature/my-senior 브랜치
```

| Worktree | 브랜치 | 담당 |
|----------|--------|------|
| 메인 repo | `develop`, `feature/ops-env` | Ops, 공통 작업 |
| `.claude/worktrees/registry` | `feature/registry` | Feature Registry 기능 |
| `.claude/worktrees/knowledge-base` | `feature/knowledge-base` | Knowledge Base 기능 |
| `.claude/worktrees/my-senior` | `feature/my-senior` | My Senior 기능 |

### Docker 환경 분리 (v6 참조)

각 worktree는 고유한 포트와 컨테이너 이름을 사용하여 Docker 충돌을 방지한다.
`setup-worktree.sh`로 `.env` 심볼릭 링크 + `docker-compose.override.yml`을 자동 생성한다.

---

## 3. 브랜치 동기화 워크플로우

### 기본 흐름

```
feature/* ──→ develop (PR) ──→ main (PR)
```

- `main`은 read-only — direct push 금지
- 모든 작업은 feature branch에서 시작
- PR은 최소 1 code review 필수

### Post-merge 동기화 (자동)

**main에 PR 머지가 완료되면**, Claude가 자동으로 아래 2단계를 실행한다.

**Step 1: develop ↔ main 동기화**
```bash
git fetch origin main
git checkout develop
git merge origin/main --no-edit
git push origin develop
```

**Step 2: 각 worktree에 develop 동기화**
```bash
# 각 worktree 디렉토리에서
git merge develop --no-edit
```

### stash 처리

동기화 시 로컬 변경사항이 있으면:
1. `git stash push -m "설명"` 으로 임시 저장
2. `git merge develop --no-edit` 실행
3. `git stash pop` 으로 복원
4. 충돌 발생 시 해당 브랜치 개발자가 해결

---

## 4. Cross-branch 테스트 실패 처리

### 문제 상황

기능 A가 아직 미완성인데, 기능 B를 main에 머지하고 싶을 때
→ 기능 A의 E2E 테스트가 실패하여 CI가 통과하지 않음

### 해결: `test.fixme()` 패턴

```typescript
// qa/ui/senior.spec.ts
test.fixme('should show FAQ view as default entry', async ({ page }) => {
  // TODO: Senior API 500 에러 수정 후 복원 (feature/my-senior)
  ...
});
```

### 원칙

1. **다른 브랜치의 버그를 내 브랜치에서 고치지 않는다** — 관심사 혼재, 머지 충돌 위험
2. **develop에서 `test.fixme()`로 임시 스킵** — CI 통과 가능
3. **해당 브랜치가 fixme 해제 책임** — Senior 개발 완료 시 `test.fixme()` → `test()` 복원
4. **TODO 주석에 책임 브랜치 명시** — 누가 복원해야 하는지 명확히

---

## 5. Doc-Driven Development

### 흐름

```
User: docs/**에 요구사항 md 작성
  │
  ▼
User: Claude에게 해당 파일 지목, 구현 요청
  │
  ▼
Claude: 파일에 context, 계획, Step 목록 작성
  │
  ▼
User: Step별 진행 지시
  │
  ▼
Claude: 각 Step 완료 시 ✅ 체크 표시
  │
  ▼
Claude: 모든 Step 완료 후 [최종 요약] 작성
```

### 규칙

- Claude가 임의로 Step을 건너뛰지 않는다
- User의 진행 지시 없이 다음 Step으로 넘어가지 않는다
- 각 Step 완료 시 md 파일을 업데이트한다

### 버전 문서화

기능 변경 시 반드시 버전 문서를 작성한다:
- 메인 명세서: `docs/features/{feature-name}/{feature-name}.md` (현재 상태)
- 버전 문서: `docs/features/{feature-name}/{feature-name}_v{N}.md` (변경 이력)
- 기능 추가/개선 → 메이저 버전 (v1 → v2)
- 버그 수정 → 패치 버전 (v1 → v1.1)

---

## 6. .claude/ 디렉토리 구조

```
.claude/
├── agents/                    # 4-Agent Pipeline 정의
│   ├── code-implementor.md    # Agent-A: 코드 구현
│   ├── unit-test-writer.md    # Agent-B: 단위/통합 테스트
│   ├── e2e-test-writer.md     # Agent-C: E2E 테스트
│   └── build-verifier.md      # Agent-D: 빌드 검증
├── settings.json              # 도구 권한, Hook 설정
├── settings.local.json        # 로컬 전용 설정 (Slack webhook 등)
├── worktrees/                 # Git worktree 디렉토리 (3개)
└── projects/                  # 프로젝트별 메모리
    └── -Users-yeongmi-dev-qa-my-atlas/
        └── memory/            # Claude 세션간 기억
            ├── MEMORY.md      # 메모리 인덱스
            ├── feedback_*.md  # 행동 규칙 (User 피드백)
            ├── project_*.md   # 프로젝트 상태
            └── user_*.md      # 사용자 정보
```

### Memory 시스템

Claude는 대화 간에 기억을 유지하기 위해 파일 기반 메모리를 사용한다.

| 유형 | 용도 | 예시 |
|------|------|------|
| feedback | User가 지시한 행동 규칙 | "E2E 스킵 금지", "커밋 전 test 필수" |
| project | 프로젝트 진행 상태 | "ALB 설정 일시 중단" |
| user | 사용자 역할/선호 | 역할, 기술 수준 |
| reference | 외부 리소스 위치 | "버그 트래킹은 Linear" |

---

## 7. CLAUDE.md 역할

프로젝트 루트와 각 서브디렉토리에 `CLAUDE.md`가 있다.
이 파일은 **Claude가 읽는 프로젝트 컨텍스트**로, 사람이 읽는 문서와 구분된다.

| 파일 | 역할 |
|------|------|
| `/CLAUDE.md` | 전체 프로젝트 구조, DB 스키마, API, 인프라, Critical Rules |
| `/backend/CLAUDE.md` | Java/Spring Boot 코딩 컨벤션, 패키지 구조 |
| `/frontend/CLAUDE.md` | React/TypeScript 컨벤션, 컴포넌트 구조 |
| `/qa/CLAUDE.md` | Playwright E2E 테스트 규칙, seed 데이터 보호 |

---

## 요약

| 항목 | 내용 |
|------|------|
| 개발 도구 | Claude Code (4-Agent Pipeline) |
| 병렬 개발 | Git Worktree (기능당 1 worktree) |
| 브랜치 전략 | feature → develop → main (PR 필수) |
| 동기화 | main 머지 후 자동 2단계 (develop ↔ main, worktree ← develop) |
| 테스트 실패 처리 | test.fixme() 패턴 (책임 브랜치 명시) |
| 문서화 | Doc-Driven Development + 버전 문서 |
| Claude 설정 | .claude/ (agents, settings, memory) |
| Claude 컨텍스트 | CLAUDE.md (루트 + backend + frontend + qa) |
