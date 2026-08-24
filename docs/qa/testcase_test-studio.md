# Test Studio — TestCase 명세 (v3 기준 / 기존 vs 신규)

> 변경 유형: 테스트 보강  
> 작성일: 2026-07-01  
> 버전: v1  
> 상태: 진행 중

---

## 목표 / 사용 안내

Test Studio 기능에 대한 **사람이 설계한 레퍼런스 TC**다. 두 용도로 쓴다.

1. **Test Studio 자체 검증** — 아래 TC로 Test Studio 동작을 확인.
2. **AI vs 사람 비교** — v3/v4/ops_v32 문서(PRD)를 Test Studio에 투입해 **AI가 생성한 TC**를 뽑고, 본 문서의 TC와 **커버리지·정확도·스타일** 차이를 비교하는 기준(gold set)으로 사용.

**구성**
- **Part A — 기존 기능 (v1~v2)**: 현재 구현·배포됨 → **지금 실행 가능**.
- **Part B — v3 이후 기능 (계획)**: 미구현 → **구현 후 실행할 acceptance 기준**.

**TC 스키마** (앱 `test_case`와 동일): `title` / `preconditions` / `steps[{order, action, expected}]` / `expectedResults` / `priority(HIGH·MEDIUM·LOW)` / `testType(SMOKE·FUNCTIONAL·REGRESSION·E2E)` / `status`. 본 문서 TC는 모두 `status=DRAFT`(레퍼런스).

> 대상 Product: `youngmi.works/features/companies/1440/products/2637`

---

# Part A — 기존 Test Studio 기능 (v1~v2) · 실행 가능

## A1. 문서 투입 & Job 생성 (검증·경계)

#### [A-01] Markdown 문서로 Job 생성
- **분류**: Test Studio > 문서 투입 | **Type**: SMOKE | **Priority**: HIGH
- **사전조건**: Header에서 Test Studio 진입, Company·Product 선택 완료
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 소스 타입 MARKDOWN 선택, 제목 입력, 본문에 스펙 텍스트 붙여넣기 | 폼 입력 완료 |
  | 2 | "생성 요청" 클릭 | `POST /api/test-studio/jobs` 201, jobId 반환, Job이 PENDING으로 목록에 표시 |
- **예상 결과**: Job 생성 성공, 이후 비동기 파이프라인 시작

#### [A-02] PDF 파일로 Job 생성
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: Product 선택 완료, 텍스트 추출 가능한 PDF 준비(≤20MB)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 소스 타입 PDF 선택, 제목 입력, 파일 업로드 | 파일 첨부됨 |
  | 2 | "생성 요청" 클릭 | 201, Job PENDING. 서버가 PDFBox로 텍스트 추출 |
- **예상 결과**: PDF 텍스트 기반으로 DRAFT TC 생성

#### [A-03] 제목 누락 → 거부
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: Product 선택 완료
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 제목을 비운 채 본문만 입력 후 제출 | 400, "title is required" (Job 미생성) |
- **예상 결과**: 필수값 검증으로 Job이 만들어지지 않음

#### [A-04] MARKDOWN 본문 빈 값 → 거부
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 소스 타입 MARKDOWN
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 본문을 공백만 넣고 제출 | 400, "Markdown content is required" |
- **예상 결과**: 빈 문서로 임베딩/LLM 호출 낭비 방지

#### [A-05] Markdown 100,000자 초과 → 거부 (경계)
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 소스 타입 MARKDOWN
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 100,001자 본문 제출 | 400, "문서 길이가 100,000자를 초과했습니다" |
- **예상 결과**: 입력 토큰 보호 상한 강제

#### [A-06] Markdown 정확히 100,000자 → 통과 (경계)
- **분류**: Test Studio > 문서 투입 | **Type**: REGRESSION | **Priority**: MEDIUM
- **사전조건**: 소스 타입 MARKDOWN
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 정확히 100,000자 본문 제출 | 201, Job 생성(경계 포함) |
- **예상 결과**: off-by-one 없이 경계값 허용

#### [A-07] PDF 20MB 초과 → 거부 (경계)
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 소스 타입 PDF
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 20MB 초과 PDF 업로드·제출 | 400, "PDF 파일 크기가 20MB를 초과했습니다" |
- **예상 결과**: 파일 크기 상한 강제

#### [A-08] PDF 선택인데 파일 없음 → 거부
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 소스 타입 PDF
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 파일 없이 제출 | 400, "PDF file is required" |
- **예상 결과**: 파일 필수 검증

#### [A-09] 존재하지 않는 Product → 거부
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 없는 productId로 API 직접 호출
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | productId=999999로 Job 제출 | 400, "Product not found: 999999" |
- **예상 결과**: FK 무결성 사전 검증

#### [A-10] 텍스트 추출 불가 PDF → Job FAILED
- **분류**: Test Studio > 문서 투입 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 스캔 이미지만 있는(텍스트 레이어 없는) PDF
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 PDF로 Job 제출 후 완료 대기 | Job FAILED, error_message "원본 문서에서 텍스트를 추출할 수 없습니다" |
- **예상 결과**: 추출 실패가 명확한 FAILED로 기록(무한 PROCESSING 아님)

## A2. 비동기 Job 상태 & 결과

#### [A-11] Job 상태 전이 & generated_count
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 정상 Markdown Job 제출
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 생성 직후 상태 조회 | PENDING |
  | 2 | 2초 간격 폴링 | PROCESSING → DONE 순으로 전이 |
  | 3 | DONE 시 generated_count 확인 | 생성된 DRAFT TC 수와 일치, completed_at 기록 |
- **예상 결과**: 상태 전이가 관측 가능, 카운트 정확

#### [A-12] 파싱 실패(0건) → Job FAILED
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: LLM이 JSON 배열을 못 만든 응답(모킹/재현)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | Job FAILED, error_message "JSON 배열 파싱 실패 — 생성된 TC 없음" |
- **예상 결과**: 0건일 때 DONE이 아니라 FAILED

#### [A-13] 부분 파싱 성공 → 성공분 저장 + DONE
- **분류**: Test Studio > Job | **Type**: REGRESSION | **Priority**: MEDIUM
- **사전조건**: 일부 TC만 유효한 응답
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | 유효한 TC만 저장, generated_count=성공분, Job DONE |
- **예상 결과**: 일부 실패가 전체 실패로 번지지 않음

#### [A-14] Claude 응답 truncation 복구 (v1.1)
- **분류**: Test Studio > Job | **Type**: REGRESSION | **Priority**: MEDIUM
- **사전조건**: max_tokens 근처에서 잘린 JSON 배열 응답
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 완료 대기 | 마지막 완결 객체까지 복구해 저장, 나머지는 버림, Job DONE |
- **예상 결과**: 잘린 JSON에서도 완결분은 보존

#### [A-15] Job 단건 조회
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 기존 Job 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /api/test-studio/jobs/{id}` | 200, 상태·generated_count·타임스탬프 포함 |
- **예상 결과**: Job 메타데이터 정확 반환

#### [A-16] 없는 Job 조회 → 404
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /jobs/999999` | 404, "Job not found: 999999" |
- **예상 결과**: 미존재 명확 처리

#### [A-17] Product별 Job 목록 최신순
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 같은 Product에 Job 여러 개
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /jobs?productId={id}` | created_at DESC 정렬로 반환 |
- **예상 결과**: 최신 Job이 상단

#### [A-18] Job 삭제 시 DRAFT TC 보존 (CRITICAL)
- **분류**: Test Studio > Job | **Type**: REGRESSION | **Priority**: HIGH
- **사전조건**: DONE Job + 그로 생성된 DRAFT TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `DELETE /jobs/{id}` | 200, Job 삭제 |
  | 2 | 해당 DRAFT TC 조회 | TC는 **유지**, `test_studio_job_id`만 NULL(FK ON DELETE SET NULL) |
- **예상 결과**: Job 삭제가 산출 TC를 삭제하지 않음(이미 ACTIVE 전환했을 수 있음)

#### [A-19] 없는 Job 삭제 → 404
- **분류**: Test Studio > Job | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `DELETE /jobs/999999` | 404 |
- **예상 결과**: 미존재 삭제 거부

## A3. RAG 컨텍스트 주입

#### [A-20] 생성 TC가 Convention 용어 반영
- **분류**: Test Studio > RAG | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: Convention에 팀 용어 등록(예: "결제 단말기" 표준)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 용어가 등장하는 스펙으로 Job 생성 | 생성 TC 문구가 Convention 표준 용어를 따름 |
- **예상 결과**: 용어 일관성 반영

#### [A-21] 기존 TC 패턴(제목/steps) 반영
- **분류**: Test Studio > RAG | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: Product에 기존 TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 생성 후 산출 TC 확인 | 제목 prefix·steps 구조가 기존 TC 스타일과 유사 |
- **예상 결과**: 팀 작성 패턴 흡수 (단 §F 한계 있음 — B-23/24 참고)

#### [A-22] KB 지식 반영
- **분류**: Test Studio > RAG | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: KB에 관련 도메인 지식 존재, 임베딩 활성
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 관련 스펙으로 Job 생성 | KB top-5 근거가 반영된 TC(도메인 규칙 준수) |
- **예상 결과**: 벡터 검색 컨텍스트가 결과에 기여

#### [A-23] 예외/실패 케이스 최소 1건 포함
- **분류**: Test Studio > RAG | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 정상 Job
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 산출 TC 집합 확인 | 네트워크 오류/입력 검증 실패/타임아웃 등 예외 케이스가 최소 1건 |
- **예상 결과**: 프롬프트 강제 조건 충족

#### [A-24] 컨텍스트가 비어도 생성 동작
- **분류**: Test Studio > RAG | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 신규 Product(기존 TC 0, KB 무관, Convention 0)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job 생성 | "(기존 TC 없음)"/"(등록된 용어 컨벤션 없음)" 컨텍스트로도 TC 생성 성공 |
- **예상 결과**: 빈 컨텍스트가 예외를 일으키지 않음

## A4. DRAFT 저장 & suggestedSegmentPath (v2)

#### [A-25] DRAFT는 status=DRAFT + job_id + path 빈 상태
- **분류**: Test Studio > 산출 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: DONE Job
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 산출 TC 조회 | status=DRAFT, test_studio_job_id 세팅, path=빈 배열 |
- **예상 결과**: 강제 path 주입 없음(미배정 상태)

#### [A-26] suggestedSegmentPath DB 영속
- **분류**: Test Studio > 산출 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: DONE Job
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 산출 TC의 suggested_segment_path 확인 | Claude 추천 경로가 문자열 배열로 저장됨 |
- **예상 결과**: 추천이 유실되지 않고 재적용 가능

#### [A-27] 미배정 TC가 대시보드 "미배정" 섹션에 노출
- **분류**: Test Studio > 산출 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: path 빈 DRAFT 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company DRAFT 대시보드 열기 | 해당 TC가 🤖 미배정 섹션에 표시 |
- **예상 결과**: 미배정 가시화

## A5. Company 대시보드 & 경로 적용 UX (v2)

#### [A-28] Header 진입 → Company → Product 선택
- **분류**: Test Studio > UI | **Type**: SMOKE | **Priority**: HIGH
- **사전조건**: 활성 Company 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Header "Test Studio" 클릭 | `/test-studio` 진입 |
  | 2 | Company 드롭다운 선택 → Product 드롭다운 선택 | Company 종속으로 Product 목록 로드 |
- **예상 결과**: Company→Product 2단 선택 동작

#### [A-29] Company DRAFT 대시보드 2섹션
- **분류**: Test Studio > UI | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 미배정·배정완료 DRAFT 혼재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 대시보드 탭 열기 | 🤖 미배정 / ✅ 배정완료 2섹션으로 분리 표시 |
- **예상 결과**: Company 전체 Product 가로질러 집계

#### [A-30] 단건 "추천 적용" → path 반영
- **분류**: Test Studio > 경로적용 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: suggestedSegmentPath 있는 미배정 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "추천 적용" 클릭 | `POST /api/test-cases/{id}/apply-suggested-path`, 이름 매칭으로 path 반영 |
  | 2 | 섹션 확인 | TC가 ✅ 배정완료로 이동 |
- **예상 결과**: 서버 최장 접두사 매칭으로 ID 배열 변환·저장

#### [A-31] 다중선택 → 일괄 추천 적용
- **분류**: Test Studio > 경로적용 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 미배정 TC 3건
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 3건 체크 → "일괄 추천 적용" | `bulk-apply-suggested-path`, 3건 모두 처리 |
- **예상 결과**: 배치 적용 성공

#### [A-32] 추천 일부만 매칭 → fullMatch=false
- **분류**: Test Studio > 경로적용 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 추천 경로 일부가 실제 Segment와 불일치
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "추천 적용" | 200, resolvedLength < names.length, fullMatch=false, 토스트 안내 |
- **예상 결과**: 부분 매칭도 400 아님, 수동 유도

#### [A-33] suggestedSegmentPath=null → 수동만
- **분류**: Test Studio > 경로적용 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 추천 없는 DRAFT(v1 생성분 등)
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 카드 확인 | "🤖 추천 없음" 표시, "수동 지정"만 제공 |
- **예상 결과**: null 추천에도 정상 처리

#### [A-34] 동명 Segment → 결정적 선택
- **분류**: Test Studio > 경로적용 | **Type**: REGRESSION | **Priority**: LOW
- **사전조건**: 동일 parent 하 동명 Segment 2개
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 추천 적용 | id 오름차순으로 결정적 선택 + WARN 로그 |
- **예상 결과**: 비결정성 없음

#### [A-35] 수동 지정(Segment Picker)
- **분류**: Test Studio > 경로적용 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 미배정/미매칭 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "수동 지정" → Segment Tree Picker에서 경로 선택 → 적용 | path 반영, 배정완료로 이동 |
- **예상 결과**: 수동 경로 부여 동작

#### [A-36] Company 레벨 DRAFT 필터
- **분류**: Test Studio > 조회 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: Company 내 여러 Product에 DRAFT
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `GET /api/test-cases?companyId={id}&status=DRAFT` | Product 가로질러 DRAFT 전체 반환 |
- **예상 결과**: Company 스코프 조회 정상

#### [A-37] productId·companyId 동시 지정 → 상호배타
- **분류**: Test Studio > 조회 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 두 파라미터 동시 지정 호출 | 상호배타 규칙에 따라 명확한 처리(한쪽만 허용/400) |
- **예상 결과**: 모호한 쿼리 방지

## A6. TC Path 수동 편집 (v2)

#### [A-38] TC Card DnD → path 변경
- **분류**: Registry > Path 편집 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: TestCasePage, Segment 트리 + TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | TC 카드를 Segment 노드로 드래그·드롭 | `PATCH /test-cases/{id}/path`, path 교체, "이동했습니다" 토스트 |
- **예상 결과**: DnD로 경로 재지정

#### [A-39] 다른 Product Segment로 이동 시도 → 거부
- **분류**: Registry > Path 편집 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 서로 다른 Product의 Segment
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 타 Product Segment로 drop 시도 | 거부(TC는 Product 고정), UI에서도 drop 대상 아님 |
- **예상 결과**: Product 경계 침범 방지

#### [A-40] 편집 모달 Segment Picker로 path 수정
- **분류**: Registry > Path 편집 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: TC 편집 모달
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 모달에서 Segment Picker로 경로 변경 후 저장 | path 반영 |
- **예상 결과**: 모달 경로 편집 동작

#### [A-41] PATCH path에 제품 불일치 Segment → 400
- **분류**: Registry > Path 편집 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: TC의 Product에 속하지 않는 segmentId
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `PATCH /test-cases/{id}/path` with 타 Product segment | 400 + 메시지 |
- **예상 결과**: 경로 무결성 검증

## A7. 전체 흐름 (E2E)

#### [A-42] E2E — 투입 → 생성 → 추천 적용 → ACTIVE 전환
- **분류**: Test Studio > E2E | **Type**: E2E | **Priority**: HIGH
- **사전조건**: 대상 Product 선택, Segment 트리·기존 TC·Convention 준비
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Markdown 스펙 투입 → Job 생성 | 201, PENDING |
  | 2 | 상태 폴링 | PENDING → PROCESSING → DONE, generated_count>0 |
  | 3 | Company DRAFT 대시보드 확인 | 신규 TC가 🤖 미배정 섹션에 노출 |
  | 4 | 한 TC "추천 적용" | path 반영, ✅ 배정완료로 이동 |
  | 5 | 해당 TC 편집 → status ACTIVE 저장 | ACTIVE 전환 |
  | 6 | TestCasePage에서 해당 경로 확인 | ACTIVE TC가 경로에 표시 |
- **예상 결과**: 문서 → DRAFT → 경로 배정 → ACTIVE까지 end-to-end 정상

---

# Part B — v3 이후 기능 (계획) · 구현 후 실행

> ⚠️ 아래는 **미구현 기능의 acceptance 기준**이다. v3 구현 + ops_v32(Boot 4 + Spring AI 2.0) 선결 후 실행.

## B1. 대화형 사전분석 루프

#### [B-01] PRD 투입 → 1회 구조화 분석 반환
- **분류**: Test Studio v3 > 분석 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: Company·Product 선택, PRD(MD/PDF) 투입
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 문서 투입 후 분석 시작 | 요약 + 요구사항 인벤토리(#1..#N) + 질문 + 결함 의심 목록 반환 |
- **예상 결과**: 생성 전 분석 산출물이 먼저 제시됨

#### [B-02] 요구사항 인벤토리 번호 고정
- **분류**: Test Studio v3 > 분석 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 분석 완료
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 같은 세션에서 재조회/재생성 | 요구사항 #N 번호가 재추출 없이 유지 |
- **예상 결과**: 번호 안정성(traceability 기반)

#### [B-03] 근거 인용된 결함 의심
- **분류**: Test Studio v3 > 결함탐지 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: PRD가 Convention/기존 TC와 모순되는 항목 포함
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 분석 결과의 결함 의심 확인 | 각 지적에 출처 표기(예: "PRD 3절 vs WordConvention의 X") |
- **예상 결과**: 검증 가능한 근거 동반

#### [B-04] 근거 없는 의심은 미출력 (precision)
- **분류**: Test Studio v3 > 결함탐지 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 모순 없는 깨끗한 PRD
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 분석 결과 확인 | 허위/근거 없는 "이상함" 미출력(오탐 억제) |
- **예상 결과**: precision 우선 동작

#### [B-05] 멀티턴 — 이전 턴 정보 유지 (핵심)
- **분류**: Test Studio v3 > 대화 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 분석 후 대화 진행
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 1턴에 "admin은 최고권한"이라 답 | AI가 기억 |
  | 2 | 3턴 뒤 관련 질문 | 1턴 답을 반영(LLM에 히스토리 재주입) |
- **예상 결과**: 현 senior 챗의 무기억 한계가 해소됨

#### [B-06] 컨텍스트 부족 경고
- **분류**: Test Studio v3 > 분석 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: KB/Convention/기존 TC가 빈약한 Product
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 분석 실행 | "컨텍스트 부족" 배너 + "요구사항 N개 중 M개는 근거 부족" 표시 |
- **예상 결과**: 낮은 신뢰도를 사전 고지

#### [B-07] 미기록 권한 결정은 미탐지 (한계)
- **분류**: Test Studio v3 > 결함탐지 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 과거 권한 결정이 Convention/TC에 없음
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 해당 충돌을 담은 PRD 분석 | 탐지 못 함(시스템에 근거 없음) — 정상 한계 |
- **예상 결과**: 품질 상한이 기록 수준에 종속됨을 확인(기대치 보정)

## B2. "OK" 게이트 & 생성

#### [B-08] "OK" 전에는 생성 안 됨 (핵심)
- **분류**: Test Studio v3 > 게이트 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 대화 진행 중
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "OK" 미클릭 상태에서 대화만 계속 | TC가 생성/저장되지 않음 |
- **예상 결과**: 충분 정보 전 제안 금지(요구사항 준수)

#### [B-09] "생성" 버튼 상시 노출 (유저 게이트 소유)
- **분류**: Test Studio v3 > 게이트 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 대화 화면
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 화면 확인 | "대화 마치고 TC 생성" 버튼이 항상 노출 |
- **예상 결과**: 판단 주체가 유저

#### [B-10] AI advisory는 표시하되 차단 안 함
- **분류**: Test Studio v3 > 게이트 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 정보 불충분 상태
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 버튼 근처 확인 | "지금 생성 가능하나 X 불명확" advisory 표시, 버튼은 여전히 활성 |
- **예상 결과**: 조언 O, 강제 차단 X

#### [B-11] "OK" 후 생성 → 스테이징(미삽입) (핵심)
- **분류**: Test Studio v3 > 생성 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: "OK" 클릭
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 트리거 | TC가 세션 스테이징 저장소에 생성, **Test Suite/TestCasePage 미노출** |
- **예상 결과**: 확정 전 미반영

#### [B-12] 생성 TC에 요구사항 #N 태깅
- **분류**: Test Studio v3 > 태깅 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 인벤토리 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 스테이징 TC 확인 | 각 TC가 source_ref(요구사항 #N) 보유 |
- **예상 결과**: traceability 확보

## B3. 스테이징 · 편집 · 확정

#### [B-13] "확정" 전 Test Suite 미반영 (핵심)
- **분류**: Test Studio v3 > 확정 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 스테이징 TC 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 확정 전 TestCasePage 조회 | 스테이징 TC 미표시 |
- **예상 결과**: 주의사항 1 준수

#### [B-14] "확정" → DRAFT 삽입
- **분류**: Test Studio v3 > 확정 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 스테이징 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | "확정" 클릭 | TC가 status=DRAFT로 Test Suite 삽입, TestCasePage 노출 |
- **예상 결과**: 확정 시점에만 반영

#### [B-15] per-TC AI revise
- **분류**: Test Studio v3 > 편집 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 스테이징 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 특정 TC에 "이 스텝 더 자세히" 요청 | 해당 TC만 수정, 나머지 유지 |
- **예상 결과**: 전체 재생성과 구분되는 타깃 수정

#### [B-16] 수동 편집 후 확정
- **분류**: Test Studio v3 > 편집 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 스테이징 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 유저가 직접 title/steps 편집 → 확정 | 편집 내용대로 삽입 |
- **예상 결과**: 수동 개입 가능

#### [B-17] coverage 뷰 — 미커버 요구사항 표시
- **분류**: Test Studio v3 > coverage | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 인벤토리 + 생성 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | coverage 뷰 확인 | 요구사항 #중 TC 0개인 항목이 미커버로 표시 |
- **예상 결과**: 커버리지 가시화

#### [B-18] 확정 시 전체 대조 dedup
- **분류**: Test Studio v3 > dedup | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 기존 TC와 유사한 생성 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 확정 전 대조 | 기존 TC와 중복인 항목 표시/제외(5개가 아니라 전체 대조) |
- **예상 결과**: 중복 삽입 방지

## B4. 세션 영속 & 이탈

#### [B-19] 이탈 후 재개 (핵심)
- **분류**: Test Studio v3 > 세션 | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: 대화·스테이징 진행 중
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 새로고침/브라우저 종료 후 재진입 | 세션·인벤토리·대화 히스토리·스테이징 TC 복원 |
- **예상 결과**: 이탈이 정상 흐름(분석 비용 재지불 없음)

#### [B-20] 진행 중 세션 목록에서 폐기
- **분류**: Test Studio v3 > 세션 | **Type**: FUNCTIONAL | **Priority**: LOW
- **사전조건**: 진행 중 세션 존재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 세션 목록에서 폐기 | 세션·스테이징 제거, Test Suite에는 애초에 영향 없음 |
- **예상 결과**: 정리 가능

#### [B-21] Company/Product 변경 시 세션 무효화
- **분류**: Test Studio v3 > 세션 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: 진행 중 세션
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 대화 도중 Company/Product 변경 | 세션·캐시 무효화 후 재시작 유도 |
- **예상 결과**: 컨텍스트 혼선 방지

## B5. Phase 0 — retrieval 재설계 & description (인프라 무관, 선착수 가능)

#### [B-22] product.description 컨텍스트 주입
- **분류**: Test Studio v3 > Phase0 | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: description 있는 Product
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Job/분석 생성 | 프롬프트에 product.description 포함(현재 name만 → 개선) |
- **예상 결과**: 제품 맥락 반영

#### [B-23] 기존 TC 예시는 ACTIVE만 (DRAFT 제외)
- **분류**: Test Studio v3 > Phase0(§F) | **Type**: FUNCTIONAL | **Priority**: HIGH
- **사전조건**: Product에 ACTIVE + DRAFT 혼재
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 생성 컨텍스트의 예시 TC 확인 | ACTIVE만 사용, 자기 생성 DRAFT는 예시에서 제외 |
- **예상 결과**: 피드백 루프(품질 드리프트) 차단

#### [B-24] 예시 TC가 관련도/결정적 순서로 선택
- **분류**: Test Studio v3 > Phase0(§F) | **Type**: FUNCTIONAL | **Priority**: MEDIUM
- **사전조건**: Product에 TC 다수
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 예시 선택 로직 확인 | 임의 앞 5개가 아니라 관련도/결정적 정렬로 선택 |
- **예상 결과**: 대표성 개선(현 `findAllByProductId().limit(5)` 대체)

#### [B-25] 예시 TC steps 과절단 방지
- **분류**: Test Studio v3 > Phase0(§F) | **Type**: REGRESSION | **Priority**: LOW
- **사전조건**: 다단계(예: 8-step) 기존 TC
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | 컨텍스트에 들어간 예시 확인 | step 2개·200자로 과절단되지 않음(토큰 예산 내 온전 요약) |
- **예상 결과**: 스타일 학습 왜곡 방지

## B6. 전체 흐름 (E2E)

#### [B-26] E2E — 투입 → 대화 → OK → 생성 → 편집 → 확정 → 노출 → 이탈 재개
- **분류**: Test Studio v3 > E2E | **Type**: E2E | **Priority**: HIGH
- **사전조건**: v3 구현 완료, ops_v32 선결, PRD 준비
- **스텝**:

  | # | Action | Expected |
  |---|--------|----------|
  | 1 | Company/Product 선택 + PRD 투입 | 요약/요구사항 인벤토리/질문/결함 의심 반환 |
  | 2 | 멀티턴 질문 응답 | 이전 턴 정보 유지 |
  | 3 | "OK" 클릭 | 스테이징 생성(Test Suite 미노출), 각 TC 요구사항 #N 태깅 |
  | 4 | 새로고침 후 재진입 | 세션·대화·스테이징 복원(이탈 재개) |
  | 5 | per-TC revise + 수동 편집 → coverage 뷰 → dedup 확인 | 타깃 수정·미커버 표시·중복 제외 동작 |
  | 6 | "확정" 클릭 | DRAFT 삽입, TestCasePage 노출 |
- **예상 결과**: 대화형 분석 → 게이트 → 스테이징 → 확정까지 end-to-end, 이탈 재개 포함

---

## 최종 요약

- **Part A (A-01~A-41)**: 기존 Test Studio(v1~v2). 현재 실행 가능. 문서 투입·검증·경계, Job 상태·삭제 시 DRAFT 보존, RAG 반영, suggestedSegmentPath/대시보드/경로 적용, Path 수동 편집까지 망라.
- **Part B (B-01~B-25)**: v3 이후 계획 기능의 acceptance 기준. 대화형 분석·"OK"/"확정" 게이트·스테이징·traceability/coverage·세션 이탈 재개·retrieval 재설계.

### AI vs 사람 비교 방법 (본 문서 활용)
1. v3/v4/ops_v32 문서를 PRD로 삼아 Test Studio에 투입 → AI 생성 TC 확보.
2. 본 문서 TC와 대조: (a) **커버리지 갭**(AI가 놓친 negative/경계 — 특히 A-05~A-10, A-18), (b) **정확도**(에러 메시지·상태 전이 정확성), (c) **스타일 차이**(제목/steps 구조). 
3. 갭이 크면 → PRD 보강 or Convention/KB 보강(§F·#1 품질 상한 원인)으로 피드백.

> Part A는 지금 바로 대상 Product(2637)에 입력·실행 가능. Part B는 v3 구현 후 회귀 스위트로 승격한다.
