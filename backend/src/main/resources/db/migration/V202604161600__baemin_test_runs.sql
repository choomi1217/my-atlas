-- V202604161600: 배달의민족 TestRun 구성 (14개 TestRun)
-- testcase_base.md의 TestRun 구성 기반

-- ============================================
-- 1. TestRun 생성
-- ============================================

-- 고객앱: Smoke Test (8개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', '고객앱 핵심 기능 빠른 검증 — 검색, 메뉴선택, 장바구니, 결제, 배달추적, 취소, 픽업, 장보기'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- 고객앱: 주문·결제 플로우 (12개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '주문·결제 플로우', '메뉴 선택 → 장바구니 → 쿠폰 → 결제 → 배달 추적 → 취소 전체 플로우 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '주문·결제 플로우' AND tr.product_id = p.id);

-- 고객앱: 장보기·쇼핑 (6개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '장보기·쇼핑', '장보기 탭 탐색, 주문, 재고 동기화, B마트 SLA 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '장보기·쇼핑' AND tr.product_id = p.id);

-- 고객앱: 3자 E2E (9개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '3자 E2E', '고객↔사장님↔라이더 크로스 시스템 통합 시나리오 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '3자 E2E' AND tr.product_id = p.id);

-- 고객앱: Full Regression (53개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '고객앱 전체 TestCase 회귀 테스트 (53개)'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- 사장님앱: Smoke Test (6개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', '사장님앱 핵심 기능 — 주문접수, 메뉴등록, 품절, 영업시간, 매출, 정산'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- 사장님앱: 수수료 검증 (4개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '수수료 검증', '오픈리스트 6.8%, 배민1 매출 구간별 수수료 정합성 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '수수료 검증' AND tr.product_id = p.id);

-- 사장님앱: Full Regression (32개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '사장님앱 전체 TestCase 회귀 테스트 (32개)'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- 배민오더: Smoke Test (4개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', '배민오더 핵심 — QR스캔, 메뉴선택, 결제, POS수신'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '배민오더' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- 배민오더: Full Regression (19개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '배민오더 전체 TestCase 회귀 테스트 (19개)'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '배민오더' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- 라이더앱: Smoke Test (4개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', '라이더앱 핵심 — 배정수락, 픽업, 배달완료, 정산'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '라이더앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- 라이더앱: AI 배차 (4개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'AI 배차', 'AI 추천배차 최적 경로, 안전 경로, 묶음 배정, 추가 배정 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '라이더앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'AI 배차' AND tr.product_id = p.id);

-- 라이더앱: Full Regression (19개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '라이더앱 전체 TestCase 회귀 테스트 (19개)'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '라이더앱' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- B마트: Smoke Test (4개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', 'B마트 핵심 — 상품검색, 주문, 30분배달, 로봇배달'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'B마트' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- B마트: 로봇배달 딜리 (3개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '로봇배달 딜리', '딜리 자율주행 로봇 정상 수령, 미수령, 경로 장애물 검증'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'B마트' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '로봇배달 딜리' AND tr.product_id = p.id);

-- B마트: Full Regression (17개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', 'B마트 전체 TestCase 회귀 테스트 (17개)'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'B마트' AND c.name LIKE '%WooWa%'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- ============================================
-- 2. TestRunTestCase 연결
-- ============================================

-- === 고객앱 ===

-- Smoke Test (8개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '고객앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '키워드 검색 — 매장명 일치', '단일 메뉴 선택', '최소주문금액 미달',
  '카드 결제 정상 플로우', '주문 상태 실시간 갱신', '접수 전 즉시 취소',
  '픽업 주문 정상 플로우', '장보기 주문 정상 플로우'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- 주문·결제 플로우 (12개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '주문·결제 플로우' AND p.name = '고객앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '단일 메뉴 선택', '품절 메뉴 선택 시도', '다른 매장 메뉴 추가 시도',
  '최소주문금액 미달', '쿠폰 적용 후 금액 계산', '쿠폰 중복 적용 차단',
  '카드 결제 정상 플로우', '토스페이 간편결제', '잔액 부족',
  '결제 중 네트워크 끊김', '접수 전 즉시 취소', '조리 중 취소 시도'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- 장보기·쇼핑 (6개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '장보기·쇼핑' AND p.name = '고객앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '장보기 탭 진입 및 카테고리 탐색', '장보기 상품 검색',
  '장보기 주문 정상 플로우', 'B마트 주문 — 30분 배달 SLA',
  '재고 부족 상품 주문', '오프라인 매장 재고 불일치'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- 3자 E2E (9개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '3자 E2E' AND p.name = '고객앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '정상 주문 E2E (3자 전체)', '알뜰배달(묶음) E2E', '픽업 주문 E2E',
  '사장님 주문 거절 → 자동 환불', '고객 접수 전 취소 → 사장님 알림',
  '조리 중 고객 취소 요청 → CS 연결', '라이더 배정 실패 → 재배정 → 고객 알림',
  '배달 중 사고 → 재배정 → 고객/사장님 알림',
  '정산 정합성 (고객 결제 = 사장님 정산 + 수수료 + 배달비)'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- Full Regression (전체 53개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '고객앱' AND c.name LIKE '%WooWa%'
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- === 사장님앱 ===

-- Smoke Test (6개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '사장님앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '배달 주문 접수', '메뉴 등록', '메뉴 품절 설정',
  '영업시간 설정', '일별 매출 통계 조회', '정산 내역 조회'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- 수수료 검증 (4개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '수수료 검증' AND p.name = '사장님앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '오픈리스트 수수료 6.8% 확인', '배민1 수수료 매출 규모별 확인',
  '정산 내역 조회', '정산 금액 vs 실입금 비교'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- Full Regression (전체 32개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '사장님앱' AND c.name LIKE '%WooWa%'
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- === 배민오더 ===

-- Smoke Test (4개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '배민오더' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  'QR 스캔 — 메뉴 화면 진입', 'QR오더 메뉴 선택 및 옵션',
  'QR오더 선불 결제', 'QR/태블릿 주문 → POS 수신'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- Full Regression (전체 19개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '배민오더' AND c.name LIKE '%WooWa%'
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- === 라이더앱 ===

-- Smoke Test (4개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '라이더앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '배달 배정 수락', '매장 도착 — 픽업 처리',
  '배달지 도착 — 배달 완료', '건별 배달비 확인'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- AI 배차 (4개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'AI 배차' AND p.name = '라이더앱' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  'AI 추천배차 — 최적 경로', 'AI 추천배차 — 안전 경로',
  '알뜰배달 묶음 배정', '묶음배달 중 추가 배정'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- Full Regression (전체 19개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '라이더앱' AND c.name LIKE '%WooWa%'
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- === B마트 ===

-- Smoke Test (4개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = 'B마트' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  'B마트 상품 검색', 'B마트 정상 주문 플로우',
  'B마트 30분 배달 SLA 확인', '딜리 로봇배달 — 정상 수령'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- 로봇배달 딜리 (3개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '로봇배달 딜리' AND p.name = 'B마트' AND c.name LIKE '%WooWa%'
AND tc.title IN (
  '딜리 로봇배달 — 정상 수령', '딜리 로봇배달 — 수령 미완료',
  '딜리 로봇배달 — 경로 장애물'
)
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);

-- Full Regression (전체 17개)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr JOIN product p ON tr.product_id = p.id JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = 'B마트' AND c.name LIKE '%WooWa%'
AND NOT EXISTS (SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id);
