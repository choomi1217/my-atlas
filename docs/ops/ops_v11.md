> 변경 유형: 환경 개선  
> 작성일: 2026-04-10  
> 버전: v11  
> 상태: 진행 중

---

# Worktree 개발 환경 개선 (문서 가시성 + DB 독립 분리)

## 1. 문제

### 현상

각 worktree의 Claude가 구현 계획서, 버전 문서를 **자기 worktree 내부의 `docs/`**에 작성한다. 이 문서들은 해당 feature 브랜치에만 존재하며, PR 머지 전까지 **develop 브랜치의 `docs/`에는 나타나지 않는다.**

유저가 Cursor IDE를 열면 develop 브랜치의 `docs/`를 보게 되는데, 진행 중인 작업의 계획서나 버전 문서가 보이지 않아 **프로젝트 전체 진행 상황을 파악할 수 없다.**

### 재현 경로

```
1. Cursor IDE에서 develop 브랜치 열기
2. docs/features/ 또는 docs/ops/ 확인
3. worktree에서 작성 중인 v*.md 파일이 보이지 않음
4. 각 worktree 디렉토리를 직접 탐색해야 확인 가능
```

### 현재 구조 (문제)

```
/Users/yeongmi/dev/qa/my-atlas/          ← Cursor IDE (develop)
└── docs/                                 ← 유저가 보는 유일한 docs
    ├── features/
    │   ├── knowledge-base/               ← 머지된 문서만 존재
    │   ├── feature-registry/
    │   └── senior/
    └── ops/

.claude/worktrees/
├── knowledge-base/docs/features/kb/      ← KB Claude가 여기에 작성
├── registry/docs/features/registry/      ← Registry Claude가 여기에 작성
├── my-senior/docs/features/senior/       ← Senior Claude가 여기에 작성
└── ops-env/docs/ops/                     ← Ops Claude가 여기에 작성
```

### 근본 원인

1. **Git worktree의 파일 격리**: worktree는 브랜치별 독립 파일 시스템이므로 worktree에서 생성한 파일은 해당 브랜치에만 존재
2. **CLAUDE.md 규칙의 맹점**: "버전 문서를 `docs/`에 작성하라"는 규칙이 worktree 환경을 고려하지 않음 — Claude는 자기 작업 디렉토리의 `docs/`에 쓸 수밖에 없음
3. **문서 확인 동선 단절**: 유저는 Cursor IDE(develop)에서 전체 현황을 파악하려 하지만, 진행 중 문서는 각 worktree에 분산됨

### 영향

| 영향 | 설명 |
|------|------|
| 진행 상황 파악 불가 | 유저가 현재 진행 중인 작업의 계획서/문서를 즉시 확인할 수 없음 |
| 문서 중복 위험 | 머지 시 충돌하거나, 같은 내용을 다른 worktree에서 중복 작성할 수 있음 |
| 리뷰 지연 | PR 생성 후에야 문서를 확인할 수 있어 사전 검토 불가 |
| 컨텍스트 손실 | worktree 삭제 시 머지되지 않은 문서가 유실될 수 있음 |

## 2. 해결 방향

### 선택: CLAUDE.md 규칙 변경 (B안)

양방향 문서 흐름이 필요하므로 Hook 자동 동기화(A안)는 복잡도가 과하다.
CLAUDE.md에 **메인 레포 절대경로 규칙**을 추가하여, 모든 worktree Claude가 자연스럽게 따르도록 한다.

### 양방향 흐름

```
[유저] develop의 docs/에 요구사항 md 작성
         │
         ▼ (worktree Claude가 메인 레포 절대경로로 읽기)
[Worktree Claude] 메인 레포 절대경로에 계획/버전 md 작성
         │        (Cursor에서 즉시 확인 가능)
         │
         ▼ (PR용)
[Worktree Claude] 자기 worktree docs/에도 동일 파일 작성
                  (feature 브랜치 커밋 → PR에 포함)
```

### 핵심 원칙

1. **읽기**: `docs/**` 파일을 읽을 때는 항상 **메인 레포 절대경로** 사용
2. **쓰기**: 메인 레포 절대경로에 먼저 작성 → 자기 worktree에도 동일 작성
3. **메인 레포 경로**: `/Users/yeongmi/dev/qa/my-atlas/docs/`
4. **메인 레포 untracked 파일**: 유저가 Cursor에서 확인 후 필요 시 정리 (gitignore 불필요 — PR 머지 시 정상 도착)

### 검토한 대안

| 방안 | 장점 | 기각 사유 |
|------|------|-----------|
| A. PostToolUse Hook | 완전 자동 | 양방향 시 hook 2개 + 충돌 처리 + 무한 루프 방지 필요 → 과도한 복잡도 |
| C. 수동 Sync 스크립트 | 명시적 제어 | 실시간이 아님, 유저가 실행을 잊을 수 있음 |

## 2-2. DB 독립 분리

### 문제

현재 DB가 `docker-compose.yml`에 backend/frontend와 함께 묶여 있어, `docker compose down` 시 DB도 같이 내려간다. worktree에서 작업하려면 항상 메인 레포의 compose를 먼저 올려야 하고, 메인 레포 compose를 내리면 모든 worktree backend가 DB 접속에 실패한다.

```
현재 구조 (문제):
docker-compose.yml
├── db         ← backend/frontend와 라이프사이클이 묶여 있음
├── backend
└── frontend

docker compose down → DB도 내려감 → 모든 worktree backend 접속 실패
```

### 해결: DB 전용 docker-compose 분리

DB를 `docker-compose.db.yml`로 분리하여 **항상 실행 상태**를 유지한다. backend/frontend는 DB가 이미 떠있다고 가정하고 독립적으로 올리고 내린다.

```
변경 후 구조:
docker-compose.db.yml       ← DB 전용 (항상 실행, 거의 안 내림)
├── db (pgvector:pg15, 포트 5432)
└── pgdata 볼륨

docker-compose.yml          ← App 전용 (자유롭게 올림/내림)
├── backend  (db 컨테이너에 접속)
└── frontend
```

### 변경 후 운영 흐름

```
[최초 1회 또는 재부팅 후]
$ docker compose -f docker-compose.db.yml up -d    ← DB 올리기

[메인 레포 개발]
$ docker compose up -d                              ← backend + frontend만
$ docker compose down                               ← DB는 그대로 유지

[worktree 개발]
$ cd .claude/worktrees/knowledge-base
$ docker compose up -d                              ← backend만 (DB는 이미 떠있음)

[DB를 내려야 할 때 (드물게)]
$ docker compose -f docker-compose.db.yml down      ← DB 종료
⚠️ docker compose -f docker-compose.db.yml down -v  ← 절대 금지 (볼륨 삭제)
```

### 핵심 변경 사항

| 파일 | 변경 |
|------|------|
| `docker-compose.db.yml` | 신규 — DB 서비스 + pgdata 볼륨만 포함 |
| `docker-compose.yml` | db 서비스 제거, backend의 `depends_on: db` 제거, DB 접속을 `host.docker.internal` 또는 컨테이너 네트워크로 변경 |
| worktree `docker-compose.override.yml` | 변경 없음 (이미 `host.docker.internal:5432` 사용) |
| `scripts/setup-worktree.sh` | DB 관련 로직 제거 (worktree에서 DB를 띄우지 않으므로) |
| CLAUDE.md | Docker 운영 규칙 업데이트 |

### 검토한 대안

| 방안 | 장점 | 기각 사유 |
|------|------|-----------|
| B. standalone `docker run` | compose 없이 단순 | 설정이 코드화되지 않음, 재현성 떨어짐 |
| C. Docker Compose profiles | 단일 파일 유지 | `docker compose down`이 profile 무시하고 전체 종료할 수 있음, 직관적이지 않음 |

---

## 2-3. Worktree 빌드 자동화 스크립트 (`wt.sh`)

### 문제

개발 완료 후 각 worktree에 들어가서 매번 수동으로 빌드 명령을 실행해야 한다.

```bash
cd .claude/worktrees/knowledge-base
docker compose up -d
cd backend && ./gradlew clean build
cd ../frontend && npm install && npm run build
```

6개 worktree에 대해 반복하면 시간과 노력이 크게 소모된다.

### 해결: `wt.sh` 스크립트

프로젝트 루트에서 한 줄 명령으로 worktree의 전체 빌드 파이프라인을 실행한다.

```bash
# 특정 worktree 전체 빌드
./scripts/wt.sh clean-up knowledge-base

# 전체 worktree 일괄 빌드
./scripts/wt.sh clean-up --all
```

### `clean-up` 실행 순서

```
1. docker compose up -d          ← 컨테이너 기동 (DB가 떠있는지 먼저 확인)
2. cd backend && ./gradlew clean build   ← 백엔드 빌드 + 테스트
3. cd frontend && npm install            ← 프론트엔드 의존성 설치
4. cd frontend && npm run build          ← 프론트엔드 빌드
5. docker compose down                   ← 컨테이너 종료
```

### 출력 형식

```
🔧 [knowledge-base] clean-up 시작
  ✅ docker compose up
  ✅ backend build (179 tests passed)
  ✅ frontend npm install
  ✅ frontend build
  ✅ docker compose down
🎉 [knowledge-base] clean-up 완료

🔧 [registry] clean-up 시작
  ...
```

---

## 3. 구현 계획

### Step 1. CLAUDE.md에 Worktree 문서 규칙 추가

"버전 문서화 규칙" 섹션 하단에 **"Worktree 환경에서의 문서 작성 규칙"** 서브섹션을 추가한다.

**추가할 규칙:**

```markdown
### Worktree 환경에서의 문서 작성 규칙

Worktree에서 작업할 때, `docs/**` 파일의 읽기/쓰기는 반드시 **메인 레포 경로**를 우선 사용한다.

**메인 레포 docs 경로:** `/Users/yeongmi/dev/qa/my-atlas/docs/`

#### 읽기
- `docs/**` 파일을 읽을 때는 메인 레포 절대경로를 사용한다
- 예: `/Users/yeongmi/dev/qa/my-atlas/docs/ops/v11.md`
- 유저가 develop 브랜치에서 작성한 요구사항을 확인할 수 있다

#### 쓰기 (2곳에 작성)
1. **메인 레포 절대경로**에 먼저 작성 (유저가 Cursor에서 즉시 확인 가능)
2. **자기 worktree의 `docs/`**에도 동일 파일 작성 (PR 커밋용)

예시 (ops-env worktree에서 v11.md 작성 시):
1. `/Users/yeongmi/dev/qa/my-atlas/docs/ops/v11.md` ← 메인 레포 (유저 확인용)
2. `docs/ops/v11.md` ← worktree 내부 (git 커밋용)

#### 규칙
- ❌ worktree의 `docs/`에만 작성하지 않는다 (유저가 못 봄)
- ❌ 메인 레포에만 작성하지 않는다 (PR에 포함 안됨)
- ✅ 반드시 양쪽 모두에 작성한다
- ✅ 메인 명세서(Master) 업데이트도 양쪽 모두 반영한다
```

### Step 2. 기존 worktree별 CLAUDE.md에도 동일 규칙 반영

각 worktree의 CLAUDE.md는 메인 레포의 CLAUDE.md를 그대로 사용하므로, 메인 레포 CLAUDE.md만 수정하면 모든 worktree에 자동 반영된다. 단, worktree별 하위 CLAUDE.md(`backend/CLAUDE.md`, `frontend/CLAUDE.md`)에는 별도 추가 불필요.

### Step 3. docker-compose.db.yml 생성

DB 전용 compose 파일을 프로젝트 루트에 생성한다.

```yaml
# docker-compose.db.yml — DB 전용 (항상 실행)
version: "3.9"

services:
  db:
    image: pgvector/pgvector:pg15
    container_name: myqaweb-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-myqaweb}
      POSTGRES_USER: ${POSTGRES_USER:-myqaweb}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-admin}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-myqaweb}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
    name: my-atlas_pgdata
```

### Step 4. docker-compose.yml에서 db 서비스 제거

메인 레포의 `docker-compose.yml`에서 db 서비스를 제거하고, backend가 호스트의 DB 컨테이너에 접속하도록 변경한다.

### Step 5. worktree override 및 setup-worktree.sh 정리

worktree의 override 파일과 setup 스크립트에서 DB 관련 불필요한 로직을 제거한다.

### Step 6. v11.md 양쪽 반영 (검증)

이 문서(v11.md)를 메인 레포와 ops-env worktree 양쪽에 작성하여 새 규칙의 첫 적용 사례로 검증한다.

### Step 7. ops.md 메인 명세서 버전 히스토리 업데이트

메인 레포와 worktree 양쪽의 `docs/ops/ops.md` 버전 히스토리 테이블에 v11 항목을 추가한다.

### Step 8. CLAUDE.md Docker 운영 규칙 업데이트

CLAUDE.md의 "Worktree Docker 운영 규칙" 섹션을 DB 분리 구조에 맞게 업데이트한다.

## Steps

- [x] Step 1: CLAUDE.md에 Worktree 문서 규칙 추가
- [x] Step 2: worktree CLAUDE.md 자동 반영 확인 (메인 레포 CLAUDE.md에도 동일 규칙 추가)
- [x] Step 3: docker-compose.db.yml 생성
- [x] Step 4: docker-compose.yml에서 db 서비스 제거
- [x] Step 5: worktree override 및 setup-worktree.sh 정리
- [x] Step 6: v11.md 양쪽 반영 (검증)
- [x] Step 7: ops.md 버전 히스토리 업데이트
- [x] Step 8: CLAUDE.md Docker 운영 규칙 업데이트
- [x] Step 9: scripts/wt.sh 생성
- [x] Step 10: wt.sh 검증 (help 출력 확인, 6개 worktree 인식)
