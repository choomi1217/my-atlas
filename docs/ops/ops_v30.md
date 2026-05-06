# Ops v30 — Deploy 후 Docker 이미지/빌드 캐시 자동 정리

> 변경 유형: 환경 개선
> 작성일: 2026-04-27
> 버전: v30
> 상태: 계획 (구현 전)

---

## 1. 배경

2026-04-27 deploy run [`24981955520`](https://github.com/choomi1217/my-atlas/actions/runs/24981955520) 이 빌드 timeout (10 분) 으로 실패. 원인 추적 중 EC2 에서 Docker 잡동사니가 7 GB 누적된 것 발견.

### 발견 시점 EC2 상태 (재부팅 + 청소 직전)

```
$ df -h /
/dev/nvme0n1p1     30G  9.4G   21G  32%  /

$ docker system df
TYPE            TOTAL   ACTIVE   SIZE       RECLAIMABLE
Images          18      3        2.561 GB   2.035 GB (79%)
Containers      3       3        7.483 MB   0 B
Local Volumes   1       1        92 MB      0 B
Build Cache     108     0        4.822 GB   4.822 GB (100%) 🚨
```

`docker compose up -d --build` 가 매 배포마다:
1. 새 `my-atlas-backend` 이미지 생성
2. 옛 이미지는 `<none>:<none>` (dangling) 으로 남음
3. BuildKit cache 가 layer 별로 누적 (재사용 목적이지만 자동 GC 없음)
4. 자동 prune 없어서 무한 누적

### 즉시 영향
- 빌드 timeout (compileJava 가 10 분 안에 못 끝남, 디스크 I/O 느려짐 가능성)
- 결국 디스크 80%+ 도달 시 sshd / 빌드 자체 죽음

### 청소 후
```
$ docker system df  (수동 docker image/builder prune 후)
TYPE            TOTAL   ACTIVE   SIZE       RECLAIMABLE
Images          3       3        1.151 GB   0 B
Containers      3       3        7.483 MB   0 B
Local Volumes   1       1        92 MB      0 B
Build Cache     0       0        0 B        0 B
```

→ 9.4 GB → 약 1.25 GB (87% 절감). 운영 데이터 무영향.

---

## 2. 변경 항목

| 항목 | 위치 | 역할 |
|---|---|---|
| **A. deploy-backend 직후 prune step** | `.github/workflows/e2e.yml` | 배포 직후 dangling 이미지 + 72 h+ build cache 자동 정리 |
| **B. systemd timer 로 주기적 prune** (선택) | EC2 `/etc/systemd/system/` | 매일 새벽 안전망 — deploy 없는 날도 정리 |
| **C. (장기 검토) GitHub Actions 빌드 + ECR push** | 별도 PR | EC2 는 image pull 만 → 누적 자체 발생 X |

A 만으로도 90% 해결. B 는 안전망. C 는 향후 검토.

---

## 3. 구현

### 3.A `.github/workflows/e2e.yml` — deploy-backend script 끝에 prune step 추가

기존 deploy script (sleep + curl health check) 직후, `exit 0` 이전에 다음 블록 삽입:

```bash
# === Post-deploy cleanup (ops v30) ===
echo "=== Disk before cleanup ==="
df -h /
docker system df

# 1. Dangling + unused 이미지 정리
docker image prune -af

# 2. Build cache (72h 이상 묵힌 것만 — 최근 cache 는 reuse 보존)
docker builder prune -af --filter "until=72h"

# 3. 종료된 컨테이너 정리
docker container prune -f

echo "=== Disk after cleanup ==="
df -h /
docker system df
```

#### 주의
- `docker volume prune` ❌ — DB 데이터 (`pgdata`) 보존 필수
- `docker compose down -v` ❌ — 같은 이유
- `--filter "until=72h"` — 최근 3 일 build cache 는 reuse 위해 보존 (cache hit 효율 ↑)

### 3.B (선택) systemd timer — 안전망

deploy 가 며칠 없는 기간에도 누적 방지.

**`/etc/systemd/system/docker-prune.service`**
```ini
[Unit]
Description=Docker prune (images + build cache)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker image prune -af
ExecStart=/usr/bin/docker builder prune -af --filter "until=72h"
ExecStart=/usr/bin/docker container prune -f
```

**`/etc/systemd/system/docker-prune.timer`**
```ini
[Unit]
Description=Daily Docker prune

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

활성화 (EC2 에서 1 회):
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now docker-prune.timer
sudo systemctl list-timers docker-prune.timer
```

확인:
```bash
journalctl -u docker-prune.service --since "yesterday"
```

### 3.C (장기) GitHub Actions 에서 빌드 + ECR push

현재 패턴 (EC2 에서 빌드):
```
GitHub push main → SSH EC2 → git pull → docker build → up -d
```

전환 패턴:
```
GitHub push main → Actions runner build → push ECR → SSH EC2 → docker pull → up -d
```

장점:
- EC2 의 빌드 cache 누적 zero (build 자체가 EC2 밖에서)
- t3.small 의 빌드 timeout 위험 zero
- GitHub runner 는 4 vCPU + 16GB → 빌드 훨씬 빠름

비용 / 작업:
- ECR private repo: ~$0.10/GB/월 (1 image ~ 600 MB → ~$0.06/월)
- IAM role 설정 (EC2 에 ECR pull 권한)
- e2e.yml 워크플로우 재구성

본 v30 에는 미포함. 별도 ops 버전으로 추적.

---

## 4. 검증

### Step A 적용 후
- [ ] deploy 1 회 후 `docker system df` 결과 확인 — Images 3개 / Build Cache 작은 값으로 유지
- [ ] `df -h /` 사용량이 deploy 누적 시에도 안정 상태
- [ ] e2e.yml run 의 deploy-backend 로그에 "Disk before/after cleanup" 출력 확인

### Step B 적용 후
- [ ] `systemctl list-timers docker-prune.timer` 가 다음 04:00 으로 스케줄됨
- [ ] 다음 날 `journalctl -u docker-prune.service` 가 성공 로그 보유

---

## 5. Step 진행 체크리스트

- [ ] Step A — `.github/workflows/e2e.yml` 의 deploy-backend script 에 cleanup 블록 추가
- [ ] Step A — feature 브랜치에서 PR (`feature/ops-v30-cleanup`) → develop (Squash 머지)
- [ ] Step A — 머지 후 다음 deploy 자동 정리 검증
- [ ] Step B (선택) — EC2 에 systemd timer 직접 설치 (root 권한, ssm 또는 수동 SSH)
- [ ] (장기) Step C — ECR 전환 별도 검토 트래킹

---

## 6. 영향 범위

- **CI 영향**: deploy-backend job 시간 +5~10 초 (prune 실행). 무시 가능.
- **로컬 개발 영향**: 없음 (워크플로우만 변경)
- **데이터 영향**: 없음 — `docker volume` 안 건드림. `myqaweb-db` 의 `pgdata` 보호.
- **배포 안정성**: ↑ (디스크 압박 사전 차단)

---

## 7. 향후 확장

- **Step C ECR push 전환** — t3.small CPU 부담 zero, 빌드 시간 단축
- **이미지 hash 기반 deploy 검증** — Actuator `/info` 의 git SHA 와 image tag 매칭 (ops_v28 의 deploy verification 과 연계)
- **EBS 사용률 CloudWatch 알람** — 70% 도달 시 Slack 알림 (v24 Slack appender 활용)

---

## 8. 참고

- 오늘 사고: GitHub run [`24981955520`](https://github.com/choomi1217/my-atlas/actions/runs/24981955520)
- 청소 전후 비교: `df -h` 기준 9.4 GB → 1.25 GB
- 관련 ops:
  - `ops_v26.md` — deploy 파이프라인 안전장치 (force-recreate, ff-only)
  - `ops_v29.md` — Git 전략 (hotfix 백포트 자동화 등)
- `CLAUDE.md` — Docker 운영 규칙 ("`docker compose down -v` 절대 금지")
