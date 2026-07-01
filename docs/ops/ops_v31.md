> 변경 유형: 환경 개선  
> 작성일: 2026-06-30  
> 버전: v31  
> 상태: 진행 중 (Notion 적용 완료 / GitHub Actions 셋업 대기)

---

# ops_v31 — Notion ↔ GitHub 자동화 (PR→Done 동기화 + Changelog/Release)

## 개요

진척 관리 도구를 Jira로 옮기지 않고 **기존 Notion + GitHub Actions 위에 자동화를 얹는다.** 목적은 새 프로세스 추가가 아니라 **수동 트래킹 제거**다.

도입 항목 4가지:
1. PRD & History DB에 **완료일(date)** 속성 추가 — weekly 통계의 전제
2. **Sprints** 데이터베이스 + relation — Jira식 Sprint 개념
3. **PR merge → Notion Status 자동 Done** (GitHub Action)
4. **Changelog / GitHub Release 자동 생성** (develop→main, GitHub Action)

---

## 1. 적용 완료 — Notion (MCP로 즉시 반영됨)

| 변경 | 위치 | 비고 |
|------|------|------|
| `완료일` (date) 속성 추가 | PRD & History DB (`895107b2-70e8-826b-b403-073e0df84d78`) | PR 자동 Done 시 머지일 기록 |
| `Sprints` DB 생성 | MyAtlas 페이지 하위 (`cf9e52de-2128-4584-8a6b-6022585bcb5f`) | Name, 시작일, 종료일, 상태(예정/진행중/완료), 목표 |
| `Sprint` relation 속성 | PRD DB ↔ Sprints DB | 양방향(`Sprint` / `Items`) |
| 예시 `Sprint 1` | Sprints DB | 2026-06-29 ~ 07-12, 진행중 — 자유롭게 수정/삭제 |

> 과거 항목 완료일 백필은 별건이다. 정밀할 필요 없음 → 마일스톤만 git 날짜로 정확히, 나머지는 Notion 마지막 편집일 근사. 신규 항목은 Done 전환 시 그날 입력(여기가 핵심).

---

## 2. 추가된 파일 — GitHub (코드 완료, 셋업 후 동작)

```
.github/
├── workflows/
│   ├── notion-sync.yml      # PR(→develop) merge → Notion Done
│   └── changelog.yml        # push(main) → Changelog + Release
└── pull_request_template.md # "Notion:" 링크 자리 포함
scripts/notion/
├── update-notion-status.mjs   # PR 본문 파싱 → Notion 페이지 PATCH
├── generate-changelog.mjs     # [type] 커밋 수집 → 릴리스 노트
└── parse-notion-ref.test.mjs  # 파서 단위 테스트 (node --test)
```

### 2-1. notion-sync.yml — PR merge → Done
- 트리거: `pull_request: closed` + base `develop` + `merged == true`
- 동작: PR 본문의 `Notion: <url>`에서 페이지 ID 추출 → `Status=Done`, `완료일=머지일(YYYY-MM-DD)`로 PATCH
- 링크 없으면 **아무것도 안 함**(no-op). 오작동으로 엉뚱한 행을 바꾸지 않음
- 필요 시크릿: `NOTION_TOKEN`

### 2-2. changelog.yml — develop→main 머지 시 릴리스
- 트리거: `push: main`
- 동작: 마지막 태그 이후 `[type] subject` 커밋 수집 → 타입별 그룹핑 → **GitHub Release**(`vYYYY.MM.DD`) 발행 + **CHANGELOG.md 갱신 PR을 develop에 생성**
- main 직접 커밋 금지 준수: 파일은 PR로만 반영
- 첫 실행은 태그가 없어 전체 히스토리를 모음(정상), 이후 증분
- 필요 권한: `contents: write`, `pull-requests: write`, repo 설정 "Allow GitHub Actions to create and approve pull requests"

---

## 3. PR 본문 규칙 (자동 Done의 핵심)

PR 설명에 한 줄:
```
Notion: https://www.notion.so/<항목-URL>
```
- PR 템플릿에 자리를 만들어 둠 → 항목 URL만 붙여넣으면 됨
- 여러 항목이면 여러 줄
- 비우면 자동 Done 없이 그냥 머지(안전)

---

## 4. 셋업 체크리스트 (사용자 작업 — 이게 있어야 라이브 동작)

1. **Notion integration 생성**: notion.so/my-integrations → New integration → Internal → 이름(예: `my-atlas-ci`) → **Internal Integration Secret 복사**
2. **DB 공유**: PRD & History DB와 Sprints DB 각각 우상단 `⋯` → **Connections** → 위 integration 연결
3. **GitHub Secret 등록**: repo → Settings → Secrets and variables → Actions → New repository secret → `NOTION_TOKEN` = (복사한 secret)
4. **Actions PR 권한**: repo → Settings → Actions → General → Workflow permissions → **"Allow GitHub Actions to create and approve pull requests"** 체크 (changelog PR용)
5. **PR 작성 시** 본문 `Notion:` 줄에 항목 URL 입력

---

## 5. 로컬 검증 결과 (2026-06-30, Node 22)

| 검증 | 결과 |
|------|------|
| 파서 단위 테스트 (`node --test`) | ✅ 5/5 pass |
| Notion 갱신 dry-run (링크 있음) | ✅ 페이지 ID 추출 + 정확한 PATCH payload(`Status=Done`, `완료일`) |
| Notion 갱신 dry-run (링크 없음) | ✅ no-op |
| Changelog 생성 (실제 git 히스토리) | ✅ `[feat]/[fix]/[docs]/[chore]` 정확 그룹핑 |
| Notion 스키마 write (완료일/Sprints/relation) | ✅ MCP로 실제 적용·확인 |

---

## 6. 직접 검증 못 한 부분 + 검증 방법

라이브 GitHub 이벤트는 PR merge 권한·repo Secrets·실 이벤트 트리거가 필요해 **E2E로 직접 확인하지 못했다**(코드 + 로컬 로직만 검증).

- **NOTION_TOKEN 빠른 확인** (본인 토큰, 가급적 임시 테스트 행으로):
  ```bash
  NOTION_TOKEN=<secret> MERGED_AT=2026-06-30T00:00:00Z \
  PR_BODY='Notion: <테스트_항목_URL>' \
  node scripts/notion/update-notion-status.mjs
  ```
  → 항목이 Done + 완료일로 바뀌면 OK
- **파이프라인 확인**: 다음 feature→develop PR 본문에 Notion 링크 넣고 머지 → Actions 로그 + Notion 확인
- **Release 확인**: 다음 develop→main 머지 후 Releases 탭 + develop의 CHANGELOG PR 확인

---

## 7. 한계 / 리스크 / 결정 기록

- 자동 Done은 **PR 본문 링크에 의존** — 링크 누락 시 자동화 안 됨(대신 오작동도 없음, 안전 측 실패)
- `peter-evans/create-pull-request@v6` 외부 액션 사용 — repo의 Actions PR 허용 설정 필요. 버전 업 가능
- `NOTION_TOKEN`은 워크스페이스 쓰기 권한 → **Secret로만** 관리(코드/로그 노출 금지)
- 별도 Sprints DB(정석)는 1인 프로젝트엔 다소 무겁다 — 사용자 선택. 운영하며 과하면 select 단일 속성으로 축소 가능
- 파서 테스트는 CI 미연결 — 원하면 `node --test scripts/notion/*.test.mjs`를 backend/frontend CI에 한 스텝으로 추가

---

## 8. 적용(머지) 절차

소스 변경이라 worktree/feature 브랜치에서만 작업하고, **push·PR·merge는 규칙상 사용자가 직접** 한다(`main`/`develop` 직접 push 금지, Claude PR merge 금지).

```bash
cd /Users/yeongmi/dev/qa/my-atlas
git checkout develop && git pull origin develop
git checkout -b feature/notion-github-automation
git add .github/workflows/notion-sync.yml .github/workflows/changelog.yml \
        .github/pull_request_template.md scripts/notion/ docs/ops/ops_v31.md
git commit -m "[feat] Notion↔GitHub 자동화 — PR머지 Done 동기화 + Changelog/Release"
git push -u origin feature/notion-github-automation
gh pr create --base develop --title "[feat] Notion↔GitHub 자동화" \
  --body "ops_v31 참고. 완료일/Sprints는 Notion 적용 완료, Actions는 NOTION_TOKEN 등록 후 동작."
```
