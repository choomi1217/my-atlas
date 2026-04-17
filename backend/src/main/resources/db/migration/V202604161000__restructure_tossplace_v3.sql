-- V202604161000: 토스플레이스 Product 구조 전면 재설계 (v3)
-- 조건: Toss Place 회사가 존재할 때만 실행 (테스트 H2 환경 안전)
-- 전체를 plain SQL로 작성하되, 모든 DELETE/INSERT에 서브쿼리 가드 적용

-- ============================================
-- Phase 1: 전체 TestRun 연결 해제 + 삭제
-- ============================================
DELETE FROM test_run_test_case WHERE test_run_id IN (
    SELECT tr.id FROM test_run tr
    JOIN product p ON tr.product_id = p.id
    JOIN company c ON p.company_id = c.id
    WHERE c.name LIKE '%Toss Place%'
);
DELETE FROM test_run WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE c.name LIKE '%Toss Place%'
);

-- ============================================
-- Phase 2: 사장님 어드민 완전 삭제
-- ============================================
DELETE FROM test_case WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '사장님 어드민' AND c.name LIKE '%Toss Place%'
);
DELETE FROM segment WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '사장님 어드민' AND c.name LIKE '%Toss Place%'
) AND parent_id IS NOT NULL AND parent_id IN (
    SELECT s2.id FROM segment s2 JOIN product p ON s2.product_id = p.id JOIN company c ON p.company_id = c.id
    WHERE p.name = '사장님 어드민' AND c.name LIKE '%Toss Place%' AND s2.parent_id IS NOT NULL
);
DELETE FROM segment WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '사장님 어드민' AND c.name LIKE '%Toss Place%'
) AND parent_id IS NOT NULL;
DELETE FROM segment WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '사장님 어드민' AND c.name LIKE '%Toss Place%'
);
DELETE FROM product WHERE name = '사장님 어드민' AND company_id IN (
    SELECT id FROM company WHERE name LIKE '%Toss Place%'
);

-- ============================================
-- Phase 3: 페이스페이 TC/Segment 제거 (토스 프론트에서)
-- ============================================
DELETE FROM test_case WHERE product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
) AND title LIKE '페이스페이%';

DELETE FROM segment WHERE name = '페이스페이' AND product_id IN (
    SELECT p.id FROM product p JOIN company c ON p.company_id = c.id
    WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
);

-- ============================================
-- Phase 4: Product 리네임
-- ============================================
UPDATE product SET name = '토스 프론트' WHERE name = '결제 단말기' AND company_id IN (SELECT id FROM company WHERE name LIKE '%Toss Place%');
UPDATE product SET name = '토스 포스' WHERE name = 'POS' AND company_id IN (SELECT id FROM company WHERE name LIKE '%Toss Place%');

UPDATE segment SET name = '토스 프론트' WHERE name = '결제 단말기' AND parent_id IS NULL
  AND product_id IN (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '토스 프론트' AND c.name LIKE '%Toss Place%');
UPDATE segment SET name = '토스 포스' WHERE name = 'POS' AND parent_id IS NULL
  AND product_id IN (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%');

-- ============================================
-- Phase 5: 토스 포스에 L1/L2 추가 + TC (사장님 어드민 + 고객 관리)
-- ============================================

-- L1
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, seg_name, root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.parent_id IS NULL
CROSS JOIN (VALUES ('정산'), ('설정'), ('크로스 시스템'), ('고객 관리')) AS v(seg_name)
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = v.seg_name AND s.product_id = p.id);

-- L2 under 정산
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산 조회', l1.id FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산'
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정산 조회' AND s.product_id = p.id);

-- L2 under 설정
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, v.seg_name, l1.id FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '설정'
CROSS JOIN (VALUES ('직원 관리'), ('매장 설정')) AS v(seg_name)
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = v.seg_name AND s.product_id = p.id);

-- L2 under 크로스 시스템
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, v.seg_name, l1.id FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템'
CROSS JOIN (VALUES ('데이터 일관성'), ('오프라인 동기화'), ('장애 복구')) AS v(seg_name)
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = v.seg_name AND s.product_id = p.id);

-- L2 under 고객 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, v.seg_name, l1.id FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '고객 관리'
CROSS JOIN (VALUES ('고객 등급'), ('쿠폰/스탬프'), ('고객 검색')) AS v(seg_name)
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = v.seg_name AND s.product_id = p.id);

-- 토스 포스 TC: 사장님 어드민 이전분 (6개) + 고객 관리 (7개) = 13개
-- 정산 조회
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '정산 내역 조회 — PG/배달앱 수수료 차감 확인', '정산 기간별 조회 시 PG 수수료, 배달앱 수수료가 정확히 차감된 실 정산 금액을 확인.', '최근 1주일간 카드 결제 + 배달앱 주문 이력 존재',
  '[{"order":1,"action":"정산 메뉴 진입, 기간 선택","expected":"기간 설정"},{"order":2,"action":"조회","expected":"총 매출, PG 수수료, 배달앱 수수료, 실 정산 금액 표시"},{"order":3,"action":"실 정산 = 총 매출 - 수수료 검증","expected":"계산 정확"}]'::jsonb,
  '수수료 차감 후 실 정산 금액 정확', 'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '정산' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '정산 조회' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정산 내역 조회 — PG/배달앱 수수료 차감 확인' AND product_id = p.id);

-- 직원 권한
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '직원 권한별 접근 제어', '직원 권한(결제만/환불 가능/관리자) 설정 시 접근 제어 동작.', '관리자 로그인',
  '[{"order":1,"action":"직원 추가, 권한 \"결제만\"","expected":"등록 완료"},{"order":2,"action":"해당 직원 로그인","expected":"결제만 가능, 환불/설정 비활성"},{"order":3,"action":"관리자 권한 변경 후 재로그인","expected":"전체 접근 가능"}]'::jsonb,
  '권한 범위 내 기능만 접근', 'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '설정' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '직원 관리' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '직원 권한별 접근 제어' AND product_id = p.id);

-- 매장 설정
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '영업시간 변경 → POS/배달앱 반영', '매장 영업시간 변경 시 POS 및 배달앱 연동 매장에 반영.', '배달앱 연동 완료',
  '[{"order":1,"action":"영업시간 변경 (09~22 → 10~23)","expected":"저장"},{"order":2,"action":"POS 확인","expected":"변경 반영"},{"order":3,"action":"배달앱 확인","expected":"변경 반영"}]'::jsonb,
  'POS/배달앱에 영업시간 반영', 'MEDIUM', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '설정' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '매장 설정' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '영업시간 변경 → POS/배달앱 반영' AND product_id = p.id);

-- 크로스: 데이터 일관성
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '프론트→포스→정산 데이터 일관성', '결제 후 포스 매출, 정산 화면까지 금액/건수 일치.', '프론트 ↔ 포스 연동',
  '[{"order":1,"action":"프론트에서 10,000원 결제","expected":"완료"},{"order":2,"action":"포스 매출 확인","expected":"10,000원 반영"},{"order":3,"action":"정산 확인","expected":"금액/건수 일치"}]'::jsonb,
  '프론트↔포스↔정산 일치', 'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '데이터 일관성' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '프론트→포스→정산 데이터 일관성' AND product_id = p.id);

-- 크로스: 오프라인 동기화
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '오프라인 결제 → 네트워크 복구 후 동기화', '오프라인 결제 건이 복구 후 동기화.', '네트워크 끊김',
  '[{"order":1,"action":"오프라인 결제","expected":"오프라인 승인"},{"order":2,"action":"네트워크 복구","expected":"동기화"},{"order":3,"action":"포스/정산 확인","expected":"누락 없이 반영"}]'::jsonb,
  '자동 동기화, 누락 없음', 'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '오프라인 동기화' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오프라인 결제 → 네트워크 복구 후 동기화' AND product_id = p.id);

-- 크로스: 장애 복구
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '포스 비정상 종료 후 데이터 보존', '포스 크래시 후 재부팅 시 주문 복구 및 결제 보존.', '주문 처리 중',
  '[{"order":1,"action":"포스 강제 종료","expected":"종료"},{"order":2,"action":"재시작","expected":"주문 복구, 결제 보존"}]'::jsonb,
  '주문 복구, 결제 보존', 'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '장애 복구' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '포스 비정상 종료 후 데이터 보존' AND product_id = p.id);

-- 고객 관리 TC 7개
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '방문 횟수별 고객 등급 자동 분류', '방문 횟수에 따라 신규/단골/VIP 자동 분류.', '5회 이상 결제 고객 존재',
  '[{"order":1,"action":"고객 관리 진입","expected":"목록 표시"},{"order":2,"action":"5회 이상 고객 확인","expected":"단골 등급"},{"order":3,"action":"1회 고객 확인","expected":"신규 등급"}]'::jsonb,
  '등급 자동 분류', 'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '고객 등급' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '방문 횟수별 고객 등급 자동 분류' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '등급별 매출 기여도 분석', '등급별 매출 기여도 확인.', '여러 등급 고객 이력 존재',
  '[{"order":1,"action":"매출 기여도 탭","expected":"등급별 비율 표시"},{"order":2,"action":"합산 확인","expected":"총 매출 = 등급 합산"}]'::jsonb,
  '등급별 기여도 표시, 합산 일치', 'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '고객 등급' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '등급별 매출 기여도 분석' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '자동 쿠폰 발송 — 미방문 고객', '30일 이상 미방문 고객에게 웰컴 쿠폰 자동 발송. 매출 3배 증가 핵심.', '30일+ 미방문 고객, 자동 발송 설정',
  '[{"order":1,"action":"자동 발송 규칙 확인","expected":"30일 미방문 → 10% 할인 쿠폰"},{"order":2,"action":"대상 고객 확인","expected":"자동 발송됨"},{"order":3,"action":"재방문 후 사용","expected":"할인 적용"}]'::jsonb,
  '자동 발송 + 사용 시 할인', 'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠폰/스탬프' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '자동 쿠폰 발송 — 미방문 고객' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '생일 쿠폰 자동 발송', '생일 당일 축하 쿠폰 자동 발송.', '생일 정보 등록, 생일 쿠폰 설정',
  '[{"order":1,"action":"생일 쿠폰 규칙 설정","expected":"저장"},{"order":2,"action":"생일 당일 발송 확인","expected":"쿠폰 발송됨"}]'::jsonb,
  '생일 당일 자동 발송', 'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠폰/스탬프' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '생일 쿠폰 자동 발송' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '스탬프 적립 및 보상', '결제 시 스탬프 자동 적립, 목표 달성 시 보상 발급.', '스탬프 카드 설정 (10개=무료 음료)',
  '[{"order":1,"action":"결제 시 스탬프 확인","expected":"1개 적립"},{"order":2,"action":"10번째 결제","expected":"보상 쿠폰 발급"},{"order":3,"action":"보상 사용","expected":"무료 적용"}]'::jsonb,
  '스탬프 적립 + 보상 발급', 'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠폰/스탬프' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '스탬프 적립 및 보상' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '전화번호 뒷자리 고객 검색', '뒷 4자리로 고객 검색.', '고객 정보 등록됨',
  '[{"order":1,"action":"뒷 4자리 입력","expected":"일치 고객 표시"},{"order":2,"action":"선택","expected":"방문/등급/쿠폰/최근 주문 표시"}]'::jsonb,
  '검색 + 상세 정보 표시', 'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '고객 검색' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '전화번호 뒷자리 고객 검색' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '최근 결제 고객 즉시 조회', '결제 직후 고객이 최상단에 표시.', '결제 직후',
  '[{"order":1,"action":"결제 후 고객 관리 진입","expected":"방금 결제 고객 최상단"},{"order":2,"action":"정보 확인","expected":"금액/메뉴/시간 정확"}]'::jsonb,
  '최상단 표시, 정보 정확', 'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '고객 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '고객 검색' AND s3.parent_id = s2.id
WHERE p.name = '토스 포스' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최근 결제 고객 즉시 조회' AND product_id = p.id);

-- ============================================
-- Phase 6~8: 신규 Products + Segments + TCs는 직접 DB 적용
-- (파일 크기 제한으로 별도 마이그레이션으로 분리)
-- ============================================
