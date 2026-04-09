# Ops 미해결 이슈 목록

> **최종 업데이트**: 2026-04-09  
> **기준 버전**: ops v8 이후  
> **총 이슈**: 10건 (높음 2 / 중간 5 / 낮음 3)

---

## 이슈 요약

| # | 우선순위 | 이슈 | 현재 상태 | 영향 범위 | 비고 |
|---|---------|------|----------|----------|------|
| 1 | 높음 | 백엔드 HTTPS 미적용 | **Blocked** | 보안, 사용자 신뢰 | 커스텀 도메인 미구매로 ACM 인증서 발급 불가. 도메인 구매 후 진행 가능 |
| 2 | 높음 | 프론트엔드 CI 미강제 | **완료 (v9)** | 코드 품질 | ESLint 설정 생성 + continue-on-error 제거 |
| 3 | 중간 | 모니터링/관측성 부재 | Actuator health만 존재 | 운영 안정성 | |
| 4 | 중간 | 로그 집계 없음 | EC2 로컬 파일만 존재 | 장애 대응 | |
| 5 | 중간 | DB 자동 백업 미구성 | 수동 pg_dump만 가능 | 데이터 보호 | |
| 6 | 중간 | JaCoCo 코드 커버리지 미적용 | build.gradle에 플러그인 없음 | 테스트 품질 | |
| 7 | 중간 | 프론트엔드 API URL 하드코딩 | EC2 IP 직접 참조 | 유지보수, 환경 분리 | |
| 8 | 낮음 | 로그 로테이션 없음 | FileAppender (무한 증가) | 디스크 | |
| 9 | 낮음 | SSH Security Group 전체 개방 | 0.0.0.0/0 허용 | 보안 | |
| 10 | 낮음 | Staging 환경 없음 | Production만 존재 | 배포 안전성 | |

---

## 이슈 상세

### #1. 백엔드 HTTPS 미적용 (높음)

**현재 상태**  
- 백엔드 API가 `http://3.34.154.147:8080`으로 직접 노출
- 프론트엔드(CloudFront)는 HTTPS 적용 완료
- Mixed Content: HTTPS 프론트엔드 → HTTP 백엔드 호출 시 브라우저 차단 가능성

**영향도**  
- API 통신 평문 전송 (API 키, 사용자 입력 등 노출 위험)
- 브라우저 Mixed Content 정책으로 일부 기능 동작 불가 가능
- 프로덕션 서비스 신뢰도 저하

**관련 파일**  
- `docker-compose.yml` — backend 포트 8080 직접 매핑
- `backend/src/main/java/com/myqaweb/config/WebConfig.java` — CORS에 `http://3.34.154.147:*` 패턴
- `.github/workflows/e2e.yml:234` — `VITE_API_BASE_URL: http://3.34.154.147:8080`

**해결 방향**  
1. **ALB + ACM 인증서**: ALB 생성 → ACM에서 SSL 인증서 발급 → ALB가 HTTPS 종료 → EC2:8080으로 프록시
2. **Nginx 리버스 프록시**: EC2에 Nginx 설치 → Let's Encrypt 인증서 → 443 → 8080 프록시
3. **CloudFront API 프록시**: CloudFront에 EC2를 Custom Origin으로 추가 → HTTPS 자동 적용

**예상 작업량**  
- ALB 방식: AWS 리소스 생성 + Security Group 수정 + CORS/API URL 변경 (반나절)
- Nginx 방식: Nginx 설치/설정 + 인증서 발급 + 자동 갱신 설정 (반나절)
- 추가 비용: ALB ~$16/월, Nginx는 추가 비용 없음

**비고**  
- memory `alb_https_setup_status.md`에 ALB 방식으로 Step 1-7 완료 기록 있음 (기능 구현 우선으로 일시 중단)

---

### #2. 프론트엔드 CI 미강제 (높음)

**현재 상태**  
- `.github/workflows/frontend-ci.yml`의 lint/test 스텝에 `continue-on-error: true` 설정
- lint 실패, 테스트 실패해도 CI가 통과로 표시됨
- 빌드(npm run build)만 실패 시 차단됨

**영향도**  
- 타입 에러, 린트 위반이 main에 머지될 수 있음
- 테스트가 깨진 상태로 배포 가능
- CI의 품질 게이트 역할 무력화

**관련 파일**  
- `.github/workflows/frontend-ci.yml:40-41` — lint `continue-on-error: true`
- `.github/workflows/frontend-ci.yml:46-47` — test `continue-on-error: true`

**해결 방향**  
1. `continue-on-error: true` 제거
2. lint 설정이 안정적인지 확인 (불필요한 규칙 비활성화)
3. 실패하는 테스트 수정 후 강제 전환

**예상 작업량**  
- lint 규칙 정리 + 기존 위반 수정 (1-2시간)
- `continue-on-error` 제거는 한 줄 변경

---

### #3. 모니터링/관측성 부재 (중간)

**현재 상태**  
- DB: `pg_isready` 헬스체크만 존재
- Backend: `/actuator/health` 엔드포인트만 노출 (health, info)
- 메트릭 수집, 대시보드, APM 모두 없음
- Slack 알림은 CI/CD 파이프라인 결과만 전송

**영향도**  
- 서비스 장애 시 사용자가 먼저 발견 (사전 감지 불가)
- 성능 저하, 메모리 누수, DB 연결 풀 고갈 등 감지 불가
- 장애 원인 분석 시 로그만 의존 → 시간 소요

**관련 파일**  
- `backend/src/main/resources/application.yml` — actuator 설정 (health, info만 노출)
- `backend/build.gradle` — actuator 의존성은 이미 포함

**해결 방향**  
- **최소 방안 (저비용)**: Actuator에 metrics, prometheus 엔드포인트 추가 → 수동 확인 가능
- **중간 방안**: CloudWatch Agent 설치 → EC2 CPU/메모리/디스크 메트릭 자동 수집
- **고급 방안**: Prometheus + Grafana Docker 컨테이너 추가 → 커스텀 대시보드

**예상 작업량**  
- Actuator 메트릭 노출: application.yml 수정 (30분)
- CloudWatch Agent: EC2에 설치 + IAM 역할 설정 (1-2시간)
- Prometheus + Grafana: docker-compose에 서비스 추가 + 대시보드 구성 (반나절)
- 추가 비용: CloudWatch 기본 무료, Grafana는 EC2 리소스 추가 사용

---

### #4. 로그 집계 없음 (중간)

**현재 상태**  
- 로그가 EC2 로컬 파일(`./logs/backend_{SESSION_TS}.log`)에만 저장
- SSH 접속해서 직접 파일을 읽어야 확인 가능
- 세션별 파일 분리 (재시작 시 새 파일 생성) → 어떤 파일을 봐야 하는지 파악 필요
- JSON 포맷이 아닌 텍스트 포맷 → 파싱/검색 어려움

**영향도**  
- 장애 시 SSH 접속 → 파일 찾기 → 수동 분석의 느린 대응
- 여러 세션 로그를 교차 분석하기 어려움
- 검색/필터링 불가 (텍스트 기반)

**관련 파일**  
- `backend/src/main/resources/logback-spring.xml` — FileAppender, 텍스트 패턴
- `docker-compose.yml:40` — `./logs:/app/logs` 볼륨 마운트

**해결 방향**  
- **최소 방안**: logback에 JSON 포맷 추가 (logstash-logback-encoder)
- **중간 방안**: CloudWatch Logs Agent → EC2 로그를 CloudWatch로 자동 전송
- **고급 방안**: ELK (Elasticsearch + Logstash + Kibana) 또는 Loki + Grafana

**예상 작업량**  
- JSON 포맷: logback-spring.xml 수정 + 의존성 추가 (1시간)
- CloudWatch Logs: Agent 설치 + IAM 역할 + 로그 그룹 설정 (2-3시간)
- 추가 비용: CloudWatch Logs 수집/저장 비용 (소량이면 월 $1 미만)

---

### #5. DB 자동 백업 미구성 (중간)

**현재 상태**  
- 수동 `pg_dump`만 문서화 (v3에서 최초 마이그레이션 시 사용)
- 자동 스케줄 백업 없음
- DB 복제/HA 없음 (단일 Docker 컨테이너)
- `knowledge_base` 테이블에 재생성 비용이 높은 임베딩 데이터 372건+ 존재

**영향도**  
- EC2 장애, 디스크 손상, 실수로 `docker compose down -v` 실행 시 전체 데이터 소실
- knowledge_base 재생성 시 OpenAI Embedding API 비용 + 수십 분 처리 시간
- 복구 시점(RPO)이 마지막 수동 백업 시점으로 제한

**관련 파일**  
- `docker-compose.yml:57-58` — pgdata 볼륨 (단일 인스턴스 영속화)
- `docs/ops/v3.md` — Step 5에서 수동 pg_dump/pg_restore 절차 문서화

**해결 방향**  
1. **cron + pg_dump**: EC2에 cron job 등록 → 매일 pg_dump → S3 업로드
2. **스크립트 작성**: `scripts/backup-db.sh` → pg_dump + gzip + aws s3 cp
3. **보존 정책**: S3 Lifecycle Rule로 30일 이상 백업 자동 삭제

**예상 작업량**  
- 백업 스크립트 + cron 설정 (1-2시간)
- S3 버킷 생성 + IAM 정책 (30분)
- 추가 비용: S3 저장 비용 (수 MB 수준, 월 $0.1 미만)

---

### #6. JaCoCo 코드 커버리지 미적용 (중간)

**현재 상태**  
- `build.gradle`에 JaCoCo 플러그인 없음
- `backend-ci.yml`에 JaCoCo 관련 스텝 주석 처리 상태
- 백엔드 테스트 179개가 존재하지만, 커버리지 측정/강제가 안 됨

**영향도**  
- 신규 코드 추가 시 테스트 없이 머지 가능
- 테스트 커버리지 추이 파악 불가
- 코드 리뷰 시 테스트 충분성 판단 근거 없음

**관련 파일**  
- `backend/build.gradle` — JaCoCo 플러그인 미등록
- `.github/workflows/backend-ci.yml:67-85` — JaCoCo 스텝 전체 주석 처리

**해결 방향**  
1. `build.gradle`에 `id 'jacoco'` 플러그인 추가
2. `jacocoTestReport` + `jacocoTestCoverageVerification` task 설정
3. 최소 커버리지 기준 설정 (70% line coverage 권장)
4. `backend-ci.yml`에서 주석 해제

**예상 작업량**  
- build.gradle 수정 + CI 주석 해제 (30분)
- 기존 커버리지 확인 후 기준값 조정 (1시간)

---

### #7. 프론트엔드 API URL 하드코딩 (중간)

**현재 상태**  
- `e2e.yml:234`에서 `VITE_API_BASE_URL: http://3.34.154.147:8080` 직접 참조
- `frontend-ci.yml:57`에서 `VITE_API_BASE_URL: http://localhost:8080`
- `WebConfig.java:13`에서 CORS origin에 `http://3.34.154.147:*` 하드코딩
- Vite의 특성상 빌드 시점에 환경변수가 번들에 포함되어 런타임 변경 불가

**영향도**  
- EC2 IP 변경 시 여러 파일 수동 수정 필요
- Staging/Production 환경 분리 불가
- 도메인 연결 시 대규모 변경 필요

**관련 파일**  
- `.github/workflows/e2e.yml:234` — `VITE_API_BASE_URL: http://3.34.154.147:8080`
- `.github/workflows/frontend-ci.yml:57` — `VITE_API_BASE_URL: http://localhost:8080`
- `backend/src/main/java/com/myqaweb/config/WebConfig.java:13` — CORS origin에 IP 직접 포함

**해결 방향**  
1. `VITE_API_BASE_URL`을 GitHub Secrets (`BACKEND_API_URL`)로 관리
2. CORS origin도 환경변수화 (`CORS_ALLOWED_ORIGINS`)
3. #1 HTTPS 이슈 해결 시 함께 도메인 기반으로 전환

**예상 작업량**  
- GitHub Secret 등록 + 워크플로우 수정 (30분)
- WebConfig 환경변수화 (30분)

---

### #8. 로그 로테이션 없음 (낮음)

**현재 상태**  
- `logback-spring.xml`에서 `FileAppender` 사용 (RollingFileAppender 아님)
- 세션별 새 파일은 생성되지만, 각 파일이 무한히 커질 수 있음
- 오래된 로그 파일 자동 삭제 정책 없음

**영향도**  
- 장기 운영 시 디스크 공간 점진적 소진
- EC2 gp3 30GB 중 로그가 차지하는 비율 증가
- 디스크 풀 시 DB/Backend 동시 장애 가능

**관련 파일**  
- `backend/src/main/resources/logback-spring.xml:22-27` — FileAppender 설정

**해결 방향**  
1. `FileAppender` → `RollingFileAppender` 변경
2. `SizeAndTimeBasedRollingPolicy` 적용 (일별 로테이션 + 100MB 단위 분할)
3. `maxHistory` 설정 (30일 보관 후 자동 삭제)
4. `totalSizeCap` 설정 (전체 로그 최대 1GB)

**예상 작업량**  
- logback-spring.xml 수정 (30분)

---

### #9. SSH Security Group 전체 개방 (낮음)

**현재 상태**  
- Security Group `sg-0c9c6e4934a014ce7`의 SSH(22번 포트) 인바운드가 `0.0.0.0/0` (전체 인터넷)
- Key Pair 인증으로 보호되지만, 무차별 대입 공격 노출
- v3에서 최초 구성 시 편의상 전체 개방 후 미변경

**영향도**  
- SSH 무차별 대입 공격 시도 노출 (Key Pair로 차단되지만 로그 노이즈)
- 보안 감사 시 즉시 지적 대상
- Key Pair 유출 시 즉시 침해 가능

**관련 파일**  
- AWS Console → VPC → Security Groups → `sg-0c9c6e4934a014ce7` (코드 외부)
- `docs/ops/v3.md` — Step 1에서 Security Group 생성 시 0.0.0.0/0 설정

**해결 방향**  
1. SSH 인바운드 규칙을 관리자 IP로 제한 (예: 집/사무실 IP)
2. 유동 IP 사용 시 VPN 또는 AWS SSM Session Manager로 SSH 대체
3. fail2ban 설치 (SSH 무차별 대입 방어)

**예상 작업량**  
- Security Group 규칙 변경: AWS Console에서 1분
- SSM Session Manager 설정: IAM 역할 + Agent 설치 (1시간)

---

### #10. Staging 환경 없음 (낮음)

**현재 상태**  
- Production(main 브랜치) 환경만 존재
- develop 브랜치는 로컬 Docker Compose로만 테스트
- E2E 테스트는 CI에서 실행되지만 실제 AWS 환경과 동일하지 않음

**영향도**  
- AWS 환경 특유의 문제 (네트워크, IAM, 보안 그룹 등)를 배포 전 검증 불가
- 프로덕션에서만 발견되는 버그 위험
- 롤백 전략 부재와 결합 시 사고 확대 가능

**관련 파일**  
- `.github/workflows/e2e.yml` — deploy-gate가 main push만 트리거
- `docs/ops/ops.md` — "Staging 환경 없음" 기록

**해결 방향**  
1. **최소 방안**: develop 브랜치 push 시 EC2에 별도 포트로 배포 (같은 인스턴스)
2. **중간 방안**: EC2 인스턴스 1대 추가 (t3.micro, Staging 전용)
3. **고급 방안**: ECS/Fargate로 환경별 클러스터 분리

**예상 작업량**  
- 같은 인스턴스 방식: docker-compose.override 활용 (2-3시간)
- 별도 인스턴스: EC2 생성 + 환경 설정 + CI/CD 수정 (반나절)
- 추가 비용: t3.micro Staging ~$8/월 (프리 티어 해당 시 무료)

---

## 권장 해결 순서

아래 순서는 **영향도 × 긴급도** 기준으로 배치했다.

| 순서 | 이슈 | 이유 |
|------|------|------|
| 1 | #2 프론트엔드 CI 미강제 | 작업량 최소, 즉시 품질 게이트 확보 |
| 2 | #1 백엔드 HTTPS | 보안 최우선, Mixed Content 차단 위험 |
| 3 | #7 API URL 하드코딩 | #1 해결 시 함께 처리 가능 |
| 4 | #6 JaCoCo | 작업량 적고 테스트 품질 가시성 확보 |
| 5 | #8 로그 로테이션 | 30분 작업으로 디스크 풀 예방 |
| 6 | #5 DB 자동 백업 | 데이터 보호 (knowledge_base 임베딩 비용 고려) |
| 7 | #4 로그 집계 | 장애 대응 속도 개선 |
| 8 | #3 모니터링 | #4와 함께 관측성 확보 |
| 9 | #9 SSH Security Group | 보안 강화 (현재 Key Pair로 방어 중) |
| 10 | #10 Staging 환경 | 장기 과제, 현재 규모에서는 E2E로 대체 가능 |
