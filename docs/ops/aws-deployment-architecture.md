# AWS 배포 아키텍처 개요

> **최종 업데이트**: 2026-04-01
> **배포 상태**: 🟢 Production
> **배포 브랜치**: main (develop은 테스트만)
> **관련 문서**: [`release-v1.md`](./release-v1.md) (배포 절차), [`release-v2.md`](./release-v2.md) (Slack 알림), [`deployment-strategy-analysis.md`](./deployment-strategy-analysis.md) (배포 전략 분석)

---

## 1. 현재 배포 상태

| 컴포넌트 | AWS 서비스 | 상태 | 위치 |
|---------|----------|------|------|
| **Backend** | EC2 + Docker | 🟢 가동 중 | EC2 (port 8080) |
| **Frontend** | S3 + CloudFront | 🟢 배포됨 | CloudFront CDN |
| **Database** | EC2 내 Docker (PostgreSQL pgvector) | 🟢 가동 중 | 내부 (5432) |
| **네트워크** | VPC + Public Subnet + Security Group | 🟢 구성됨 | Seoul (ap-northeast-2) |

---

## 2. 배포 아키텍처

### 2-1. 시스템 구조도

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS (ap-northeast-2)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────┐         ┌──────────────────┐ │
│  │    CloudFront CDN        │         │   EC2 Instance   │ │
│  │  (정적 배포)              │         │  (Backend + DB)  │ │
│  │                          │         │                  │ │
│  │  ├─ S3 Bucket (Frontend) │         │  ├─ Backend      │ │
│  │  │  정적 파일 배포        │  ←→     │  │  (port 8080)  │ │
│  │  └─ OAC (보안)           │         │  │                │ │
│  │                          │         │  └─ PostgreSQL   │ │
│  └──────────────────────────┘         │     DB           │ │
│           ↑                           │  (Docker)        │ │
│           │                           └──────────────────┘ │
│      사용자 접속                           ↑                │
│    (HTTPS 자동)                    Elastic IP              │
│                                  (고정 IP 할당됨)           │
│                                                             │
│  VPC                                                        │
│  └─ Subnet (Public)                                        │
│     └─ Security Group                                      │
│        ├─ SSH (22) — Key Pair 인증                         │
│        ├─ HTTP (80)                                        │
│        ├─ HTTPS (443)                                      │
│        └─ Backend (8080) — Docker                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2-2. 컴포넌트별 구성

**Frontend (정적 배포)**
- **S3 버킷**: GitHub Secrets에서 관리
- **배포 방식**: Vite 빌드 결과물 → S3 → CloudFront
- **환경변수**: `VITE_API_BASE_URL` (GitHub Secrets 참고)
- **캐시**: CloudFront의 CachingOptimized 정책 적용
- **라우팅**: SPA 모드 (404 → index.html)

**Backend (Docker 컨테이너)**
- **런타임**: Spring Boot 3.3.1 (Java 21)
- **포트**: 8080
- **환경**: EC2 내 Docker Compose
- **상태 확인**: `/actuator/health` 엔드포인트

**Database (Docker 컨테이너)**
- **이미지**: `pgvector/pgvector:pg15`
- **포트**: 5432 (내부)
- **데이터 보존**: Docker 볼륨 (pgdata)
- **특수 기능**: pgvector 확장 (벡터 검색)

---

## 3. AWS 리소스 구성

### 3-1. 컴퓨팅 & 스토리지

| 리소스 | 타입 | 사양 | 상세 정보 |
|--------|------|------|---------|
| **EC2** | 컴퓨팅 | t3.small | 2 vCPU, 2GB RAM, 30GB gp3 스토리지 |
| **Elastic IP** | 네트워킹 | 1개 | EC2 인스턴스에 할당 (고정 IP) |
| **S3 Bucket** | 스토리지 | 1개 | Frontend 정적 파일 호스팅 |
| **CloudFront** | CDN | 1개 | S3 배포 (Origin Access Control 사용) |

### 3-2. 네트워킹

| 리소스 | 사양 | 설정 |
|--------|------|------|
| **VPC** | 1개 | CIDR: 10.0.0.0/16 |
| **Public Subnet** | 1개 | CIDR: 10.0.1.0/24, Zone: ap-northeast-2a |
| **Internet Gateway** | 1개 | VPC ↔ 인터넷 연결 |
| **Security Group** | 1개 | 인바운드 22, 80, 443, 8080 허용 |
| **Key Pair** | 1개 | SSH 접속용 (안전하게 보관) |

---

## 4. 접속 정보

### 4-1. Frontend & Backend 접속

> ⚠️ **실제 URL 및 IP는 GitHub Secrets 및 AWS Console에서 확인하세요.**

| 용도 | 서비스 | 프로토콜 | 비고 |
|------|--------|---------|------|
| **Frontend** | CloudFront | HTTPS | S3를 통한 정적 배포 |
| **Backend API** | EC2 | HTTP | Elastic IP:8080 |
| **Health Check** | EC2 | HTTP | /actuator/health 엔드포인트 |

### 4-2. SSH 접속

```bash
# GitHub Secrets에서 EC2_HOST, EC2_USER, EC2_SSH_KEY 확인 후 사용
ssh -i {KEY_FILE} {EC2_USER}@{EC2_HOST}
```

**EC2 내 주요 경로:**
- 프로젝트 홈: `/home/ec2-user/my-atlas`
- 환경변수: `/home/ec2-user/my-atlas/.env` (민감 정보)
- Docker 로그: `docker compose logs {service}`
- 애플리케이션 로그: `/home/ec2-user/my-atlas/logs/`

---

## 5. CI/CD 배포 파이프라인

### 5-1. 배포 흐름

```
main 브랜치 push
    ↓
GitHub Actions 자동 트리거
    ↓
┌─────────────────────────────────────────────┐
│  Backend 코드 변경 (backend/**)              │
│  → deploy-backend.yml                       │
│    1. SSH로 EC2 접속 (GitHub Secrets 사용)  │
│    2. git pull origin main                  │
│    3. docker compose build backend          │
│    4. docker compose up -d backend          │
│    5. Health check 확인                     │
│    6. Slack 알림 (성공/실패)                 │
└─────────────────────────────────────────────┘
    또는
┌─────────────────────────────────────────────┐
│  Frontend 코드 변경 (frontend/**)             │
│  → deploy-frontend.yml                      │
│    1. npm install && npm run build          │
│    2. aws s3 sync frontend/dist/ → S3      │
│    3. CloudFront 캐시 무효화                 │
│    4. Slack 알림 (성공/실패)                 │
└─────────────────────────────────────────────┘
```

### 5-2. 워크플로우 설정

| 워크플로우 | 파일 | 트리거 조건 | 배포 대상 |
|-----------|------|-----------|---------|
| **Backend CI** | `backend-ci.yml` | PR 생성 | 테스트 (배포 X) |
| **Frontend CI** | `frontend-ci.yml` | PR 생성 | 테스트 (배포 X) |
| **E2E Test** | `e2e.yml` | PR 생성 | 테스트 (배포 X) |
| **Deploy Backend** | `deploy-backend.yml` | main push (backend/**, docker-compose.yml) | EC2 |
| **Deploy Frontend** | `deploy-frontend.yml` | main push (frontend/**) | S3 + CloudFront |

### 5-3. 필요한 GitHub Secrets

| Secret | 용도 | 보안 수준 |
|--------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWS 인증 | 🔐 높음 |
| `AWS_SECRET_ACCESS_KEY` | AWS 인증 | 🔐 높음 |
| `AWS_REGION` | 배포 리전 | 🔓 낮음 |
| `EC2_HOST` | EC2 Elastic IP | 🔓 낮음 |
| `EC2_USER` | EC2 SSH 사용자 | 🔓 낮음 |
| `EC2_SSH_KEY` | EC2 Key Pair | 🔐 높음 |
| `SLACK_WEBHOOK_URL` | Slack 알림 | 🔐 높음 |

---

## 6. 환경별 비교

### 6-1. 로컬 vs AWS

| 항목 | 로컬 (Docker Compose) | AWS |
|------|----------------------|-----|
| **DB** | pgvector:pg15 컨테이너 | EC2 내 Docker 컨테이너 (동일) |
| **Backend** | Docker 컨테이너 (8080) | EC2 내 Docker 컨테이너 (동일) |
| **Frontend** | Vite dev server (5173) | S3 + CloudFront 정적 배포 |
| **시크릿 관리** | `.env` 파일 (로컬) | EC2 `.env` 파일 + GitHub Secrets |
| **로그** | 로컬 파일 (`./logs/`) | EC2 파일 (`./logs/`) |
| **SSL/TLS** | 없음 | CloudFront HTTPS |
| **배포 방식** | 수동 | GitHub Actions (자동) |

---

## 7. 예상 월 비용

**리전**: AWS 서울 (ap-northeast-2)

| 서비스 | 사양 | 월 예상 비용 (USD) |
|--------|------|-------------------|
| **EC2** | t3.small 상시 가동 (2 vCPU, 2GB, 30GB gp3) | ~$15-20 |
| **Elastic IP** | 인스턴스 연결 시 | 무료 |
| **S3** | 정적 파일 호스팅 (<100MB) | ~$1 미만 |
| **CloudFront** | 기본 트래픽 (<10GB) | ~$1-5 |
| **Data Transfer** | EC2 → CloudFront 내부 | 무료 |
| **합계** | | **~$18-25/월** |

### 💡 비용 절감 팁

- **학습 중 EC2 중지 (Stop)**: 인스턴스 비용 발생 안 함 (스토리지 소액만)
- **프리 티어**: t3.micro 750시간/월 무료 (개인 계정)
- **예약 인스턴스**: 장기 사용 시 30-50% 할인

---

## 8. 데이터 관리

### 8-1. knowledge_base 테이블 ⚠️ 중요

- **용도**: PDF 청킹·임베딩 저장 (운영 데이터)
- **특수성**: OpenAI Embedding API 호출 비용 포함
- **주의사항**:
  - ❌ `DELETE FROM knowledge_base` 금지
  - ❌ `TRUNCATE knowledge_base` 금지
  - ❌ DB 볼륨 삭제 금지
  - ✅ 백업 시 `pg_dump` 사용 (pgvector 벡터 타입 지원)

### 8-2. 마이그레이션 절차

```bash
# 로컬 백업
pg_dump -h localhost -U {DB_USER} -d {DB_NAME} -F c -f backup.dump

# EC2로 전송
scp -i {KEY_FILE} backup.dump {EC2_USER}@{EC2_HOST}:/home/{EC2_USER}/

# EC2에서 복원
docker cp backup.dump {DB_CONTAINER}:/tmp/
docker exec {DB_CONTAINER} pg_restore -U {DB_USER} -d {DB_NAME} --clean /tmp/backup.dump
```

---

## 9. 운영 체크리스트

### 9-1. 정기 점검

- [ ] EC2 인스턴스 상태: AWS Console 또는 `aws ec2 describe-instances`
- [ ] Backend 헬스체크: `/actuator/health` 엔드포인트
- [ ] CloudFront 배포 상태: AWS Console > CloudFront
- [ ] Docker 컨테이너: SSH 접속 후 `docker compose ps`
- [ ] 모니터링: CloudWatch, X-Ray (선택)

### 9-2. 긴급 조치

| 상황 | 조치 |
|------|------|
| Backend 응답 없음 | SSH → `docker compose restart backend` → health check |
| DB 연결 오류 | `docker compose logs db` → 로그 확인 |
| Frontend 캐시 문제 | CloudFront 무효화 (AWS Console) |
| EC2 공간 부족 | `docker system prune -a` → 디스크 정리 |

---

## 10. 보안 주의사항

### ⚠️ 민감 정보 관리

- ❌ **Git 커밋 금지**: 실제 IP, 리소스 ID, API 키, SSH 키
- ✅ **GitHub Secrets 사용**: AWS 자격증명, API 키, EC2 정보
- ✅ **`.env` 파일**: `.gitignore`에 등록 (로컬 + EC2)
- ✅ **Key Pair 관리**: 로컬에만 보관, 절대 공유 금지

### 🔐 SSH 접근 제한

```bash
# Security Group: SSH 포트(22)는 관리자 IP만 허용
# 공용 인터넷(0.0.0.0/0)에서의 접근 차단 권장
```

---

## 11. 참고 문서

- **배포 절차**: [`docs/ops/release-v1.md`](./release-v1.md)
- **Slack 알림 설정**: [`docs/ops/release-v2.md`](./release-v2.md)
- **Docker Compose 구성**: `docker-compose.yml` (프로젝트 루트)
- **GitHub Actions 워크플로우**: `.github/workflows/`
- **Backend CLAUDE.md**: `backend/CLAUDE.md`
- **Frontend CLAUDE.md**: `frontend/CLAUDE.md`

---

**마지막 업데이트**: 2026-04-01
**상태**: Production 배포 완료 (main 브랜치 기반 자동 배포)

**주요 변경사항:**
- ✅ 배포 트리거: develop → **main** (2026-04-01)
- ✅ CI/CD 파이프라인 정확화 (deploy-backend.yml, deploy-frontend.yml)
- ✅ 배포 전략 분석 문서 추가

> 💡 **참고**: 실제 AWS 리소스 ID, IP, 도메인, API 키 등 민감한 정보는 GitHub Secrets 및 AWS Console에서 관리합니다.
