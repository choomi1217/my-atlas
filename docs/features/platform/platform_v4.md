# Platform — Docker 이미지 볼륨 마운트 누락 수정 (v4)

> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v0.4  
> 상태: 진행 중

---

## 요구사항

Docker를 통해 worktree 코드를 실행한 후 테스트하면, 이미지 관련 기능들이 전부 엑박(broken image)으로 표시된다.

---

## 현재 코드 분석 (Context)

### 이미지 관련 컨트롤러 (3개)

| 컨트롤러 | 업로드 엔드포인트 | 서빙 엔드포인트 | 저장 경로 설정 |
|----------|------------------|----------------|---------------|
| `KbImageController` | `POST /api/kb/images` | `GET /api/kb/images/{filename}` | `${kb.image.upload-dir:kb-images}` |
| `ConventionImageController` | `POST /api/convention-images` | `GET /api/convention-images/{filename}` | `${convention.image.upload-dir:convention-images}` |
| `FeatureImageController` | `POST /api/feature-images` | `GET /api/feature-images/{filename}` | `${feature.image.upload-dir:feature-images}` |

### 이미지 저장 방식

- 파일 시스템에 저장 (DB 아님)
- `application.yml`에서 상대 경로로 설정:
  ```yaml
  feature:
    image:
      upload-dir: ${FEATURE_IMAGE_UPLOAD_DIR:feature-images}
  kb:
    image:
      upload-dir: ${KB_IMAGE_UPLOAD_DIR:kb-images}
  convention:
    image:
      upload-dir: ${CONVENTION_IMAGE_UPLOAD_DIR:convention-images}
  ```
- 컨트롤러 생성자에서 `Paths.get(uploadDirPath).toAbsolutePath().normalize()`로 절대 경로 변환
- Docker 컨테이너 내부에서는 WORKDIR `/app` 기준으로 `/app/feature-images`, `/app/kb-images`, `/app/convention-images`에 저장

### 원인: Docker 볼륨 마운트 누락

**현재 `docker-compose.yml`:**
```yaml
backend:
  volumes:
    - ./logs:/app/logs    # ← 로그만 마운트됨
    # feature-images, kb-images, convention-images → 마운트 없음!
```

**문제 흐름:**
1. 메인 레포에서 이미지 업로드 → 호스트 파일 시스템의 `feature-images/` 등에 저장
2. Docker 컨테이너는 호스트의 이미지 디렉토리를 마운트하지 않음
3. 컨테이너 내부 `/app/feature-images/`는 비어있음
4. `GET /api/feature-images/{filename}` → 파일 없음 → 404 → 엑박

이 문제는 메인 레포와 모든 worktree에 공통으로 발생한다.

### Frontend 이미지 참조 방식

- `<img src="/api/feature-images/{filename}" />` 형태로 API 경로를 직접 참조
- 프론트엔드 자체에는 문제 없음 — 백엔드가 파일을 찾지 못하는 것이 원인

---

## 설계

### 해결 방안: 이미지 디렉토리 볼륨 마운트 추가

`docker-compose.yml`의 backend 서비스에 이미지 저장 디렉토리 3개를 볼륨 마운트한다.

```yaml
backend:
  volumes:
    - ./logs:/app/logs
    - ./feature-images:/app/feature-images
    - ./kb-images:/app/kb-images
    - ./convention-images:/app/convention-images
```

- 호스트의 `feature-images/`, `kb-images/`, `convention-images/` 디렉토리를 컨테이너 내부 동일 경로에 마운트
- 메인 레포에서 `./gradlew bootRun`으로 업로드한 이미지도 Docker에서 그대로 사용 가능
- 컨테이너 재시작 시에도 이미지 유지

### 영향 범위

| 파일 | 변경 |
|------|------|
| `docker-compose.yml` (메인 레포) | backend volumes에 3개 마운트 추가 |
| `docker-compose.yml` (worktree) | 동일 |

- Backend 코드 변경 없음
- Frontend 코드 변경 없음
- application.yml 변경 없음

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | 메인 레포 + worktree docker-compose.yml에 이미지 볼륨 마운트 추가 | `docker-compose.yml` |
| 2 | Docker 컨테이너 재시작 후 이미지 표시 확인 | — |

---

### Step 1 — docker-compose.yml 수정

**수정 파일:** `docker-compose.yml` (메인 레포 + worktree)

- [ ] backend 서비스의 volumes에 이미지 디렉토리 3개 마운트 추가
  - `./feature-images:/app/feature-images`
  - `./kb-images:/app/kb-images`
  - `./convention-images:/app/convention-images`

---

### Step 2 — 검증

- [ ] Docker 컨테이너 재시작 (`docker compose down && docker compose up -d`)
- [ ] 기존 업로드된 이미지가 정상 표시되는지 확인
- [ ] 새 이미지 업로드 후 표시 확인

---

## 변경 파일 목록

| 파일 | 구분 | 설명 |
|------|------|------|
| `docker-compose.yml` | 수정 | backend volumes에 이미지 디렉토리 3개 마운트 추가 |

---

## 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | Docker로 실행 후 기존 이미지 포함 페이지 접근 | 이미지 정상 표시 (엑박 아님) |
| 2 | Docker 환경에서 새 이미지 업로드 | 업로드 성공 + 즉시 표시 |
| 3 | Docker 컨테이너 재시작 후 이미지 접근 | 이미지 유지 (볼륨 마운트로 영속) |
| 4 | 메인 레포에서 bootRun으로 업로드한 이미지 → Docker에서 표시 | 동일 경로이므로 정상 표시 |

---

## [최종 요약]

(모든 Step 완료 후 작성)
