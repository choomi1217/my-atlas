# Ops v26 — Deploy 파이프라인 버그 수정 (Backend 실-배포 + Frontend /images/features 라우팅)

> 변경 유형: 환경 개선
> 작성일: 2026-04-23
> 버전: v26
> 상태: 완료 (PR 대기)

---

## 배경

Ops v25 (hotfix #108) 머지 직후 main push 로 `e2e.yml` 실행 → run 24818251884 에서 모든 job **SUCCESS** 로 보고됐음에도 프로드가 갱신되지 않음. 두 개의 서로 다른 파이프라인 버그가 동시에 드러남.

---

## Bug 1 — deploy-backend: EC2 컨테이너가 재생성되지 않음

### 증상

run 24818251884 의 `Deploy Backend to EC2` job 은 exit 0 (success) 으로 종료. 그러나 프로드 `GET /api/settings/public` 은 여전히 403 (v8 동작), `POST /api/companies` anonymous 도 403 (demo mode 미적용). 즉 **hotfix 코드가 프로드에 존재하지 않음**.

### 로그 결정적 단서

```
#13 [builder 8/9] COPY src src                           CACHED
#12 [builder 9/9] RUN ./gradlew bootJar -x test          CACHED
...
Container myqaweb-backend Running    ← 기존 컨테이너 그대로
```

Docker buildx 가 src 레이어를 CACHED 처리. Buildx 의 `COPY` 캐시 키는 대상 디렉터리 **content hash** 로 계산되므로, src 내용이 이전 빌드와 동일해야 CACHED 가 찍힌다. 곧 **EC2 작업 트리의 `src/` 내용이 hotfix 이전과 동일**.

### 근본 원인

기존 스크립트:
```bash
cd /home/ec2-user/my-atlas
git pull origin main
docker compose up -d --build backend
```

3 가지 결함:

1. **`set -e` 부재** — `git pull` 이 실패(merge conflict, dirty working tree, diverged) 해도 exit code 가 무시되고 다음 라인 실행. 따라서 "pull 실패 → 코드 안 바뀜 → build 는 캐시 hit → 컨테이너 재생성 안 함" 이 조용히 성공으로 보고됨.
2. **`git pull`** — 이미 업스트림과 동기화 돼 있거나, 로컬 작업 트리가 diverge 되면 no-op. 둘 다 silent.
3. **`docker compose up -d --build` (without `--force-recreate`)** — 이미지 digest 가 변하지 않으면 기존 컨테이너를 그대로 둔다. 빌드 캐시가 hit 하면 digest 가 그대로라 재생성 스킵.

### 수정

```bash
set -euo pipefail

cd /home/ec2-user/my-atlas

git fetch origin main
git merge --ff-only origin/main   # diverged 면 여기서 exit 1

DEPLOYED_SHA=$(git rev-parse HEAD)
echo "Deploying commit: $DEPLOYED_SHA"

docker compose up -d --build --force-recreate backend
```

- `set -euo pipefail`: 어떤 단계에서 실패해도 즉시 exit — silent failure 제거.
- `git fetch + merge --ff-only`: fast-forward 불가면 실패. EC2 에 수동 편집이 남았다면 CI 에서 바로 감지.
- `DEPLOYED_SHA` 로그: 어떤 commit 이 배포됐는지 runner 로그에 명시.
- `--force-recreate`: 이미지 digest 불변이어도 컨테이너 강제 재생성. 캐시 hit 시에도 최신 코드로 기동 보장.

`git reset --hard` 는 일부러 **사용하지 않음** — destructive 고, EC2 에 의도된 local 변경이 있을 수도 있으니 CI 가 조용히 덮어쓰지 않도록 `--ff-only` 로 실패시켜 사람이 조사하도록.

---

## Bug 2 — deploy-frontend: `/images/features/*.png` 가 CloudFront 에서 404

### 증상

Frontend 의 Feature 상세 페이지 스크린샷 (`senior_01_faq_list.png` 등 27 장) 이 프로드에서 엑박.

```bash
$ curl -I https://youngmi.works/images/features/senior_01_faq_list.png
HTTP/2 200
content-type: text/html          ← 이미지가 아닌 HTML
content-length: 575              ← 여러 이미지 경로가 모두 동일 575 bytes
etag: "cb8e2ba0637e9c3acb0ccf73ea4908d4"   ← 동일 etag
```

CloudFront 의 SPA fallback (404 → index.html, 200) 이 동작 중 = 원본 S3 에 파일이 없음.

### 근본 원인

Ops v17/v18 에서 S3/CloudFront 전환 당시 설정된 CloudFront 라우팅:

```
/*         → S3 my-atlas-frontend (기본 origin)
/images/*  → S3 my-atlas-images (OAC, 백엔드 업로드용)
```

Platform v6 에서 Feature 상세 페이지 추가 시 `frontend/public/images/features/*.png` 경로로 정적 에셋 커밋. 빌드 결과는 `frontend/dist/images/features/...` 로 출력.

`deploy-frontend` 는 `aws s3 sync frontend/dist/ s3://my-atlas-frontend/ --delete` 만 수행 → `my-atlas-frontend/images/features/*.png` 에 업로드. 하지만 **사용자 요청 `/images/features/senior_01_faq_list.png` 는 CloudFront 의 `/images/*` 행동 매처에 걸려 `my-atlas-images` 버킷으로 라우팅**. 그 버킷에는 `images/convention/`, `images/feature/` (단수), `images/kb/` 만 있고 `images/features/` (복수) 는 없음 → S3 404 → CloudFront 의 SPA 에러 응답 설정이 index.html 반환.

### 수정

`deploy-frontend` 에 두 번째 sync step 추가:

```yaml
- name: Sync feature-detail static images to images bucket
  run: |
    if [ -d frontend/dist/images/features ]; then
      aws s3 sync frontend/dist/images/features/ s3://my-atlas-images/images/features/ \
        --cache-control 'public,max-age=3600'
    else
      echo "No frontend/dist/images/features/ — skipping images-bucket sync"
    fi
```

- 동일 파일을 **my-atlas-images 버킷에도 업로드**해서 CloudFront 의 `/images/*` 라우팅이 file 을 찾을 수 있게 함.
- `if [ -d ... ]` 가드로 빌드 결과에 해당 디렉터리가 없을 때 (예: 이후 경로를 바꾸면) step 이 실패하지 않도록.
- 기존 `my-atlas-frontend` sync 는 그대로 유지 — 이 버킷에 있어도 해가 없고, 나중에 CloudFront 라우팅을 재설계하면 한쪽만 쓰게 정리하면 됨.
- CloudFront invalidation `/*` 은 두 origin 모두 커버.

---

## 이 hotfix 의 배포 방법 (self-hosting)

본 PR 머지 시 main push 이벤트가 새 workflow (수정된 deploy-backend + deploy-frontend) 를 트리거 → 자동으로 프로드 복구.

만약 이 PR 자체 배포가 실패하면 fallback 으로 User 수동 SSH:

```bash
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
cd /home/ec2-user/my-atlas
git fetch origin main
git merge --ff-only origin/main
docker compose up -d --build --force-recreate backend
curl -s http://localhost:8080/api/settings/public
```

---

## 검증 (PR 머지 후)

```bash
# 1) Backend 새 코드 동작
curl -i https://api.youngmi.works/api/settings/public
# 기대: 200 + {"success":true,"data":{"loginRequired": true}}

curl -X POST https://api.youngmi.works/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"prod-smoke"}' -w "\nHTTP: %{http_code}\n"
# 기대: 403 (현재 loginRequired=true, 로그인 필요)
# 만약 DB 에 login_required row 가 없는 상태면 403 로 잘못 보여도 OK — Flyway 로 seed 된 후 정상

# 2) Frontend feature 이미지
curl -I https://youngmi.works/images/features/senior_01_faq_list.png
# 기대: 200 OK, content-type: image/png (text/html 이면 다시 실패)

# 3) Flyway 확인 (ops_v25 Step A 미수행이었다면 이제 적용됨)
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
  "SELECT version FROM flyway_schema_history WHERE version='202604210900';"
# 기대: 1 row with success=t

# 4) Deploy 로그에서 DEPLOYED_SHA 확인 (runner 로그)
# "Deploying commit: 6a95034..." 같이 hotfix SHA 가 찍혀야 함
```

---

## 후속

- 장기적으로 frontend static `/images/features/` 를 `/static/features/` 같은 비충돌 경로로 이동 검토 (두 버킷에 중복 업로드 없애기).
- deploy-backend 에 `--force-recreate` 를 항상 쓰면 매 배포마다 다운타임 ~30-60s 발생. 현재 스케일에선 수용 가능하나 이후 blue-green 이나 zero-downtime 스키마 검토.
- Actuator `/info` 에 git commit id 노출하면 CI 가 배포 후 `curl /actuator/info` 로 실 배포 버전 검증 가능.
