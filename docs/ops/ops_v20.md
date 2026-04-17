> 변경 유형: 버그 수정  
> 작성일: 2026-04-17  
> 버전: v20  
> 상태: 진행 중

---

# Jira 티켓 발행 500 에러 수정 + CI 경로 필터 추가

## 버그

### Jira 티켓 발행시 에러
- 재현경로
    1. LNB > Product Test Suite 버튼 클릭
    2. TossPlace 클릭
    3. 토스 포스 Card Version 클릭
    4. Phase 클릭 후, 랜덤 TC Fail 처리
    5. Jira 티켓 발행
- Actual Result
    - Jira 연결을 확인하세요: Request failed with status code 500
    - 위와 같은 에러가 나고 티켓이 발행되지 않습니다.
- Expacted Result
    - Jira 티켓 발행에 성공해야합니다.

## 개선사항
- md 파일과 같은 문서만 업로드해서 PR을 날려도 전체 CI가 돕니다.

---

## 1. 원인 분석

### 1-1. Jira 티켓 발행 500 에러

**근본 원인:** EC2 프로덕션 `.env`에 Jira 환경변수가 누락되어 있었다.

```bash
# EC2에서 확인
[ec2-user@ip-10-0-1-77 my-atlas]$ grep JIRA .env
# → 출력 없음 (변수 자체가 없음)

[ec2-user@ip-10-0-1-77 my-atlas]$ docker exec myqaweb-backend env | grep JIRA
JIRA_EMAIL=
JIRA_API_KEY=
JIRA_BASE_URL=
# → docker-compose.yml에서 매핑은 되어 있지만, .env에 값이 없어 빈 문자열로 주입
```

`docker-compose.yml`에는 `JIRA_BASE_URL: ${JIRA_BASE_URL}` 매핑이 있지만, EC2의 `.env`에 해당 변수가 없어 빈 문자열이 주입되었다. `JiraServiceImpl.isConfigured()`가 `StringUtils.hasText()`로 체크하므로 false를 반환하고, `TicketServiceImpl`에서 `IllegalStateException`이 발생한다. 이 예외가 `GlobalExceptionHandler`의 일반 `Exception` 핸들러에서 500으로 변환되었다.

**발생 경위:** Jira 연동은 로컬 개발 환경에서 구현·테스트 후 배포되었으나, EC2 `.env`에 Jira 변수를 추가하는 작업이 누락되었다. 로컬 `.env`에만 값이 존재했기 때문에 로컬에서는 정상 동작했다.

### 1-2. 문서 전용 PR에서 전체 CI 실행

**근본 원인:** `e2e.yml`에 `paths` 필터가 없다.

```yaml
# .github/workflows/e2e.yml:3-8
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]    # ← paths 필터 없음 → 모든 파일 변경에 트리거
```

**비교:**
| 워크플로우 | paths 필터 | docs/** 변경 시 |
|-----------|-----------|----------------|
| `backend-ci.yml` | ✅ `backend/**` | 트리거 안됨 |
| `frontend-ci.yml` | ✅ `frontend/**` | 트리거 안됨 |
| `e2e.yml` | ❌ 없음 | **트리거됨** (E2E + 배포까지 실행) |

---

## 2. 구현 계획

### Step 1: EC2 프로덕션 `.env`에 Jira 환경변수 추가 (User 직접)

EC2의 `.env`에 Jira 관련 환경변수 3개를 추가하고 백엔드를 재시작한다.

```bash
# EC2에서 실행
cd /home/ec2-user/my-atlas
vi .env
# 아래 3줄 추가:
# JIRA_BASE_URL=https://my-atlas.atlassian.net
# JIRA_EMAIL=whdudal1217@gmail.com
# JIRA_API_KEY=<로컬 .env와 동일한 값>

docker compose up -d --build backend
```

### Step 2: Jira 티켓 발행 검증

운영 환경(`youngmi.works`)에서 재현 경로 그대로 실행하여 티켓 생성 확인.

### Step 3: e2e.yml에 paths 필터 추가

**변경 파일:** `.github/workflows/e2e.yml`

```yaml
# Before
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# After
on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'qa/**'
      - 'docker-compose*.yml'
      - '.github/workflows/e2e.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'qa/**'
      - 'docker-compose*.yml'
      - '.github/workflows/e2e.yml'
  workflow_dispatch:
```

`docs/**`, `scripts/**`, `CLAUDE.md`, `README.md` 등 문서 변경은 CI를 트리거하지 않는다.
`workflow_dispatch`는 유지하여 수동 실행은 항상 가능하도록 한다.

### Step 4: CI 경로 필터 검증

| 항목 | 검증 방법 |
|------|-----------|
| CI 경로 필터 | docs/** 파일만 변경한 PR 생성 → e2e.yml 트리거 안됨 확인 |
| CI 정상 트리거 | backend/** 변경 PR → e2e.yml 정상 트리거 확인 |

### Step 5: 문서 업데이트

- [ ] ops_v20.md 최종 요약 작성
- [ ] ops.md 버전 히스토리에 v20 추가

---

## 3. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| EC2 `.env` | Jira 환경변수 3개 추가 (User 직접) |
| `.github/workflows/e2e.yml` | push/pull_request에 paths 필터 추가 |

---

## Steps

- [x] Step 1: EC2 프로덕션 `.env`에 Jira 환경변수 추가
- [x] Step 2: Jira 티켓 발행 검증
- [x] Step 3: e2e.yml에 paths 필터 추가
- [ ] Step 4: CI 경로 필터 검증
- [ ] Step 5: 문서 업데이트
