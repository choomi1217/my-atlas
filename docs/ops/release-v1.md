# AWS 배포 가이드 — 환경 개선 (v1)

> **변경 유형**: 환경 개선
> **날짜**: 2026-03-27
> **관련 기능**: 전체 (Backend + Frontend + DB)

---

## 1. 개요

my-atlas 프로젝트를 AWS에 배포하기 위한 단계별 가이드.
현재 로컬 Docker Compose 기반 구성을 AWS 클라우드 인프라로 이전한다.

### 현재 구성
| 컴포넌트 | 로컬 환경 |
|----------|-----------|
| Backend | Spring Boot 3.3.1 (Java 21), Docker 컨테이너, port 8080 |
| Frontend | React 18 + Vite, Docker 컨테이너 (dev server), port 5173 |
| Database | pgvector/pgvector:pg15, Docker 볼륨, port 5432 |
| AI API | Anthropic Claude API + OpenAI Embedding API (외부 호출) |

### 목표 AWS 구성
| 컴포넌트 | AWS 서비스 |
|----------|-----------|
| Backend | EC2 (Docker Compose로 Backend + DB 함께 구동) |
| Frontend | S3 + CloudFront (정적 배포) |
| Database | EC2 내 Docker 컨테이너 (pgvector/pgvector:pg15) |
| 시크릿 관리 | EC2 `.env` 파일 + SSM Parameter Store (선택) |
| 네트워크 | VPC + Public Subnet |
| DNS/SSL | Route 53 + ACM (Certificate Manager) |

---

## 2. 사전 준비

### 2-1. AWS 계정 및 CLI 설정
- [x] AWS 계정 생성 및 IAM 사용자 설정 (`my-atlas-admin`, AdministratorAccess)
- [x] AWS CLI 설치 및 `aws configure` 실행
- [x] 리전 결정: `ap-northeast-2` 서울

### 2-2. 도메인 및 SSL (선택)
- [ ] 도메인 보유 시 Route 53에 호스팅 영역 생성
- [ ] ACM에서 SSL 인증서 발급 (CloudFront용은 `us-east-1` 리전 필수)

### 2-3. GitHub Secrets 등록
CI/CD에서 사용할 시크릿을 GitHub Repository Settings > Secrets에 등록:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_ACCOUNT_ID`

---

## 3. 단계별 배포 절차

### Step 1: VPC 및 네트워크 구성

VPC를 생성하여 리소스를 격리한다. 학습 목적이므로 단순한 Public Subnet 구성을 사용한다.

```
VPC (10.0.0.0/16)
├── Public Subnet A (10.0.1.0/24) — EC2 인스턴스
└── Public Subnet B (10.0.2.0/24) — (확장용, 선택)
```

- [x] VPC 생성 (`vpc-0dd2d80dcf32b9926`, CIDR: `10.0.0.0/16`)
- [x] Public Subnet 1개 (`subnet-0a65868480a1cd1f0`, ap-northeast-2a)
- [x] Internet Gateway 생성 및 VPC 연결 (`igw-07bc7f096f422f570`)
- [x] Route Table 설정 (`rtb-0c01b993cf3270a0a`, Public Subnet → IGW)
- [x] Security Group 생성 (`sg-0c9c6e4934a014ce7`):
  - 22 (SSH) 인바운드 — 0.0.0.0/0 (Key Pair 인증으로 보호)
  - 80, 443 (HTTP/HTTPS) 인바운드 — 0.0.0.0/0
  - 8080 (Backend) 인바운드 — 0.0.0.0/0

### Step 2: EC2 인스턴스 생성

Backend + DB를 하나의 EC2에서 Docker Compose로 구동한다. 로컬과 동일한 구조이므로 학습하기 좋다.

- [x] Key Pair 생성 (`my-atlas-key`, `~/.ssh/my-atlas-key.pem`에 보관)
- [x] EC2 인스턴스 생성 (`i-0242a794b86668829`)
  - AMI: Amazon Linux 2023
  - 인스턴스 타입: `t3.small` (2 vCPU, 2GB)
  - 스토리지: 30GB gp3
  - Elastic IP: `3.34.154.147` (`eipalloc-083caff75c55e1245`)
- [x] SSH 접속 확인
  ```bash
  ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
  ```

### Step 3: EC2 서버 환경 설정

SSH 접속 후 필요한 소프트웨어를 설치한다.

- [x] Docker 및 Docker Compose 설치
  ```bash
  # Amazon Linux 2023
  sudo dnf update -y
  sudo dnf install -y docker git
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker ec2-user

  # Docker Compose Plugin 설치
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

  # 재접속 (docker 그룹 반영)
  exit
  ssh -i my-atlas-key.pem ec2-user@<elastic-ip>

  # 확인
  docker --version
  docker compose version
  ```

### Step 4: 프로젝트 배포 및 환경변수 설정

- [x] 프로젝트 클론
  ```bash
  cd /home/ec2-user
  git clone https://github.com/<your-username>/my-atlas.git
  cd my-atlas
  ```
- [x] `.env` 파일 생성 (시크릿 포함)
  ```bash
  cat > .env << 'EOF'
  POSTGRES_DB=myqaweb
  POSTGRES_USER=myqaweb
  POSTGRES_PASSWORD=<secure-password>

  SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb
  SPRING_DATASOURCE_USERNAME=myqaweb
  SPRING_DATASOURCE_PASSWORD=<secure-password>

  ANTHROPIC_API_KEY=<anthropic-api-key>
  OPENAI_API_KEY=<openai-api-key>
  EOF
  ```
- [x] Docker Compose로 Backend + DB 실행
  ```bash
  docker compose up -d
  ```
- [x] 컨테이너 상태 확인
  ```bash
  docker compose ps
  docker compose logs backend --tail 50
  ```
- [x] Health check 확인 (`{"status":"UP"}`)
  ```bash
  curl http://localhost:8080/actuator/health
  ```

### Step 5: 로컬 DB 데이터 마이그레이션

**주의: knowledge_base 테이블의 임베딩 데이터는 재생성 비용이 높으므로 마이그레이션 시 각별히 주의할 것.**

- [x] 로컬에서 DB 덤프
  ```bash
  # 로컬 머신에서 실행
  pg_dump -h localhost -U myqaweb -d myqaweb -F c -f myatlas_backup.dump
  ```
- [x] EC2로 덤프 파일 전송
  ```bash
  scp -i my-atlas-key.pem myatlas_backup.dump ec2-user@<elastic-ip>:/home/ec2-user/
  ```
- [x] EC2에서 DB 복원
  ```bash
  # 기존 Flyway로 생성된 빈 스키마가 있으므로, 먼저 컨테이너 중지 후 복원
  docker compose stop backend

  # DB 컨테이너에 덤프 파일 복사 후 복원
  docker cp myatlas_backup.dump myqaweb-db:/tmp/
  docker exec myqaweb-db pg_restore -U myqaweb -d myqaweb --clean --if-exists /tmp/myatlas_backup.dump

  # Backend 재시작
  docker compose start backend
  ```
- [x] 데이터 정상 복원 확인 (knowledge_base: 372건)
  ```bash
  docker exec myqaweb-db psql -U myqaweb -d myqaweb -c "SELECT count(*) FROM knowledge_base;"
  ```

### Step 6: Frontend 정적 배포 (S3 + CloudFront)

프로덕션 빌드를 S3에 업로드하고 CloudFront로 서빙한다.

- [x] Frontend 프로덕션 빌드 (`VITE_API_BASE_URL=http://3.34.154.147:8080`)
  ```bash
  cd frontend

  # 환경변수 설정 (ALB 엔드포인트로 변경)
  echo "VITE_API_BASE_URL=https://api.your-domain.com" > .env.production

  # 프로덕션 빌드
  npm run build
  # → dist/ 폴더에 정적 파일 생성
  ```
- [x] S3 버킷 생성 (`my-atlas-frontend`)
  ```bash
  aws s3 mb s3://my-atlas-frontend --region ap-northeast-2
  ```
- [x] S3에 빌드 결과 업로드
  ```bash
  aws s3 sync frontend/dist/ s3://my-atlas-frontend/ --delete
  ```
- [x] CloudFront Distribution 생성 (`EVMWQ4ZH85AXV`, `d1tr7ozyf0jrsl.cloudfront.net`)
  - Origin: S3 버킷 (OAC 사용으로 퍼블릭 접근 차단)
  - Default Root Object: `index.html`
  - Error Pages: 403/404 → `/index.html` (SPA 라우팅 지원)
  - Cache Policy: CachingOptimized
  - HTTPS: ACM 인증서 연결 (커스텀 도메인 사용 시)
- [x] S3 버킷 정책 설정 (CloudFront OAC만 접근 허용)
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-atlas-frontend/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }]
  }
  ```

### Step 7: CORS 및 API 연결 설정

- [x] Backend `WebConfig.java`에 CORS 설정 추가 (`*.cloudfront.net`, EC2 IP)
  ```yaml
  # 프로덕션 환경에서의 CORS 허용 origin
  cors:
    allowed-origins: https://your-domain.com, https://www.your-domain.com
  ```
- [x] Frontend API URL 설정: `VITE_API_BASE_URL=http://3.34.154.147:8080`

### Step 8: CI/CD 파이프라인 구성 (GitHub Actions)

기존 CI 워크플로우에 배포 단계를 추가한다.

- [x] Backend 배포 워크플로우 (`.github/workflows/deploy-backend.yml`)
  ```yaml
  # main 브랜치 push 시 트리거
  # 1. SSH로 EC2 접속
  # 2. git pull (최신 코드 가져오기)
  # 3. docker compose build --no-cache backend
  # 4. docker compose up -d
  ```
  GitHub Actions에서 SSH 배포 시 필요한 Secrets:
  - `EC2_HOST`: Elastic IP 주소
  - `EC2_SSH_KEY`: `my-atlas-key.pem` 내용
  - `EC2_USER`: `ec2-user`

- [x] Frontend 배포 워크플로우 (`.github/workflows/deploy-frontend.yml`)
  ```yaml
  # main 브랜치 push 시 트리거
  # 1. npm install && npm run build
  # 2. S3 sync
  # 3. CloudFront 캐시 무효화
  ```

### Step 9: DNS 설정 (커스텀 도메인 사용 시)

- [ ] Route 53에 레코드 추가 (스킵 — 도메인 없음)
  - `your-domain.com` → CloudFront Distribution (A/AAAA Alias)
  - `api.your-domain.com` → EC2 Elastic IP (A 레코드)

---

## 4. 환경별 구성 비교

| 항목 | 로컬 (Docker Compose) | AWS (EC2) |
|------|----------------------|-----------|
| DB | pgvector:pg15 컨테이너 | EC2 내 Docker 컨테이너 (동일) |
| Backend | Docker 컨테이너 (8080) | EC2 내 Docker 컨테이너 (동일) |
| Frontend | Vite dev server (5173) | S3 + CloudFront (정적) |
| 시크릿 | `.env` 파일 | EC2 `.env` 파일 |
| 로그 | 로컬 파일 (`./logs/`) | EC2 로컬 파일 (`./logs/`) |
| SSL | 없음 | CloudFront (HTTPS) |
| 배포 | 수동 | SSH + git pull + docker compose |

---

## 5. 비용 예상 (최소 구성, 서울 리전 기준)

| 서비스 | 사양 | 월 예상 비용 (USD) |
|--------|------|-------------------|
| EC2 | t3.small (2 vCPU, 2GB), 30GB gp3 | ~$15-20 |
| Elastic IP | 1개 (인스턴스 연결 시 무료) | $0 |
| S3 | 정적 파일 호스팅 | ~$1 미만 |
| CloudFront | 기본 트래픽 | ~$1-5 |
| **합계** | | **~$20-25/월** |

> **비용 절감 팁**: 학습 중 사용하지 않을 때 EC2 인스턴스를 중지(Stop)하면 인스턴스 비용이 발생하지 않음 (EBS 스토리지 비용만 소액 발생). 프리 티어 계정이면 t3.micro 750시간/월 무료.

---

## 6. 배포 후 체크리스트

- [ ] EC2 SSH 접속 확인: `ssh -i my-atlas-key.pem ec2-user@<elastic-ip>`
- [ ] Docker 컨테이너 상태 확인: `docker compose ps` (3개 모두 Up)
- [ ] Backend health check: `curl http://<elastic-ip>:8080/actuator/health`
- [ ] Frontend 접속 확인 (CloudFront 배포 후): `https://your-domain.com`
- [ ] API 호출 정상 동작 확인 (CORS)
- [ ] DB 연결 확인: `docker compose logs backend | grep Flyway`
- [ ] knowledge_base 데이터 정상 마이그레이션 확인
- [ ] Claude AI 채팅 기능 동작 확인

---

## 7. 주의 사항

1. **knowledge_base 데이터 보존**: pg_dump/pg_restore 시 임베딩 데이터(vector 타입)가 정상 복원되는지 반드시 확인. 데이터 유실 시 OpenAI Embedding API 재호출 비용 발생.
2. **pgvector 확장**: Docker 이미지 `pgvector/pgvector:pg15`를 그대로 사용하므로 별도 설치 불필요 (로컬과 동일).
3. **Flyway 마이그레이션**: `ddl-auto: validate` 설정이므로 스키마는 Flyway가 관리. EC2에서도 동일하게 동작.
4. **API 키 관리**: Anthropic/OpenAI API 키는 EC2의 `.env` 파일에만 저장. 절대 Git에 커밋하지 않음.
5. **Frontend 환경변수**: Vite 빌드 시 `VITE_API_BASE_URL`이 빌드에 포함되므로, 프로덕션 빌드 전에 반드시 올바른 API URL(EC2 Elastic IP 또는 도메인)을 설정.
6. **EC2 보안**: SSH 포트(22)는 반드시 본인 IP만 허용. `.env` 파일 권한은 `chmod 600`으로 제한.
7. **EC2 중지 vs 종료**: 학습 중단 시 Stop(중지)하면 데이터 유지. Terminate(종료)하면 모든 데이터 삭제됨.

---

## 8. 최종 배포 요약

> **배포 완료일**: 2026-03-30

### 접속 정보

| 항목 | URL / 정보 |
|------|-----------|
| Frontend | `https://d1tr7ozyf0jrsl.cloudfront.net` |
| Backend API | `http://3.34.154.147:8080` |
| Health Check | `http://3.34.154.147:8080/actuator/health` |
| EC2 SSH | `ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147` |

### AWS 리소스 목록

| 리소스 | ID / 이름 |
|--------|----------|
| VPC | `vpc-0dd2d80dcf32b9926` (10.0.0.0/16) |
| Subnet | `subnet-0a65868480a1cd1f0` (ap-northeast-2a) |
| Internet Gateway | `igw-07bc7f096f422f570` |
| Security Group | `sg-0c9c6e4934a014ce7` (my-atlas-sg) |
| EC2 Instance | `i-0242a794b86668829` (t3.small, Amazon Linux 2023) |
| Elastic IP | `3.34.154.147` (`eipalloc-083caff75c55e1245`) |
| S3 Bucket | `my-atlas-frontend` |
| CloudFront | `EVMWQ4ZH85AXV` (`d1tr7ozyf0jrsl.cloudfront.net`) |
| Key Pair | `my-atlas-key` (`~/.ssh/my-atlas-key.pem`) |

### CI/CD 파이프라인

| 워크플로우 | 트리거 | 동작 |
|-----------|--------|------|
| `deploy-backend.yml` | develop push (`backend/**`) | SSH → git pull → docker compose build |
| `deploy-frontend.yml` | develop push (`frontend/**`) | npm build → S3 sync → CloudFront 무효화 |

### 예상 월 비용

| 사용 패턴 | 예상 비용 (USD) |
|-----------|---------------|
| 24시간 상시 가동 | ~$18/월 |
| 학습 시에만 EC2 Start | ~$3-5/월 |
