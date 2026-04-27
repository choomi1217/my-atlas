# Ops v27 — EC2 docker-compose.yml local drift 해소 (AWS env 영구 반영)

> 변경 유형: 환경 개선
> 작성일: 2026-04-23
> 버전: v27
> 상태: 완료 (PR 대기)

---

## 배경

Ops v26 (`hotfix/ci-deploy-scripts` merge) 이후 첫 push 배포에서 `git merge --ff-only origin/main` 이 **정상적으로 실패**:

```
error: Your local changes to the following files would be overwritten by merge:
    docker-compose.yml
Please commit your changes or stash them before you merge.
Aborting
Updating 02035dd..18b72fa
```

두 가지 사실이 드러남:

1. **EC2 backend repo 가 02035dd (Platform v8 release, 2026-04-21) 에 멈춰있었음**. 그 이후 모든 main push (`#105`, `#106`, `#107`, `#108`, `#111`) 가 `git pull` 의 silent failure 로 EC2 에는 한 번도 적용 안 됨.
2. **EC2 의 `docker-compose.yml` 에 uncommitted local 변경** 이 있어서 `merge --ff-only` 가 거부됐고, 이전엔 `git pull` 이 동일 사유로 조용히 실패하고 있었음.

EC2 local diff:
```diff
+      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
+      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
+      AWS_REGION: ${AWS_REGION:-ap-northeast-2}
```

이 3 줄은 **의미 있는 수정** — backend 컨테이너에 AWS 자격 증명을 주입해야 `S3ImageService` 가 my-atlas-images 버킷에 업로드 가능. 없으면 `LocalImageService` 로 fallback 되고 S3 연동 무력화.

누군가 (아마도 ops v17/v18 S3 전환 당시) EC2 에서 직접 편집한 뒤 **repo 에 커밋 안 함** → 이후 모든 deploy 가 이 diff 때문에 pull 실패 → Platform v8 이후 main 의 모든 변경이 프로드 반영 안 됨.

---

## 조치

### 1) Repo 에 영구 반영 (본 hotfix)

`docker-compose.yml` 의 backend.environment 섹션에 AWS 3 줄 추가:

```yaml
environment:
  ...
  JIRA_API_KEY: ${JIRA_API_KEY}
  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  AWS_REGION: ${AWS_REGION:-ap-northeast-2}
  SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"
```

- **프로드**: `.env` 에 이미 AWS_* 변수가 설정돼 있으므로 바로 사용됨. S3ImageService 활성화 유지.
- **로컬/worktree**: `.env` 에 AWS_* 변수가 없으면 빈 문자열로 pass-through. `S3Config` 가 빈 값 감지하면 `LocalImageService` 로 fallback — 현재 로컬 동작 그대로.
- `AWS_REGION` 은 default `ap-northeast-2` 명시.

### 2) EC2 local diff 제거 (User 수행)

```bash
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
cd /home/ec2-user/my-atlas

# 방법 A — 이 PR 머지 후 (권장): repo 에 3 줄이 있으니 local stash 는 버려도 됨
git stash push -m "ec2 aws creds (now in repo via ops_v27)"
git fetch origin main
git merge --ff-only origin/main
git stash drop     # local diff 내용은 repo 에 이미 있으므로 버림
docker compose up -d --build --force-recreate backend
sleep 30
curl -s http://localhost:8080/api/settings/public
# 기대: 200 + {"success":true,...,"loginRequired": ...}

# 방법 B — 이 PR 머지 전: local diff 임시 보존
git stash
git fetch origin main
git merge --ff-only origin/main
git stash pop      # 이 PR 머지 전이니 충돌 없이 local diff 다시 적용
docker compose up -d --build --force-recreate backend
# 이 PR 머지 후에 git checkout -- docker-compose.yml 로 local diff 정리
```

## 검증

```bash
# 프로드 기동 확인 — 이 시점이면 02035dd..18b72fa 사이 모든 commit (Platform v9/v10, KB v7, hotfix #108/#110/#111, ops v27) 이 한번에 적용됨
curl -i https://api.youngmi.works/api/settings/public
# 기대: 200 + {"success":true,"data":{"loginRequired": ...}}

curl -I https://youngmi.works/images/features/senior_01_faq_list.png
# 기대: 200 + content-type: image/png

# 이미지 업로드가 S3ImageService 로 작동하는지 확인 (backend 로그)
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker logs myqaweb-backend 2>&1 | grep -E 'LocalImageService|S3 credentials|S3Config' | tail -5"
# 기대: "S3Config: using S3ImageService" 같은 라인 (LocalImageService fallback 이 아니어야 함)
```

---

## 후속

- 장기: docker-compose.yml 에서 환경별 차이가 날 수 있는 항목은 모두 `.env` + `${VAR:-default}` 패턴으로 통일하고, repo 의 compose 파일 자체는 모든 환경에서 unmodified 로 쓸 수 있도록 유지. 이번처럼 local 편집으로 silent drift 가 생기는 걸 원천 차단.
- CI: backend 기동 후 `GET /actuator/info` 로 배포된 git SHA 를 검증하는 step 추가 검토 (ops_v26 후속).
