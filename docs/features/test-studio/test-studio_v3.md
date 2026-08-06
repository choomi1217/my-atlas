# Test Studio — v3: 대화형 분석·확정 루프 + 문서(PRD/Figma) 기반 TC 생성

> 변경 유형: 기능 추가  
> 작성일: 2026-06-30 (개정: 2026-07-01)  
> 버전: v3  
> 상태: 진행 중 (계획 / 의사결정 단계 — 착수 전 "확인 필요" 해소 필요)

---

# 개발 목적

- QA로서 일하면서 다음 버전을 준비할 때 가장 크게 공수를 들이는 건 두가지 일이었습니다.
1. 설계 결함·모순 탐지 
  — PRD/Figma를 보고 기존에 합의된 설계와의 충돌을 사람이 직접 대조해 찾아내는 일.
    - 예: 과거 개발 시 `admin = SuperUser`로 합의했는데, 새 PRD에서 `admin`을 단순 관리자로 격하하고 `SuperUser`라는 상위 개념을 새로 신설. 
2. 설계 분석 — PRD/Figma에서 어떤 **기능 테스트 / 비기능 테스트 / 보안 테스트**가 필요한지 TC를 설계하는데 **아주 많은 시간**이 든다.

- 이 두 비용을 TestStudio 안에서 AI와 채팅을 통해 줄여볼 예정.
---

# 핵심 판단

## 1. 컨텍스트 주입(원 제안의 1~4)은 이미 구현돼 있다 — 재구현 금지

현재 `TestStudioGenerator`는 문서 투입 시 이미 아래를 LLM 프롬프트에 주입해 DRAFT TC를 생성한다.

| 원 제안 항목 | 현재 상태 |
|---|---|
| 1. Product + Test Suite(기존 TC) 스타일 | ⚠️ 기존 TC를 주입하긴 하나 **임의 5개 + step 2개 절단** — 재설계 필요(§F) |
| 2. WordConvention | ✅ convention **전량**(term+definition) 주입 |
| 3. KB | ✅ 문서 텍스트로 벡터 검색해 KB top-5 주입 |
| 4. PRD 문서 | △ MARKDOWN(붙여넣기) / PDF(PDFBox 텍스트)만. **Figma 불가** |
| (Company→Product 선택 후 진입) | ✅ 이미 그 구조 |
| 예외/실패 케이스 포함 | ✅ 프롬프트에 "예외/실패 케이스 최소 1건" 강제 |

즉 **"문서 + 팀 자산 → TC 초안 생성"은 이미 동작 중**이다.

- 미주입: `product.description` (현재 product **name만** 사용) → Phase 0에서 보완.
- 미지원: Figma (백엔드에 비전/멀티모달 호출이 **전무**, 모든 AI 호출 text-only) → Phase 3(v4)로 분리.
- 미흡: 기존 TC retrieval이 관련도 정렬이 아니라 임의 5개 + DRAFT 혼입 + step 절단 → §F에서 재설계.

## 2. 진짜 새 작업(delta)

원 제안에서 **현재 없는 것**만 추리면 실제 개발 범위는 다음이다.

| delta | 내용 | 비고 |
|---|---|---|
| **대화형 사전분석 루프** | 생성 전, AI가 문서를 읽고 모호함·결함 의심을 지적·질문 → 유저와 멀티턴 → "OK" 시 생성 | **이 버전의 핵심 가치** |
| **출처 태깅(traceability)** | 생성 TC ↔ PRD 요구사항 매핑 + coverage 뷰 | **must-add** (§G) |
| **생성 후 편집·확정 게이트** | 생성 결과를 보여주고 per-TC AI 수정 또는 수동 편집 → "확정" 시에만 Test Suite 삽입 | 현재는 생성 즉시 DRAFT persist |
| **기존 TC retrieval 재설계** | ACTIVE 필터 + 관련도 정렬 + 온전한 요약 | 현 임의 5개/절단 대체 (§F) |
| Figma / 시각 입력 | 디자인 파일 분석 | 비전 배선 필요, 가장 비쌈 → v4 |
| `product.description` 주입 | 컨텍스트 1줄 보강 | 즉시 가능 |

## 3. 두 문제의 난이도가 다르다 — 한 버전에 욱여넣지 말 것

- **문제 #2 (분석→생성): 이미 ~80% 구현.** 대화 루프를 붙이는 목적은 "더 많은 TC"가 아니라 **생성 전에 모호함을 제거해 첫 초안 품질을 올리는 것**이다. 달성 가능, ROI 높음.
- **문제 #1 (결함 탐지): 새롭고 가치 최고, 그러나 함정이 많다.**
  - **AI는 시스템에 기록된 것하고만 비교할 수 있다.** "과거엔 admin=SuperUser였다"를 잡으려면 그 결정이 **Convention이나 기존 TC에 적혀 있어야** 한다. 어디에도 기록 안 된 결정은 영원히 못 잡는다. → **이 기능의 품질 상한선은 Convention·TC 관리 수준이 결정한다.** (주의: convention은 term+definition 구조라 용어 충돌엔 강하나 **권한·역할 모델 충돌은 못 잡을 수 있음** — 한계로 명시.)
  - **오탐(false positive)이 신뢰를 죽인다.** 한두 번 헛걸음하면 QA가 도구를 안 믿는다. recall보다 **precision** 우선.
  - 따라서 v3에서 #1은 "완벽한 자동 탐지"가 아니라 **"근거를 인용한 의심 목록(reviewer 보조)"** 로 스코프를 낮춘다. 모든 지적에 출처(예: "PRD 3절 vs WordConvention의 X")를 강제한다.

---

# 요구사항 (원문)

```
채팅을 통해 TestStudio에서 PRD/Figma 문서 기반으로 TC를 제작한다.

User Flow
1. Company / Product 선택 후 TestStudio 진입
2. 컨텍스트 주입: Product + Test Suite(기존 TC 스타일), WordConvention(용어), KB(QA 기본지식)
3. PRD / Figma 문서 투입
4. 사용자가 추가로 하고 싶은 말을 Chat으로 입력
5. LLM이 전체를 파악해 "이건 설계가 잘못됐다 / 이건 무슨 의미냐"를 유저와 주고받음(티키타카)
6. 유저가 "OK!" 하면 그때 TestCase 생성
7. 생성된 TC를 보여주고 수정 요청(AI) 또는 직접 수정 → Test Suite에 삽입
8. (미래) 만들어진 TC로 테스트 수행 → 자동화 코드 생성까지 발전
```

> 핵심 주의: **유저가 "OK"/"확정"하기 전까지 어떤 것도 Test Suite에 반영하지 않는다. 충분한 정보가 모이기 전까지 TC를 제안하지 않는다.**

---

# 선결 인프라 (별도 트랙 — ops_v32가 소유)

v3에 필요한 **prompt caching**과 **구조화 출력**은 Spring AI 2.0에서 제공된다. 이 업그레이드(Boot 4 + Spring AI 2.0)는 **test_studio가 아니라 별도 ops 트랙**이며, 마이그레이션 범위·검증·구현·상태는 전부 **[ops_v32](../../ops/ops_v32.md)**가 소유한다.

- **선결 관계만**: ops_v32 완료 후 v3 Phase 1 착수. 인프라 상세는 본 문서에서 다루지 않는다(→ ops_v32).

---

# 스코프 (v3 포함 / 제외)

**포함 (Phase 0~2):**
- Phase 0 — `product.description` 컨텍스트 주입 + TC retrieval 재설계(§F)
- Phase 1 — 대화형 사전분석 루프(요약·질문·근거 인용 결함 의심 → 멀티턴 대화 → "OK" 게이트) + **출처 태깅(§G)**
- Phase 2 — 생성 후 편집·확정 게이트(per-TC AI revise + 수동 편집 + "확정" 시 DRAFT 삽입)

**제외 (→ [test-studio_v4.md](./test-studio_v4.md)):**
- Phase 3 — Figma / 시각 입력 (비전 배선 필요)
- Phase 4 — 자동화 코드 생성

> 제외 사유: Figma·비전은 가장 비싸고 불확실하다. **text/PDF PRD로 핵심 가치(대화형 분석)를 먼저 검증**한 뒤 v4에서 붙인다. Phase 3·4 상세는 **[test-studio_v4.md](./test-studio_v4.md)** 참조.

---

# 기술적 난점 및 결정사항

## A. (v4로 이관) Figma / 시각 입력

Figma 입력·비전 배선 관련 기술 검토는 **[test-studio_v4.md](./test-studio_v4.md)**로 분리했다. v3는 text/PDF PRD만 다룬다.

## B. one-shot → 대화형의 비용

현재 TestStudio는 비동기 one-shot(POST job → 2초 폴링)이다. 대화형으로 바꾸면 매 턴 PRD+Convention 전량+KB+기존 TC+히스토리를 재전송하게 되어 턴당 토큰이 폭증한다.

- **Anthropic prompt caching** — PRD·Convention 같은 고정 대형 컨텍스트를 캐시하고 대화 꼬리만 변동시킨다. **이 기법 없이는 대화형이 비용으로 무너진다.** → **ops_v32(Spring AI 2.0) 선결** (§선결 인프라).
- 문서를 매 턴 재독하지 말고, **최초 1회 구조화 분석(요약 + 이슈/질문 목록)을 추출**해 그 산출물 위에서 대화한다. 단 #1(결함 탐지)엔 요약이 lossy할 수 있으므로 **원문은 캐시로 유지**한다.
- TestStudio에는 대화 상태가 없다(senior의 `chat_session`은 별도 도메인). → 분석 세션/메시지 저장이 신규로 필요(§데이터 설계).

## C. 모델 티어링 + 구조화 출력

현재 전 기능이 `claude-haiku-4-5`. 다문서 추론·모순 탐지(#1)에는 haiku가 약하다.

- **분석·결함탐지 턴 → 상위 모델(sonnet/opus급), 일반 TC 양산 → haiku 유지**로 분리. per-call 옵션 override는 이미 사용 중(TestStudio가 max-tokens override).
- **구조화 출력**: 현재 JSON 수동 파싱 + truncation 복구(`parseDrafts`/`truncateToLastCompleteObject`, v1.1 버그 전력)는 취약. ops_v32(Spring AI 2.0) 후 **표준 structured/tool output으로 대체**해 파서 자체를 제거한다.

## D. 확정·편집 게이트 (현재 "즉시 DRAFT persist"와 충돌)

- 현재: 생성 즉시 `status=DRAFT`로 DB 저장.
- v3: 대화 단계에서는 TC를 저장하지 않는다. 유저 "OK" 후 생성하되 **스테이징(미삽입)** 상태로 보여주고, 유저 "확정" 후에만 Test Suite에 DRAFT로 삽입한다.
- 선례: v2의 `suggestedSegmentPath` "추천 적용"이 곧 **stage-then-apply** 철학이다. 이를 확장한다.
- 신규 기능: per-TC **targeted revise**("이 TC만 이렇게 고쳐줘")는 전체 재생성과 다른 신규 동작.
- **"OK" 게이트 = 유저가 소유**: 버튼은 항상 노출하고, AI는 **막지 말고 advisory만**("지금 생성 가능하나 X 불명확 / 요구사항 N개 중 M개 컨텍스트 부족"). 이렇게 하면 "충분함"의 판단 주체가 AI가 아니라 유저가 된다(초기 요구의 비결정성 해소).

## E. 비기능·보안 테스트 기대치 보정

- 보안/비기능 TC는 **PRD/Figma만으로는 도출되지 않는다.** 인증·인가·입력검증·rate limit·PII 같은 항목은 KB(QA 지식)와 아키텍처 지식에서 온다.
- AI는 합리적 **체크리스트**는 생성하지만 실제 보안 감사는 못 한다. → **"테스트 아이디어 생성"으로 포지셔닝**하고, KB에 실제 보안/비기능 지식이 있어야 작동한다는 점을 전제로 둔다.
- **컨텍스트 부족 경고**: (a) 기계 신호 — KB 유사 청크/Convention/기존 TC 수가 임계 미만이면 배너, (b) AI 진단 — "X 검증엔 Y 지식이 필요한데 KB에 없음"을 요구사항별로.

## F. 기존 TC retrieval 재설계 (코드에서 확인된 문제)

현행 `TestStudioGenerator.buildExistingTcContext()`의 실제 동작(검증됨):

- `testCaseRepository.findAllByProductId(productId)` → `.stream().limit(5)`. repository는 **`OrderBy` 없는 derived query** → **관련도 정렬이 아니라 임의의 앞 5개**. (클래스 Javadoc·명세서의 "vector top-5"는 **stale/오기** — 실제 임베딩·유사도 없음.)
- **status 필터 없음** → **DRAFT(자기 생성물)까지 예시로 재투입** → 품질 드리프트 피드백 루프. (`findAllByProductIdAndStatus(productId, ACTIVE)`가 이미 있으니 그걸로 교체.)
- steps는 `.limit(2)` + `truncate(…,200)` → 다단계 TC가 **앞 2 step·200자로 과절단**. (1-step은 안전 — limit(2)는 최대 2개라 크래시 없음.)

→ v3의 dedup·coverage·스타일 학습엔 부족. **재설계**: ① ACTIVE 필터, ② 관련도 정렬(TC 임베딩 or 최소 결정적 정렬), ③ 온전한 요약(step 절단 완화, 토큰 예산 내), ④ dedup은 5개가 아니라 **전체 대조** 경로 별도.

## G. 출처 태깅 / coverage (must-add)

단순 컬럼 추가가 아니라 **요구사항 인벤토리 기반**으로 설계한다.

- **분석 1회차에서 PRD를 "요구사항 인벤토리"(번호 목록)로 분해 → 세션에 1회 영속화.**
- 생성된 각 TC가 **요구사항 #N을 참조** → traceability(왜 나왔나) + **coverage(어느 요구사항이 TC 0개인가)** 를 한 번에 확보.
- 주의: LLM이 매번 뽑는 번호는 불안정 → **인벤토리는 1회만 추출·고정**, 재생성 시 재추출 금지.
- 결함 의심(#1) 출력도 인벤토리·Convention 항목을 **출처로 인용**. 필요 시 `product.jira_project_key` + 기존 Jira 설정으로 **이슈 생성**까지 라우팅 가능(선택).

---

# 제안 아키텍처 (Phase 1~2 개념도)

```
[Company ▼] [Product ▼]  ──선택──▶ 문서(PRD: MD/PDF) 투입 + 추가 지시(Chat)
                                          │
                                          ▼
                          ① 1회 구조화 분석 (상위 모델, prompt caching)
                             - 문서 요약 + 요구사항 인벤토리(#1..#N) 추출·고정
                             - 모호/누락 → 유저 질문
                             - 근거 인용 결함 의심 (vs Convention / 기존 TC)
                             - 컨텍스트 부족 신호
                                          │
                                          ▼
                          ② 멀티턴 대화 루프 (히스토리 주입 + 캐시 유지, SSE)
                             - 유저 답변 ↔ AI 추가 질문·정정
                             - [항상 노출] "대화 마치고 TC 생성" 버튼 + AI advisory
                                          │
                              유저 "OK!" ─┤
                                          ▼
                          ③ TC 생성 (스테이징 — 세션에 보관, Test Suite 미삽입)
                             - 각 TC → 요구사항 #N 태깅
                                          │
                                          ▼
                          ④ 편집 루프
                             - per-TC AI revise / 수동 편집
                             - 기존 TC 전체 대조 dedup, suggestedSegmentPath 추천
                                          │
                            유저 "확정" ──┤
                                          ▼
                          ⑤ DRAFT 삽입 → Feature Registry TestCasePage 검토·ACTIVE 전환
```

**신규 개념 2가지**
- **분석 세션** — 캐시된 문서 컨텍스트 + 요구사항 인벤토리 + 대화 히스토리 + 스테이징 제안. **영속(재개 가능)**.
- **스테이징된 TC 제안** — 확정 전까지 Test Suite 미삽입, 세션 전용 저장소에 격리.

---

# 데이터 / 상태 설계

- **분석 세션 저장**: 신규 `test_studio_session`(+ 메시지/제안) 방향. senior `chat_session`은 LLM 히스토리 재주입 구조가 아니라 그대로 재사용 불가 — 멀티턴 주입은 어차피 신규 구현.
- **스테이징 TC 보관 — 옵션 B(영속) 권장** (이전 옵션 A에서 변경):

  | 옵션 | 장점 | 단점 |
  |---|---|---|
  | A. 미저장(프론트 state) | "미반영" 의미 깨끗 | **이탈/새로고침 시 소실 + 비싼 분석 재호출** |
  | **B. 세션 전용 저장소에 영속(Test Suite 미노출)** | **이탈 후 재개**, 분석 비용 보존, "확정 전 미반영"도 동시 만족 | 세션 저장소·정리 로직 필요 |

  → **이탈 우려 + 분석 호출이 비쌈(상위 모델)** 때문에 B. 스테이징 제안은 `test_case`가 **아니라** 세션 저장소에 → 이탈은 버그가 아니라 정상 흐름(재개/폐기). (`DRAFT`는 이미 "운영 전 TC" 마커라 재사용 금지.)
- **출처 태깅 데이터**: 요구사항 인벤토리(세션에 저장) + 각 TC의 `source_ref`(요구사항 #N). 저장 위치·형식은 구현 시 확정.
- **세션 라이프사이클**: 상태(IN_PROGRESS / ABANDONED) + "진행 중 분석 세션" 목록에서 재개·폐기. 저장 시점 = 분석 1회 후 / 매 턴 / 생성 시.
- `product.description` 주입(Phase 0)은 위 결정과 무관하게 즉시 가능.

---

# 구현 절차 (User 승인 단위)

각 Step은 User 지시 없이 다음으로 넘어가지 않는다. 완료 시 `- [ ]`를 `- [x]`로 갱신한다.
**전제: 아래 "확인 필요" 항목 + ops_v32(Boot 4 + Spring AI 2.0) 완료·green이 선행되어야 Phase 1 착수 가능.**

### Phase 0 — 컨텍스트 보강 (즉시, 인프라 무관)
- [x] **Step 1** — `TestStudioGenerator` 프롬프트에 `product.description` 주입 + 테스트 보강. (2026-07-13) — `buildPrompt`에 `[Product]` 블록을 `name + "설명: " + description`으로 확장(null/blank 시 name-only fallback). 단위 테스트 2건 추가(주입 검증 + blank fallback), `TestStudioGeneratorTest` 10건 통과.
- [x] **Step 2** — ~~TC retrieval 재설계(§F)~~ → **v2.5로 이관·폐기**. (2026-07-28) "기존 운영 TC 자동 주입" 접근 자체를 폐기하고 **Style-by-Example**(사용자가 작성한 예시 TC 세트를 verbatim 주입)로 대체했다. §F 재설계 코드(ACTIVE 필터/relevance/summarize)는 v2.5 Step 3에서 제거됨. → [test-studio_v2.5.md](./test-studio_v2.5.md)
- [ ] **Step 2.5** — (T1 — [qa_v14](../../qa/qa_v14.md) 트랙 T에서 귀속) 생성 프롬프트에 **테스트 설계 기법 + TC 설계 체크리스트 주입**:
  - 설계 기법 지시: 문서 특성에 따라 EP/BVA/State Transition/Decision Table 중 적용 기법을 선택·명시하도록 시스템 지시 추가
  - 체크리스트 핵심 규칙 주입 (`docs/qa/portfolio/user_feedback.md` 26건에서 발췌): TC 원자성(#1), 단일 Oracle — Expected에 "또는"·"적절한" 금지(#7·#25), Positive/Negative 쌍(#2), 실행자 중심 언어(#21), 최소 전제조건(#23)
  - **검증**: `TestStudio_입력문서` 5종으로 개선 전/후 생성 → 채점시트 비교, 결과와 프롬프트 토큰 증가량을 본 문서에 기록

### Phase 1 — 대화형 사전분석 루프 (ops_v32 선결 후)
- [ ] **Step 3** — 분석 세션 백엔드: 1회 구조화 분석(요약 / **요구사항 인벤토리** / 질문 / **근거 인용** 결함 의심 / 컨텍스트 부족 신호). prompt caching + 분석 턴 모델 티어.
- [ ] **Step 4** — 멀티턴 대화 endpoint: 히스토리 LLM 재주입 + 캐시 유지 + SSE.
- [ ] **Step 5** — 프론트 대화 UI: 문서 투입 + 채팅 + 분석 패널(출처 표기) + 항상 노출된 "생성" 버튼 + advisory.
- [ ] **Step 6** — "OK!" 게이트 → TC 생성(스테이징, 세션 저장) + 요구사항 #N 태깅.

### Phase 2 — 편집 · 확정
- [ ] **Step 7** — 스테이징 TC 표시 + 수동 편집 + per-TC AI revise.
- [ ] **Step 8** — 기존 TC **전체 대조** dedup + Company/Product 변경 시 세션 무효화.
- [ ] **Step 9** — "확정" → DRAFT 삽입 + coverage 뷰(인벤토리 대비 미커버 표시) + `suggestedSegmentPath` 재사용.

### Phase 3 — 테스트 · 검증
- [ ] **Step 10** — Backend 단위/통합: 세션, 멀티턴 주입, 게이트, revise, dedup, 인벤토리·태깅.
- [ ] **Step 11** — E2E: 문서 → 대화 → OK → 생성 → 편집 → 확정 → TestCasePage 노출 + 이탈 후 재개.
- [ ] **Step 12** — 4-Agent Pipeline Agent-D 검증(`./gradlew clean build` → `docker compose up -d --build` → `npx playwright test` → `docker compose down`).
- [ ] **Step 13** — 문서: `test-studio.md` 버전 히스토리 갱신(v2·v3 함께 정리).

---

# 확인 필요 / 선결정 사항

1. **선결 인프라 (외부 의존 — ops_v32)** — Boot 4 + Spring AI 2.0 업그레이드는 별도 ops 트랙. 완료 여부만 [ops_v32](../../ops/ops_v32.md)에서 확인(상세·상태는 그쪽 소유). Phase 1의 전제.
   - **완료** (ops_v32 개발 완료)
2. **WordConvention이 실제로 관리·권위 있는가?** 결함 탐지(#1)의 품질 상한. + **권한/역할 결정은 convention에 안 담길 수 있음** — #1 스코프를 용어 충돌 중심으로 둘지 결정.
   - **완료** (결정: #1 스코프에 **권한/역할 결정도 Convention에 기록하는 관행**을 포함. definition이 모호하면 AI가 추측하지 말고 **chat으로 질문**. 예: Term=`Admin` — "회사별로 SuperUser와 분리 or 결합 가능" → 이 product에선 어느 쪽인지 AI가 되물음. §G와 연결.)
3. **PRD가 어디 사는가?** Notion 연결 시 PDF보다 Notion 직접 수집이 깔끔. v3는 text/PDF만.
   - **완료** (결정: PRD 출처 무관 — Notion 등 어디에 있든 **Markdown 텍스트박스에 붙여넣으면 됨**. Notion API 직접 연동은 v3 불필요, 편의용 후순위. 이미지는 v3 text-only라 무관 → v4 Figma.)
4. **timeout 초과 시 복구 정책** (기존 "성공 지표/시간 절감"은 제외 — 개인 프로젝트라 ROI 측정 불필요) — LLM 분석·생성이 설정 timeout을 초과할 때의 처리. 권장 조합: ① 분석·생성을 **비동기 Job/SSE**로 처리해 HTTP timeout과 분리, ② 생성 중 초과 시 **완료 TC 보존**(기존 "부분 성공=DONE" 패턴 확장), ③ **명시적 재시도** 버튼 + 세션 영속(옵션 B)으로 유실 0. → 세부 정책(timeout 값·재시도 횟수) 확정 필요.
5. **모델 티어**: 분석 턴 상위 모델 비용 허용 여부.
6. **dedup 정책**: 전체 대조 기준, segment 자동 배치 범위.

> 해소됨(번호 외): 스테이징 상태 모델 → **옵션 B(영속)** (§데이터 설계).

---

# 리스크 / 엣지 케이스

| 케이스 | 처리 방향 |
|---|---|
| 결함 탐지 오탐 남발 | 모든 지적에 출처 인용 강제, precision 우선. 근거 없는 "이상함" 금지 |
| Convention/TC에 과거 결정 미기록 (특히 권한 모델) | 탐지 불가 — 한계 명시, 기대치 보정 |
| Studio Chat 도중 이탈 | **세션 영속 → 재개**(정상 흐름). Test Suite 오염 없음 |
| 대형 PRD + 다턴 대화 | prompt caching(ops_v32) + 원문 캐시 유지 + 인벤토리로 토큰 통제 |
| "OK" 전 생성 / "확정" 전 삽입 | 게이트 + 세션 격리 저장으로 원천 차단 |
| 생성 TC가 기존 TC와 중복 | 확정 전 **전체** 대조 dedup |
| AI가 예시로 자기 DRAFT 학습 | retrieval을 ACTIVE 필터(§F) |
| 보안·비기능 과대 기대 | "테스트 아이디어 생성"으로 포지셔닝, KB 의존 명시 |
| Figma 요청 | v3 범위 외 — v4 안내 |

---

# 참조

**현행 구현 (검증된 사실)**
- `TestStudioGenerator.java` — KB top-5(vector) / Convention 전량 / 기존 TC **임의 5개** 주입, product **name만**, `claude-haiku-4-5`, blocking(max_tokens 8192), JSON 수동 파싱.
- `buildExistingTcContext` — `findAllByProductId().limit(5)` (관련도·status 무관) + steps `limit(2)`+200자 절단.
- 백엔드 전역 **비전/멀티모달 없음**(text-only).
- prompt caching·구조화 출력은 **ops_v32(Spring AI 2.0)** 이후 사용 가능 — 인프라 상세·상태는 ops_v32 소유(별도 트랙).
- v2 `suggestedSegmentPath` "추천 적용" — stage-then-apply 선례.

**관련 문서**
- [test-studio.md](./test-studio.md) — 메인 명세서
- [test-studio_v1.md](./test-studio_v1.md) / [test-studio_v1.1.md](./test-studio_v1.1.md) / [test-studio_v2.md](./test-studio_v2.md)
- **[ops_v32](../../ops/ops_v32.md)** — Spring Boot 4.0 + Spring AI 2.0 최신화 — **본 기능의 선결 인프라(R1)**
- 연동 도메인: Knowledge Base, Word Convention, Feature Registry, My Senior(chat 인프라 참조)

---

> 본 문서는 **계획·의사결정 단계**다. "확인 필요" 항목 + ops_v32(선결 인프라)가 정리되면 Phase 0부터 Step 단위로 착수하며, 각 Step 완료 시 체크박스를 갱신하고 모든 Step 완료 후 본 문서 하단에 **[최종 요약]** 을 추가한다.
