# 시드 데이터 보호 강화 — E2E 테스트 안정성

> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v13  
> 상태: 진행 중

---

## 1. Context

개발자 QA 요청:
- `ui/test-run.spec.ts:98` — "Test Runs" heading `toBeVisible` 타임아웃, 매번 실패
- 하위 7개 테스트 연쇄 skip (TestRunDetailPage 전체)

### 조사 결과

| 항목 | 결과 |
|------|------|
| main ↔ develop 동기화 | main에 `d7ca5a1` (release PR #44) 누락 → 머지 완료 |
| test-run.spec.ts E2E | develop 동기화 후 **8/8 통과** (타임아웃 재현 안됨) |
| DB 상태 확인 | company/product/segment/test_case **전부 0 rows** |

### 원인 분석

`cleanupAllTestData()`는 "E2E"/"Test" 이름만 필터링하므로 시드 회사 "my-atlas"를 삭제하지 않음.  
**E2E 코드에서 my-atlas를 삭제하는 경로는 없음.**

의심 원인:
- 과거 `docker compose down -v` 실행으로 DB 볼륨 소실
- V7 시드는 Flyway에 "실행 완료" 상태이므로 컨테이너 재시작 시 **재실행되지 않음**
- 한번 삭제되면 자동 복구 불가능한 구조

### 재발 방지가 필요한 이유

사용자가 수동으로 넣은 test_case 데이터가 반복적으로 사라짐 (5회 이상 INSERT 반복).  
시드 데이터(my-atlas company + Product Test Suite + 14 segments + 22 test_cases) 보호 메커니즘이 필요함.

---

## 2. Plan

### Step 1: 시드 데이터 즉시 복구 ✅
- V7 시드 SQL을 수동 실행하여 데이터 복원
- 복구 결과: company 1, product 1, segment 14, test_case 22

### Step 2: cleanupAllTestData() 시드 보호 로직 강화
- "my-atlas" 이름의 company를 삭제 대상에서 명시적으로 제외하는 safeguard 추가
- 필터 조건을 더 엄격하게 변경: "E2E"를 반드시 포함해야 삭제

### Step 3: E2E beforeAll에 시드 데이터 존재 확인 guard 추가
- 전체 테스트 실행 전 my-atlas company 존재 여부 확인
- 없으면 경고 로그 출력 (테스트 데이터 의존성 명시)

### Step 4: 전체 E2E 재실행 검증

---

## 3. Progress

- [x] Step 1: 시드 데이터 복구
- [ ] Step 2: cleanupAllTestData() 강화
- [ ] Step 3: beforeAll guard 추가
- [ ] Step 4: 전체 E2E 검증
