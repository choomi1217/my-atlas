# Ops v33 — Claude Code GitHub Actions 도입 및 자동 리뷰 트리거 제어

> 변경 유형: 환경 개선  
> 작성일: 2026-08-11  
> 버전: v33  
> 상태: 진행 중

---

## 1. 배경

`/install-github-app`으로 Claude Code GitHub Actions 워크플로 2종이 추가되었고, PR #140을 통해 **main에만** 머지되었다 (2026-08-11 04:30 UTC).

| 워크플로 | 역할 | 트리거 |
|---|---|---|
| `claude.yml` | `@claude` 멘션 시 응답 (수동 질의응답/리뷰) | `issue_comment`, `issues`, `pull_request_review`, `pull_request_review_comment` |
| `claude-code-review.yml` | PR 자동 코드 리뷰 | `pull_request` |

두 워크플로는 **워크플로 파일을 읽어오는 브랜치가 서로 다르다.**

- `issue_comment` / `issues` 계열 → GitHub이 **default branch(main)** 에서만 워크플로를 읽는다. PR의 base가 develop이어도 무관하므로 `claude.yml`은 main 머지만으로 이미 동작한다.
- `pull_request` → **PR merge ref(base + head)** 에서 읽는다. base(develop)·head 어디에도 파일이 없으면 트리거 자체가 걸리지 않는다.

> **실증:** PR #140의 "Claude Code Review" run이 `04:30:04Z`에 성공했는데, main 머지는 `04:30:37Z`였다. head 브랜치에만 파일이 있는 상태에서 실행된 것으로, `pull_request`가 default branch가 아닌 merge ref를 참조함을 확인했다.

따라서 develop을 base로 하는 `feature/*` PR에 자동 리뷰를 적용하려면 **develop에도 반영이 필요**하다.

## 2. 문제 — 기본 템플릿의 트리거가 과도함

설치된 기본 템플릿은 필터가 전부 주석 처리된 상태였다.

| 이슈 | 내용 |
|---|---|
| `synchronize` 포함 | PR에 push할 때마다 **PR diff 전체**를 재리뷰 (증분 리뷰 개념 없음) |
| author/branch 필터 없음 | changelog 봇 PR, forward-merge PR, 릴리스 PR까지 전부 리뷰 대상 |
| draft 필터 없음 | WIP PR도 리뷰 |
| 동시성 제어 없음 | 연속 push 시 리뷰 run이 중첩 |

### 비용 실측 (PR #139 기준)

| 항목 | 값 |
|---|---|
| 변경 파일 | 58개 |
| 라인 | +3,886 / -29 |
| 커밋 | 11개 |
| diff 원본 | 219 KB / 4,577줄 |

diff 원본만 약 55~65k 토큰이며, `/code-review` 플러그인이 주변 파일 컨텍스트를 추가로 읽으므로 1회 실행은 150k~300k 토큰 규모로 추정된다.

**중요:** 이 워크플로는 `CLAUDE_CODE_OAUTH_TOKEN`(구독 기반)을 사용한다. API 종량과금이 아니라 **로컬 Claude Code 세션과 동일한 구독 사용량 풀**을 소모하므로, 자동 리뷰가 빈번하면 로컬 작업 중 rate limit에 걸릴 수 있다.

실제로 PR #139에는 2026-08-11 하루에만 push가 3회(02:48, 03:09, 03:13) 있었고, 기본 설정이었다면 219KB diff를 3회 리뷰했을 것이다.

## 3. 변경 내용

### 3.1 forward merge (main → develop)

`claude.yml`, `claude-code-review.yml`을 develop으로 반영한다.  
CHANGELOG.md는 develop 쪽(v2026.08.06 포함)이 최신이므로 develop 버전이 보존된다.

### 3.2 `claude-code-review.yml` 트리거 제어

```yaml
on:
  pull_request:
    types: [opened, ready_for_review, reopened]   # synchronize 제거

concurrency:
  group: claude-review-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  claude-review:
    if: >
      startsWith(github.head_ref, 'feature/') &&
      github.event.pull_request.draft == false
```

| 항목 | 효과 |
|---|---|
| `synchronize` 제거 | PR당 리뷰 1회로 수렴. 갱신본 리뷰는 `@claude 리뷰해줘` 코멘트로 수동 호출 (`claude.yml`이 처리) |
| `concurrency` + `cancel-in-progress` | 연속 이벤트 시 이전 run 취소, 마지막 것만 완주 |
| `startsWith(github.head_ref, 'feature/')` | `feature/*` PR만 리뷰. changelog 봇 PR(`chore/changelog-*`), forward-merge PR(`chore/*`), 릴리스 PR(develop→main) 자동 제외 |
| `draft == false` | WIP PR 제외. draft 해제 시 `ready_for_review`로 리뷰 |

> `on.pull_request.branches`는 **base** 브랜치 기준이라 head 브랜치 필터로 쓸 수 없고, `paths`는 파일 경로용이다. head 브랜치 필터는 job-level `if` + `github.head_ref`로만 구현 가능하다.

## 4. 적용 범위 / 알려진 제약

- **`bugfix/*`, `hotfix/*` PR은 자동 리뷰 대상이 아니다.** 필요 시 `if` 조건에 `|| startsWith(github.head_ref, 'bugfix/')`를 추가한다.
- **PR #139는 이 변경 후에도 자동 리뷰가 붙지 않는다.** `opened` 시점이 워크플로 도입 이전이고 `synchronize`를 제거했기 때문. `@claude` 멘션으로 수동 리뷰를 요청한다.
- 레포가 public이므로 코멘트 트리거 워크플로는 외부 사용자도 시도 가능하다. `claude-code-action`이 write 권한 보유자만 응답하도록 actor를 검증한다.

## 5. 검증

| 항목 | 결과 |
|---|---|
| YAML 파싱 | ✅ `yaml.safe_load` 통과 |
| 트리거 | ✅ `{'pull_request': {'types': ['opened', 'ready_for_review', 'reopened']}}` |
| concurrency | ✅ `claude-review-pr-${{ ... }}`, `cancel-in-progress: true` |
| job `if` | ✅ `startsWith(github.head_ref, 'feature/') && github.event.pull_request.draft == false` |
| forward merge 충돌 | ✅ 없음 (워크플로 2개 신규 추가, CHANGELOG는 develop 유지) |

실동작 검증은 머지 후 첫 `feature/*` PR 생성 시점에 확인한다.

## 6. 버전 히스토리

| 버전 | 날짜 | 내용 |
|---|---|---|
| v33 | 2026-08-11 | Claude Code Actions develop 반영 + 자동 리뷰 트리거 제어 (synchronize 제거, feature/* 한정, concurrency, draft 제외) |
| v32 | - | Spring Boot 4.0 + Spring AI 2.0 GA 마이그레이션 |
