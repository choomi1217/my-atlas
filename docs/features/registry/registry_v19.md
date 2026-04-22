# Feature Registry — v19: TestCase 이미지 URL 하드코딩 수정

> 변경 유형: 버그 수정
> 작성일: 2026-04-22
> 버전: v19
> 상태: 완료 (로컬 검증)

---

## 배경

프로덕션 TestCase 페이지에서 첨부 이미지가 엑박으로 표시되는 증상 보고됨.

`https://youngmi.works/api/feature-images/47fefb1c-d1d2-4c10-8ba9-44d1a19c9f35.png`

`/api/feature-images/` 는 `V202604171158__migrate_image_urls_to_s3.sql` (Ops v17/v18 S3 전환) 이후 **더 이상 존재하지 않는 경로**. 실제 이미지는 `/images/feature/{uuid}.png` 로 S3 `my-atlas-images` 버킷 → CloudFront 배포.

그런데도 프론트가 옛 경로를 요청한 이유: **backend 가 응답에 포함된 `url` 필드를 하드코딩으로 `/api/feature-images/` + filename 으로 조립**하고 있었음.

| 위치 | 코드 |
|---|---|
| `TestCaseController.java:75` (getImages) | `"/api/feature-images/" + img.getFilename()` |
| `TestCaseController.java:101` (addImage) | `"/api/feature-images/" + saved.getFilename()` |
| `TestCaseServiceImpl.java:329` (toResponse) | `"/api/feature-images/" + img.getFilename()` |

Convention, KB 도메인은 이미 `image_url` / `content` 컬럼에 완전한 경로를 저장하고 응답에 그대로 실어 보내는 구조라 마이그레이션만으로 수정됨. Registry 도메인만 응답 조립 시점에 경로를 합성하는 패턴이어서 누락.

---

## 수정 내용

### 신규: `TestCaseImageUrlResolver`

`backend/src/main/java/com/myqaweb/feature/TestCaseImageUrlResolver.java`

```java
final class TestCaseImageUrlResolver {
    private static final String PREFIX = "/images/feature/";
    private TestCaseImageUrlResolver() {}

    static String toImageUrl(String filename) {
        if (filename == null || filename.isBlank()) return null;
        if (filename.startsWith("/")) return filename;
        return PREFIX + filename;
    }
}
```

**DB 데이터는 건드리지 않는다.** `test_case_image.filename` 컬럼에는
- 대부분 bare UUID.png 가 저장됨 (frontend 가 업로드 응답의 `filename` 필드, prefix 없음, 을 그대로 보냄)
- 일부 row 는 V202604171158 로 `/images/feature/xxx.png` 가 박혀있을 수 있음 (원래 `/api/feature-images/...` prefix 였던 row 가 REPLACE 로 변환된 경우)
- 혹시 남아있는 legacy `/api/feature-images/...` row 가 있더라도 그대로 통과해야 함 (이중 prefix 방지)

따라서 resolver 가 세 경우를 모두 handled:
1. bare `abc.png` → `/images/feature/abc.png`
2. `/images/feature/abc.png` → 그대로 통과
3. `/api/feature-images/abc.png` → 그대로 통과 (broken URL 이지만 이중 prefix 부작용은 회피)

### 호출부 교체

`TestCaseController.java`, `TestCaseServiceImpl.java` 의 3곳을 `toImageUrl(filename)` 로 치환.

---

## 테스트

### Unit

- 신규 `TestCaseImageUrlResolverTest` — 6 시나리오:
  - bare filename prefix 적용
  - UUID bare filename prefix 적용
  - `/images/feature/` prefix 통과
  - legacy `/api/feature-images/` prefix 통과 (이중 prefix 방지 회귀 가드)
  - null 입력 → null
  - blank 입력 → null
- `TestCaseControllerTest` 업데이트 — GET `/api/test-cases/{id}/images` 와 POST 응답의 `url` 이 `/images/feature/` 로 시작하는지 검증.

### E2E

- 신규 `qa/api/test-case-image.spec.ts` 3 건:
  1. `POST /api/feature-images` 가 `{url: "/images/feature/..."}` 반환
  2. `POST /api/test-cases/{id}/images` 와 `GET /api/test-cases/{id}/images` 응답의 `url` 필드가 `/images/feature/` 로 시작하고 `/api/feature-images/` 로는 시작하지 않음
  3. `GET /api/test-cases?productId={id}` 의 `images[].url` 도 동일하게 `/images/feature/` prefix

### Agent-D 전체 실행 결과

- `./gradlew clean build` — SUCCESS
- Playwright E2E 316 passed (신규 3 건 포함), 24 skipped, 3 pre-existing flakes (login_required 토글 DB 상태 leak — CI fresh DB 에서는 재현 안 됨).

---

## 관련 문서

- Ops v25 (전체 핫픽스 컨텍스트): `docs/ops/ops_v25.md`
- Platform v12 (Platform v9 `/api/settings/public` 500 방어): `docs/features/platform/platform_v12.md`
- 기존 이미지 S3 전환: `docs/ops/ops_v17.md`, `docs/ops/ops_v18.md`
