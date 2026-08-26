# ops v36 — prod ↔ dev 데이터 왕복 파이프라인

> 변경 유형: 환경 개선
> 작성일: 2026-08-20
> 버전: v36
> 상태: 진행 중

---

## 1. 배경

`https://youngmi.works/features/companies/3194/products/2641`(WebApp-QA)에 운영 서버에서
직접 데이터를 입력해 왔다. 앞으로의 대량 입력은 운영이 아닌 로컬에서 하고 싶다.
따라서 다음 3단계 왕복이 필요하다.

| 단계 | 방향 | 목적 |
|------|------|------|
| **Step 1** | prod → dev | 지금까지 넣은 데이터를 로컬로 가져와 확인 |
| **Step 2** | dev 내부 | 로컬에서 데이터를 대량 입력 |
| **Step 3** | dev → prod | 채운 데이터를 운영에 반영 |

**대상 범위**: company `3194` / product `2641` 서브트리 20개 테이블로 한정한다.
`knowledge_base`, `pdf_upload_job`, 다른 product는 전 단계에서 일절 건드리지 않는다.

---

## 2. 사전 조사 결과 (확정 사실)

### 2-1. ID 충돌 없음

| 테이블 | prod (product 2641) | 로컬 최대 id | 충돌 |
|---|---|---|---|
| segment | 15건 (4152–4166) | 4129 | 0건 |
| test_case | 13건 (3387–3399) | 3376 | 0건 |

로컬 시퀀스가 prod보다 뒤처져 있어 Step 1은 순수 insert-only로 성립한다.

### 2-2. 이미지 저장 구조

`FeatureImageController`가 업로드 결과에서 파일명만 추출해 저장한다.

```java
String filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);   // → "{uuid}.png"
```

따라서 `test_case_image.filename`은 **환경 중립적**이다. 환경별로 다른 것은 파일 실물의 위치뿐이다.

| 환경 | ImageService 구현 | 파일 실물 | 서빙 경로 |
|---|---|---|---|
| prod (AWS 키 있음) | `S3ImageService` | `s3://my-atlas-images/feature/` | CloudFront `/images/*` |
| local (AWS 키 없음) | `LocalImageService` | `backend/uploads/images/feature/` | 백엔드 `/images/**` 리소스 핸들러 |

선택은 `S3Config`가 크레덴셜 유무로 자동 분기한다. 로컬 `.env`에 AWS 키가 없으므로 자동으로 로컬 저장이 된다.

### 2-3. 현재 로컬에서 이미지가 안 보이는 이유 (기존 이슈)

`TestCaseImageUrlResolver`는 `/images/feature/{filename}` 상대경로를 반환한다.
로컬에서 이 요청은 Vite(5173)로 가는데 `vite.config.ts`는 `/api`만 프록시한다.
백엔드에 `/images/**` 핸들러가 있어도 Vite가 넘겨주질 않는다.
→ **이번 이식과 무관하게 로컬 이미지는 이미 전부 404다.**

### 2-4. 로컬 업로드 파일의 휘발성 (Step 2 차단 요인)

`docker-compose.yml`의 backend 볼륨에 `uploads` 마운트가 없다.

```yaml
volumes:
  - ./logs:/app/logs
  - ./backend/feature-images:/app/feature-images
  - ./backend/kb-images:/app/kb-images
  - ./backend/convention-images:/app/convention-images
  # ← ./backend/uploads:/app/uploads 없음
```

Step 2에서 올린 이미지가 `/app/uploads`에 쌓이는데 이건 컨테이너 수명과 함께 사라진다.
**Step 2 시작 전에 반드시 마운트를 추가해야 한다.**

---

## 3. 설계

### 3-1. 이미지 왕복 방식

```
Step 1:  CloudFront(공개 GET) ──curl──> backend/uploads/images/feature/
                                          (크레덴셜 불필요, 비용 사실상 0)
Step 2:  로컬 업로드 ────────────────> backend/uploads/images/feature/
                                          (LocalImageService, AWS 미접촉)
Step 3:  backend/uploads/images/feature/ ──aws s3 cp──> s3://my-atlas-images/feature/
                                          (신규 파일만, 크레덴셜 필요)
```

Vite에 `/images` → 백엔드 프록시를 추가하면 로컬에서 세 경우 모두 같은 경로로 보인다.

### 3-2. Step 3 전략 — insert-only 워터마크 방식

Step 1에서 가져온 행은 prod에 이미 존재하므로 통째로 되밀면 PK 충돌이 난다. 두 가지 선택지가 있다.

| 방식 | 처리 | 장점 | 단점 |
|---|---|---|---|
| **(A) 워터마크 insert-only** | Step 1 시점의 테이블별 max(id)를 기록해두고, Step 3에서 `id > 워터마크`인 행만 push | prod에 DELETE 없음, 프로젝트 안전 규칙 부합 | Step 2에서 **기존 행을 수정**한 건 반영 안 됨 |
| **(B) 범위 한정 replace** | prod의 product 2641 서브트리를 DELETE 후 로컬 것으로 전량 교체 | 추가·수정·삭제 모두 반영 | prod에 DELETE 발생 |

**(A)를 기본으로 한다.** CLAUDE.md의 "스키마 변경 없는 작업에서 DB 데이터 삭제 금지" 규칙에 부합하고,
Step 2의 목적이 "데이터를 더 가득 채워넣기"(추가)라 insert-only로 대부분 커버된다.

(A)의 공백을 메우기 위해 Step 3에 **drift 리포트**를 넣는다. 양쪽에 다 있는데 내용이 다른 행을 찾아
목록으로 보여주고, 반영 여부는 User가 판단한다. (B)가 필요하다고 판단되면 그때 별도 승인 후 진행한다.

### 3-3. 시퀀스 관리

```
Step 1 직후 : 로컬 시퀀스를 prod max 까지 상향  → 로컬 신규 행은 3400+ 부터 발번
Step 3 직후 : prod 시퀀스를 push 된 max 까지 상향 → prod 신규 행이 충돌하지 않음
```

시퀀스는 **올리기만** 한다. 내리면 PK 충돌을 유발한다.

### 3-4. ⚠️ 제약: Step 2 동안 prod 데이터 입력 금지

로컬과 prod가 **같은 시퀀스 구간**에서 각자 발번하게 되므로, Step 2 진행 중 운영에서
2641에 데이터를 만들면 Step 3에서 PK가 충돌한다. Step 2 시작 ~ Step 3 완료 구간에는
운영 입력을 멈춰야 한다.

---

## 4. 실행 절차

### Step 1 — prod → dev

- [ ] 1-1. `scripts/sync-product-from-aws.sh export` — prod에서 20개 테이블 추출
- [ ] 1-2. `import` — 로컬 백업 자동 수행 후 적재, 로컬 시퀀스 상향
- [ ] 1-3. 워터마크 기록 (`backups/watermark-2641.tsv`) — Step 3에서 사용
- [ ] 1-4. 이미지 파일 확보 — `test_case_image.filename`을 CloudFront에서 받아 `backend/uploads/images/feature/`에 저장
- [ ] 1-5. `vite.config.ts`에 `/images` → 백엔드 프록시 추가
- [ ] 1-6. `docker-compose.yml`에 `./backend/uploads:/app/uploads` 마운트 추가
- [ ] 1-7. `verify` + 화면 확인 (데이터·이미지 모두)

### Step 2 — dev 데이터 입력

- [ ] 2-1. 운영 입력 중단 (3-4 제약)
- [ ] 2-2. 로컬에서 데이터 입력 — 이미지는 자동으로 로컬 디스크에 저장됨

### Step 3 — dev → prod

- [ ] 3-1. prod 전체 백업 (pg_dump)
- [ ] 3-2. drift 리포트 — 양쪽에 있으나 내용이 다른 행 목록 출력
- [ ] 3-3. 신규 이미지 파일을 S3에 업로드 (`aws s3 cp`, 신규분만)
- [ ] 3-4. `id > 워터마크`인 행만 prod에 push (트랜잭션 + FK 일시 해제)
- [ ] 3-5. prod 시퀀스 상향
- [ ] 3-6. verify — 양쪽 row count 대조 + 운영 화면 확인

---

## 5. 비용에 대한 정정

"AWS 비용이 발생하지 않도록" 이라고 하셨는데, 실제 비용 구조는 이렇다.

| 항목 | 로컬 작업 시 절감되나 |
|---|---|
| EC2 + ALB (~$36–41/월) | **아니오** — 사용량과 무관한 고정비 |
| S3 PUT / CloudFront 전송 | 절감되나 원래 금액이 미미 (PUT 1,000건당 $0.005) |
| **Anthropic API** (Test Studio, 에이전트 실행) | **아니오** — 로컬 `.env`에도 같은 키가 있어 동일하게 과금 |
| **OpenAI 임베딩** | **아니오** — 동일. 단 `feature.embedding.enabled` 기본값이 `false`라 현재는 미호출 |

즉 **로컬 작업으로 줄어드는 AWS 비용은 사실상 0에 가깝다.**
실제로 아껴야 할 것은 AI API 비용이고, 그건 실행 위치가 아니라 **AI 기능을 쓰느냐**로 갈린다.
Step 2에서 Test Studio 자동 생성을 쓰면 로컬이어도 과금되고, 수동 입력만 하면 어디서 하든 0이다.

다만 "운영 데이터를 어지럽히지 않고 로컬에서 편하게 채운다"는 목적 자체는 유효하므로 계획은 그대로 진행한다.

---

## 6. 현재까지 완료된 것

- `scripts/sync-product-from-aws.sh` 작성 완료 (export / backup / import / verify)
  - insert-only, TRUNCATE·DELETE 0건
  - `BEGIN…COMMIT` + `ON_ERROR_STOP=1` → 실패 시 전량 롤백 (PK 충돌 시뮬레이션으로 실증)
  - import 직전 로컬 DB 전체 pg_dump 자동 수행
  - 로컬에 product 2641 존재 시 중단 (`FORCE=1`로만 우회)
- 로컬 dry-run 검증 완료 (product 2637 기준)
- **미실행**: SSH 구간(export)은 권한 대기 중

---

## 7. 버전 히스토리

| 버전 | 날짜 | 내용 |
|------|------|------|
| v36 | 2026-08-20 | prod ↔ dev 왕복 파이프라인 설계 (계획 수립) |
