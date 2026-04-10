# my-atlas Ops 현황 종합

> **최종 업데이트**: 2026-04-07

## 개요

my-atlas 프로젝트의 운영 인프라 전체 현황을 정리한 메인 명세서.
CI/CD, Docker, 클라우드 인프라, 모니터링, 데이터베이스, 빌드 도구, 환경 설정을 포괄한다.

---

## 1. 인프라 아키텍처

### 현재 구성

```
[사용자]
   │
   ├─ Frontend ──→ CloudFront (EVMWQ4ZH85AXV) ──→ S3 (my-atlas-frontend)
   │                d1tr7ozyf0jrsl.cloudfront.net
   │
   └─ API 요청 ──→ EC2 (3.34.154.147:8080)
                    t3.small / Amazon Linux
                    ├── Backend Container (Spring Boot, port 8080)
                    └── PostgreSQL Container (pgvector:pg15, port 5432)
                        └── pgdata volume
```

### AWS 리소스 목록

| 리소스 | 타입 | ID | 상태 |
|--------|------|----|----|
| VPC | Network | vpc-0dd2d80dcf32b9926 | Active |
| Public Subnet | Network | subnet-0a65868480a1cd1f0 | Active |
| Internet Gateway | Network | igw-07bc7f096f422f570 | Active |
| Security Group | Network | sg-0c9c6e4934a014ce7 | Active |
| EC2 | Compute | i-0242a794b86668829 (t3.small) | Active |
| Elastic IP | Network | 3.34.154.147 | Active |
| S3 | Storage | my-atlas-frontend | Active |
| CloudFront | CDN | EVMWQ4ZH85AXV | Active |
| Key Pair | Auth | my-atlas-key | Active |

### 미구성 항목
- ALB/NLB (로드밸런서 없음)
- Auto Scaling Group 없음
- 백엔드 HTTPS 미적용 (HTTP 8080 직접 노출)
- 커스텀 도메인 미연결
- Staging 환경 없음

### 예상 월 비용: ~$20-25 (t3.small 상시 가동 기준)

---

## 2. CI/CD 파이프라인

### 워크플로우 현황 (`.github/workflows/`)

| 워크플로우 | 트리거 | 상태 | 비고 |
|-----------|--------|------|------|
| `backend-ci.yml` | Push/PR (main, develop) | 정상 | JaCoCo 비활성, Docker push 주석처리 |
| `frontend-ci.yml` | Push/PR (main, develop) | 부분 동작 | lint/test가 continue-on-error |
| `e2e.yml` | Push/PR + manual | 정상 | 98개 테스트 전부 통과 (API 65 + UI 33) |
| `deploy-backend.yml` | Push to main (backend/**) | 구성 완료 | SSH → git pull → docker compose rebuild |
| `deploy-frontend.yml` | Push to main (frontend/**) | 구성 완료 | npm build → S3 sync → CloudFront invalidation |

### 배포 흐름

```
feature/* → develop (PR) → main (PR)
                                │
                    ┌───────────┼───────────┐
                    ▼                       ▼
            deploy-backend          deploy-frontend
            (SSH → EC2)             (S3 + CloudFront)
```

### CI/CD 주요 이슈

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| 배포 게이트 없음 | 높음 | E2E 통과 여부와 무관하게 main push 시 바로 배포됨 |
| ~~Frontend CI 미강제~~ | ~~중간~~ | ~~lint/test 실패해도 빌드 통과~~ → **v9에서 해결** (ESLint 설정 + continue-on-error 제거) |
| JaCoCo 미적용 | 중간 | 백엔드 코드 커버리지 측정/강제 안됨 |
| 프론트엔드 API URL 하드코딩 | 중간 | deploy-frontend에서 EC2 IP 직접 참조 |
| 롤백 전략 없음 | 중간 | 배포 실패 시 수동 대응만 가능 |

### Slack 알림
- 모든 워크플로우에 Slack 알림 연동 완료 (Block Kit 포맷)
- 성공/실패 모두 알림 발송 (`always()` 조건)

---

## 3. Docker 구성

### docker-compose.yml 서비스

| 서비스 | 이미지 | 포트 | Health Check | 상태 |
|--------|--------|------|-------------|------|
| db | pgvector/pgvector:pg15 | 5432:5432 | pg_isready | 정상 |
| backend | 자체 빌드 (multi-stage) | 8080:8080 | 없음 | 정상 |
| frontend | 자체 빌드 (dev mode) | 5173:5173 | 없음 | 개발용 |

### Dockerfile 상태

**Backend** — 프로덕션 적합
```
Builder: eclipse-temurin:21-jdk-alpine (Gradle bootJar)
Runtime: eclipse-temurin:21-jre-alpine (JRE만 포함)
TZ: Asia/Seoul
```

**Frontend** — 개발 전용
```
Base: node:20-alpine
Mode: npm run dev (Vite dev server)
```
- 프로덕션 빌드 스테이지 없음 (실제 배포는 S3 + CloudFront로 별도 수행)

### 볼륨
- `pgdata` (`my-atlas_pgdata`) — PostgreSQL 데이터 영속화 (메인 레포 전용)
- `./logs` — 백엔드 로그 마운트
- `./frontend/src` — 프론트엔드 소스 라이브 리로드

### Worktree Docker 운영 규칙 (v10)

**원칙:** DB 인스턴스 1개 (메인), Backend 인스턴스 N개 (메인 + worktree)

```
[myqaweb-db]  ← 포트 5432, 메인 레포에서만 실행
     ↑ (host.docker.internal:5432)
     ├── myqaweb-backend                   (8080, 메인)
     ├── myqaweb-knowledge-base-backend    (8082)
     ├── myqaweb-registry-backend          (8085)
     └── myqaweb-my-senior-backend         (8083)
```

**시작 순서:**
1. 메인 레포: `docker compose up -d` (DB + Backend + Frontend)
2. worktree: `docker compose up -d` (Backend + Frontend만, DB는 메인 사용)

**종료 순서:**
1. worktree: `docker compose down`
2. 메인 레포: `docker compose down` (DB 마지막에 종료)

**금지 사항:**
- worktree에서 DB 컨테이너를 직접 실행하지 않는다
- `docker compose down -v` 실행 금지 (DB 볼륨 삭제 방지)

---

## 4. 환경 설정

### 환경 변수 관리

| 변수 | 소스 | 용도 |
|------|------|------|
| POSTGRES_DB/USER/PASSWORD | .env | DB 접속 |
| SPRING_DATASOURCE_URL/USERNAME/PASSWORD | .env / docker-compose | Spring 데이터소스 |
| ANTHROPIC_API_KEY | .env / GitHub Secrets | Claude AI API |
| OPENAI_API_KEY | .env / GitHub Secrets | 임베딩 API |
| VITE_API_BASE_URL | .env / CI override | 프론트엔드 API 주소 |
| FEATURE_EMBEDDING_ENABLED | application.yml (default: false) | 임베딩 기능 토글 |

### Spring 프로필 설정 (`application.yml`)

| 항목 | 설정값 | 비고 |
|------|--------|------|
| Hibernate ddl-auto | validate | Flyway가 스키마 관리 |
| Flyway | enabled, classpath:db/migration | 7개 마이그레이션 적용 |
| AI 모델 | claude-3-5-sonnet-20241022 | Spring AI Anthropic |
| 임베딩 모델 | text-embedding-3-small | OpenAI |
| pgvector | 1536 dims, COSINE_DISTANCE | 벡터 검색 |
| Multipart | max 500MB | PDF 업로드 대응 |
| Actuator | health, info 노출 | 기본 헬스체크만 |

### 테스트 환경 (`test/resources/application.yml`)
- H2 인메모리 DB 사용
- Flyway 비활성
- 더미 API 키

---

## 5. 데이터베이스

### 구성
- **엔진:** PostgreSQL 15 + pgvector 확장
- **실행:** Docker 컨테이너 (단일 인스턴스)
- **영속화:** Docker named volume (`pgdata`)

### 스키마 관리 (Flyway)

| 버전 | 마이그레이션 | 설명 |
|------|-------------|------|
| V1 | create_company_features | 회사/기능 테이블 생성 |
| V2 | create_test_case | 테스트 케이스 테이블 |
| V3 | remove_feature_add_segment | 기능 제거, 세그먼트 추가 |
| V4 | create_senior_tables | 시니어 QA 테이블 |
| V5 | add_source_to_knowledge_base | KB 소스 컬럼 추가 |
| V6 | create_pdf_upload_job | PDF 업로드 작업 추적 |
| V7 | seed_testcase_v1 | 초기 데이터 시드 |

### 주요 테이블

| 테이블 | 용도 | 벡터 컬럼 |
|--------|------|-----------|
| knowledge_base | QA 지식 (PDF 청킹/임베딩) | 있음 (1536 dims) |
| pdf_upload_job | PDF 업로드 이력/상태 | 없음 |
| seniors | 시니어 QA FAQ | 없음 |
| companies / segments | 기능 레지스트리 | 없음 |
| test_cases | 테스트 케이스 관리 | 없음 |

### 데이터 보호 규칙
- `knowledge_base`, `pdf_upload_job` 테이블은 **삭제 절대 금지** (실 도서 데이터)
- `docker compose down -v` 실행 금지 (볼륨 삭제 방지)

### 백업
- **현재:** 수동 pg_dump만 문서화 (release-v1.md)
- **자동 백업:** 미구성
- **복제/HA:** 없음

---

## 6. 모니터링 및 관측성

### 현재 상태

| 영역 | 구현 여부 | 현황 |
|------|-----------|------|
| 헬스체크 | 부분 | DB: pg_isready / Backend: /actuator/health |
| 로깅 | 로컬만 | logback → ./logs/backend_{session}.log |
| 메트릭 | 없음 | Actuator metrics 미노출 |
| 대시보드 | 없음 | Grafana/CloudWatch 없음 |
| 알림 | CI/CD만 | Slack 알림 (파이프라인 결과만) |
| APM | 없음 | 트레이싱/성능 모니터링 없음 |
| 로그 집계 | 없음 | EC2 로컬 파일만 존재 |

### 로깅 설정 (logback-spring.xml)
- Console + File 출력
- 세션별 파일명 (`backend_{SESSION_TS}.log`)
- com.myqaweb: DEBUG / root: INFO
- **로그 로테이션 없음** — 파일이 무한히 커짐
- **JSON 포맷 없음** — 로그 집계 시 파싱 필요

---

## 7. 빌드 도구

### Backend (Gradle)

| 항목 | 값 |
|------|-----|
| Java | 21 (Temurin) |
| Spring Boot | 3.3.1 |
| Spring AI | 1.0.0-M1 |
| 테스트 | JUnit 5 + Mockito + H2 + TestContainers |
| 빌드 명령 | `./gradlew clean build` |
| 테스트 JVM | -Xmx1g |

미적용: JaCoCo, SpotBugs, 의존성 취약점 스캔

### Frontend (npm + Vite)

| 항목 | 값 |
|------|-----|
| React | 18.3.1 |
| TypeScript | 5.4.5 |
| 빌드 도구 | Vite 5.3.1 |
| 상태 관리 | Zustand 4.5.7 |
| 스타일링 | Tailwind CSS 3.4.4 |
| 테스트 | Vitest + Testing Library |
| 빌드 명령 | `npm run build` (tsc + vite build) |

미적용: 프로덕션 최적화 설정, 환경별 빌드 분리

### E2E 테스트 (Playwright)

| 항목 | 값 |
|------|-----|
| 위치 | qa/ 디렉토리 |
| API 테스트 | 65개 (7개 도메인) |
| UI 테스트 | 33개 (Chromium) |
| 총 테스트 | 98개, 전부 통과 |

---

## 8. 보안 현황

| 항목 | 상태 | 설명 |
|------|------|------|
| API 키 관리 | 주의 필요 | .env에 실 키 존재, .gitignore 적용됨 |
| HTTPS (프론트엔드) | 적용 | CloudFront SSL |
| HTTPS (백엔드) | 미적용 | HTTP 8080 직접 노출 |
| Security Group | 과다 개방 | SSH 22번 포트 0.0.0.0/0 허용 |
| DB 접근 | 내부만 | Docker 네트워크 내 통신 |
| CORS | 미설정 | application.yml에 CORS 설정 없음 |
| 입력 검증 | 적용 | spring-boot-starter-validation |

---

## 9. 종합 평가

### 강점
- 모던 기술 스택 (Spring Boot 3.3, React 18, Vite, Docker)
- CI/CD 5개 파이프라인 자동화 완료
- E2E 테스트 98개 전부 통과
- 운영 문서화 우수 (AWS 배포 가이드, CI 최적화 이력)
- Flyway 마이그레이션으로 스키마 관리
- Slack 알림 연동

### 개선 필요

| 우선순위 | 항목 | 현재 | 목표 |
|----------|------|------|------|
| 높음 | 배포 게이트 | E2E와 배포 분리되지 않음 | E2E 통과 시에만 배포 허용 |
| 높음 | 백엔드 HTTPS | HTTP 직접 노출 | ALB + ACM 인증서 적용 |
| 높음 | 프론트엔드 CI 강제 | lint/test continue-on-error | 실패 시 빌드 차단 |
| 중간 | 모니터링 | 없음 | CloudWatch 또는 Prometheus + Grafana |
| 중간 | 로그 집계 | EC2 로컬 파일 | CloudWatch Logs 또는 ELK |
| 중간 | DB 자동 백업 | 수동 pg_dump | 자동 스케줄 백업 |
| 중간 | JaCoCo | 비활성 | build.gradle에 플러그인 추가, 70% 강제 |
| 낮음 | 로그 로테이션 | 없음 | logback RollingFileAppender |
| 낮음 | Security Group | SSH 전체 개방 | 특정 IP만 허용 |
| 낮음 | Staging 환경 | 없음 | develop 브랜치용 별도 환경 |

---

## 10. 버전 히스토리

Ops 관련 변경 이력을 시간순으로 기록한다. 각 버전 문서는 `docs/ops/` 디렉토리에 별도 파일로 존재한다.

### 타임라인

| 날짜 | 버전 문서 | 변경 유형 | 요약 |
|------|-----------|-----------|------|
| 2026-03-25 | [v1.md](v1.md) | 환경 개선 | Logback 파일 로깅 추가. `docker logs` 대신 프로젝트 내 로그 파일로 자동 저장하여 Claude Code가 직접 분석 가능하도록 개선 |
| 2026-03-25 | [v2.md](v2.md) | 환경 개선 | Multipart 업로드 크기 제한 50MB → 500MB 확대. PDF 업로드 시 `MaxUploadSizeExceededException` 해결 |
| 2026-03-27 | [v3.md](v3.md) | 환경 개선 | AWS 최초 배포. VPC/Subnet → EC2(t3.small) → Docker Compose(Backend+DB) → S3+CloudFront(Frontend) 전체 구성. 로컬 DB를 pg_dump로 EC2에 복원. CORS 설정 포함 |
| 2026-03-30 | [v4.md](v4.md) | 환경 개선 | Slack 알림 전면 전환. 모든 CI/CD 워크플로우(5개)에 성공/실패 Slack 알림 추가. Block Kit 포맷 적용, `failure()` → `always()` 조건 변경 |
| 2026-04-06 | [v5.md](v5.md) | 버그 수정 | CI/CD 파이프라인 6건 수정. Logback 경로 권한 오류, API 키 누락 시 빌드 실패, docker-compose 명령 deprecation, 테스트 상태코드 불일치 해결. E2E 98개 전부 통과 확인 |
| 2026-04-07 | [v6.md](v6.md) | 환경 개선 | Git WorkTree Docker 환경 분리. 볼륨 이름 고정, setup-worktree.sh로 .env 심볼릭 링크 + docker-compose.override.yml 자동 생성, 워크트리별 고유 포트 할당 |
| 2026-04-08 | [v7.md](v7.md) | 환경 개선 | Claude Code 개발 워크플로우 문서화. 4-Agent Pipeline, Git Worktree 전략, 브랜치 동기화, test.fixme() 패턴, Doc-Driven Development, .claude/ 구조 정리 |
| 2026-04-08 | [v8.md](v8.md) | 환경 개선 | CI/CD 파이프라인 통합 (e2e.yml에 배포 job 통합, deploy-backend/frontend.yml 삭제). Slack 알림 5개→1개 정리. Claude Slack Hook 동적 정보 추가 |
| 2026-04-09 | [v9.md](v9.md) | 환경 개선 | Frontend ESLint 설정 생성 + CI `continue-on-error` 제거. lint/test 실패 시 CI 차단되도록 품질 게이트 강제 |
| 2026-04-09 | [v10.md](v10.md) | 환경 개선 | Docker Compose DB 공유 아키텍처 개선. worktree별 DB 컨테이너가 동일 볼륨 공유 → 데이터 손상 문제 해결. override로 독립 볼륨 분리 + host.docker.internal 접속 |
