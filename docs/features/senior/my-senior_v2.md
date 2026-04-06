# My Senior E2E 테스트 보강 — v2

## 변경 유형: 테스트 보강

## 배경
현재 my-senior E2E 테스트(API 8개, UI 8개)는 기본 CRUD만 커버한다.
명세서(my-senior.md, my-senior_v1.md)에 정의된 검증 시나리오 대비 누락된 테스트를 보강한다.

---

## 현재 테스트 현황

### API 테스트 (`qa/api/senior-faq.spec.ts`) — 8개
| # | 테스트 | 상태 |
|---|--------|------|
| 1 | GET /api/senior/faq - 목록 조회 | ✅ |
| 2 | POST /api/senior/faq - FAQ 생성 | ✅ |
| 3 | GET /api/senior/faq/{id} - 단건 조회 | ✅ |
| 4 | PUT /api/senior/faq/{id} - FAQ 수정 | ✅ |
| 5 | POST 검증: blank title → 400 | ✅ |
| 6 | POST 검증: blank content → 400 | ✅ |
| 7 | DELETE /api/senior/faq/{id} - 삭제 | ✅ |
| 8 | GET 삭제된 FAQ → 404 | ✅ |

### UI 테스트 (`qa/ui/senior.spec.ts`) — 8개 (2개 skip)
| # | 테스트 | 상태 |
|---|--------|------|
| 1 | My Senior 헤딩 표시 | ✅ |
| 2 | FAQ 기본 진입 화면 | ✅ |
| 3 | Chat 뷰 전환 | ✅ |
| 4 | KB Management 뷰 전환 | ⏭️ skip |
| 5 | FAQ ↔ Chat 뷰 네비게이션 | ✅ |
| 6 | FAQ 생성 | ✅ |
| 7 | FAQ 삭제 | ✅ |
| 8 | KB 서브뷰 전환 | ⏭️ skip |

---

## 추가할 테스트

### API 테스트 추가 (5개)

| # | 테스트 | 검증 포인트 |
|---|--------|------------|
| A1 | PUT 검증: blank title → 400 | 수정 시에도 title 필수 검증 |
| A2 | PUT 검증: blank content → 400 | 수정 시에도 content 필수 검증 |
| A3 | PUT 존재하지 않는 FAQ → 404 | 없는 리소스 수정 시 404 |
| A4 | DELETE 존재하지 않는 FAQ → 404 | 없는 리소스 삭제 시 404 |
| A5 | POST /api/senior/chat - SSE 스트리밍 응답 | content-type: text/event-stream 확인 |

### UI 테스트 추가 (3개)

| # | 테스트 | 검증 포인트 |
|---|--------|------------|
| U1 | FAQ 수정 | 카드 Expand → 수정 → 모달 → 저장 → 목록 반영 |
| U2 | FAQ 검색 필터링 | 검색 바 입력 → 일치 항목만 표시 |
| U3 | FAQ → Chat 컨텍스트 전달 | "Chat에서 더 물어보기" 클릭 → Chat 전환 + 컨텍스트 배너 표시 |

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | API 테스트 5개 추가 (A1~A5) | `qa/api/senior-faq.spec.ts` |
| 2 | UI 테스트 3개 추가 (U1~U3) | `qa/ui/senior.spec.ts` |
| 3 | 전체 Senior 테스트 실행 및 검증 | `npx playwright test api/senior-faq.spec.ts ui/senior.spec.ts` |

---

## 검증 기준
- `npx playwright test api/senior-faq.spec.ts` — 13개 전체 pass
- `npx playwright test ui/senior.spec.ts` — 9개 pass + 2개 skip (KB 관련)
