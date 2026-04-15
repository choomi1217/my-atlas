# Platform — Docker 이미지 엑박 근본 수정 + AWS 배포 고려 (v5)

> 변경 유형: 버그 수정  
> 작성일: 2026-04-15  
> 버전: v0.5  
> 상태: 진행 중

---

## 요구사항

v0.4에서 Docker 이미지 엑박 수정을 시도했으나 (볼륨 마운트 추가, SecurityConfig permitAll, 403 처리), 루트 프로젝트에서 `docker compose up` 시 여전히 이미지가 엑박으로 표시된다.

### [BUG-4] Docker 볼륨 마운트 경로 불일치
로컬 dev(`cd backend && ./gradlew bootRun`)에서 업로드한 이미지는 `backend/convention-images/`에 저장되지만, Docker는 `./convention-images`(프로젝트 루트)를 마운트한다. 호스트 경로가 달라 Docker에서 이미지를 찾을 수 없다.

### [BUG-5] `useImageUpload.ts` 절대 URL 저장
KB 이미지 업로드 시 `http://localhost:8080/api/kb/images/uuid` 형태의 절대 URL이 마크다운 content에 저장된다. 포트 변경(worktree 8084)이나 프로덕션(EC2 IP)에서 기존 URL이 깨진다. Convention/feature 이미지는 이미 상대 경로를 사용하므로 KB만 문제.

### [BUG-6] `.gitignore` 누락
`feature-images/`와 루트 `convention-images/`가 `.gitignore`에 없어 Docker 실행 시 자동 생성되는 빈 디렉토리가 커밋될 수 있다.

### [DOC] AWS 배포 영향 분석
변경사항이 AWS EC2 프로덕션에 미치는 영향과 현재 아키텍처 한계를 문서화한다.

---

## 현재 코드 분석 (Context)

### BUG-4: docker-compose.yml 볼륨 마운트

```yaml
# 현재 — 프로젝트 루트의 디렉토리를 마운트
backend:
  volumes:
    - ./convention-images:/app/convention-images  # 루트에 해당 디렉토리 없음!
```

로컬 dev: `Paths.get("convention-images").toAbsolutePath()` → `{root}/backend/convention-images/`
Docker: `/app/convention-images/` ↔ 호스트 `{root}/convention-images/` (다른 경로)

### BUG-5: useImageUpload.ts

```typescript
// 현재 — 절대 URL 구성
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
return API_BASE_URL + url;  // "http://localhost:8080/api/kb/images/uuid"
```

Convention 이미지: `conventionApi.uploadImage()` → `/api/convention-images/uuid` (상대 ✅)
Feature 이미지: `featureApi.uploadImage()` → `/api/feature-images/uuid` (상대 ✅)
KB 이미지: `useImageUpload.uploadImage()` → `http://localhost:8080/api/kb/images/uuid` (절대 ❌)

### BUG-6: .gitignore 현황

```
kb-images/                    # ✅ 커버됨
backend/convention-images/    # ✅ 커버됨
feature-images/               # ❌ 누락
convention-images/ (루트)      # ❌ 누락
```

---

## 설계

### BUG-4 해결: 볼륨 마운트 경로를 `./backend/{dir}`로 수정

```yaml
backend:
  volumes:
    - ./logs:/app/logs
    - ./backend/feature-images:/app/feature-images
    - ./backend/kb-images:/app/kb-images
    - ./backend/convention-images:/app/convention-images
```

로컬 dev와 Docker가 같은 호스트 디렉토리(`backend/{dir}`)를 공유하게 된다.

Frontend에서 더 이상 사용하지 않는 `VITE_API_BASE_URL` 환경변수도 제거:
```yaml
frontend:
  environment:
    API_PROXY_TARGET: http://${COMPOSE_CONTAINER_PREFIX:-myqaweb}-backend:8080
    # VITE_API_BASE_URL 제거 — 모든 API는 상대 경로 + Vite proxy
```

### BUG-5 해결: 상대 URL로 변경 + DB 마이그레이션

```typescript
// useImageUpload.ts — API_BASE_URL 상수 제거
const url = await kbApi.uploadImage(file);
return url;  // "/api/kb/images/uuid.png" (상대 경로)
```

기존 DB 데이터의 절대 URL을 Flyway 마이그레이션으로 수정:
```sql
-- V202604151000__fix_kb_image_absolute_urls.sql
UPDATE knowledge_base
SET content = REGEXP_REPLACE(
  content, 'http://localhost:\d+(/api/kb/images/)', '\1', 'g'
)
WHERE content ~ 'http://localhost:\d+/api/kb/images/';

UPDATE knowledge_base
SET content = REPLACE(content, 'http://3.34.154.147:8080/api/kb/images/', '/api/kb/images/')
WHERE content LIKE '%http://3.34.154.147:8080/api/kb/images/%';
```

### BUG-6 해결: .gitignore 보완

```
kb-images/
convention-images/
feature-images/
backend/kb-images/
backend/convention-images/
backend/feature-images/
```

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | docker-compose.yml 볼륨 마운트 수정 + VITE_API_BASE_URL 제거 | `docker-compose.yml` |
| 2 | useImageUpload.ts 상대 URL 변환 | `frontend/src/hooks/useImageUpload.ts` |
| 3 | Flyway 마이그레이션 작성 | `backend/src/main/resources/db/migration/V202604151000__fix_kb_image_absolute_urls.sql` |
| 4 | .gitignore 보완 | `.gitignore` |

---

### Step 1 — docker-compose.yml 수정

**수정 파일:** `docker-compose.yml`

- [x] 볼륨 마운트 `./backend/feature-images:/app/feature-images` 등 3개 수정
- [x] frontend environment에서 `VITE_API_BASE_URL` 행 제거

---

### Step 2 — useImageUpload.ts 수정

**수정 파일:** `frontend/src/hooks/useImageUpload.ts`

- [x] `API_BASE_URL` 상수 제거
- [x] `uploadImage` 함수에서 `return url` (상대 경로 직접 반환)

---

### Step 3 — Flyway 마이그레이션

**신규 파일:** `backend/src/main/resources/db/migration/V202604151000__fix_kb_image_absolute_urls.sql`

- [x] `http://localhost:XXXX/api/kb/images/` → `/api/kb/images/` REGEXP_REPLACE
- [x] `http://3.34.154.147:8080/api/kb/images/` → `/api/kb/images/` REPLACE

---

### Step 4 — .gitignore 보완

**수정 파일:** `.gitignore`

- [x] `feature-images/`, `convention-images/` 추가 (루트 + backend 모두 커버)

---

## AWS 배포 영향 분석

### 영향 없는 항목 (이미 적용됨)

| 항목 | 상태 |
|------|------|
| SecurityConfig 이미지 경로 permitAll | v0.4에서 적용 완료 |
| Axios 401/403 자동 로그아웃 | v0.4에서 적용 완료 |
| `api/client.ts` baseURL `''` | CloudFront `/api` behavior로 EC2 프록시 |

### EC2 이미지 파일 수동 이동 (1회성)

볼륨 마운트 경로 변경에 따라, EC2에 기존 이미지가 있다면 한 번 수동 이동 필요:

```bash
# EC2 SSH 후 1회 실행
cd /path/to/my-atlas
mkdir -p backend/{convention-images,kb-images,feature-images}
cp -a convention-images/* backend/convention-images/ 2>/dev/null || true
cp -a kb-images/* backend/kb-images/ 2>/dev/null || true
cp -a feature-images/* backend/feature-images/ 2>/dev/null || true
```

### 현재 아키텍처 한계 (향후 과제)

| 한계 | 설명 | 위험도 |
|------|------|--------|
| 파일 시스템 저장 | EC2 인스턴스 교체/장애 시 이미지 소실 | **높음** |
| 백업 없음 | EBS 스냅샷/S3 백업 미설정 | **높음** |
| CDN 미사용 | 이미지가 백엔드 직접 서빙 (CloudFront 캐시 X) | 중간 |
| `.env.production` 잔재 | `VITE_API_BASE_URL=http://3.34.154.147:8080` — 미사용이나 혼란 소지 | 낮음 |

→ **S3 마이그레이션은 별도 작업으로 진행** (이번 범위 외)

---

## 변경 파일 목록

| 파일 | 구분 | 설명 |
|------|------|------|
| `docker-compose.yml` | 수정 | 볼륨 마운트 `./backend/{dir}`, VITE_API_BASE_URL 제거 |
| `frontend/src/hooks/useImageUpload.ts` | 수정 | 상대 URL 반환, API_BASE_URL 상수 제거 |
| `V202604151000__fix_kb_image_absolute_urls.sql` | 신규 | KB content 절대 URL → 상대 URL 마이그레이션 |
| `.gitignore` | 수정 | `feature-images/`, `convention-images/` 추가 |

---

## 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 로컬 dev로 이미지 업로드 → Docker로 실행 | 이미지 정상 표시 |
| 2 | Docker로 이미지 업로드 → 컨테이너 재시작 | 이미지 유지 (볼륨 마운트) |
| 3 | KB 에디터에서 이미지 붙여넣기 | `![image](/api/kb/images/uuid)` 형태로 저장 |
| 4 | Flyway 마이그레이션 적용 | 기존 절대 URL → 상대 URL 변환 |
| 5 | `./gradlew test` | 전체 테스트 통과 |
| 6 | E2E 전체 실행 | 전체 테스트 통과 |

---

## [최종 요약]

(모든 Step 완료 후 작성)
