# Deployment Strategy Analysis: Frontend Docker 통일 검토

> **작성일**: 2026-04-01
> **현재 상태**: 분석 완료
> **상태**: 의사결정 대기

---

## 📋 Executive Summary

현재 my-atlas는 **Backend(EC2+Docker) ↔ Frontend(S3+CloudFront)** 이원화된 배포 전략을 사용 중입니다.
Frontend를 Docker로 통일할 경우의 **기술적 영향도, 문제점, 개선안**을 분석했습니다.

### 주요 결론
- ✅ **Docker 통일 가능** (프로덕션 Dockerfile 추가 필수)
- ⚠️ **5개 주요 문제점** 사전 해결 필요
- 🎯 **현재 방식 유지 권장** (증명된 설정, 리스크 낮음)

---

## 1. 현재 배포 아키텍처

### 1-1. Frontend (S3 + CloudFront)

**배포 흐름:**
```
GitHub main push
  ↓
.github/workflows/deploy-frontend.yml (자동 트리거)
  ↓
1. npm install && npm run build
   └─ frontend/dist/ 생성 (프로덕션 번들)
2. aws s3 sync frontend/dist/ s3://my-atlas-frontend/
   └─ S3 버킷에 정적 파일 배포
3. aws cloudfront create-invalidation
   └─ CloudFront 캐시 무효화
```

**특징:**
- ✅ CDN 글로벌 배포 (빠른 로딩)
- ✅ 정적 파일 최적화 (minified, chunked)
- ✅ Serverless (인프라 관리 불필요)
- ❌ API 베이스 URL **빌드타임 고정** (환경별 변경 불가)
- ❌ 배포 복잡도 높음 (로컬 빌드 필요)

**환경변수 관리:**
```yaml
# deploy-frontend.yml (GitHub Actions)
env:
  VITE_API_BASE_URL: http://3.34.154.147:8080  # ← IP 하드코딩
```

---

### 1-2. Backend (EC2 + Docker)

**배포 흐름:**
```
GitHub main push
  ↓
.github/workflows/deploy-backend.yml (자동 트리거)
  ↓
1. SSH로 EC2 접속 (GitHub Secrets)
2. git pull origin main
3. docker compose up -d --build backend
4. curl http://localhost:8080/actuator/health
   └─ 헬스체크 성공 확인
```

**특징:**
- ✅ 간단한 배포 (한 줄 명령)
- ✅ 환경변수 런타임 주입 가능
- ✅ git pull + docker compose 자동화
- ✅ EC2에 `.env` 파일로 환경 관리
- ❌ EC2 리소스 의존 (인스턴스 비용)

**Docker Compose 설정:**
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  environment:
    SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-jdbc:postgresql://db:5432/myqaweb}
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    OPENAI_API_KEY: ${OPENAI_API_KEY}
```

---

## 2. Frontend Dockerfile 현재 상태

**파일 경로:** `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

### 문제점 분석

| 항목 | 현재 | 문제점 |
|------|------|-------|
| **빌드 방식** | `npm run dev` (개발 서버) | Vite 핫 리로드 서버 (번들 최적화 없음) |
| **프로덕션 빌드** | 미존재 | 멀티스테이지 빌드 없음 |
| **출력 산물** | 소스코드 전체 + node_modules | dist/ 없음 (정적 파일 미생성) |
| **이미지 크기** | ~1GB (node_modules 포함) | 과도함 |
| **배포 방식** | Docker = 개발용 | S3로 배포하므로 실제 사용 안 함 |

---

## 3. Docker 통일 시 5가지 주요 문제점

### 3-1 ⚠️ Dockerfile에 프로덕션 빌드 없음

**현상:**
```
현재 S3 배포:
  npm run build → dist/bundle.js (minified, tree-shaken) → S3 업로드

Docker 통일 시:
  npm run dev → Vite 서버 (최적화 없음) → 번들 상태로 EC2 배포
```

**영향:**
- Frontend 성능 저하 (번들 최적화 미적용)
- 불필요한 소스맵 포함
- 개발용 의존성도 포함 (eslint, vitest 등)

**해결 방법:**
```dockerfile
# 프로덕션용 멀티스테이지 빌드 필요
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build  # ← dist/ 생성

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### 3-2 ⚠️ API 베이스 URL 하드코딩 문제

**현상:**
```javascript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}

// package.json build script
"build": "tsc && vite build"
```

**빌드 시점 변수 포함:**
- `npm run build` 실행 시 `VITE_*` 환경변수가 **번들에 포함**
- 빌드 후 런타임에는 변경 불가능
- S3 배포: 빌드 후 정적 파일로 URL 고정
- Docker 배포: 이미지 빌드 시점에 URL 고정

**영향:**
```
현재 (S3):
  GitHub Actions에서 빌드 → dist/ 생성 (API URL 고정) → S3 업로드

Docker로 통일 시:
  GitHub Actions에서 Docker 이미지 빌드 → API URL 이미 포함된 이미지
  → EC2에서 런타임 변경 불가능
```

**문제 시나리오:**
1. EC2 IP가 변경되면 → 새로운 이미지 재빌드 필요
2. Staging/Production 환경 분리 불가능
3. API URL을 환경변수로 주입할 수 없음

**해결 방법:**
```dockerfile
# Docker build args 사용
FROM node:20-alpine AS build
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
WORKDIR /app
COPY . .
RUN npm run build  # VITE_API_BASE_URL이 이미지에 포함

# GitHub Actions에서:
# docker build --build-arg VITE_API_BASE_URL=http://3.34.154.147:8080 ...
```

---

### 3-3 ⚠️ Database 구성 불일치

**현상:**
```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg15

  backend:
    SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/myqaweb
```

**배포 스크립트:**
```bash
# deploy-backend.yml
docker compose up -d --build backend  # ← db 서비스 실행 안 함
```

**문제:**
- EC2에서 `docker compose up`은 **backend만 실행**
- PostgreSQL이 EC2 호스트에 **별도 설치**되어 있다고 가정
- Docker로 Frontend 추가 시: `docker compose up`은 모든 서비스를 시작해야 함

**해결 필요:**
```bash
# 확인 1: EC2의 current state
docker ps
docker compose ps

# 확인 2: PostgreSQL이 어디에 있는가?
ps aux | grep postgres
docker ps | grep postgres
```

---

### 3-4 ⚠️ Frontend 포트 충돌 위험

**docker-compose.yml:**
```yaml
frontend:
  ports:
    - "5173:5173"
  volumes:
    - ./frontend/src:/app/src
  depends_on:
    - backend
```

**문제 시나리오:**
```bash
# Step 1: Docker로 frontend 시작
docker-compose up -d frontend
# → 포트 5173 점유

# Step 2: 로컬에서 개발 시작
cd frontend && npm run dev
# → "Port 5173 already in use" 오류

# Step 3: 포트 다르게 지정 필요
PORT=5174 npm run dev
# or
docker-compose.yml에서 포트 변경
```

**프로덕션 영향:**
- S3/CloudFront: 포트 개념 없음 (HTTPS)
- Docker EC2: 포트 5173 방화벽 개방 필요
- nginx로 변경 시: 포트 80/443 사용 가능

---

### 3-5 ⚠️ 배포 워크플로우 변경

**현재:**
```
deploy-frontend.yml (S3):
  1. npm install
  2. npm run build
  3. aws s3 sync dist/ → S3
  4. CloudFront 무효화

deploy-backend.yml (EC2):
  1. SSH 접속
  2. git pull
  3. docker compose up
```

**Docker 통일 후:**
```
deploy-backend.yml (EC2) - 수정 필요:
  1. SSH 접속
  2. git pull
  3. docker compose up -d --build backend frontend  # ← frontend 추가
  4. curl http://localhost:5173/health  # ← frontend health check 필요

deploy-frontend.yml: 삭제
```

**변경 영향:**
| 항목 | 현재 | 통일 후 |
|------|------|-------|
| **배포 방식** | 이원화 (S3 + SSH) | 단일화 (SSH만) |
| **배포 속도** | S3 sync 빠름 | Docker 빌드 느림 (5-10분) |
| **롤백** | CloudFront 캐시 무효화만 필요 | Docker 이미지 재배포 필요 |
| **환경 분리** | S3에서 동적 파일 배포 | Docker 이미지마다 고정 |

---

## 4. CORS 설정 현황 (호환성 ✅)

**파일:** `backend/src/main/java/com/myqaweb/config/WebConfig.java`

```java
registry.addMapping("/api/**")
    .allowedOriginPatterns(
        "http://localhost:*",           // 로컬 개발
        "https://*.cloudfront.net",     // S3/CloudFront (현재)
        "http://3.34.154.147:*"         // EC2 (통일 시)
    )
    .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    .allowedHeaders("*")
    .maxAge(3600);
```

**평가:**
- ✅ 로컬 localhost 패턴 허용
- ✅ CloudFront 도메인 패턴 허용
- ✅ EC2 IP 패턴 허용
- ✅ Docker 통일 시에도 문제 없음

---

## 5. 환경변수 관리 현황

### 5-1. 로컬 개발

```env
# .env
VITE_API_BASE_URL=http://localhost:8080
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/myqaweb
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

### 5-2. Docker Compose (로컬)

```yaml
# docker-compose.yml
frontend:
  environment:
    VITE_API_BASE_URL: http://localhost:8080

backend:
  environment:
    SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-jdbc:postgresql://db:5432/myqaweb}
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

### 5-3. 프로덕션 (GitHub Actions)

```yaml
# deploy-frontend.yml
env:
  VITE_API_BASE_URL: http://3.34.154.147:8080

# deploy-backend.yml (EC2 내 .env 파일 사용)
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb
ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 6. 배포 옵션 비교

### 옵션 A: 현재 유지 (권장 ✅)

**구성:**
```
Frontend: S3 + CloudFront (정적 배포)
Backend: EC2 + Docker (동적 서비스)
Database: EC2 내 Docker 또는 외부
```

**장점:**
- ✅ 이미 증명된 설정 (현재 운영 중)
- ✅ Frontend CDN 성능 (글로벌 배포)
- ✅ 배포 리스크 낮음
- ✅ 로컬 개발과 프로덕션 환경 명확
- ✅ Backend/Frontend 독립적 배포 가능
- ✅ Frontend 캐싱 전략 유연함 (CloudFront)

**단점:**
- ❌ 배포 방식 이원화 (학습곡선)
- ❌ API URL 하드코딩 (다중 환경 불가)
- ❌ 로컬 S3 배포 시뮬레이션 불가능

**배포 속도:**
- Frontend: 3-5분 (npm build + S3 sync)
- Backend: 3-10분 (git pull + docker compose)

---

### 옵션 B: Docker 완전 통일 (검토 필요)

**구성:**
```
Frontend: EC2 + Docker + Nginx
Backend: EC2 + Docker
Database: EC2 + Docker (docker-compose)
```

**장점:**
- ✅ 단일 배포 프로세스 (EC2 SSH 접속 + docker compose)
- ✅ 로컬 = 프로덕션 환경 동일
- ✅ Backend와 동일한 컨테이너 관리
- ✅ Docker Compose로 전체 스택 관리

**단점:**
- ❌ Frontend Dockerfile 완전 재작성 필요
  - Nginx 멀티스테이지 빌드 작성
  - 테스트 + 검증 필요
- ❌ CDN 이점 상실 (EC2 단일 인스턴스에서만 배포)
- ❌ 글로벌 성능 저하 (CloudFront 없음)
- ❌ EC2 리소스 증가 (CPU, 메모리 추가 필요)
- ❌ 롤백/배포 속도 느림 (Docker 이미지 빌드 시간)
- ❌ API URL 빌드타임 고정 (여전한 문제)

**배포 속도:**
- Frontend + Backend: 8-15분 (docker compose build)

---

## 7. 필요한 수정 사항 (통일 선택 시)

### 7-1. Frontend Dockerfile 작성

**파일:** `frontend/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Build args로 API URL 주입
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf 생성:**
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # SPA routing: 모든 경로를 index.html로
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API 프록시 (Optional)
        location /api/ {
            proxy_pass http://backend:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

### 7-2. docker-compose.yml 수정

```yaml
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

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: myqaweb-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-jdbc:postgresql://db:5432/myqaweb}
      SPRING_DATASOURCE_USERNAME: ${SPRING_DATASOURCE_USERNAME:-myqaweb}
      SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD:-admin}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "8080:8080"
    volumes:
      - ./logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8080}
    container_name: myqaweb-frontend
    restart: unless-stopped
    ports:
      - "5173:80"  # 컨테이너 80 → 호스트 5173
    depends_on:
      - backend

volumes:
  pgdata:
```

---

### 7-3. deploy-backend.yml 수정

```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'frontend/**'  # ← 추가
      - 'docker-compose.yml'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/my-atlas
            git pull origin main

            # Frontend + Backend 모두 빌드
            docker compose up -d --build backend frontend

            echo "Waiting for services to start..."
            sleep 15

            # Health check
            curl -f http://localhost:8080/actuator/health || exit 1
            curl -f http://localhost:5173/ || exit 1

            echo "All services deployed successfully!"
```

---

### 7-4. deploy-frontend.yml 삭제

```bash
rm .github/workflows/deploy-frontend.yml
```

---

## 8. 실행 체크리스트

### 현재 유지 (권장)
- [ ] 현재 배포 프로세스 문서화
- [ ] API URL 환경변수를 GitHub Secrets로 마이그레이션 (선택)
- [ ] CloudFront 캐싱 전략 검토

### Docker 통일 선택 시
- [ ] Frontend Dockerfile + nginx.conf 작성 및 로컬 테스트
- [ ] docker-compose.yml 수정 및 로컬 검증
- [ ] deploy-backend.yml 수정
- [ ] deploy-frontend.yml 삭제
- [ ] EC2에서 `docker compose ps` 확인 (DB 서비스 확인)
- [ ] GitHub Actions 테스트 (의도적 배포 1회)
- [ ] 프로덕션 Health Check 확인
- [ ] 롤백 절차 문서화

---

## 9. 비용 비교

### 옵션 A (S3 + CloudFront + EC2)
```
EC2 t3.small:        $15-20/월
Elastic IP:          무료 (할당 시)
S3 (<100MB):         $1 미만/월
CloudFront:          $1-5/월
─────────────────────────
합계:               $18-25/월
```

### 옵션 B (Docker 통합 on EC2)
```
EC2 t3.small (증가): $15-20/월
    (Frontend 추가로 CPU/메모리 사용)
S3:                  0 (사용 안 함)
CloudFront:          0 (사용 안 함)
─────────────────────────
합계:               $15-20/월 (비용 동일, 리소스만 증가)
```

---

## 10. 권장사항

### 🎯 최종 권장: **옵션 A (현재 유지)**

**이유:**
1. ✅ **증명된 배포 시스템** - 현재 운영 중, 리스크 최소
2. ✅ **성능 최적화** - CloudFront CDN (글로벌)
3. ✅ **독립적 배포** - Frontend/Backend 별도 배포 가능
4. ✅ **빠른 배포** - S3 sync (5분 이내)
5. ✅ **명확한 책임 분리** - 정적(S3) vs 동적(EC2)

**개선 사항:**
1. 🔧 **API URL을 GitHub Secrets 관리**로 변경
   ```yaml
   VITE_API_BASE_URL: ${{ secrets.BACKEND_API_URL }}
   ```

2. 🔧 **Staging/Production 환경 분리** (선택사항)
   ```yaml
   env:
     VITE_API_BASE_URL: ${{ secrets.BACKEND_API_URL_PROD }}
   ```

3. 🔧 **EC2에서 .env 파일 관리** (현재 상태 유지)

---

## 참고자료

- AWS Deployment Architecture: `/docs/ops/aws-deployment-architecture.md`
- Frontend CLAUDE.md: `/frontend/CLAUDE.md`
- Backend CLAUDE.md: `/backend/CLAUDE.md`
- Project CLAUDE.md: `/CLAUDE.md`

---

**마지막 수정**: 2026-04-01
**상태**: 분석 완료 및 의사결정 대기
