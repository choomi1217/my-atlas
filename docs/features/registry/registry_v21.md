# Registry v21 — 실행 프로파일 자격증명 + 외부 제품 지원 (범용 로그인·읽기 전용 안전선)

> 변경 유형: 기능 추가
> 작성일: 2026-07-23
> 버전: v21
> 상태: 예정 (계획 — registry_v20 Phase 2 완료 후 분기)

---

## 배경 — 왜 이 버전이 필요한가

registry_v20에서 **에이전트 실행 엔진**을 구현하고 docker로 실동 검증했다. 그 과정에서 드러난 핵심 한계:

**에이전트 실행 루프(스냅샷→액션→판정)는 범용이지만, 로그인은 my-atlas 전용으로 과하게 fit되어 있다.**

구체적으로 v20의 `agent-worker/src/agent.js` `autoLogin`은:
- `POST /api/auth/login` (my-atlas 전용 엔드포인트) 호출
- 응답의 `data.token`/`username`/`role` 파싱 → `localStorage['my-atlas-token']`, `['my-atlas-user']` 주입
- 자격증명은 워커 env `AGENT_WORKER_USERNAME/PASSWORD`(id/password를 `.env`에 고정 설정) **고정**

→ **my-atlas 자기 테스트에만 통한다.** Toss 같은 외부 제품을 `hello / hello!@~~@#` 같은 별도 계정으로 로그인시키는 것은 현재 불가:
1. 엔드포인트·응답·localStorage 키가 전부 다름
2. **Product별로 다른 자격증명을 저장할 구조가 없음** (env 하나로 고정, seedNote는 평문이라 비밀값 금지)
3. v20에서 폼 로그인을 의도적으로 버리고 my-atlas API 주입으로 대체함 (폼 `fill`이 React controlled-input 미갱신)

이 버전은 **(1) Product별 안전한 자격증명 저장 → (2) 범용 로그인 메커니즘 → (3) 외부 제품 읽기 전용 안전선** 순으로 외부 제품 실행을 가능케 한다 (qa_v14 시나리오 4 귀속처).

---

## 스코프

**포함:**
- Product 실행 프로파일에 **자격증명 저장** (암호화 or Secret 참조, DB 평문 금지)
- 워커가 Product별 자격증명을 받아 로그인하는 경로 (env 고정 → per-product)
- **범용 로그인 메커니즘** (my-atlas API 주입 방식에서 탈피)
- **외부 제품 읽기 전용 안전선** — 부작용 step 분류기 + 실행 거부 (qa_v14 시나리오 4)
- 외부 제품(읽기 전용) 플래그 + Phase 실행 시 선행 검사

**제외 (변경 불가 원칙, qa_v14 승계):**
- 부작용 있는 step 자동 실행 금지 (결제·주문·계정 변경·데이터 생성/삭제) — 외부 실서비스
- 외부 실서비스 데모는 통제 가능한 대상(별도 배포 샘플 앱) 우선

---

## 설계 (초안 — 착수 시 구체화)

### 1. 자격증명 저장 (핵심 선행)

**원칙: DB 평문 저장 금지.** 후보:

| 안 | 방식 | 장단 |
|----|------|------|
| A. env 참조 키 | 프로파일엔 `exec_cred_ref`(키 이름)만, 실제 값은 워커 env/Secret에 | 단순, 비밀값 DB 미저장. 단 키 관리 수동 |
| B. 앱 레벨 암호화 | DB에 암호화 저장(예: AES + 앱 마스터키), 워커 요청 시 복호화 전달 | Product별 UI 설정 가능. 마스터키 관리 필요 |
| C. Secret Manager | AWS Secrets Manager 등에 저장, 프로파일엔 ARN | 프로덕션급. 인프라 비용/복잡도 |

→ 로컬/PoC는 **A(env 참조 키)**, 프로덕션 확장 시 **B/C** 재평가.

### 2. 스키마 변경 (초안)

`product` 실행 프로파일 확장:
- `exec_login_url` (로그인 페이지 경로, baseUrl 상대 or 절대)
- `exec_username` (계정 ID — 비밀 아님)
- `exec_cred_ref` (비밀번호는 값이 아닌 **참조 키** — 실제 값은 env/Secret)
- `exec_is_external` (외부 제품 여부 → 읽기 전용 안전선 강제)

### 3. 범용 로그인 메커니즘

v20의 my-atlas API 주입은 자기 테스트 fast-path로 유지하되(옵션), 일반 대상은:
- **에이전트 폼 로그인** — 로그인 URL 진입 → username칸에 `exec_username`, password칸에 복호화된 비밀번호 입력 → 제출. React SPA `fill` 불안정은 `pressSequentially`(실제 타이핑) + 값 검증 재시도로 보강.
- 자격증명은 워커가 **로그 등에 절대 남기지 않음** (마스킹).

### 4. 외부 제품 읽기 전용 안전선 (qa_v14 시나리오 4)

- Phase/단건 실행 전 **step 분류기**: 각 TC step을 LLM/규칙으로 분류 → 부작용(결제·주문·가입·작성·삭제) 감지 시 **실행 거부 + 사유 표시**
- `exec_is_external=true`면 읽기 전용 step(탐색·조회·표시 검증)만 통과, 나머지 `수동 전용` 표시
- 사람 확인 게이트: 외부 제품 첫 실행 전 안전선 재확인

---

## 구현 절차 (User 승인 단위)

각 Step은 User 지시 없이 다음으로 넘어가지 않는다.

- [ ] **Step 1** — 자격증명 저장 방식 결정(A/B/C) + `product` 스키마 마이그레이션 (exec_login_url, exec_username, exec_cred_ref, exec_is_external)
- [ ] **Step 2** — 실행 컨텍스트 endpoint 확장: 워커에 로그인 정보(URL·username·복호화 비밀번호) 전달 (마스킹 로깅)
- [ ] **Step 3** — 워커 범용 폼 로그인 (pressSequentially + 값 검증 재시도), 자격증명 마스킹
- [ ] **Step 4** — 프론트: 실행 프로파일 UI에 로그인 URL/계정/비밀참조 + 외부 제품 플래그 입력
- [ ] **Step 5** — 읽기 전용 안전선: step 분류기 + 부작용 step 실행 거부 + `수동 전용` 표시
- [ ] **Step 6** — 통제 가능한 외부 대상(샘플 앱)으로 E2E 검증 + 문서 갱신
- [ ] **Step 7** — 단위/통합/E2E 테스트 (Agent-D 3단계)

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| 자격증명 유출 | DB 평문 금지, 로그 마스킹, Secret 참조. 외부 실계정은 스테이징/샘플 우선 |
| 외부 실서비스 부작용 | step 분류기 + 읽기 전용 화이트리스트 + 사람 확인 게이트 |
| 사이트별 로그인 편차 | 범용 폼 로그인 + Product별 로그인 설정(URL·셀렉터) 폴백 |
| 외부 실서비스 약관/부하 | 통제 가능한 대상 우선, 실서비스 데모 신중 |

---

## 참조

- [registry_v20.md](./registry_v20.md) — 실행 엔진 (자격증명·외부 로그인 미지원 상태) + "Phase 2 런타임 검증·신뢰성 개선"
- [qa_v14](../../qa/qa_v14.md) — 상위 전략 (시나리오 4 외부 제품 + 안전선 원문)
- [registry.md](./registry.md) — 메인 명세서
