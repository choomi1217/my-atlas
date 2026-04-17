# my-atlas Ops 현황 종합

> **최종 업데이트**: 2026-04-17

## 개요

my-atlas 프로젝트의 운영 인프라 전체 현황을 정리한 메인 명세서.
CI/CD, Docker, 클라우드 인프라, 모니터링, 데이터베이스, 빌드 도구, 환경 설정을 포괄한다.

---

## 1. 인프라 아키텍처

### 현재 구성

```
[사용자 브라우저]
  │
  ├─ https://youngmi.works
  │     → Route 53 (A Alias)
  │     → CloudFront (EVMWQ4ZH85AXV)
  │     ├─ /* → S3 (my-atlas-frontend)        # React SPA
  │     └─ /images/* → S3 (my-atlas-images)   # 이미지 CDN 서빙
  │
  └─ https://api.youngmi.works
        → Route 53 (A Alias)
        → ALB (my-atlas-alb, HTTPS:443)
        → EC2:8080 (Spring Boot Docker)
              └── PostgreSQL (Docker, 내부 5432)
                  └── pgdata volume
```

### AWS 리소스 목록

| 리소스 | 타입 | ID | 상태 |
|--------|------|----|----|
| VPC | Network | vpc-0dd2d80dcf32b9926 | Active |
| Public Subnet (2a) | Network | subnet-0a65868480a1cd1f0 | Active |
| Public Subnet (2b) | Network | (ALB용 추가) | Active |
| Internet Gateway | Network | igw-07bc7f096f422f570 | Active |
| Security Group (EC2) | Network | sg-0c9c6e4934a014ce7 | Active |
| EC2 | Compute | i-0242a794b86668829 (t3.small) | Active |
| Elastic IP | Network | 3.34.154.147 | Active |
| ALB | Load Balancer | my-atlas-alb | Active |
| Target Group | Load Balancer | my-atlas-backend (EC2:8080) | Healthy |
| Route 53 | DNS | youngmi.works Hosted Zone | Active |
| ACM (us-east-1) | Certificate | *.youngmi.works (CloudFront용) | ISSUED |
| ACM (ap-northeast-2) | Certificate | *.youngmi.works (ALB용) | ISSUED |
| S3 | Storage | my-atlas-frontend | Active |
| S3 | Storage | my-atlas-images | Active |
| CloudFront | CDN | EVMWQ4ZH85AXV | Active |
| Key Pair | Auth | my-atlas-key | Active |

### 미구성 항목
- Auto Scaling Group 없음
- Staging 환경 없음

### 예상 월 비용: ~$36-41 (t3.small + ALB 상시 가동 기준)

---

## 2. CI/CD 파이프라인

### 워크플로우 현황 (`.github/workflows/`)

| 워크플로우 | 트리거 | 상태 | 비고 |
|-----------|--------|------|------|
| `backend-ci.yml` | Push/PR (main, develop) | 정상 | JaCoCo 활성 (70% 커버리지 강제) |
| `frontend-ci.yml` | Push/PR (main, develop) | 정상 | lint/test 실패 시 빌드 차단 (v9) |
| `e2e.yml` | Push/PR + manual | 정상 | E2E + 배포 통합 파이프라인 (v8) |

### 배포 흐름

```
feature/* → develop (PR) → main (PR)
                                │
                          e2e.yml (통합)
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
                  E2E 테스트  deploy-backend  deploy-frontend
                              (SSH → EC2)   (S3 + CloudFront)
```

### CI/CD 주요 이슈

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| ~~배포 게이트 없음~~ | ~~높음~~ | → **v8에서 해결** (e2e.yml에 배포 job 통합) |
| ~~Frontend CI 미강제~~ | ~~중간~~ | → **v9에서 해결** (ESLint + continue-on-error 제거) |
| ~~JaCoCo 미적용~~ | ~~중간~~ | → **v14에서 해결** (70% line coverage 강제) |
| ~~API URL 하드코딩~~ | ~~중간~~ | → **v14/v17에서 해결** (CORS 환경변수화 + 커스텀 도메인) |
| 롤백 전략 없음 | 중간 | 배포 실패 시 수동 대응만 가능 |

### Slack 알림
- 모든 워크플로우에 Slack 알림 연동 완료 (Block Kit 포맷)
- 성공/실패 모두 알림 발송 (`always()` 조건)

---

## 3. Docker 구성

### Docker Compose 구성 (v16)

**DB와 App은 별도 Compose 프로젝트로 완전 분리:**

| Compose 파일 | 프로젝트 이름 | 서비스 | 포트 |
|-------------|-------------|--------|------|
| `docker-compose.db.yml` | `myatlas-db` | db (pgvector:pg15) | 5432 |
| `docker-compose.yml` | `my-atlas` | backend, frontend | 8080, 5173 |

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
| 로깅 | 적용 | RollingFileAppender + JSON 포맷 (v14) |
| 메트릭 | 없음 | Actuator metrics 미노출 |
| 대시보드 | 없음 | Grafana/CloudWatch 없음 |
| 알림 | CI/CD만 | Slack 알림 (파이프라인 결과만) |
| APM | 없음 | 트레이싱/성능 모니터링 없음 |
| 로그 집계 | 없음 | EC2 로컬 파일만 존재 |

### 로깅 설정 (logback-spring.xml, v14)
- Console + File(텍스트) + File(JSON) 3중 출력
- `RollingFileAppender` — 일별 로테이션, 100MB 분할, 30일 보관, 1GB 총 용량 제한
- 텍스트 로그: `backend.log` (사람 읽기용)
- JSON 로그: `backend-json.log` (기계 파싱용, `logstash-logback-encoder`)
- com.myqaweb: DEBUG / root: INFO

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

JaCoCo 적용 (v14): 70% line coverage 강제, CI에서 자동 리포트 생성
미적용: SpotBugs, 의존성 취약점 스캔

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
| HTTPS (프론트엔드) | 적용 | CloudFront + ACM (`youngmi.works`) |
| HTTPS (백엔드) | 적용 | ALB + ACM (`api.youngmi.works`) (v17) |
| Security Group | 과다 개방 | SSH 22번 포트 0.0.0.0/0 허용 |
| DB 접근 | 내부만 | Docker 네트워크 내 통신 |
| CORS | 적용 | 환경변수화 완료 (`CORS_ALLOWED_ORIGIN_PATTERNS`) (v14) |
| 입력 검증 | 적용 | spring-boot-starter-validation |

---

## 9. 종합 평가

### 강점
- 모던 기술 스택 (Spring Boot 3.3, React 18, Vite, Docker)
- CI/CD 통합 파이프라인 (E2E + 배포 + Slack 알림)
- E2E 테스트 98개 전부 통과
- 커스텀 도메인 + HTTPS 전면 적용 (`youngmi.works` / `api.youngmi.works`)
- 이미지 S3 + CloudFront CDN 서빙
- JaCoCo 70% 커버리지 강제
- 로그 로테이션 + JSON 포맷 병행
- CORS/API URL 환경변수화 (IP 하드코딩 제거)
- Flyway 마이그레이션으로 스키마 관리 (타임스탬프 기반)
- Slack 알림 연동 (CI/CD + Claude Code 세션)
- 운영 문서화 우수 (19개 버전 문서)

### 개선 필요

| 우선순위 | 항목 | 현재 | 목표 |
|----------|------|------|------|
| ~~높음~~ | ~~배포 게이트~~ | ~~E2E와 배포 분리~~ | ✅ **v8에서 해결** |
| ~~높음~~ | ~~백엔드 HTTPS~~ | ~~HTTP 직접 노출~~ | ✅ **v17에서 해결** (ALB + ACM) |
| ~~높음~~ | ~~프론트엔드 CI 강제~~ | ~~continue-on-error~~ | ✅ **v9에서 해결** |
| ~~중간~~ | ~~JaCoCo~~ | ~~비활성~~ | ✅ **v14에서 해결** (70% 강제) |
| ~~중간~~ | ~~API URL 하드코딩~~ | ~~IP 직접 참조~~ | ✅ **v14/v17에서 해결** |
| ~~낮음~~ | ~~로그 로테이션~~ | ~~없음~~ | ✅ **v14에서 해결** |
| 중간 | 모니터링 | 없음 | CloudWatch 또는 Prometheus + Grafana |
| 중간 | 로그 집계 | EC2 로컬 파일 | CloudWatch Logs 또는 ELK |
| 중간 | DB 자동 백업 | 수동 pg_dump | 자동 스케줄 백업 |
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
| 2026-04-10 | [v11.md](v11.md) | 환경 개선 | Worktree 개발 환경 개선. (1) 문서 가시성: CLAUDE.md에 메인 레포 양쪽 작성 규칙 추가. (2) DB 독립 분리: docker-compose.db.yml로 DB 라이프사이클 분리, app compose down 시에도 DB 유지 |
| 2026-04-13 | [v12.md](ops_v12.md) | 버그 수정 | Flyway validation 실패 수정. 공유 DB 환경에서 worktree 간 마이그레이션 충돌(description mismatch) 해결. `validate-on-migrate: false` 추가 |
| 2026-04-13 | [v13.md](ops_v13.md) | 환경 개선 | Worktree Git 워크플로우 표준화. `wt.sh sync/status` 명령 추가, 심링크로 CLAUDE.md 단일화, Git 생명주기 규칙 명문화, Agent-D 4→3 Step 개선 |
| 2026-04-16 | [v14.md](ops_v14.md) | 환경 개선 | 로깅 개선(로테이션 + JSON), JaCoCo 70% 강제, CORS 환경변수화, Dockerfile Gradle 캐싱 |
| 2026-04-16 | [v15.md](ops_v15.md) | 버그 수정 | Slack 알림 JSON 파싱 오류 수정. 커밋 메시지를 이스케이프 없이 JSON에 삽입 → 첫 줄만 추출 + 72자 truncate + JSON 이스케이프 처리 |
| 2026-04-16 | [v16.md](ops_v16.md) | 버그 수정 | DB Compose 프로젝트 완전 독립 분리. `name: myatlas-db`로 프로젝트 이름 분리, `.env` DB 접속 주소를 `host.docker.internal`로 변경 |
| 2026-04-16 | [v17.md](ops_v17.md) | 환경 개선 | 커스텀 도메인 + HTTPS 프로덕션 배포. `youngmi.works` 도메인, ALB HTTPS, CloudFront 커스텀 도메인, CORS/API URL 환경변수화 |
| 2026-04-17 | [v18.md](ops_v18.md) | 환경 개선 | 이미지 저장소 S3 전환. EC2 로컬 파일시스템 → S3(`my-atlas-images`) + CloudFront CDN 서빙. S3ImageService 통합, 이미지 GET 엔드포인트 제거 |
| 2026-04-17 | [v19.md](ops_v19.md) | 버그 수정 | Deploy health check 재시도 방식 전환. `sleep 15` + 1회 → 10초 간격 최대 60초 재시도 루프. 실패 시 컨테이너 로그 출력 |
