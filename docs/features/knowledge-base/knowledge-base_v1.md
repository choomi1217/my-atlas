# Knowledge Base — E2E 테스트 보강 (v1)

> **변경 유형**: 기능 개선
> **날짜**: 2026-04-06
> **이전 버전**: v0.1

---

## 1. 개요

Knowledge Base v0 + v0.1 구현이 완료된 상태에서, 현재 E2E 테스트의 커버리지를 분석하고 부족한 테스트를 보강한다.

---

## 2. 현재 테스트 현황 분석

### 2-1. KB API 테스트 (`qa/api/kb.spec.ts`) — 8개

| # | 테스트 | 상태 |
|---|--------|------|
| 1 | GET /api/kb - returns list | ✅ 존재 |
| 2 | POST /api/kb - create manual KB entry | ✅ 존재 |
| 3 | GET /api/kb/{id} - retrieve created entry | ✅ 존재 |
| 4 | PUT /api/kb/{id} - update entry | ✅ 존재 |
| 5 | POST /api/kb - blank title → 400 | ✅ 존재 |
| 6 | GET /api/kb/jobs - returns job list | ✅ 존재 |
| 7 | DELETE /api/kb/{id} - delete entry | ✅ 존재 |
| 8 | GET /api/kb/{id} - deleted → 404 | ✅ 존재 |

### 2-2. KB UI 테스트 — 없음

`qa/ui/` 디렉토리에 KB 관련 UI E2E 테스트 파일이 존재하지 않는다.

---

## 3. 누락된 테스트 목록

### 3-1. API 테스트 누락 항목

| # | 누락 테스트 | 사유 |
|---|------------|------|
| A1 | E2E 데이터 cleanup (beforeAll/afterAll) | 이전 실행 데이터가 남아 시드 데이터 오염 가능 |
| A2 | POST /api/kb - blank content → 400 | `@NotBlank content` 검증 누락 |
| A3 | POST /api/kb - optional 필드 없이 생성 | category, tags 없이 생성 시 null 반환 검증 |
| A4 | source 필드 null 검증 | 수동 작성 시 source=null 확인 |
| A5 | GET /api/kb/{id} - 존재하지 않는 ID → 404 | 삭제된 ID가 아닌 처음부터 없는 ID |
| A6 | PUT 후 GET round-trip 검증 | 수정 값이 실제로 저장되었는지 재조회 |
| A7 | createdAt / updatedAt 필드 존재 검증 | 타임스탬프 필드 응답 확인 |

### 3-2. UI 테스트 누락 항목

| # | 누락 테스트 | 설명 |
|---|------------|------|
| U1 | /kb 페이지 진입 | "Knowledge Base" 제목 표시 |
| U2 | 헤더 버튼 표시 | "+ 직접 작성", "PDF 업로드" 버튼 존재 |
| U3 | 소스 필터 탭 표시 | "전체", "직접 작성", "PDF 도서" 탭 존재 |
| U4 | 수동 KB 항목 생성 | 모달에서 제목/내용 입력 → 목록에 노출 |
| U5 | "직접 작성" 뱃지 표시 | 수동 생성 항목에 초록색 뱃지 |
| U6 | 수동 KB 항목 수정 | Edit 클릭 → 모달에서 수정 → 반영 확인 |
| U7 | 수동 KB 항목 삭제 | Delete 클릭 → confirm → 목록에서 제거 |
| U8 | 소스 필터 탭 전환 | "직접 작성" 탭 클릭 시 수동 항목만 표시 |
| U9 | 빈 상태 메시지 | 항목이 없을 때 안내 문구 표시 |

---

## 4. 구현 계획

### Step 1 — API 테스트 보강 (`qa/api/kb.spec.ts`)

기존 파일을 개선하여 누락 항목 A1~A7을 추가한다.

**변경 사항:**
- `beforeAll`: 이전 실행의 E2E KB 항목 cleanup 추가
- `afterAll`: 이번 실행에서 생성한 E2E KB 항목 cleanup 추가
- 신규 테스트 5개 추가 (A2, A3, A4+A5, A6, A7은 기존 테스트에 assertion 보강)
- 기존 테스트의 assertion 강화 (source, createdAt, updatedAt 필드)

**예상 결과:** API 테스트 8개 → 13개

### Step 2 — UI 테스트 신규 작성 (`qa/ui/kb.spec.ts`)

KB 페이지 UI E2E 테스트 파일을 신규 생성한다.

**파일:** `qa/ui/kb.spec.ts`

**테스트 구성:**
```
test.describe('Knowledge Base Page UI')
  ├─ beforeEach: /kb 페이지 이동
  ├─ afterEach: E2E KB 항목 API cleanup
  ├─ U1: "Knowledge Base" 제목 표시
  ├─ U2: "+ 직접 작성", "PDF 업로드" 버튼 표시
  ├─ U3: 소스 필터 탭 (전체/직접 작성/PDF 도서) 표시
  ├─ U4: 수동 KB 항목 생성 (모달 → 목록 반영)
  ├─ U5: 생성된 항목에 "직접 작성" 뱃지 표시
  ├─ U6: 수동 KB 항목 수정 (Edit → 모달 → 반영)
  ├─ U7: 수동 KB 항목 삭제 (Delete → confirm → 제거)
  ├─ U8: 소스 필터 탭 전환 동작
  └─ U9: 빈 상태 안내 메시지
```

**데이터 cleanup 전략:**
- UI 테스트에서 생성하는 KB 항목 제목은 모두 "E2E" 접두어 사용
- afterEach에서 API 직접 호출로 E2E 항목만 삭제 (시드 데이터 보존)

### Step 3 — E2E 테스트 실행 및 검증

```bash
# API 테스트만
cd /Users/yeongmi/dev/qa/my-atlas/qa && npx playwright test api/kb.spec.ts

# UI 테스트만
npx playwright test ui/kb.spec.ts

# 전체 KB 테스트
npx playwright test api/kb.spec.ts ui/kb.spec.ts
```

---

## 5. 변경 파일 목록

| 파일 | 변경 구분 | 설명 |
|------|-----------|------|
| `qa/api/kb.spec.ts` | 수정 | API 테스트 보강 (cleanup + 5개 신규 + assertion 강화) |
| `qa/ui/kb.spec.ts` | **신규** | KB 페이지 UI E2E 테스트 9개 |

---

## 6. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | `npx playwright test api/kb.spec.ts` | 13개 테스트 전체 PASS |
| 2 | `npx playwright test ui/kb.spec.ts` | 9개 테스트 전체 PASS |
| 3 | 테스트 반복 실행 | cleanup 동작으로 2회 연속 실행 시에도 PASS |
| 4 | 시드 데이터 확인 | 테스트 실행 후 기존 KB 데이터 보존 |
