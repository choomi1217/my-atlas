-- V202604150900: 토스플레이스 포트폴리오 — Company, Product 3개, Segment 32개, TestCase 31개, TestRun 9개
-- Segment는 기능 도메인 기준으로 분류, TestRun은 실행 목적별 그룹

-- ============================================
-- 1. Company (토스플레이스)
-- ============================================
INSERT INTO company (name, is_active)
SELECT '토스플레이스', false
WHERE NOT EXISTS (SELECT 1 FROM company WHERE name = '토스플레이스');

-- ============================================
-- 2. Products (3개)
-- ============================================

-- 결제 단말기
INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '결제 단말기', 'ETC', '토스플레이스 결제 단말기 — 카드/QR/NFC 결제 처리'
FROM company c WHERE c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM product p WHERE p.name = '결제 단말기' AND p.company_id = c.id
  );

-- POS
INSERT INTO product (company_id, name, platform, description)
SELECT c.id, 'POS', 'DESKTOP', '토스플레이스 POS — 매장 주문/매출/상품 관리'
FROM company c WHERE c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM product p WHERE p.name = 'POS' AND p.company_id = c.id
  );

-- 사장님 어드민
INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '사장님 어드민', 'WEB', '토스플레이스 사장님 어드민 — 정산/설정/권한 관리'
FROM company c WHERE c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM product p WHERE p.name = '사장님 어드민' AND p.company_id = c.id
  );

-- ============================================
-- 3. Segments — 결제 단말기 (1 Root + 6 L1 + 8 L2 = 15)
-- ============================================

-- Root: 결제 단말기
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '결제 단말기', NULL
FROM product p
JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '결제 단말기' AND s.product_id = p.id AND s.parent_id IS NULL
  );

-- L1: 결제
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '결제', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '결제' AND s.product_id = p.id
  );

-- L1: 취소/환불
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '취소/환불', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '취소/환불' AND s.product_id = p.id
  );

-- L1: 영수증
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '영수증', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '영수증' AND s.product_id = p.id
  );

-- L1: 정산
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '정산' AND s.product_id = p.id AND s.parent_id = root.id
  );

-- L1: 보안
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '보안', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '보안' AND s.product_id = p.id
  );

-- L1: 단말기 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '단말기 관리', root.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '결제 단말기' AND root.parent_id IS NULL
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM segment s WHERE s.name = '단말기 관리' AND s.product_id = p.id
  );

-- L2 under 결제
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'IC카드 결제', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'IC카드 결제' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'NFC 결제', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'NFC 결제' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'QR 결제', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'QR 결제' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '금액 검증', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '금액 검증' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '중복 결제 방지', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '중복 결제 방지' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '네트워크 장애', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '네트워크 장애' AND s.product_id = p.id);

-- L2 under 취소/환불
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '전체 취소', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '취소/환불'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '전체 취소' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '부분 취소', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '취소/환불'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '부분 취소' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '당일/익일 취소', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '취소/환불'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '당일/익일 취소' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '망취소(Reversal)', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '취소/환불'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '망취소(Reversal)' AND s.product_id = p.id);

-- L2 under 영수증
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '용지 장애', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '영수증'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '용지 장애' AND s.product_id = p.id);

-- L2 under 정산 (결제 단말기)
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '일마감', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산' AND l1.parent_id = (
    SELECT root.id FROM segment root WHERE root.name = '결제 단말기' AND root.product_id = p.id AND root.parent_id IS NULL
)
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '일마감' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '거래내역 조회', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산' AND l1.parent_id = (
    SELECT root.id FROM segment root WHERE root.name = '결제 단말기' AND root.product_id = p.id AND root.parent_id IS NULL
)
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '거래내역 조회' AND s.product_id = p.id);

-- L2 under 보안
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'PAN 마스킹', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '보안'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'PAN 마스킹' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '로그 보안', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '보안'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '로그 보안' AND s.product_id = p.id);

-- L2 under 단말기 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배터리', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '단말기 관리'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배터리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '연속 결제 내구성', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '단말기 관리'
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '연속 결제 내구성' AND s.product_id = p.id);

-- ============================================
-- 3-B. Segments — POS (1 Root + 3 L1 + 4 L2 = 8)
-- ============================================

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'POS', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'POS' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상품 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '상품 관리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문 관리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '매출 분석', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '매출 분석' AND s.product_id = p.id);

-- L2
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상품 CRUD', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 관리'
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '상품 CRUD' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달앱 연동', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달앱 연동' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '테이블 관리', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '테이블 관리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '리포트', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매출 분석'
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '리포트' AND s.product_id = p.id);

-- ============================================
-- 3-C. Segments — 사장님 어드민 (1 Root + 3 L1 + 5 L2 = 9)
-- ============================================

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '사장님 어드민', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '사장님 어드민' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님 어드민' AND root.parent_id IS NULL
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정산 관리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '설정', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님 어드민' AND root.parent_id IS NULL
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '설정' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '크로스 시스템', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님 어드민' AND root.parent_id IS NULL
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '크로스 시스템' AND s.product_id = p.id);

-- L2
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산 조회', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산 관리'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정산 조회' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '직원 관리', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '설정'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '직원 관리' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '매장 설정', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '설정'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '매장 설정' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '데이터 일관성', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '데이터 일관성' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '오프라인 동기화', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '오프라인 동기화' AND s.product_id = p.id);

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '장애 복구', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템'
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '장애 복구' AND s.product_id = p.id);

-- ============================================
-- 4. TestCases — 결제 단말기 (20개)
-- ============================================

-- TC-001: IC카드 정상 결제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'IC카드 정상 결제',
  '단말기에서 IC카드를 사용한 정상 결제 프로세스 검증',
  '단말기 정상 부팅, 네트워크 연결, POS 연동 완료',
  '[{"order":1,"action":"금액 10,000원 입력","expected":"금액 화면 표시"},{"order":2,"action":"IC 카드 삽입","expected":"카드 인식 메시지 표시"},{"order":3,"action":"비밀번호 입력","expected":"VAN사 승인 요청 전송"},{"order":4,"action":"결제 완료 대기","expected":"승인번호 발급, 영수증 출력, POS 매출 반영"}]'::jsonb,
  '승인번호 발급 및 영수증 출력, POS 매출 반영',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'IC카드 정상 결제' AND product_id = p.id);

-- TC-002: QR 결제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'QR 결제 (토스페이)',
  '토스페이 QR을 사용한 결제 프로세스 검증',
  '토스페이 QR 활성화, 단말기 정상 부팅',
  '[{"order":1,"action":"금액 입력","expected":"금액 화면 표시"},{"order":2,"action":"QR 스캔 모드 전환","expected":"QR 스캐너 활성화"},{"order":3,"action":"고객 앱에서 QR 스캔","expected":"3초 이내 승인 완료, 영수증 출력"}]'::jsonb,
  '3초 이내 승인 완료',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'QR 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR 결제 (토스페이)' AND product_id = p.id);

-- TC-003: NFC 결제 (삼성페이)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'NFC 결제 (삼성페이)',
  '삼성페이 NFC 비접촉 결제 검증',
  'NFC 활성화 단말기',
  '[{"order":1,"action":"금액 입력","expected":"금액 화면 표시"},{"order":2,"action":"단말기 NFC 영역에 폰 접촉","expected":"NFC 인식"},{"order":3,"action":"결제 완료 대기","expected":"승인 완료, 영수증 출력"}]'::jsonb,
  '승인 완료 및 영수증 출력',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'NFC 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'NFC 결제 (삼성페이)' AND product_id = p.id);

-- TC-004: 금액 0원 입력 차단
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '금액 0원 입력 차단',
  '0원 결제 시도 시 오류 메시지 표시 확인',
  '결제 대기 화면',
  '[{"order":1,"action":"0 입력 후 결제 시도","expected":"\"금액을 입력하세요\" 오류 메시지 표시, 결제 진행 차단"}]'::jsonb,
  '오류 메시지 표시, 결제 차단',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '금액 검증' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '금액 0원 입력 차단' AND product_id = p.id);

-- TC-005: 최대 금액 한도
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '최대 금액 한도 결제',
  '9,999,999원 최대 금액 결제 시 정상 승인 또는 한도 초과 메시지',
  '결제 대기 화면',
  '[{"order":1,"action":"9,999,999원 입력","expected":"금액 표시"},{"order":2,"action":"카드 결제 진행","expected":"정상 승인 또는 한도 초과 메시지"}]'::jsonb,
  '정상 승인 또는 한도 초과 메시지',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '금액 검증' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최대 금액 한도 결제' AND product_id = p.id);

-- TC-101: 전체 취소
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '전체 취소',
  '승인 완료 거래의 전액 취소 처리 검증',
  '승인 완료 거래 존재',
  '[{"order":1,"action":"거래내역 조회","expected":"승인 거래 목록 표시"},{"order":2,"action":"해당 거래 선택","expected":"거래 상세 정보 표시"},{"order":3,"action":"취소 진행","expected":"원거래 전액 취소, 취소 영수증 출력"}]'::jsonb,
  '원거래 전액 취소 및 취소 영수증 출력',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '취소/환불' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '전체 취소' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '전체 취소' AND product_id = p.id);

-- TC-102: 부분 취소
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '부분 취소',
  '10,000원 거래 중 3,000원 부분 취소 시 잔여 금액 정확성 검증',
  '승인 완료 거래 존재',
  '[{"order":1,"action":"10,000원 거래 선택","expected":"거래 상세 표시"},{"order":2,"action":"부분 취소 3,000원 입력","expected":"부분 취소 처리"},{"order":3,"action":"잔여 금액 확인","expected":"7,000원 잔여, 부분취소 영수증 출력"}]'::jsonb,
  '7,000원 잔여, 부분취소 영수증 출력',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '취소/환불' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '부분 취소' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '부분 취소' AND product_id = p.id);

-- TC-103: 당일/익일 취소
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '당일/익일 취소 구분',
  '전일 거래에 대한 취소 시 매입 전/후 처리 구분 검증',
  '전일 승인 거래 존재',
  '[{"order":1,"action":"전일 거래에 대해 취소 시도","expected":"매입 전/후 상태 확인"},{"order":2,"action":"취소 처리 진행","expected":"매입 전: 승인 취소, 매입 후: 환불 처리 구분"}]'::jsonb,
  '매입 전/후에 따라 취소 또는 환불 처리 구분',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '취소/환불' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '당일/익일 취소' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '당일/익일 취소 구분' AND product_id = p.id);

-- TC-104: 망취소 (CRITICAL)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '망취소(Reversal) 자동 처리',
  '승인 응답 수신 직전 네트워크 단절 시 자동 망취소 처리 검증. 결제 단말기 QA 최고 우선순위 항목.',
  '정상 네트워크 연결 상태',
  '[{"order":1,"action":"결제 진행 중 VAN사 응답 직전 랜선 분리","expected":"네트워크 단절 감지"},{"order":2,"action":"네트워크 재연결","expected":"자동 망취소 처리"},{"order":3,"action":"고객 청구 여부 확인","expected":"고객 미청구 확인"}]'::jsonb,
  '자동 망취소 처리, 고객 미청구 확인',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '취소/환불' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '망취소(Reversal)' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '망취소(Reversal) 자동 처리' AND product_id = p.id);

-- TC-105: 중복 결제 방지 (승인 중 재시도)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '중복 결제 방지 — 승인 중 재시도',
  '승인 처리 중 재차 결제 시도 시 두 번째 요청 차단 검증',
  '승인 처리 중',
  '[{"order":1,"action":"카드 삽입 후 응답 대기 중 재차 결제 시도","expected":"두 번째 요청 차단, 오류 메시지 표시"}]'::jsonb,
  '두 번째 요청 차단',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '중복 결제 방지' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '중복 결제 방지 — 승인 중 재시도' AND product_id = p.id);

-- TC-201: 카드 중간 제거
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'IC카드 중간 제거 시 롤백',
  '비밀번호 입력 중 IC카드 강제 제거 시 거래 롤백 검증',
  'IC카드 삽입 상태, 비밀번호 입력 화면',
  '[{"order":1,"action":"비밀번호 입력 중 IC 카드 강제 제거","expected":"\"카드를 다시 삽입해주세요\" 오류 표시"},{"order":2,"action":"거래 상태 확인","expected":"거래 롤백, 승인 미처리"}]'::jsonb,
  '오류 메시지 표시 및 거래 롤백',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'IC카드 중간 제거 시 롤백' AND product_id = p.id);

-- TC-202: VAN사 네트워크 타임아웃
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'VAN사 네트워크 타임아웃',
  'VAN사 응답 30초 초과 시 타임아웃 처리 및 자동 망취소 검증',
  '정상 네트워크 연결',
  '[{"order":1,"action":"VAN사 응답 30초 초과 유도","expected":"타임아웃 처리"},{"order":2,"action":"자동 망취소 확인","expected":"자동 망취소 처리, 사용자 재시도 안내"}]'::jsonb,
  '타임아웃 후 자동 망취소, 재시도 안내',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '네트워크 장애' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'VAN사 네트워크 타임아웃' AND product_id = p.id);

-- TC-203: 동일 카드 연속 승인 차단
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '동일 카드 연속 승인 차단',
  '동일 카드로 3초 내 동일 금액 2회 결제 시 중복 방지 알림',
  '정상 부팅 상태',
  '[{"order":1,"action":"동일 카드로 동일 금액 결제 2회 연속 시도 (3초 내)","expected":"중복결제 방지 알림 노출"}]'::jsonb,
  '중복결제 방지 알림 노출',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '중복 결제 방지' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '동일 카드 연속 승인 차단' AND product_id = p.id);

-- TC-204: 영수증 용지 없음
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '영수증 용지 없음 시 결제 유지',
  '용지 제거 상태에서 결제 시 승인은 정상 처리, 재출력 옵션 제공',
  '용지 제거 상태',
  '[{"order":1,"action":"용지 없는 상태에서 결제 진행","expected":"승인 정상 처리"},{"order":2,"action":"\"용지 없음\" 알림 확인","expected":"알림 표시 및 재출력 옵션 제공"}]'::jsonb,
  '승인 정상, 용지 없음 알림 및 재출력 옵션',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '영수증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '용지 장애' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '영수증 용지 없음 시 결제 유지' AND product_id = p.id);

-- TC-205: 배터리 5% 이하 결제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배터리 방전 중 결제 및 복구',
  '배터리 5% 이하 결제 진행, 승인 중 전원 꺼짐 시 복구 로직 검증',
  '배터리 5% 이하',
  '[{"order":1,"action":"배터리 5% 이하 상태에서 결제 진행","expected":"경고 표시 후 결제 진행 가능"},{"order":2,"action":"승인 중 전원 꺼짐","expected":"재부팅 후 복구 로직 동작, 거래 상태 확인 가능"}]'::jsonb,
  '경고 후 진행, 전원 꺼짐 시 복구 로직 동작',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '단말기 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배터리' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배터리 방전 중 결제 및 복구' AND product_id = p.id);

-- TC-301: 연속 결제 100건 내구성
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '연속 결제 100건 내구성',
  '1시간 동안 100건 연속 결제 시 모든 거래 정상 처리 및 메모리 누수 없음',
  '단말기 정상 부팅, 테스트 카드 준비',
  '[{"order":1,"action":"1시간 동안 100건 연속 결제 수행","expected":"모든 거래 정상 처리"},{"order":2,"action":"메모리 사용량 모니터링","expected":"메모리 누수 없음, 정상 범위 유지"}]'::jsonb,
  '모든 거래 정상, 메모리 누수 없음',
  'HIGH', 'REGRESSION', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '단말기 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '연속 결제 내구성' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '연속 결제 100건 내구성' AND product_id = p.id);

-- TC-302: PAN 마스킹
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'PAN 마스킹 검증',
  '화면 및 영수증에서 카드번호 마스킹 처리 확인 (PCI-DSS)',
  '결제 완료 상태',
  '[{"order":1,"action":"결제 완료 후 화면에 표시된 카드번호 확인","expected":"앞 6자리 + 뒤 4자리 외 마스킹 처리"},{"order":2,"action":"영수증에 인쇄된 카드번호 확인","expected":"동일한 마스킹 규칙 적용"}]'::jsonb,
  'PAN 마스킹 (앞6 + 뒤4 외 마스킹)',
  'HIGH', 'REGRESSION', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '보안' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'PAN 마스킹' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'PAN 마스킹 검증' AND product_id = p.id);

-- TC-303: 로그 보안 (평문 저장 금지)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '로그 평문 저장 금지',
  '거래 로그에 비밀번호/CVC 평문 저장 여부 검증 (PCI-DSS)',
  '결제 수행 완료',
  '[{"order":1,"action":"거래 로그 파일 확인","expected":"비밀번호, CVC 평문 저장 없음"}]'::jsonb,
  '비밀번호/CVC 평문 저장 없음',
  'HIGH', 'REGRESSION', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '보안' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '로그 보안' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '로그 평문 저장 금지' AND product_id = p.id);

-- TC-401: 일마감
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '일마감 집계 정확성',
  '당일 거래 10건 후 일마감 시 승인/취소 내역 정확히 집계',
  '당일 거래 10건 수행 완료',
  '[{"order":1,"action":"일마감 실행","expected":"승인/취소 내역 정확히 집계"},{"order":2,"action":"리포트 출력 확인","expected":"리포트 출력, POS/어드민 수치와 일치"}]'::jsonb,
  '승인/취소 집계 정확, 리포트 출력',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '정산' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '일마감' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '일마감 집계 정확성' AND product_id = p.id);

-- TC-402: 거래내역 조회
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '거래내역 필터 조회',
  '날짜/금액/카드사별 필터로 거래내역 조회 시 정확한 결과',
  '다양한 거래 이력 존재',
  '[{"order":1,"action":"날짜별 필터 적용","expected":"해당 날짜 거래만 표시"},{"order":2,"action":"금액별 필터 적용","expected":"해당 금액 범위 거래만 표시"},{"order":3,"action":"카드사별 필터 적용","expected":"해당 카드사 거래만 표시"}]'::jsonb,
  '조건에 맞는 거래만 노출',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '정산' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '거래내역 조회' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '거래내역 필터 조회' AND product_id = p.id);

-- ============================================
-- 4-B. TestCases — POS (5개)
-- ============================================

-- POS-01: 상품 등록
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '상품 등록 (카테고리/옵션 포함)',
  'POS에서 상품 등록 시 카테고리 및 옵션 설정 검증',
  'POS 관리자 로그인',
  '[{"order":1,"action":"상품명/가격/카테고리 입력","expected":"입력 필드 정상 동작"},{"order":2,"action":"옵션 추가 (사이즈, 토핑 등)","expected":"옵션 항목 추가됨"},{"order":3,"action":"저장","expected":"상품 목록에 노출, 결제 시 선택 가능"}]'::jsonb,
  '상품 목록 노출, 결제 시 선택 가능',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '상품 CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '상품 등록 (카테고리/옵션 포함)' AND product_id = p.id);

-- POS-02: 배달앱 주문 수신
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배달앱 주문 수신',
  '배달앱에서 주문 발생 시 POS에서 정확한 주문 정보 수신',
  '배달앱 연동 완료',
  '[{"order":1,"action":"배달앱에서 주문 발생","expected":"POS에 주문 알림 표시"},{"order":2,"action":"주문 상세 정보 확인","expected":"주문 상세 정보 정확"},{"order":3,"action":"접수/거절 선택","expected":"접수 또는 거절 처리 가능"}]'::jsonb,
  '주문 알림, 상세 정보 정확, 접수/거절 가능',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배달앱 연동' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달앱 주문 수신' AND product_id = p.id);

-- POS-03: 동시 주문 처리
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '동시 주문 처리 (배민+쿠팡이츠)',
  '복수 채널에서 동시 주문 수신 시 누락 없이 개별 처리',
  '배민 + 쿠팡이츠 동시 연동',
  '[{"order":1,"action":"배민 주문 + 쿠팡이츠 주문 동시 발생","expected":"각 주문 개별 표시"},{"order":2,"action":"순서대로 처리","expected":"누락 없이 모든 주문 처리 가능"}]'::jsonb,
  '각 주문 개별 표시, 누락 없음',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배달앱 연동' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '동시 주문 처리 (배민+쿠팡이츠)' AND product_id = p.id);

-- POS-04: 테이블 주문→합산 결제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '테이블 주문→추가주문→합산 결제',
  '테이블 관리에서 주문 추가 후 전체 합산 결제 검증',
  '테이블 관리 활성화',
  '[{"order":1,"action":"테이블 선택 후 주문 추가","expected":"테이블에 주문 기록"},{"order":2,"action":"추가 주문","expected":"기존 주문에 추가"},{"order":3,"action":"테이블 결제","expected":"전체 주문 합산 결제, 테이블 초기화"}]'::jsonb,
  '전체 합산 결제, 테이블 초기화',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '테이블 관리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '테이블 주문→추가주문→합산 결제' AND product_id = p.id);

-- POS-05: 일별/월별 매출 리포트
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '일별/월별 매출 리포트',
  '결제 이력 기반 매출 리포트 정확성 검증',
  '결제 이력 존재',
  '[{"order":1,"action":"매출 리포트 조회","expected":"일별/월별 탭 전환 가능"},{"order":2,"action":"기간 필터 변경","expected":"결제/취소/순매출 수치 정확"},{"order":3,"action":"결제 수단별 분류 확인","expected":"결제 수단별 금액 정확"}]'::jsonb,
  '결제/취소/순매출 정확, 결제 수단별 분류 정확',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '매출 분석' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '리포트' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '일별/월별 매출 리포트' AND product_id = p.id);

-- ============================================
-- 4-C. TestCases — 사장님 어드민 (6개)
-- ============================================

-- ADMIN-01: 정산 내역 조회
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '정산 내역 조회 (수수료 차감)',
  '정산 기간별 조회 시 PG/배달앱 수수료 차감 후 실 정산 금액 정확성',
  '결제 이력 존재',
  '[{"order":1,"action":"정산 기간 선택","expected":"기간 설정"},{"order":2,"action":"조회","expected":"PG 수수료, 배달앱 수수료 차감 후 실 정산 금액 정확"}]'::jsonb,
  '수수료 차감 후 실 정산 금액 정확',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '정산 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '정산 조회' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정산 내역 조회 (수수료 차감)' AND product_id = p.id);

-- ADMIN-02: 직원 권한 관리
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '직원 권한별 접근 제어',
  '직원 추가 후 권한(결제만/환불 가능/관리자) 설정 시 접근 제어 동작',
  '관리자 로그인',
  '[{"order":1,"action":"직원 추가, 권한 설정 (결제만)","expected":"직원 등록 완료"},{"order":2,"action":"해당 직원으로 로그인","expected":"결제만 가능, 환불/설정 메뉴 접근 불가"},{"order":3,"action":"관리자 권한으로 변경 후 재로그인","expected":"전체 기능 접근 가능"}]'::jsonb,
  '설정된 권한 범위 내에서만 기능 접근',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '설정' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '직원 관리' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '직원 권한별 접근 제어' AND product_id = p.id);

-- ADMIN-03: 매장 설정 변경 반영
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '영업시간 변경→POS/배달앱 반영',
  '어드민에서 영업시간 변경 시 POS 및 배달앱 연동 매장에 반영',
  '기존 매장 설정 존재',
  '[{"order":1,"action":"영업시간 변경","expected":"저장 완료"},{"order":2,"action":"POS에서 영업시간 확인","expected":"변경된 영업시간 반영"},{"order":3,"action":"배달앱 매장 정보 확인","expected":"변경사항 반영"}]'::jsonb,
  'POS 및 배달앱에 변경사항 반영',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '설정' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '매장 설정' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '영업시간 변경→POS/배달앱 반영' AND product_id = p.id);

-- ADMIN-04: 결제→POS→어드민 데이터 일관성
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '결제→POS→어드민 데이터 일관성',
  '단말기 결제 후 POS 매출, 어드민 정산까지 금액/건수 완전 일치 검증',
  '전 시스템 연동 상태',
  '[{"order":1,"action":"단말기에서 결제 수행","expected":"결제 완료"},{"order":2,"action":"POS 매출 확인","expected":"결제 금액/건수 일치"},{"order":3,"action":"어드민 정산 확인","expected":"세 시스템 금액/건수 완전 일치"}]'::jsonb,
  '세 시스템의 금액/건수 완전 일치',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '데이터 일관성' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '결제→POS→어드민 데이터 일관성' AND product_id = p.id);

-- ADMIN-05: 오프라인→복구 동기화
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '오프라인→복구 후 자동 동기화',
  '단말기 오프라인 결제 후 네트워크 복구 시 POS/어드민 자동 동기화',
  '네트워크 끊김 상태',
  '[{"order":1,"action":"오프라인 상태에서 결제 수행","expected":"오프라인 승인 처리"},{"order":2,"action":"네트워크 복구","expected":"자동 동기화 시작"},{"order":3,"action":"POS/어드민 확인","expected":"오프라인 건 누락 없이 반영"}]'::jsonb,
  '오프라인 건 자동 동기화, 누락 없음',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '오프라인 동기화' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오프라인→복구 후 자동 동기화' AND product_id = p.id);

-- ADMIN-06: POS 비정상 종료 후 데이터 보존
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'POS 비정상 종료 후 데이터 보존',
  'POS 비정상 종료(크래시) 후 재부팅 시 처리 중 주문 복구 및 결제 데이터 보존',
  '주문 처리 중',
  '[{"order":1,"action":"POS 비정상 종료 (강제 종료)","expected":"종료"},{"order":2,"action":"POS 재부팅","expected":"처리 중이던 주문 복구, 결제 완료 건 보존"}]'::jsonb,
  '주문 복구, 결제 데이터 보존',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '사장님 어드민' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '크로스 시스템' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '장애 복구' AND s3.parent_id = s2.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'POS 비정상 종료 후 데이터 보존' AND product_id = p.id);

-- ============================================
-- 5. TestRuns (9개) — 실행 목적별 그룹
-- ============================================

-- 결제 단말기: Smoke Test
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', '핵심 Happy Path 빠른 검증 — IC카드/QR/NFC 정상 결제, 전체 취소, 일마감'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- 결제 단말기: 결제 안전성 검증
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '결제 안전성 검증', '결제 예외/장애 집중 — 망취소, 중복 결제 방지, 카드 제거, 네트워크 타임아웃'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '결제 안전성 검증' AND tr.product_id = p.id);

-- 결제 단말기: 보안 점검
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '보안 점검', 'PCI-DSS 보안 검증 — PAN 마스킹, 로그 평문 저장 금지'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '보안 점검' AND tr.product_id = p.id);

-- 결제 단말기: 취소/환불 검증
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '취소/환불 검증', '취소 플로우 전체 — 전체 취소, 부분 취소, 당일/익일 취소, 망취소'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '취소/환불 검증' AND tr.product_id = p.id);

-- 결제 단말기: Full Regression
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '결제 단말기 전체 TestCase 회귀 테스트'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- POS: Smoke Test
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', 'POS 핵심 기능 검증 — 상품등록, 배달앱 주문 수신, 매출 리포트'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Smoke Test' AND tr.product_id = p.id);

-- POS: Full Regression
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', 'POS 전체 TestCase 회귀 테스트'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- 사장님 어드민: 크로스 시스템 검증
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '크로스 시스템 검증', '단말기↔POS↔어드민 데이터 정합성 — 데이터 일관성, 오프라인 동기화, 장애 복구'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = '크로스 시스템 검증' AND tr.product_id = p.id);

-- 사장님 어드민: Full Regression
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', '사장님 어드민 전체 TestCase 회귀 테스트'
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (SELECT 1 FROM test_run tr WHERE tr.name = 'Full Regression' AND tr.product_id = p.id);

-- ============================================
-- 6. TestRunTestCase 연결 (TestRun ↔ TestCase N:M)
-- ============================================

-- 결제 단말기: Smoke Test (5개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND tc.title IN ('IC카드 정상 결제', 'QR 결제 (토스페이)', 'NFC 결제 (삼성페이)', '전체 취소', '일마감 집계 정확성')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 결제 단말기: 결제 안전성 검증 (5개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '결제 안전성 검증' AND p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND tc.title IN ('망취소(Reversal) 자동 처리', '중복 결제 방지 — 승인 중 재시도', 'IC카드 중간 제거 시 롤백', 'VAN사 네트워크 타임아웃', '동일 카드 연속 승인 차단')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 결제 단말기: 보안 점검 (2개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '보안 점검' AND p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND tc.title IN ('PAN 마스킹 검증', '로그 평문 저장 금지')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 결제 단말기: 취소/환불 검증 (4개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '취소/환불 검증' AND p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND tc.title IN ('전체 취소', '부분 취소', '당일/익일 취소 구분', '망취소(Reversal) 자동 처리')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 결제 단말기: Full Regression (20개 TC — 전체)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '결제 단말기' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- POS: Smoke Test (3개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = 'POS' AND c.name = '토스플레이스'
  AND tc.title IN ('상품 등록 (카테고리/옵션 포함)', '배달앱 주문 수신', '일별/월별 매출 리포트')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- POS: Full Regression (5개 TC — 전체)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = 'POS' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 사장님 어드민: 크로스 시스템 검증 (3개 TC)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '크로스 시스템 검증' AND p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND tc.title IN ('결제→POS→어드민 데이터 일관성', '오프라인→복구 후 자동 동기화', 'POS 비정상 종료 후 데이터 보존')
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );

-- 사장님 어드민: Full Regression (6개 TC — 전체)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '사장님 어드민' AND c.name = '토스플레이스'
  AND NOT EXISTS (
    SELECT 1 FROM test_run_test_case trtc WHERE trtc.test_run_id = tr.id AND trtc.test_case_id = tc.id
  );
