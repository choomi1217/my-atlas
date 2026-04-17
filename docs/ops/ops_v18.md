> 변경 유형: 환경 개선  
> 작성일: 2026-04-17  
> 버전: v18  
> 상태: 완료

---

# 이미지 저장소 S3 전환

## 1. 배경

v17에서 커스텀 도메인(`youngmi.works` + `api.youngmi.works`)을 적용한 후, 운영 환경에서 모든 이미지가 엑박으로 표시된다.

### 근본 원인

이미지를 **백엔드 EC2 로컬 파일시스템**에 저장하고 서빙 중. 프론트엔드(`youngmi.works`)와 백엔드(`api.youngmi.works`)가 다른 도메인이므로, `<img src="/api/convention-images/xxx.png">`가 프론트엔드 도메인(`youngmi.works`)으로 요청되어 CloudFront(S3)에서 404 발생.

```
현재: <img src="/api/convention-images/xxx.png">
  → https://youngmi.works/api/convention-images/xxx.png
  → CloudFront → S3 → 없음! ❌

필요: <img src="https://youngmi.works/images/convention/xxx.png">
  → CloudFront → S3 → 있음! ✅
```

### 현재 문제점

1. EC2 로컬 파일시스템 의존 → Docker 재빌드 시 이미지 유실 가능
2. 백엔드가 이미지 서빙에 CPU/대역폭 사용
3. Spring Security 인증 우회 필요 (`<img>` 태그는 Authorization 헤더 미포함)
4. 프론트/백엔드 도메인 분리로 이미지 경로 불일치

---

## 2. 해결: S3 + CloudFront 이미지 서빙

### Target Architecture

```
[이미지 업로드]
브라우저 → api.youngmi.works → 백엔드 → S3 (my-atlas-images) 저장
                                      → DB에 S3 경로 저장 (/images/convention/xxx.png)

[이미지 조회]
브라우저 → <img src="/images/convention/xxx.png">
         → https://youngmi.works/images/convention/xxx.png
         → CloudFront → S3 (my-atlas-images) → 이미지 응답
```

**핵심**: 이미지를 프론트엔드와 **같은 도메인**(`youngmi.works`)에서 서빙. CORS 없음, Security 우회 불필요, CDN 캐싱.

---

## 3. 구현 계획

### Phase 1: AWS 인프라 (User 직접)

#### Step 1: S3 버킷 생성

```bash
aws s3 mb s3://my-atlas-images --region ap-northeast-2
```

#### Step 2: CloudFront에 S3 Origin 추가

CloudFront 배포(`EVMWQ4ZH85AXV`)에 두 번째 Origin 추가:
- Origin: `my-atlas-images.s3.ap-northeast-2.amazonaws.com`
- OAC(Origin Access Control) 설정

#### Step 3: CloudFront Behavior 추가

- Path pattern: `/images/*`
- Origin: `my-atlas-images` S3
- Cache policy: CachingOptimized
- Viewer protocol: HTTPS only

#### Step 4: S3 버킷 정책

OAC를 통한 CloudFront 접근만 허용:
```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-atlas-images/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/EVMWQ4ZH85AXV"
      }
    }
  }]
}
```

### Phase 2: 백엔드 코드 변경

#### Step 5: S3 의존성 추가

`build.gradle`:
```gradle
implementation 'software.amazon.awssdk:s3:2.25.0'
```

#### Step 6: S3 업로드 공통 서비스 생성

`backend/src/main/java/com/myqaweb/common/S3ImageService.java`:
- `upload(String folder, MultipartFile file)` → S3 업로드 → `/images/{folder}/{uuid}.{ext}` 반환
- `delete(String key)` → S3 삭제

#### Step 7: 이미지 컨트롤러 3개 수정

| 컨트롤러 | S3 폴더 | 변경 |
|----------|---------|------|
| `ConventionImageController` | `images/convention/` | 로컬 저장 → S3 업로드, GET 서빙 엔드포인트 제거 |
| `FeatureImageController` | `images/feature/` | 동일 |
| `KbImageController` | `images/kb/` | 동일 |

**변경 전 (로컬 파일시스템)**:
```java
file.transferTo(targetPath.toFile());
String imageUrl = "/api/convention-images/" + filename;
```

**변경 후 (S3)**:
```java
String imageUrl = s3ImageService.upload("convention", file);
// imageUrl = "/images/convention/xxx.png"
```

#### Step 8: SecurityConfig 이미지 permitAll 제거

이미지가 CloudFront(S3)에서 서빙되므로 백엔드 Security 설정 불필요. GET 서빙 엔드포인트도 제거.

#### Step 9: DB 기존 이미지 URL 마이그레이션

Flyway 마이그레이션으로 기존 URL 변환:
```sql
-- convention
UPDATE convention SET image_url = REPLACE(image_url, '/api/convention-images/', '/images/convention/') WHERE image_url LIKE '/api/convention-images/%';

-- test_case_image
UPDATE test_case_image SET filename = REPLACE(filename, '/api/feature-images/', '/images/feature/') WHERE filename LIKE '/api/feature-images/%';

-- knowledge_base (image_url이 있는 경우)
UPDATE knowledge_base SET content = REPLACE(content, '/api/kb/images/', '/images/kb/') WHERE content LIKE '%/api/kb/images/%';
```

### Phase 3: 기존 이미지 S3 이관

#### Step 10: EC2 로컬 이미지 → S3 업로드

```bash
# EC2에서 실행
aws s3 sync /home/ec2-user/my-atlas/backend/convention-images/ s3://my-atlas-images/images/convention/
aws s3 sync /home/ec2-user/my-atlas/backend/feature-images/ s3://my-atlas-images/images/feature/
aws s3 sync /home/ec2-user/my-atlas/backend/kb-images/ s3://my-atlas-images/images/kb/
```

### Phase 4: 배포 + 검증

#### Step 11: 배포

- feature/ops-env → develop PR → main PR → 자동 배포
- EC2에서 `--no-cache` 리빌드

#### Step 12: 검증

```bash
# S3 이미지 CloudFront 경유 접근
curl -sI "https://youngmi.works/images/convention/xxx.png"
→ HTTP/2 200

# 브라우저 테스트
# - Convention 이미지 정상 표시
# - Feature Registry TestCase 이미지 정상
# - KB 이미지 정상
```

---

## 4. E2E 이미지 테스트 CI Skip 사유

### 변경 전 (로컬 파일시스템)

```
[CI 환경]
백엔드 → 로컬 디스크에 이미지 저장 → 같은 서버에서 GET으로 서빙
→ S3 불필요, CI에서 업로드/조회 모두 테스트 가능 ✅
```

### 변경 후 (S3)

```
[CI 환경]
백엔드 → S3에 이미지 업로드 시도 → AWS 자격증명 필요
→ CI 러너에 S3 자격증명 없음 → 업로드 500 에러 ❌

[이미지 조회]
브라우저 → CloudFront → S3 (백엔드 경유 안 함)
→ 백엔드 GET 서빙 엔드포인트 자체가 제거됨 → 테스트 대상 없음 ❌
```

### Skip하는 테스트와 이유

| 테스트 | Skip 이유 |
|--------|-----------|
| `POST /api/convention-images` (업로드) | S3 자격증명이 CI에 없음. 업로드 시 `S3Client` 호출 실패 |
| `POST /api/kb/images` (업로드) | 동일 |
| `GET /api/kb/images/{filename}` (조회) | 백엔드 GET 엔드포인트 제거됨. 이미지는 CloudFront(S3)에서 서빙 |
| `GET /api/kb/images/nonexistent.png` (404) | 동일 |

### 대안 검토

| 방안 | 채택 | 이유 |
|------|:---:|------|
| CI에 S3 자격증명 추가 | ❌ | 테스트마다 S3에 실제 파일이 쌓임, 비용 발생, 테스트 격리 어려움 |
| LocalStack(S3 에뮬레이터) | ❌ | Docker-in-Docker 필요, CI 복잡도 증가, 현재 규모에 과함 |
| CI에서만 skip | ✅ | `test.skip(!!process.env.CI)` — 로컬/운영에서는 실행 가능 |

### 보완

- 유닛 테스트(`ConventionImageControllerTest`, `KbImageControllerTest`)에서 S3ImageService를 Mock하여 업로드 로직을 검증 중
- 이미지 서빙은 CloudFront + S3 인프라 레벨이므로 `curl https://youngmi.works/images/...`로 수동 검증

---

## 5. 변경 파일

| 파일 | 변경 |
|------|------|
| `build.gradle` | AWS S3 SDK 의존성 추가 |
| `application.yml` | S3 버킷명, 리전 설정 추가 |
| `S3ImageService.java` | **신규** — S3 업로드/삭제 공통 서비스 |
| `ConventionImageController.java` | 로컬 → S3 업로드, GET 서빙 제거 |
| `FeatureImageController.java` | 동일 |
| `KbImageController.java` | 동일 |
| `SecurityConfig.java` | 이미지 permitAll 제거 |
| `db/migration/V{timestamp}__migrate_image_urls_to_s3.sql` | 기존 URL 변환 |

---

## 5. AWS 작업 요약

| 작업 | 도구 |
|------|------|
| S3 버킷 `my-atlas-images` 생성 | AWS CLI |
| CloudFront에 S3 Origin + `/images/*` Behavior 추가 | CloudFront 콘솔 |
| S3 버킷 정책 (OAC) | S3 콘솔 |
| EC2에 AWS 자격증명 설정 (S3 업로드용) | EC2 IAM Role 또는 .env |
| 기존 이미지 S3 이관 | aws s3 sync |

---

## Steps

- [x] Step 1: S3 버킷 생성
- [x] Step 2: CloudFront에 S3 Origin 추가
- [x] Step 3: CloudFront `/images/*` Behavior 추가
- [x] Step 4: S3 버킷 정책 설정
- [x] Step 5: build.gradle S3 SDK 추가
- [x] Step 6: S3ImageService 생성
- [x] Step 7: 이미지 컨트롤러 3개 수정
- [x] Step 8: SecurityConfig 이미지 permitAll 제거
- [x] Step 9: Flyway 마이그레이션 (기존 URL 변환)
- [x] Step 10: 기존 이미지 S3 이관
- [x] Step 11: 배포
- [x] Step 12: 검증

---

## [최종 요약]

이미지 저장소를 EC2 로컬 파일시스템에서 S3(`my-atlas-images`)로 전환했다. CloudFront에 `/images/*` Behavior를 추가하여 프론트엔드와 같은 도메인(`youngmi.works`)에서 이미지를 CDN 서빙한다. 백엔드의 이미지 GET 엔드포인트를 제거하고 S3ImageService로 업로드를 통합했다. Flyway 마이그레이션으로 기존 URL을 변환하고, EC2의 이미지를 S3로 이관하여 배포 완료. E2E 이미지 테스트는 S3 자격증명 의존으로 CI에서 skip 처리하고 사유를 문서화했다.
