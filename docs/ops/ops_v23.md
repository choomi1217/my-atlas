> 변경 유형: 환경 개선
> 작성일: 2026-04-21
> 버전: v23
> 상태: 계획 수립

---

# Ops v23 — 로컬 DB → AWS 운영 DB 마이그레이션 (이미지 포함)

## 1. 배경

### 현재 상태
- 로컬 DB에 운영용 시드 데이터를 직접 쌓아둔 상태
  - Toss Place TC 31건 + Test Run 9건 (V202604150900)
  - POS 재구성 (V202604151500)
  - 배민 TC + Test Run (V202604161500, V202604161600)
  - Statistics 스냅샷 필드 (V202604170900)
  - 수기로 추가한 Convention, KB HTML, test_case_image, test_result_comment 등
- AWS 운영 DB의 `knowledge_base`는 기존 청킹 품질이 미달 상태 → **전면 재청킹 필요**
- 아직 데이터 추가 작업이 더 남아 있음 → **이번 문서는 계획 수립까지, 실행은 추후**

### 목표
- 로컬 DB의 운영 데이터를 AWS 운영 DB에 이관
- 이미지 파일(로컬 파일시스템) → S3 `my-atlas-images` 버킷으로 함께 이관
- **`knowledge_base` / `pdf_upload_job`은 prod에서 삭제 후 UI를 통한 PDF 재업로드로 재생성** (pgvector 덤프·복원 리스크 회피, 로컬과 동일한 파이프라인으로 안전하게 재구성)
- 그 외 모든 테이블(`app_user`, `chat_session`, `chat_message`, `test_result`, `ticket` 포함)은 **전부 로컬 데이터로 덮어쓰기 확정**

### 사전 확인 완료 사항
- **DB 이미지 경로는 환경 중립** — `convention.image_url`, `test_case_image.filename`, `test_result_comment.image_url`, `knowledge_base.content`(HTML img) 전부 상대경로 `/images/{folder}/{uuid}.png`
  - Local: `/images/**` resource handler → 백엔드 파일시스템
  - Prod: CloudFront → S3 `my-atlas-images/images/{folder}/{uuid}.png`
  - → **DB 데이터는 경로 재작성 없이 그대로 복사해도 양쪽 환경에서 해석됨**
- **이미지 실체는 별도 이관 필요** — DB만 싱크하고 파일을 빠뜨리면 prod UI에서 전부 깨진 이미지
- **KB는 재업로드 방식 채택** — 로컬 KB 덤프를 prod로 복원하는 방식은 pgvector 포맷 호환성 리스크가 있어 배제. prod에서 UI로 PDF 재업로드 → 기존 비동기 파이프라인 재사용이 가장 안전

### ⚠️ CLAUDE.md 예외 처리 명시
- `CLAUDE.md`에 `knowledge_base` / `pdf_upload_job` 삭제 금지 규칙이 있음 (임베딩 비용·재생성 시간 보호 목적)
- **이번 작업은 1회성 예외**: 기존 prod KB의 청킹 품질 문제로 전면 재구성이 필요하며 유저가 명시 승인
- 이 예외 범위를 벗어나는 KB 삭제/수정은 여전히 금지

---

## 2. 리스크 요약

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| S3 업로드 누락 → prod에서 깨진 이미지 | 높음 | DB 싱크 **전에** S3 업로드 먼저 수행, 업로드 후 카운트 검증 |
| `app_user` 덮어쓰기로 prod 로그인 실패 | 중간 | 유저 명시 승인 완료 — 로컬 계정 비번 그대로 사용 |
| PDF 재업로드 중 OpenAI API 실패 | 중간 | 책 단위로 순차 업로드, 실패 시 해당 책만 재시도 (FAILED 상태 job 삭제 후 재업로드) |
| 재업로드 기간 중 prod `/senior` RAG 일시 품질 저하 | 중간 | 비핵심 경로, 재업로드 완료(`DONE`)까지 대기 후 공지 |
| 로컬 DB에 작업 중인 미완성 데이터가 함께 넘어감 | 중간 | 실행 직전 로컬 DB 상태 스냅샷 검토 (테이블별 row count, 샘플 row) |
| FK 순서 꼬임으로 복원 실패 | 중간 | `--disable-triggers` 플래그 사용 중 (기존 스크립트) — 그대로 유지 |
| 원본 PDF 파일 분실로 재업로드 불가 | 중간 | Step 0에서 원본 PDF 위치 및 버전 리스트 확정, 없으면 실행 중단 |
| CloudFront 캐시에 이전 이미지가 남아 있음 | 낮음 | 신규 UUID 파일이라 충돌 없음. 동일 키 덮어쓰기 발생 시 invalidation 필요 |

---

## 3. 마이그레이션 계획

### 전제 조건 체크리스트
- [ ] 로컬 DB에 넣을 데이터 작업이 모두 끝났는지 유저 확인
- [ ] 원본 PDF 파일이 로컬 디스크에 온전히 보관돼 있는지 확인 (책 제목, 파일명, 버전)
- [ ] `~/.ssh/my-atlas-key.pem` 존재 및 권한 600
- [ ] AWS CLI 로그인 상태 (`aws sts get-caller-identity`)
- [ ] 로컬 DB 컨테이너(`myqaweb-db`) 실행 중
- [ ] 로컬 백엔드 컨테이너의 이미지 파일 경로 확정

### Step 0 — 인벤토리 (로컬)

```sql
-- DB에서 참조 중인 이미지 경로 전체 수집
SELECT 'convention' as src, image_url FROM convention WHERE image_url IS NOT NULL
UNION ALL
SELECT 'test_case_image', filename FROM test_case_image
UNION ALL
SELECT 'test_result_comment', image_url FROM test_result_comment WHERE image_url IS NOT NULL;
```

```sql
-- 재업로드 대상 KB 책 목록 (source 기준)
SELECT source, count(*) as chunks, min(created_at) as first_upload
FROM knowledge_base
WHERE source IS NOT NULL
GROUP BY source
ORDER BY source;
```

```bash
# KB 본문 내 <img src="/images/..."> 추출
docker exec myqaweb-db psql -U myqaweb -d myqaweb -t -c \
  "SELECT content FROM knowledge_base WHERE content LIKE '%<img%';" \
  | grep -oE '/images/[^"]+' | sort -u

# 로컬 파일시스템 이미지 목록
docker exec <backend-container> find /app/uploads/images -type f
```

**검증 포인트**:
- DB 참조 경로와 파일시스템 파일명이 1:1 매칭되는지 확인
- 재업로드할 책별로 **원본 PDF 파일 위치 명기** (책 제목 ↔ 파일 경로 맵)

### Step 1 — 이미지 파일 S3 업로드 (DB 싱크 前)

```bash
# 백엔드 컨테이너에서 호스트로 이미지 꺼내기
docker cp <backend-container>:/app/uploads/images ./tmp-images

# prod 기존 이미지 사전 백업 (롤백 대비)
aws s3 sync s3://my-atlas-images/images/ ./prod-images-backup/

# S3로 업로드 (convention, kb, feature 폴더 구조 보존)
aws s3 sync ./tmp-images/ s3://my-atlas-images/images/ \
  --exclude "*.DS_Store" \
  --cache-control "public, max-age=31536000, immutable"

# 업로드 카운트 검증 (로컬 = S3)
LOCAL_COUNT=$(find ./tmp-images -type f | wc -l)
S3_COUNT=$(aws s3 ls s3://my-atlas-images/images/ --recursive | wc -l)
echo "Local: $LOCAL_COUNT / S3: $S3_COUNT"

# 정리
rm -rf ./tmp-images
```

**검증 포인트**:
- `LOCAL_COUNT == S3_COUNT`
- 샘플 URL 브라우저에서 직접 열기: `https://{cloudfront-domain}/images/convention/{uuid}.png`
- 403/404 시 OAC 정책·버킷 정책 확인

### Step 2 — prod KB / pdf_upload_job 초기화

**⚠️ CLAUDE.md 예외 적용 범위 — 이 단계만 한정 1회성 실행**

```bash
# 실행 전 AWS DB 전체 백업 (필수)
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker exec myqaweb-db pg_dump -U myqaweb -d myqaweb --data-only \
     > /tmp/aws-backup-pre-v23-$(date +%Y%m%d%H%M%S).sql"

# prod KB / pdf_upload_job 삭제
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
    \"DELETE FROM knowledge_base WHERE source IS NOT NULL;
      DELETE FROM pdf_upload_job;
      SELECT count(*) FROM knowledge_base;
      SELECT count(*) FROM pdf_upload_job;\""
```

- `WHERE source IS NOT NULL` 조건으로 **PDF 유래 청크만 삭제** (수동 입력 KB는 Step 3 sync에서 덮어쓰기되므로 유지해도 무방)
- 수동 KB까지 통째로 날리고 싶다면 `DELETE FROM knowledge_base;` 로 변경 (Step 3에서 로컬 데이터로 덮어쓰기되므로 안전)

### Step 3 — DB 싱크 실행 (그 외 테이블)

```bash
./scripts/sync-db-to-aws.sh
```

**기존 스크립트 그대로 사용** — PROTECTED_TABLES(`knowledge_base`, `pdf_upload_job`, `flyway_schema_history`)는 수정하지 않음.

동작:
1. 로컬 DB `pg_dump --data-only --disable-triggers` (protected 테이블 제외)
2. EC2로 scp
3. AWS DB에서 protected 제외 전 테이블 `TRUNCATE CASCADE`
4. 덤프 파일 `psql` 복원
5. 주요 테이블 row count 출력

**덮어쓰기 대상**:
`app_user`, `company`, `product`, `segment`, `test_case`, `test_case_image`, `test_run`, `version`, `version_phase`, `test_result`, `test_result_comment`, `ticket`, `convention`, `chat_session`, `chat_message`, `kb_category`, `daily_test_snapshot`

**보존 대상** (Step 2에서 비워졌고 Step 4에서 재생성될 예정):
`knowledge_base`, `pdf_upload_job`, `flyway_schema_history`

### Step 4 — prod UI에서 PDF 재업로드

1. prod (`https://youngmi.works`) 로그인
2. `/kb` 페이지 → PDF 업로드 모달 진입
3. Step 0에서 확정한 책 목록 순서대로 업로드 (책 제목 동일하게 입력)
4. 각 업로드 후 `pdf_upload_job` 상태 모니터링:
   - `PENDING` → `PROCESSING` → `DONE` 흐름 확인
   - `FAILED` 발생 시 해당 job 삭제 후 재업로드
5. 모든 책이 `DONE` 될 때까지 대기

**모니터링 쿼리**:
```bash
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
    \"SELECT book_title, status, progress, created_at
      FROM pdf_upload_job
      ORDER BY created_at DESC;\""
```

### Step 5 — 사후 검증

```bash
# 1. 테이블별 row count 비교 (로컬 vs AWS)
docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
  "SELECT 'company' t, count(*) FROM company UNION ALL
   SELECT 'product', count(*) FROM product UNION ALL
   SELECT 'test_case', count(*) FROM test_case UNION ALL
   SELECT 'convention', count(*) FROM convention UNION ALL
   SELECT 'test_case_image', count(*) FROM test_case_image
   ORDER BY 1;"

ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \"... 동일 쿼리 ...\""

# 2. prod KB 재생성 결과 확인
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147 \
  "docker exec myqaweb-db psql -U myqaweb -d myqaweb -c \
    \"SELECT count(*) kb_total,
             count(embedding) kb_embedded,
             count(DISTINCT source) kb_sources
      FROM knowledge_base;\""
# → kb_embedded == kb_total (임베딩 누락 없음), kb_sources == 업로드한 책 수

# 3. UI 스모크 테스트 (youngmi.works)
#   - 로그인 (로컬 계정 비번 그대로)
#   - /conventions 이미지 표시
#   - /features 드릴다운 → test case image 표시
#   - /kb HTML 내 embedded 이미지 표시 (있을 경우)
#   - /senior 챗봇 — 재청킹 전 품질 문제를 일으킨 질의로 응답 확인
```

### Step 6 — 롤백 플랜 (이슈 발생 시)

| 시나리오 | 롤백 |
|----------|------|
| 이미지 업로드 실패 | `aws s3 sync ./prod-images-backup/ s3://my-atlas-images/images/` |
| DB 복원 실패 (Step 3) | Step 2의 `/tmp/aws-backup-pre-v23-*.sql`을 prod에 `psql`로 재적용 |
| PDF 재업로드 반복 실패 | 해당 책의 `pdf_upload_job` 삭제 후 다른 chunk size 또는 수정된 파일로 재시도 |
| prod 완전 먹통 | EC2 인스턴스 스냅샷에서 복구 (사전 스냅샷 생성 권장) |

---

## 4. 스크립트 개선 제안 (선택)

### 4.1 AWS DB 사전 백업을 `sync-db-to-aws.sh`에 통합
```bash
# 스크립트 최상단에 추가
echo "=== [0/5] AWS DB 사전 백업 ==="
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" \
  "docker exec $REMOTE_DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME \
     --data-only > /tmp/aws-backup-$(date +%Y%m%d%H%M%S).sql"
echo "  백업 완료"
```

### 4.2 이미지 S3 업로드 통합 여부
현재는 수동 2단계가 안전. 정기 동기화 필요성이 생기면 통합 고려.

---

## 5. 실행 타임라인 (추정)

| 단계 | 소요 시간 | 비고 |
|------|-----------|------|
| Step 0 인벤토리 | 10분 | SQL + find + 원본 PDF 위치 확정 |
| Step 1 S3 업로드 | 1-3분 | 파일 수에 비례, 현재 소량 |
| Step 2 prod KB 초기화 | 2분 | 백업 + DELETE |
| Step 3 DB 싱크 | 2-5분 | 기존 스크립트 |
| Step 4 PDF 재업로드 | 책 1권당 3-10분 (비동기) | 책 수에 비례, 병렬 불가 권장 |
| Step 5 검증 | 10분 | UI 스모크 포함 |
| **합계** | **책 N권 기준 30분 + N×5분** | |

---

## 6. 실행 전 유저 확인 필요 항목

- [ ] 로컬 DB 데이터 추가 작업 완료 선언
- [ ] 원본 PDF 파일 목록 및 위치 확정
- [ ] 스크립트 개선 항목(4.1) 반영 여부
- [ ] 실행 시점 (운영 트래픽이 거의 없는 시간대 권장)
- [ ] 실행 후 prod 로그인 테스트용 계정 1개 확정

---

## 7. Step 진행 체크리스트

- [ ] Step 0 — 인벤토리 수집 및 원본 PDF 위치 확정
- [ ] Step 1 — 이미지 S3 업로드 및 카운트 검증
- [ ] Step 2 — prod KB / pdf_upload_job 초기화 (백업 + DELETE)
- [ ] Step 3 — `sync-db-to-aws.sh` 실행 (KB 제외 전 테이블)
- [ ] Step 4 — prod UI에서 PDF 재업로드 및 `DONE` 대기
- [ ] Step 5 — row count + KB 임베딩 + UI 스모크 검증
- [ ] 최종 요약 작성

---

## 참고 파일

- `scripts/sync-db-to-aws.sh` — DB 싱크 스크립트 (기존, 수정 불필요)
- `backend/src/main/java/com/myqaweb/config/S3Config.java:38-55` — Local/S3 ImageService 자동 선택
- `backend/src/main/java/com/myqaweb/common/{ImageService,S3ImageService,LocalImageService}.java` — 이미지 저장 구현
- `backend/src/main/resources/db/migration/V202604171158__migrate_image_urls_to_s3.sql` — 과거 경로 정규화 마이그레이션 (참고)
- `backend/src/main/java/com/myqaweb/knowledgebase/` — PDF 업로드 / 청킹 / 임베딩 파이프라인
- `docs/ops/aws-deployment-architecture.md` — AWS 인프라 종합
- `CLAUDE.md` — `knowledge_base` / `pdf_upload_job` 삭제 금지 규칙 (이번 작업은 명시 예외)
