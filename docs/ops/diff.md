# Ops v23 — 로컬(dev) ↔ 프로드(prod) DB diff

> 작성일: 2026-04-23
> 백업 파일: `.claude/worktrees/ops-env/backups/aws-backup-pre-v23-20260423200633.sql` (8.25 MB)
> 프로드 S3: `s3://my-atlas-images/` (41 objects, 33 MB)

## 사용법

- 각 항목 뒤의 **체크박스**에 `dev` (로컬 살림) / `prod` (운영 살림) / `merge` (수동 병합) / `drop` (양쪽 폐기) 중 하나 표기
- 체크박스 없는 항목은 "결정 불필요" 의미 (같거나 자명함)
- 다 표기 후 알려주시면 그 결정대로 마이그 플랜 재구성해서 실행

---

## 1. 테이블별 row count 요약

| # | 테이블 | dev (로컬) | prod (운영) | 차이 | 비고 |
|---|---|---:|---:|---|---|
| 1 | ai_usage_log | 180 | 8 | dev +172 | E2E/실사용 로그 누적 |
| 2 | api_access_log | 24,791 | 708 | dev +24,083 | 거의 대부분 E2E 로그 |
| 3 | app_user | 6 | 4 | dev +2 | 계정 다름 |
| 4 | chat_message | 20 | 10 | dev +10 | chat 테스트 누적 |
| 5 | chat_session | 94 | 5 | dev +89 | chat 테스트 누적 |
| 6 | company | 7 | 7 | 같음 but **id 충돌** | id=2142 dev↔prod 의미 다름 |
| 7 | convention | 1 | 3 | prod +2 | 내용 전면 다름 |
| 8 | daily_test_snapshot | 9 | 50 | prod +41 | 운영 스냅샷 |
| 9 | faq | 0 | 0 | 같음 | — |
| 10 | flyway_schema_history | 35 | 35 | 같음 | — |
| 11 | kb_category | 38 | 20 | dev +18 | — |
| 12 | knowledge_base | 49 | 373 | prod +324 | v23 예외로 둘 다 wipe 후 재업로드 예정 |
| 13 | knowledge_base_backup | 46 | 0 (테이블 없음) | dev only | 과거 로컬 백업 테이블 |
| 14 | pdf_upload_job | 1 | 3 | prod +2 | 동일 책 중복 시도 |
| 15 | product | 20 | 18 | dev +2 | 토스증권 vs 배민 분리 |
| 16 | segment | 285 | 215 | dev +70 | 새 제품 세그먼트 |
| 17 | system_settings | 5 | 5 | 같음 | 키/값 모두 동일 |
| 18 | test_case | 519 | 445 | dev +74 | 토스/배민 TC 추가 |
| 19 | test_case_image | 7 | 8 | prod +1 | 공통 7건, prod only 1건 |
| 20 | test_result | 256 | 177 | dev +79 | 추가 실행 결과 |
| 21 | test_result_comment | 3 | 5 | prod +2 | 공통 3건, prod only 2건 |
| 22 | test_run | 66 | 18 | dev +48 | 테스트 러너 누적 |
| 23 | test_run_test_case | 958 | 251 | dev +707 | — |
| 24 | test_studio_job | 1 | 2 | prod +1 | — |
| 25 | ticket | 7 | 5 | 교집합 2건 only | AT-key 다름 |
| 26 | user_company_access | 0 | 10 | prod only | 사용자-회사 권한 |
| 27 | version | 5 | 5 | 같음 but 이름 다름 | Youngmi/Test vs v1.0/V15 |
| 28 | version_phase | 9 | 9 | 같음 but 일부 다름 | 대부분 동일 |
| 29 | version_phase_test_case | 5 | 5 | 같음 | 내용 확인 필요 |
| 30 | version_phase_test_run | 25 | 7 | dev +18 | — |
| 31 | word_category | 77 | 2 | dev +75 | 로컬 대량 생성 |

---

## 2. 이미지 파일 정합성 (S3 대조)

### 프로드 S3 `my-atlas-images` 현황

| 폴더 | 파일 수 | 용도 |
|---|---:|---|
| `images/convention/` | 8 | Convention 이미지 |
| `images/feature/` (단수) | 3 | TestCase 첨부 |
| `images/features/` (복수) | 27 | Platform 스펙 스크린샷 |
| `images/kb/` | 1 | KB 본문 이미지 |

### 로컬 호스트 FS 이미지

| 경로 | 파일 수 |
|---|---:|
| `backend/feature-images/` | 0 |
| `backend/kb-images/` | 1 |
| `backend/convention-images/` | 2 |

로컬 호스트 파일과 로컬 DB 참조는 **대부분 매칭되지 않음** — 과거 프로드에서 DB만 복원하고 파일은 안 받은 상태로 추정.

### DB 이미지 참조 UUID vs S3 실존 대조

| 출처 | UUID (파일명) | S3 존재? |
|---|---|---|
| dev convention id=761 | `ea1bd8aa-...png` | ❌ 없음 |
| prod convention id=386 (LNB) | `3daf1d17-...png` | ✅ 있음 |
| prod convention id=387 (GNB) | `c8cd811d-...webp` | ✅ 있음 |
| prod convention id=388 (PG) | NULL | — |
| 공통 test_case_image 7건 | `0ed670db`, `3dcd361c` | ✅ 있음 (2건) |
| 공통 test_case_image 7건 | `cda128db`, `8805f06f`, `8ecc112a`, `774488cc`, `baaac331` | ❌ 없음 (5건, **프로드도 이미 깨진 상태**) |
| prod only test_case_image id=10 | `47fefb1c-...png` | ✅ 있음 |
| test_result_comment (dev/prod 공통 2건) | `/api/feature-images/76ba68be...`, `.../8cf74ffe...` | ❌ 레거시 경로 (양쪽 모두 깨짐) |

**결론**:
- 프로드도 이미 이미지 5건(test_case_image) + 2건(test_result_comment 레거시 경로)이 깨져있음 — 이 migration과 무관
- 로컬 convention 1건은 S3에 없어 살려도 프로드에서 깨짐

---

## 3. 결정 필요 항목

### 3.1 `app_user` (계정)

**dev (6)**
| id | username | role |
|---|---|---|
| 1 | admin | ADMIN |
| 147 | e2e_test_user_1776860614945 | USER |
| 148 | e2e_auth_user_1776860614945 | USER |
| 149 | e2e_auth_user_1776860617496 | USER |
| 152 | e2e_test_user_1776861140795 | USER |
| 153 | e2e_auth_user_1776861140796 | USER |

**prod (4)**
| id | username | role | created_at |
|---|---|---|---|
| 1 | admin | ADMIN | 2026-04-10 |
| 82 | woowahan | USER | 2026-04-21 |
| 83 | toss | USER | 2026-04-21 |
| 84 | luxrobo | USER | 2026-04-21 |

→ **dev 는 admin + E2E 테스트용 계정**. prod 는 **실 유저 계정 3명 + admin**.

- [✅] 선택: `prod` 걸로 유지
- 추천: `merge` (admin 공통, prod 실 유저 3명 유지, dev E2E 계정 제거)


### 3.2 `company` ⚠️ id 충돌

**dev (7)**
| id | name | is_active |
|---|---|---|
| 1440 | 🌎 my-atlas | f |
| 1644 | 🥧 프로토파이 | f |
| 1646 | 🤖 럭스로보 | f |
| **1647** | **💳 토스 플레이스** | f |
| **2142** | **🛵 배달의 민족** | f |
| **2190** | **📈 토스증권** | f |
| 3180 | demo-mode-smoke-test | f |

**prod (7)**
| id | name | is_active |
|---|---|---|
| **1440** | **🌎 my-atlas** | **t** ← 유일한 활성 |
| 1644 | 🥧 ProtoPie | f |
| 1646 | 🤖 LuxRobo | f |
| **1647** | **💳 Toss Place** | f |
| **2142** | **🛵 WooWaHan** | f |
| **2144** | **배달의민족** | f |
| 2145 | prod-smoke-test-ok-to-delete | f |

→ **id=2142 충돌**: dev 에선 "배달의민족", prod 에선 "WooWaHan" — 동일 id가 서로 다른 회사.
→ **id=1647 이름 다름**: dev "💳 토스 플레이스" vs prod "💳 Toss Place" (실질 동일 회사, 표기만 차이)
→ **id=1644, 1646**: dev 한글 vs prod 영문. 실질 동일.
→ **dev only**: `2190 📈 토스증권`, `3180 demo-mode-smoke-test`
→ **prod only**: `2144 배달의민족`, `2145 prod-smoke-test-ok-to-delete`

결정 필요:
- [✅] `1440 my-atlas`: prod로 유지
- [✅] `1644, 1646, 1647`: prod로 유지 (영어 유지)
- [✅] `2142`: 내가 직접 prod 배달의민족 삭제했어, dev의 2142 == prod 2142야 (영어 유지)
- [✅] `2190 토스증권` (dev only): dev에 있는 토스증권 데이터를 prod에 넣어줘
- [✅] `3180 demo-mode-smoke-test`, `2145 prod-smoke-test`: 폐기해줘

### 3.3 `product`

**dev (20)**
| id | company | name |
|---|---|---|
| 1119 | my-atlas | Product Test Suite |
| 1289 | 토스 플레이스 | 토스 프론트 |
| 1290 | 토스 플레이스 | 토스 포스 |
| 1710 | 토스 플레이스 | 페이스페이 |
| 1711 | 토스 플레이스 | 키오스크 |
| 1712 | 토스 플레이스 | 테이블 주문 |
| **1715-1719** | **배달의 민족(2142)** | 고객앱/사장님앱/배민오더/라이더앱/B마트 |
| 1720 | 토스 플레이스 | 토스플레이스 웹 |
| **1791-1795** | **토스증권(2190)** | 국내주식/해외주식/AI 투자 정보/WTS/계좌 관리 |
| 1835 | my-atlas | Test |
| 2416 | 프로토파이 | Cloud |
| 2435 | my-atlas | My Senior |

**prod (18)**
| id | company | name |
|---|---|---|
| 1119 | my-atlas | Product Test Suite |
| 1289 | Toss Place | 토스 프론트 |
| 1290 | Toss Place | 토스 포스 |
| 1710-1712 | Toss Place | 페이스페이/키오스크/테이블 주문 |
| **1715-1719** | **WooWaHan(2142)** | 고객앱/사장님앱/배민오더/라이더앱/B마트 |
| **1723-1727** | **배달의민족(2144)** | 고객앱/사장님앱/배민오더/라이더앱/B마트 |
| 1728 | my-atlas | 결제 테스트 |
| 1729 | my-atlas | Product Test Suite |

→ dev 는 "1715-1719 = 배민 제품" / prod 는 "1715-1719 = WooWaHan 제품 + 1723-1727 = 배민 제품" (별도 분리)
→ dev only: 토스증권 제품 5개 (1791-1795), 1835 Test, 2416 Cloud, 2435 My Senior
→ prod only: 배민 제품 5개 별도 (1723-1727), 1728 결제 테스트, 1729 중복 Product Test Suite

- [✅] dev의 2142 -> prod의 2142, 2144는 내가 방금 삭제했어
- [✅] 토스증권 제품 5개 (dev only): dev에 있는 토스증권 데이터를 prod에 넣어줘
- [✅] Cloud (2416, 프로토파이): dev에 데이터가 있다면 그거를 prod에 넣어줘
- [✅] My Senior (2435): dev에 데이터가 있다면 그거를 prod에 넣어줘

### 3.4 `convention`

**dev (1)**
| id | term | category | image_url |
|---|---|---|---|
| 761 | Test | Test | `/images/convention/ea1bd8aa-...png` (S3 없음 ❌) |

**prod (3)**
| id | term | category | image_url |
|---|---|---|---|
| 386 | LNB | UI | `3daf1d17-...png` (S3 있음 ✅) |
| 387 | GNB | UI | `c8cd811d-...webp` (S3 있음 ✅) |
| 388 | PG | Tech | (없음) |

→ dev 는 Test 1개(깨진 이미지), prod 는 실 용어 3개 + 이미지 정상.

- [✅] 선택: `prod`

### 3.5 `version` + `version_phase`

**dev version (5)**
| id | product | name |
|---|---|---|
| 347 | 토스 프론트 | v1 |
| 369 | Product Test Suite | V14 |
| 370 | Product Test Suite | V14 Test |
| 548 | 토스 포스 | Youngmi |
| 561 | 토스 포스 | Test Version 1 |

**prod version (5)**
| id | product | name |
|---|---|---|
| 347 | 토스 프론트 | v1 |
| 369 | Product Test Suite | V14 |
| 370 | Product Test Suite | V14 Test |
| 548 | 토스 포스 | v1.0 |
| 549 | Product Test Suite | V15 |

→ id 347, 369, 370 공통(이름 동일). id 548 이름 다름(Youngmi vs v1.0). id 549 prod only / id 561 dev only.

- [✅] `548` 이름: `v1.0`(prod)
- [✅] `549 V15`(prod only): prod 유지
- [✅] `561 Test Version 1`(dev only): 굳이 prod에 넣지 말아줘

**version_phase**: 9 vs 9, 대부분 유사. dev 의 `580 1차 기능 테스트` (version_id=561, dev only version) 1건만 추가.
- [✅] version 결정에 따라 자동 결정됨

### 3.6 `ticket`

**dev (7)**
`AT-2, AT-3, AT-5, AT-7, AT-8, AT-9, AT-10`

**prod (5)**
`AT-2, AT-3, AT-11, AT-13, AT-14`

공통: AT-2, AT-3 (내용 다를 수도)
dev only: AT-5, AT-7, AT-8, AT-9, AT-10
prod only: AT-11, AT-13, AT-14

→ Jira 실체와 연동된 데이터. Jira 쪽에 실제 어떤 이슈가 살아있는지에 따라 결정 필요.

- [✅] 선택: `prod`

### 3.7 `test_case_image` (이미지 참조)

공통 7건은 dev/prod 동일 UUID. prod only 1건 (id=10, `47fefb1c-...png` — S3 존재).

- [✅] : `prod` 유지

### 3.8 `test_result_comment`

**dev 3건** / **prod 5건**. 2건 공통 UUID (레거시 `/api/feature-images/` 경로).

- [✅] prod only 2건: `prod`유지

### 3.9 `daily_test_snapshot`

dev 9 / prod 50. 프로드가 훨씬 많음 (운영 실제 스냅샷 누적).

- [✅] 선택: `prod` 유지

### 3.10 `word_category`

dev 77 / prod 2. 프로드엔 UI, Tech 2개만. dev 에 75개 추가.

- [✅] 선택: `prod` (기존 2개 유지)

### 3.11 `kb_category`

dev 38 / prod 20. 둘 다 자동 생성된 카테고리 (KB 업로드 결과). KB 전체가 어차피 wipe 후 재업로드 → **kb_category 도 같이 wipe** 후 재업로드 시 자동 재생성 권장.

- [✅] 선택: `prod`것만 날려줘

### 3.12 `user_company_access`

dev 0 / prod 10. 프로드에만 존재. v9 이후 권한 모델 시드.

- [✅] 선택: `prod` 

### 3.13 `chat_session` / `chat_message`

dev 94/20, prod 5/10. 대부분 dev 는 테스트 세션.

- [✅] 선택: `prod`것만 날려줘

### 3.14 `ai_usage_log` / `api_access_log`

dev 180/24,791 — 대부분 E2E. prod 8/708 — 실사용.

- [✅] 선택: `prod` 

### 3.15 `test_run` / `test_run_test_case` / `test_result` / `test_studio_job` / `segment` / `test_case` / `version_phase_test_case` / `version_phase_test_run`

이들은 테스트 운영 실 데이터. 전부 함께 움직여야 정합성 유지 (FK 사슬).

**dev 가 대폭 많음** — 로컬에서 토스/배민/증권 TC 를 대량으로 쌓음.

- [✅] 선택: `dev`
- 추천: `dev` — 이 작업의 본래 목적

### 3.16 `knowledge_base` + `pdf_upload_job` + `kb_category`

v23 플랜 예외 적용: prod 에서 전체 DELETE 후 **prod UI 에서 PDF 재업로드**.

재업로드 대상 확정 필요:
- dev 에는 ISTQB (48 chunks, PROCESSING 상태) 만 있음
- prod 에는 "소프트웨어 테스팅 실무" (370 chunks, DONE) 만 있음

원본 PDF 파일 위치 (**유저 확인 필요**):
- [ ] ISTQB 원본 PDF 경로: ______________
- [ ] 소프트웨어 테스팅 실무 원본 PDF 경로: ______________
- [✅] 둘 다 내가 직접 재업로드할거야

### 3.17 `knowledge_base_backup` (dev only)

로컬에만 있는 과거 백업 테이블 (46 rows). 프로드엔 없음.

- [✅] 선택: `drop`

---

## 4. 이미지 파일 처리 결정

| 케이스 | 현 상태 | 처리 |
|---|---|---|
| prod S3 에 있는 유효한 이미지 (convention 2건, feature 3건, features 27건, kb 1건) | ✅ 정상 | **건드리지 않음** |
| dev convention `ea1bd8aa-...png` | ❌ S3 없음 | convention 테이블 처리에 따름 |
| 공통 test_case_image 5건 (S3 없음) | ❌ 이미 깨짐 (프로드도) | dev/prod 어느 쪽이든 동일하게 깨짐 — 별도 복구 필요 |
| prod only test_case_image `47fefb1c-...png` | ✅ S3 있음 | merge 시 보존 |
| `/api/feature-images/...` 레거시 2건 | ❌ 양쪽 모두 깨짐 | DB 경로 삭제 또는 이미지 재업로드 필요 |

- [✅] 이미지 없는 test_case_image 5건 처리: `DB row 삭제`
- [✅] 레거시 `/api/feature-images/` 2건 처리: `DB row 삭제`

---

## 5. 최종 결정 요약 (유저 작성)

위 3장의 각 체크박스 선택 완료 후, 아래 한 줄 요약으로 최종 의사 표기:

```
app_user:    ____
company:     ____ (세부 매핑은 3.2에)
product:     ____ (토스증권/My Senior/Cloud 유지 여부는 3.3에)
convention:  ____
version:     ____
ticket:      ____
TC/run/result 계열 (3.15): ____
기타는 추천값 수용 [ ] / 직접 표기
```

---

## 6. 다음 단계

1. 이 파일에 유저가 결정 표기
2. 제가 결정에 맞춰 v23 실행 플랜 재작성 (Step 2-5 수정)
3. 실행 전 각 destructive 게이트 고지
4. 실행
5. 검증
6. 백업 파일 삭제 (테스크 #4)

---

## 참고 파일

- 백업 (프로드 pg_dump): `.claude/worktrees/ops-env/backups/aws-backup-pre-v23-20260423200633.sql`
- v23 플랜: `docs/ops/ops_v23.md`
- sync 스크립트: `scripts/sync-db-to-aws.sh`
