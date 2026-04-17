-- V202604161500: 배달의민족 포트폴리오 — Company 1개, Product 5개, Segment 트리, TestCase 140개
-- 고객앱(44) + 사장님앱(32) + 배민오더(19) + 라이더앱(19) + B마트(17) + 크로스시스템(9)

-- ============================================
-- 1. Company
-- ============================================
INSERT INTO company (name, is_active)
SELECT '배달의민족', false
WHERE NOT EXISTS (SELECT 1 FROM company WHERE name = '배달의민족');

-- ============================================
-- 2. Products (5개)
-- ============================================
INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '고객앱', 'MOBILE', '배달의민족 고객앱 — 배달/장보기/픽업/배민클럽'
FROM company c WHERE c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM product p WHERE p.name = '고객앱' AND p.company_id = c.id);

INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '사장님앱', 'WEB', '배달의민족 사장님앱 — 주문관리/메뉴관리/정산/광고'
FROM company c WHERE c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM product p WHERE p.name = '사장님앱' AND p.company_id = c.id);

INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '배민오더', 'ETC', '배달의민족 배민오더 — QR오더/태블릿 테이블오더/POS연동'
FROM company c WHERE c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM product p WHERE p.name = '배민오더' AND p.company_id = c.id);

INSERT INTO product (company_id, name, platform, description)
SELECT c.id, '라이더앱', 'MOBILE', '배달의민족 라이더앱 — AI배차/배달수행/정산'
FROM company c WHERE c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM product p WHERE p.name = '라이더앱' AND p.company_id = c.id);

INSERT INTO product (company_id, name, platform, description)
SELECT c.id, 'B마트', 'MOBILE', '배달의민족 B마트 — 퀵커머스/로봇배달/장보기'
FROM company c WHERE c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM product p WHERE p.name = 'B마트' AND p.company_id = c.id);

-- ============================================
-- 3. Segments — 고객앱
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '고객앱', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '고객앱' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1: 매장 탐색
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '매장 탐색', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '매장 탐색' AND s.product_id = p.id);

-- L2: 검색
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '검색', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색'
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '검색' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 필터/정렬
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '필터/정렬', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색'
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '필터/정렬' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 배달권역
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달권역', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색'
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달권역' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 주문
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문' AND s.product_id = p.id AND s.parent_id = root.id);

-- L2: 메뉴 선택
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '메뉴 선택', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '메뉴 선택' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 장바구니
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '장바구니', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '장바구니' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 쿠폰/할인
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '쿠폰/할인', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '쿠폰/할인' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 결제
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '결제', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '결제' AND s.product_id = p.id AND s.parent_id = root.id);

-- L2: 정상 결제
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정상 결제', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정상 결제' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 결제 실패
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '결제 실패', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '결제 실패' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 배달 추적
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달 추적', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달 추적' AND s.product_id = p.id AND s.parent_id = root.id);

-- L2: 상태 확인
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상태 확인', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '상태 확인' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 배달 지연
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달 지연', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적'
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달 지연' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 주문 취소/환불
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문 취소/환불', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문 취소/환불' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 픽업
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '픽업', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '픽업' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 장보기·쇼핑
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '장보기·쇼핑', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '장보기·쇼핑' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 배민클럽
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배민클럽', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배민클럽' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 리뷰/평점
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '리뷰/평점', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '리뷰/평점' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 크로스 시스템
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '크로스 시스템', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '크로스 시스템' AND s.product_id = p.id AND s.parent_id = root.id);

-- ============================================
-- 4. Segments — 사장님앱
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '사장님앱', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '사장님앱' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1: 주문 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문 관리' AND s.product_id = p.id);

-- L2: 주문 접수/거절
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문 접수/거절', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문 접수/거절' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 동시 주문 처리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '동시 주문 처리', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '동시 주문 처리' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 픽업 주문
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '픽업 주문', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '픽업 주문' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 메뉴 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '메뉴 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '메뉴 관리' AND s.product_id = p.id);

-- L2: 메뉴 CRUD
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '메뉴 CRUD', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '메뉴 CRUD' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 품절 처리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '품절 처리', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '품절 처리' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L2: 옵션/가격
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '옵션/가격', l1.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리'
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '옵션/가격' AND s.product_id = p.id AND s.parent_id = l1.id);

-- L1: 매장 설정
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '매장 설정', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '매장 설정' AND s.product_id = p.id);

-- L1: 정산/매출
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산/매출', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정산/매출' AND s.product_id = p.id);

-- L1: 광고 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '광고 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '광고 관리' AND s.product_id = p.id);

-- L1: 리뷰 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '리뷰 관리', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '리뷰 관리' AND s.product_id = p.id);

-- ============================================
-- 5. Segments — 배민오더
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배민오더', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배민오더' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1: QR오더
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'QR오더', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'QR오더' AND s.product_id = p.id);

-- L1: 태블릿오더
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '태블릿오더', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '태블릿오더' AND s.product_id = p.id);

-- L1: POS 연동
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'POS 연동', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'POS 연동' AND s.product_id = p.id);

-- L1: 비기능
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '비기능', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '비기능' AND s.product_id = p.id AND s.parent_id = root.id);

-- ============================================
-- 6. Segments — 라이더앱
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '라이더앱', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '라이더앱' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1: 배달 배정
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달 배정', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달 배정' AND s.product_id = p.id);

-- L1: 배달 수행
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달 수행', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달 수행' AND s.product_id = p.id);

-- L1: 정산
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '정산', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '정산' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 비기능 (라이더앱)
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '비기능', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '비기능' AND s.product_id = p.id AND s.parent_id = root.id);

-- ============================================
-- 7. Segments — B마트
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'B마트', NULL
FROM product p JOIN company c ON p.company_id = c.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = 'B마트' AND s.product_id = p.id AND s.parent_id IS NULL);

-- L1: 상품 탐색
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상품 탐색', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '상품 탐색' AND s.product_id = p.id);

-- L1: 주문 (B마트)
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '주문' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 배달 (B마트)
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '배달' AND s.product_id = p.id AND s.parent_id = root.id);

-- L1: 특화 기능
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '특화 기능', root.id
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '특화 기능' AND s.product_id = p.id);

-- ============================================
-- 8. TestCases — 고객앱 > 매장 탐색 > 검색 (3)
-- ============================================

-- TC-C-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '키워드 검색 — 매장명 일치',
  '배달 주소 설정 후 매장명으로 검색하여 일치하는 매장 목록이 정확히 노출되는지 검증',
  '로그인, 배달 주소 설정',
  '[{"order":1,"action":"검색창 탭","expected":"검색 입력 화면 노출"},{"order":2,"action":"매장명 입력","expected":"자동완성 또는 입력 반영"},{"order":3,"action":"검색 실행","expected":"검색 결과 목록 노출"}]'::jsonb,
  '검색어와 일치하는 매장 목록 노출, 배달 가능 매장만 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '검색' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '키워드 검색 — 매장명 일치' AND product_id = p.id);

-- TC-C-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '키워드 검색 — 메뉴명 검색',
  '메뉴명으로 검색하여 해당 메뉴가 있는 매장이 노출되는지 검증',
  '로그인, 배달 주소 설정',
  '[{"order":1,"action":"\"치킨\" 검색","expected":"검색 실행"},{"order":2,"action":"결과 확인","expected":"치킨 메뉴 보유 매장 목록 노출"}]'::jsonb,
  '치킨 메뉴가 있는 매장 목록 노출, 해당 메뉴 하이라이트',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '검색' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '키워드 검색 — 메뉴명 검색' AND product_id = p.id);

-- TC-C-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '검색어 없음 — 빈 검색',
  '빈 검색어로 검색 시 최근/인기 검색어가 표시되는지 검증',
  '로그인',
  '[{"order":1,"action":"검색창에 빈 값으로 검색 실행","expected":"최근 검색어 또는 인기 검색어 표시"}]'::jsonb,
  '최근 검색어 또는 인기 검색어 표시, 빈 결과 아님',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '검색' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '검색어 없음 — 빈 검색' AND product_id = p.id);

-- ============================================
-- 고객앱 > 매장 탐색 > 필터/정렬 (3)
-- ============================================

-- TC-C-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '카테고리 필터',
  '카테고리 필터 적용 시 해당 카테고리 매장만 노출되는지 검증',
  '로그인, 배달 주소 설정',
  '[{"order":1,"action":"\"한식\" 카테고리 선택","expected":"한식 매장만 필터링"},{"order":2,"action":"매장 목록 확인","expected":"한식 카테고리 매장만 노출"}]'::jsonb,
  '한식 카테고리 매장만 필터링되어 노출',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '필터/정렬' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '카테고리 필터' AND product_id = p.id);

-- TC-C-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달비 낮은순 정렬',
  '배달비 낮은순 정렬 시 매장이 올바르게 정렬되는지 검증',
  '로그인, 배달 주소 설정',
  '[{"order":1,"action":"정렬 옵션에서 \"배달비 낮은순\" 선택","expected":"배달비 오름차순 정렬"}]'::jsonb,
  '배달비 오름차순으로 매장 정렬, 배달비 0원 매장 최상단',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '필터/정렬' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달비 낮은순 정렬' AND product_id = p.id);

-- TC-C-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '최소주문금액 필터',
  '최소주문금액 필터 적용 시 조건에 맞는 매장만 노출되는지 검증',
  '로그인, 배달 주소 설정',
  '[{"order":1,"action":"필터에서 \"최소주문 1만원 이하\" 선택","expected":"조건 부합 매장만 노출"}]'::jsonb,
  '최소주문금액 10,000원 이하 매장만 노출',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '필터/정렬' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최소주문금액 필터' AND product_id = p.id);

-- ============================================
-- 고객앱 > 매장 탐색 > 배달권역 (2)
-- ============================================

-- TC-C-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달 주소 변경 시 매장 갱신',
  '배달 주소 변경 시 매장 목록과 배달비가 재계산되는지 검증',
  '기존 주소 설정 상태',
  '[{"order":1,"action":"배달 주소 변경","expected":"새 주소 반영"},{"order":2,"action":"매장 목록 확인","expected":"변경된 주소 기준 매장 갱신"}]'::jsonb,
  '변경된 주소 기준으로 매장 목록 갱신, 배달비 재계산',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '배달권역' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 주소 변경 시 매장 갱신' AND product_id = p.id);

-- TC-C-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달 불가 지역 접근',
  '배달 불가 지역 주소 입력 시 적절한 안내가 표시되는지 검증',
  '로그인',
  '[{"order":1,"action":"배달 불가 지역 주소 입력","expected":"주소 입력 완료"},{"order":2,"action":"매장 검색","expected":"배달 불가 안내 또는 픽업 매장 추천"}]'::jsonb,
  '"배달 가능한 매장이 없습니다" 안내 또는 픽업 가능 매장 추천',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 탐색' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '배달권역' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 불가 지역 접근' AND product_id = p.id);

-- ============================================
-- 고객앱 > 주문 > 메뉴 선택 (3)
-- ============================================

-- TC-C-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '단일 메뉴 선택',
  '메뉴 1개 선택 후 옵션 포함하여 장바구니에 정확히 반영되는지 검증',
  '매장 상세 화면 진입',
  '[{"order":1,"action":"메뉴 1개 선택","expected":"메뉴 상세 화면 노출"},{"order":2,"action":"옵션 선택","expected":"옵션 반영"},{"order":3,"action":"장바구니 담기","expected":"장바구니에 메뉴+옵션 반영"}]'::jsonb,
  '선택한 메뉴+옵션이 장바구니에 정확히 반영, 금액 일치',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 선택' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '단일 메뉴 선택' AND product_id = p.id);

-- TC-C-010
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '품절 메뉴 선택 시도',
  '사장님이 품절 처리한 메뉴 선택 시 차단되는지 검증',
  '사장님이 메뉴 품절 처리',
  '[{"order":1,"action":"품절 메뉴 선택 시도","expected":"품절 표시, 장바구니 담기 불가"}]'::jsonb,
  '"품절" 표시, 장바구니 담기 불가',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 선택' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '품절 메뉴 선택 시도' AND product_id = p.id);

-- TC-C-011
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '영업 종료 매장 주문 시도',
  '영업시간 외 매장에서 주문 시도 시 차단되는지 검증',
  '영업시간 외 접근',
  '[{"order":1,"action":"영업 종료 매장 메뉴 선택 시도","expected":"영업시간 외 안내 표시"}]'::jsonb,
  '"현재 영업시간이 아닙니다" 안내, 주문 불가',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 선택' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '영업 종료 매장 주문 시도' AND product_id = p.id);

-- ============================================
-- 고객앱 > 주문 > 장바구니 (3)
-- ============================================

-- TC-C-012
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '다른 매장 메뉴 추가 시도',
  '다른 매장 메뉴를 장바구니에 추가 시 확인 팝업이 노출되는지 검증',
  '매장A 메뉴가 장바구니에 존재',
  '[{"order":1,"action":"매장B에서 메뉴 담기 시도","expected":"장바구니 비우기 확인 팝업 노출"}]'::jsonb,
  '"장바구니를 비우고 새로 담으시겠습니까?" 확인 팝업',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '장바구니' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '다른 매장 메뉴 추가 시도' AND product_id = p.id);

-- TC-C-013
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '수량 변경',
  '장바구니 수량 변경 시 금액이 정확히 재계산되는지 검증',
  '장바구니에 메뉴 존재',
  '[{"order":1,"action":"수량 +/- 변경","expected":"수량 변경 반영"},{"order":2,"action":"금액 확인","expected":"수량에 따른 금액 재계산"}]'::jsonb,
  '수량에 따른 금액 정확히 재계산',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '장바구니' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '수량 변경' AND product_id = p.id);

-- TC-C-014
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '최소주문금액 미달',
  '장바구니 금액이 최소주문금액 미달 시 결제 차단되는지 검증',
  '장바구니 금액 < 최소주문금액',
  '[{"order":1,"action":"주문하기 시도","expected":"최소주문금액 미달 안내"}]'::jsonb,
  '"최소 주문 금액 X원 이상 주문 가능" 안내, 결제 버튼 비활성화',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '장바구니' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최소주문금액 미달' AND product_id = p.id);

-- ============================================
-- 고객앱 > 주문 > 쿠폰/할인 (3)
-- ============================================

-- TC-C-015
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '쿠폰 적용 후 금액 계산',
  '쿠폰 적용 시 최종 결제금액이 정확히 계산되는지 검증',
  '사용 가능 쿠폰 보유',
  '[{"order":1,"action":"쿠폰 선택","expected":"쿠폰 적용"},{"order":2,"action":"할인 금액 확인","expected":"할인 반영"},{"order":3,"action":"결제","expected":"최종 금액 = 주문금액 - 할인 + 배달비"}]'::jsonb,
  '최종 결제금액 = 주문금액 - 할인 + 배달비, 정확히 일치',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '쿠폰/할인' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '쿠폰 적용 후 금액 계산' AND product_id = p.id);

-- TC-C-016
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '쿠폰 중복 적용 차단',
  '동일 쿠폰 중복 적용이 차단되는지 검증',
  '동일 쿠폰 2장 보유',
  '[{"order":1,"action":"쿠폰 1장 적용","expected":"쿠폰 적용 완료"},{"order":2,"action":"동일 쿠폰 추가 적용 시도","expected":"중복 적용 차단"}]'::jsonb,
  '중복 적용 차단, 1장만 적용',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '쿠폰/할인' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '쿠폰 중복 적용 차단' AND product_id = p.id);

-- TC-C-017
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '최소주문금액 조건 쿠폰',
  '최소주문금액 미달 시 쿠폰 적용이 차단되는지 검증',
  '"15,000원 이상 주문 시 3,000원 할인" 쿠폰',
  '[{"order":1,"action":"12,000원 주문에 쿠폰 적용 시도","expected":"최소 주문금액 미달 안내"}]'::jsonb,
  '"최소 주문금액 미달" 안내, 쿠폰 적용 불가',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '쿠폰/할인' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최소주문금액 조건 쿠폰' AND product_id = p.id);

-- ============================================
-- 고객앱 > 결제 > 정상 결제 (2)
-- ============================================

-- TC-C-018
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '카드 결제 정상 플로우',
  '카드 결제 시 주문 완료까지 정상 처리되는지 검증',
  '장바구니 완성, 결제 수단 등록',
  '[{"order":1,"action":"결제 수단 선택","expected":"결제 수단 확인"},{"order":2,"action":"결제하기","expected":"결제 처리 중"},{"order":3,"action":"결제 완료","expected":"주문 완료 화면, 주문번호 발급"}]'::jsonb,
  '주문 완료 화면, 주문번호 발급, 상태 "접수 대기"',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '정상 결제' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '카드 결제 정상 플로우' AND product_id = p.id);

-- TC-C-019
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '토스페이 간편결제',
  '토스페이 간편결제로 3초 이내 승인되는지 검증',
  '토스페이 연동 상태',
  '[{"order":1,"action":"토스페이 선택","expected":"토스페이 결제 화면"},{"order":2,"action":"비밀번호/생체인증","expected":"인증 완료"},{"order":3,"action":"결제","expected":"3초 이내 승인"}]'::jsonb,
  '3초 이내 승인, 주문 상태 "접수 대기"',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '정상 결제' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '토스페이 간편결제' AND product_id = p.id);

-- ============================================
-- 고객앱 > 결제 > 결제 실패 (3)
-- ============================================

-- TC-C-020
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '잔액 부족',
  '잔액 부족 시 결제 실패 처리 및 대안 안내 검증',
  '잔액 부족 결제 수단',
  '[{"order":1,"action":"결제 시도","expected":"결제 실패 안내, 다른 결제 수단 선택 유도"}]'::jsonb,
  '결제 실패 안내, 다른 결제 수단 선택 유도, 장바구니 유지',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '결제 실패' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '잔액 부족' AND product_id = p.id);

-- TC-C-021
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '결제 중 네트워크 끊김',
  '결제 진행 중 네트워크 끊김 시 중복 결제 방지 검증',
  '정상 네트워크',
  '[{"order":1,"action":"결제 버튼 클릭 직후 네트워크 차단","expected":"결제 상태 재확인 안내, 중복 결제 방지"}]'::jsonb,
  '결제 상태 재확인 안내, 중복 결제 방지',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '결제 실패' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '결제 중 네트워크 끊김' AND product_id = p.id);

-- TC-C-022
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '결제 중 앱 종료 후 재진입',
  '결제 처리 중 앱 강제 종료 후 재진입 시 이중 결제 방지 검증',
  '결제 진행 중',
  '[{"order":1,"action":"결제 처리 중 앱 강제 종료","expected":"앱 종료"},{"order":2,"action":"앱 재실행","expected":"결제 완료/실패 상태 정확히 반영, 이중 결제 없음"}]'::jsonb,
  '결제 완료/실패 상태 정확히 반영, 이중 결제 없음',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '결제 실패' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '결제 중 앱 종료 후 재진입' AND product_id = p.id);

-- ============================================
-- 고객앱 > 배달 추적 > 상태 확인 (2)
-- ============================================

-- TC-C-023
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '주문 상태 실시간 갱신',
  '주문 상태가 실시간으로 전이되는지 검증',
  '주문 완료 상태',
  '[{"order":1,"action":"주문 상세 화면 진입","expected":"현재 주문 상태 표시"},{"order":2,"action":"상태 변화 관찰","expected":"접수대기→조리중→배달중→완료 상태 전이 실시간 반영"}]'::jsonb,
  '접수대기→조리중→배달중→완료 상태 전이 실시간 반영',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '상태 확인' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '주문 상태 실시간 갱신' AND product_id = p.id);

-- TC-C-024
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달 위치 추적',
  '라이더 실시간 위치가 지도에 정확히 표시되는지 검증',
  '라이더 배달 중',
  '[{"order":1,"action":"지도에서 라이더 위치 확인","expected":"라이더 실시간 위치 표시, 예상 도착 시간 갱신"}]'::jsonb,
  '라이더 실시간 위치 표시, 예상 도착 시간 갱신',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '상태 확인' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 위치 추적' AND product_id = p.id);

-- ============================================
-- 고객앱 > 배달 추적 > 배달 지연 (2)
-- ============================================

-- TC-C-025
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달 예상시간 초과',
  '배달 예상시간 초과 시 지연 알림 및 시간 재계산 검증',
  '예상 시간 40분, 50분 경과',
  '[{"order":1,"action":"주문 상세 확인","expected":"배달 지연 알림, 예상 시간 재계산"}]'::jsonb,
  '"배달이 지연되고 있습니다" 알림, 예상 시간 재계산',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '배달 지연' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 예상시간 초과' AND product_id = p.id);

-- TC-C-026
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '라이더 배정 실패',
  '라이더 미배정 시 안내 및 후속 처리 검증',
  '주문 접수 후 라이더 미배정',
  '[{"order":1,"action":"주문 상태 확인","expected":"배달원 배정 중 안내, 일정 시간 후 자동 취소 또는 CS 연결"}]'::jsonb,
  '"배달원 배정 중" 안내, 일정 시간 후 자동 취소 또는 CS 연결',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 추적' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '배달 지연' AND l2.parent_id = l1.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '라이더 배정 실패' AND product_id = p.id);

-- ============================================
-- 고객앱 > 주문 취소/환불 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-C-027
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '접수 전 즉시 취소',
  '사장님 미접수 상태에서 주문 취소 시 즉시 환불 검증',
  '주문 완료, 사장님 미접수',
  '[{"order":1,"action":"주문 취소","expected":"즉시 취소, 전액 환불 처리"}]'::jsonb,
  '즉시 취소, 전액 환불 처리',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 취소/환불' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '접수 전 즉시 취소' AND product_id = p.id);

-- TC-C-028
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '조리 중 취소 시도',
  '사장님 접수 후 조리 중 취소 시도 시 차단되는지 검증',
  '사장님 접수 완료',
  '[{"order":1,"action":"주문 취소 시도","expected":"취소 불가 안내, CS 연결 안내"}]'::jsonb,
  '취소 불가 안내, CS 연결 안내',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 취소/환불' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '조리 중 취소 시도' AND product_id = p.id);

-- TC-C-029
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 중 취소 시도',
  '라이더 픽업 후 배달 중 취소 시도 시 차단되는지 검증',
  '라이더 픽업 완료',
  '[{"order":1,"action":"주문 취소 시도","expected":"취소 불가, CS 문의 안내"}]'::jsonb,
  '취소 불가, CS 문의 안내',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 취소/환불' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 중 취소 시도' AND product_id = p.id);

-- ============================================
-- 고객앱 > 픽업 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-C-030
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '픽업 주문 정상 플로우',
  '픽업 주문 전체 플로우가 정상 처리되는지 검증',
  '로그인, 픽업 가능 매장',
  '[{"order":1,"action":"픽업 탭 선택","expected":"픽업 매장 목록"},{"order":2,"action":"매장 선택","expected":"매장 상세"},{"order":3,"action":"메뉴 선택","expected":"메뉴 담기"},{"order":4,"action":"결제","expected":"주문 완료, 매장에서 수령 안내"}]'::jsonb,
  '주문 완료, "매장에서 수령" 안내, 예상 준비 시간 표시',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '픽업' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '픽업 주문 정상 플로우' AND product_id = p.id);

-- TC-C-031
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '내 주변 픽업 가게 노출',
  'GPS 기반으로 가까운 순으로 픽업 매장이 노출되는지 검증',
  'GPS 활성화',
  '[{"order":1,"action":"픽업 탭 진입","expected":"현재 위치 기준 가까운 순 매장 노출"}]'::jsonb,
  '현재 위치 기준 가까운 순으로 매장 노출',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '픽업' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '내 주변 픽업 가게 노출' AND product_id = p.id);

-- TC-C-032
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '픽업 가격 vs 배달 가격 차이',
  '픽업 가격이 배달 가격과 별도로 표시되는지 검증',
  '사장님이 픽업 가격 별도 설정',
  '[{"order":1,"action":"동일 메뉴의 배달/픽업 가격 비교","expected":"픽업 가격 별도 표시"}]'::jsonb,
  '픽업 가격이 별도 표시, 배달 가격과 다를 수 있음 안내',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '픽업' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '픽업 가격 vs 배달 가격 차이' AND product_id = p.id);

-- ============================================
-- 고객앱 > 장보기·쇼핑 (6) — L1 직접, path [root, l1]
-- ============================================

-- TC-C-033
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '장보기 탭 진입 및 카테고리 탐색',
  '장보기 탭에서 카테고리별 매장/상품 노출 검증',
  '로그인',
  '[{"order":1,"action":"장보기·쇼핑 탭 선택","expected":"장보기 메인 화면"},{"order":2,"action":"카테고리 탐색","expected":"편의점/마트/생활용품 등 카테고리 노출, 입점 매장 목록"}]'::jsonb,
  '편의점/마트/생활용품 등 카테고리 노출, 입점 매장 목록',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '장보기 탭 진입 및 카테고리 탐색' AND product_id = p.id);

-- TC-C-034
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '장보기 상품 검색',
  '상품명 검색 시 매장별 가격 비교 가능 여부 검증',
  '로그인',
  '[{"order":1,"action":"상품명 검색","expected":"검색 실행"},{"order":2,"action":"결과 확인","expected":"검색어 일치 상품 목록, 매장별 가격 비교"}]'::jsonb,
  '검색어와 일치하는 상품 목록, 매장별 가격 비교 가능',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '장보기 상품 검색' AND product_id = p.id);

-- TC-C-035
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '장보기 주문 정상 플로우',
  '장보기 주문 전체 플로우 및 예상 배달 시간 검증',
  '배달 주소 설정',
  '[{"order":1,"action":"매장 선택","expected":"매장 상세"},{"order":2,"action":"상품 담기","expected":"장바구니에 반영"},{"order":3,"action":"결제","expected":"주문 완료, 예상 배달 시간 30분 내외 표시"}]'::jsonb,
  '주문 완료, 예상 배달 시간(30분 내외) 표시',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '장보기 주문 정상 플로우' AND product_id = p.id);

-- TC-C-036
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 주문 — 30분 배달 SLA',
  'B마트 상품 주문 시 30분 내외 배달 SLA 표시 검증',
  'B마트 배달 가능 지역',
  '[{"order":1,"action":"B마트 상품 주문","expected":"주문 완료"},{"order":2,"action":"배달 시간 확인","expected":"30분 내외 배달 예상 시간 표시"}]'::jsonb,
  '30분 내외 배달 예상 시간 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 주문 — 30분 배달 SLA' AND product_id = p.id);

-- TC-C-037
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '재고 부족 상품 주문',
  '장바구니 담은 후 재고 소진 시 처리 검증',
  '장바구니에 담은 후 재고 소진',
  '[{"order":1,"action":"결제 시도","expected":"재고 부족 안내, 해당 상품 제거 또는 대체 상품 추천"}]'::jsonb,
  '"재고 부족" 안내, 해당 상품 제거 또는 대체 상품 추천',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '재고 부족 상품 주문' AND product_id = p.id);

-- TC-C-038
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '오프라인 매장 재고 불일치',
  '앱 재고와 실제 매장 재고 불일치 시 부분 취소 처리 검증',
  '앱에 재고 있음 표시',
  '[{"order":1,"action":"주문","expected":"주문 접수"},{"order":2,"action":"매장에서 품절 확인","expected":"사장님이 부분 취소 처리, 고객에게 변경 알림"}]'::jsonb,
  '사장님이 부분 취소 처리, 고객에게 변경 알림',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '장보기·쇼핑' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오프라인 매장 재고 불일치' AND product_id = p.id);

-- ============================================
-- 고객앱 > 배민클럽 (4) — L1 직접, path [root, l1]
-- ============================================

-- TC-C-039
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배민클럽 가입',
  '배민클럽 가입 시 결제 및 혜택 즉시 적용 검증',
  '미가입 상태',
  '[{"order":1,"action":"배민클럽 가입","expected":"가입 화면"},{"order":2,"action":"결제 수단 등록","expected":"월 3,990원 결제, 배달팁 무료 혜택 즉시 적용"}]'::jsonb,
  '월 3,990원 결제, 배달팁 무료 혜택 즉시 적용',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배민클럽' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배민클럽 가입' AND product_id = p.id);

-- TC-C-040
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배민클럽 무료배달 적용',
  '배민클럽 가입 상태에서 배달팁 무료 적용 검증',
  '배민클럽 가입 상태',
  '[{"order":1,"action":"음식 주문","expected":"주문 화면"},{"order":2,"action":"배달팁 확인","expected":"배달팁 0원, 비회원 대비 할인 금액 표시"}]'::jsonb,
  '배달팁 0원 표시, 비회원 대비 할인 금액 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배민클럽' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배민클럽 무료배달 적용' AND product_id = p.id);

-- TC-C-041
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배민클럽 해지',
  '배민클럽 해지 시 잔여 혜택 유지 및 만료 후 정상 부과 검증',
  '가입 상태',
  '[{"order":1,"action":"배민클럽 해지","expected":"해지 완료"},{"order":2,"action":"다음 주문 시 배달팁 확인","expected":"잔여 기간 혜택 유지, 만료 후 정상 배달팁 부과"}]'::jsonb,
  '해지 완료, 잔여 기간 혜택 유지, 만료 후 정상 배달팁 부과',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배민클럽' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배민클럽 해지' AND product_id = p.id);

-- TC-C-042
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배민클럽 + 유튜브 프리미엄 번들',
  '배민클럽+유튜브 프리미엄 번들 가입 시 양쪽 활성화 검증',
  '미가입 상태',
  '[{"order":1,"action":"유튜브 프리미엄 패키지 가입","expected":"결제 완료"},{"order":2,"action":"유튜브 앱 확인","expected":"월 13,900원 결제, 배민클럽 + 유튜브 프리미엄 모두 활성화"}]'::jsonb,
  '월 13,900원 결제, 배민클럽 + 유튜브 프리미엄 모두 활성화',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배민클럽' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배민클럽 + 유튜브 프리미엄 번들' AND product_id = p.id);

-- ============================================
-- 고객앱 > 리뷰/평점 (2) — L1 직접, path [root, l1]
-- ============================================

-- TC-C-043
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 완료 후 리뷰 작성',
  '배달 완료 후 리뷰(별점+사진+텍스트) 등록 검증',
  '배달 완료 상태',
  '[{"order":1,"action":"리뷰 작성","expected":"리뷰 입력 화면"},{"order":2,"action":"별점 + 사진 + 텍스트 입력","expected":"입력 완료"},{"order":3,"action":"등록","expected":"리뷰 등록 완료, 매장 리뷰 목록에 즉시 반영"}]'::jsonb,
  '리뷰 등록 완료, 매장 리뷰 목록에 즉시 반영',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '리뷰/평점' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 완료 후 리뷰 작성' AND product_id = p.id);

-- TC-C-044
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '미주문 매장 리뷰 작성 차단',
  '주문 이력 없는 매장 리뷰 작성 시도 시 차단 검증',
  '해당 매장 주문 이력 없음',
  '[{"order":1,"action":"리뷰 작성 시도","expected":"리뷰 작성 불가, 주문 후 리뷰 작성 가능 안내"}]'::jsonb,
  '리뷰 작성 불가, "주문 후 리뷰 작성 가능" 안내',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '리뷰/평점' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '미주문 매장 리뷰 작성 차단' AND product_id = p.id);

-- ============================================
-- 고객앱 > 크로스 시스템 (9) — L1 직접, path [root, l1]
-- ============================================

-- TC-X-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '정상 주문 E2E (3자 전체)',
  '고객-사장님-라이더 3자 연동 정상 주문 전체 플로우 검증',
  '고객/사장님/라이더 모두 활성',
  '[{"order":1,"action":"고객: 주문+결제","expected":"주문 완료"},{"order":2,"action":"사장님: 접수","expected":"접수 완료"},{"order":3,"action":"사장님: 조리완료","expected":"조리 완료"},{"order":4,"action":"라이더: 배정 수락","expected":"배정 수락"},{"order":5,"action":"라이더: 픽업","expected":"픽업 완료"},{"order":6,"action":"라이더: 배달완료","expected":"배달 완료"},{"order":7,"action":"고객: 배달완료 확인","expected":"완료 확인"}]'::jsonb,
  '모든 상태 전이 3자 동기화, 알림 정확, 금액 정합',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정상 주문 E2E (3자 전체)' AND product_id = p.id);

-- TC-X-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '알뜰배달(묶음) E2E',
  '2건 근접 주문 묶음 배달 전체 플로우 검증',
  '2건 근접 주문',
  '[{"order":1,"action":"고객A: 주문","expected":"주문 완료"},{"order":2,"action":"고객B: 주문","expected":"주문 완료"},{"order":3,"action":"라이더: 묶음 배정 수락","expected":"배정 수락"},{"order":4,"action":"순차 픽업/배달","expected":"두 주문 모두 정상 완료"}]'::jsonb,
  '두 주문 모두 정상 완료, 각 고객에게 정확한 배달 시간 안내',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '알뜰배달(묶음) E2E' AND product_id = p.id);

-- TC-X-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '픽업 주문 E2E',
  '고객-사장님 2자 픽업 주문 전체 플로우 검증 (라이더 없음)',
  '고객/사장님 활성',
  '[{"order":1,"action":"고객: 픽업 주문+결제","expected":"주문 완료"},{"order":2,"action":"사장님: 접수","expected":"접수 완료"},{"order":3,"action":"사장님: 준비완료","expected":"준비 완료"},{"order":4,"action":"고객: 매장 수령","expected":"수령 완료"}]'::jsonb,
  '라이더 배정 없이 완료, 고객에게 준비완료 알림',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '픽업 주문 E2E' AND product_id = p.id);

-- TC-X-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '사장님 주문 거절 → 자동 환불',
  '사장님 거절 시 고객 자동 환불 및 알림 검증',
  '고객 주문 완료',
  '[{"order":1,"action":"고객: 주문","expected":"주문 완료"},{"order":2,"action":"사장님: 거절(사유 선택)","expected":"거절 처리"},{"order":3,"action":"고객: 알림 확인","expected":"주문 취소 알림, 전액 자동 환불"}]'::jsonb,
  '고객에게 "주문 취소" 알림, 전액 자동 환불, 주문 상태 "취소"',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '사장님 주문 거절 → 자동 환불' AND product_id = p.id);

-- TC-X-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '고객 접수 전 취소 → 사장님 알림',
  '고객 즉시 취소 시 사장님 알림 및 환불 검증',
  '고객 주문 직후',
  '[{"order":1,"action":"고객: 주문","expected":"주문 완료"},{"order":2,"action":"고객: 즉시 취소","expected":"취소 처리"},{"order":3,"action":"사장님: 알림 확인","expected":"주문 취소됨 알림, 전액 환불"}]'::jsonb,
  '사장님에게 "주문 취소됨" 알림, 전액 환불',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '고객 접수 전 취소 → 사장님 알림' AND product_id = p.id);

-- TC-X-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '조리 중 고객 취소 요청 → CS 연결',
  '조리 중 취소 요청 시 CS 중재 프로세스 검증',
  '사장님 접수 완료',
  '[{"order":1,"action":"고객: 취소 요청","expected":"CS 연결"},{"order":2,"action":"CS 연결","expected":"중재 시작"},{"order":3,"action":"사장님에게 취소 전달","expected":"사장님 동의 시 취소/환불, 거부 시 배달 진행"}]'::jsonb,
  'CS 중재, 사장님 동의 시 취소/환불, 거부 시 배달 진행',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '조리 중 고객 취소 요청 → CS 연결' AND product_id = p.id);

-- TC-X-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '라이더 배정 실패 → 재배정 → 고객 알림',
  '라이더 전원 거절 시 재배정 및 고객 지연 알림 검증',
  '사장님 조리완료',
  '[{"order":1,"action":"라이더 배정","expected":"배정 시도"},{"order":2,"action":"모든 라이더 거절","expected":"재배정 시작"},{"order":3,"action":"재배정","expected":"새 라이더 배정"},{"order":4,"action":"고객 알림","expected":"배달 지연 알림, 예상 시간 재계산"}]'::jsonb,
  '고객에게 "배달 지연" 알림, 예상 시간 재계산',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '라이더 배정 실패 → 재배정 → 고객 알림' AND product_id = p.id);

-- TC-X-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 중 사고 → 재배정 → 고객/사장님 알림',
  '배달 중 사고 발생 시 자동 재배정 및 알림 검증',
  '라이더 배달 중',
  '[{"order":1,"action":"라이더: 사고 보고","expected":"사고 접수"},{"order":2,"action":"새 라이더 재배정","expected":"재배정 완료"},{"order":3,"action":"고객/사장님 알림","expected":"배달 지연 알림, 음식 상태 확인"}]'::jsonb,
  '자동 재배정, 배달 지연 알림, 음식 상태 확인 프로세스',
  'MEDIUM', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 중 사고 → 재배정 → 고객/사장님 알림' AND product_id = p.id);

-- TC-X-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '정산 정합성 (고객 결제 = 사장님 정산 + 수수료 + 배달비)',
  '고객 결제액과 사장님 정산+수수료+배달비 정합성 검증',
  '주문 완료 건',
  '[{"order":1,"action":"고객 결제 금액 확인","expected":"결제 금액 확인"},{"order":2,"action":"사장님 정산 금액 확인","expected":"정산 금액 확인"},{"order":3,"action":"라이더 배달비 확인","expected":"고객 결제액 = 사장님 정산 + 수수료 + 배달비"}]'::jsonb,
  '고객 결제액 = 사장님 정산 + 플랫폼 수수료 + 배달비, 원 단위까지 일치',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '고객앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '크로스 시스템' AND l1.parent_id = root.id
WHERE p.name = '고객앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정산 정합성 (고객 결제 = 사장님 정산 + 수수료 + 배달비)' AND product_id = p.id);

-- ============================================
-- 9. TestCases — 사장님앱 > 주문 관리 > 주문 접수/거절 (4)
-- ============================================

-- TC-S-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달 주문 접수',
  '신규 배달 주문 접수 시 상태 변경 및 고객 알림 검증',
  '신규 주문 알림 수신',
  '[{"order":1,"action":"주문 확인","expected":"주문 상세 확인"},{"order":2,"action":"접수 버튼 클릭","expected":"접수 처리"},{"order":3,"action":"예상 조리 시간 설정","expected":"주문 상태 접수로 변경, 고객앱에 접수 알림"}]'::jsonb,
  '주문 상태 "접수"로 변경, 고객앱에 접수 알림 전송',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '주문 접수/거절' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 주문 접수' AND product_id = p.id);

-- TC-S-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '주문 거절',
  '주문 거절 시 고객 자동 환불 및 취소 알림 검증',
  '신규 주문 알림 수신',
  '[{"order":1,"action":"주문 확인","expected":"주문 상세"},{"order":2,"action":"거절 사유 선택","expected":"사유 선택"},{"order":3,"action":"거절 실행","expected":"주문 상태 거절, 고객 자동 환불 + 취소 알림"}]'::jsonb,
  '주문 상태 "거절", 고객에게 자동 환불 + 취소 알림',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '주문 접수/거절' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '주문 거절' AND product_id = p.id);

-- TC-S-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '조리 완료 처리',
  '조리 완료 시 라이더 배정 요청 트리거 검증',
  '주문 접수 상태',
  '[{"order":1,"action":"조리 완료 버튼 클릭","expected":"상태 조리완료로 변경, 라이더 배정 요청 트리거"}]'::jsonb,
  '상태 "조리완료"로 변경, 라이더 배정 요청 트리거',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '주문 접수/거절' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '조리 완료 처리' AND product_id = p.id);

-- TC-S-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '접수 미처리 타임아웃',
  '일정 시간 미접수 시 자동 알림 및 자동 취소 검증',
  '신규 주문 알림 수신',
  '[{"order":1,"action":"일정 시간 동안 미접수","expected":"자동 알림 재전송, 지정 시간 초과 시 자동 취소"}]'::jsonb,
  '자동 알림 재전송, 지정 시간 초과 시 자동 취소 처리',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '주문 접수/거절' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '접수 미처리 타임아웃' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 주문 관리 > 동시 주문 처리 (2)
-- ============================================

-- TC-S-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '피크 시간 동시 다건 주문',
  '피크 시간대 동시 5건 이상 주문 수신 시 누락 없이 처리되는지 검증',
  '점심 피크 시간대',
  '[{"order":1,"action":"동시에 5건 이상 주문 수신","expected":"모든 주문 수신"},{"order":2,"action":"순차 접수","expected":"접수 순서대로 목록 정렬"}]'::jsonb,
  '모든 주문 누락 없이 수신, 접수 순서대로 목록 정렬',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '동시 주문 처리' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '피크 시간 동시 다건 주문' AND product_id = p.id);

-- TC-S-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '배달앱별 주문 통합 관리',
  '복수 배달앱 주문이 하나의 화면에 통합 표시되는지 검증',
  '배민+쿠팡이츠+요기요 동시 주문',
  '[{"order":1,"action":"각 앱에서 주문 수신","expected":"주문 수신"},{"order":2,"action":"통합 주문 목록 확인","expected":"모든 배달앱 주문 통합 표시, 출처 구분"}]'::jsonb,
  '모든 배달앱 주문이 하나의 화면에 통합 표시, 출처 구분',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '동시 주문 처리' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달앱별 주문 통합 관리' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 주문 관리 > 픽업 주문 (2)
-- ============================================

-- TC-S-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '픽업 주문 접수',
  '픽업 주문 접수 시 태그 표시 및 구분 검증',
  '픽업 주문 수신',
  '[{"order":1,"action":"픽업 주문 확인","expected":"픽업 태그 표시"},{"order":2,"action":"접수","expected":"접수 완료"},{"order":3,"action":"준비 시간 설정","expected":"고객에게 준비 시간 알림"}]'::jsonb,
  '"픽업" 태그 표시, 배달 주문과 구분, 고객에게 준비 시간 알림',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '픽업 주문' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '픽업 주문 접수' AND product_id = p.id);

-- TC-S-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '픽업 가격 별도 설정',
  '메뉴별 픽업 가격 설정 시 고객앱에 다르게 표시되는지 검증',
  '메뉴 관리 화면',
  '[{"order":1,"action":"메뉴별 픽업 가격 설정","expected":"가격 설정"},{"order":2,"action":"저장","expected":"고객앱에서 픽업 가격이 배달 가격과 다르게 표시"}]'::jsonb,
  '고객앱에서 해당 메뉴의 픽업 가격이 배달 가격과 다르게 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '픽업 주문' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '픽업 가격 별도 설정' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 메뉴 관리 > 메뉴 CRUD (3)
-- ============================================

-- TC-S-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '메뉴 등록',
  '메뉴 등록 후 고객앱에 즉시 반영되는지 검증',
  '사장님 로그인',
  '[{"order":1,"action":"메뉴명/가격/사진/설명 입력","expected":"입력 완료"},{"order":2,"action":"카테고리 선택","expected":"카테고리 설정"},{"order":3,"action":"저장","expected":"메뉴 등록 완료, 고객앱에 즉시 반영"}]'::jsonb,
  '메뉴 등록 완료, 고객앱에 즉시 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 CRUD' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '메뉴 등록' AND product_id = p.id);

-- TC-S-010
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '메뉴 수정',
  '메뉴 가격 변경 시 고객앱 및 장바구니 반영 검증',
  '기존 메뉴 존재',
  '[{"order":1,"action":"메뉴 선택","expected":"메뉴 상세"},{"order":2,"action":"가격 변경","expected":"변경 입력"},{"order":3,"action":"저장","expected":"변경사항 즉시 반영, 장바구니 가격 갱신 여부 확인"}]'::jsonb,
  '변경사항 즉시 반영, 기존 장바구니의 해당 메뉴 가격 갱신 여부 확인',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 CRUD' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '메뉴 수정' AND product_id = p.id);

-- TC-S-011
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '메뉴 삭제',
  '메뉴 삭제 시 고객앱 반영 및 장바구니 처리 검증',
  '기존 메뉴 존재',
  '[{"order":1,"action":"메뉴 삭제","expected":"삭제 처리"},{"order":2,"action":"고객앱 확인","expected":"메뉴 목록에서 제거, 장바구니 해당 메뉴 판매 종료 처리"}]'::jsonb,
  '메뉴 목록에서 제거, 장바구니에 담긴 해당 메뉴 "판매 종료" 처리',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '메뉴 CRUD' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '메뉴 삭제' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 메뉴 관리 > 품절 처리 (2)
-- ============================================

-- TC-S-012
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '메뉴 품절 설정',
  '메뉴 품절 처리 시 고객앱에서 품절 표시 및 주문 차단 검증',
  '메뉴 존재',
  '[{"order":1,"action":"메뉴 품절 처리","expected":"품절 설정"},{"order":2,"action":"고객앱 확인","expected":"고객앱에서 품절 표시, 장바구니 담기 불가"}]'::jsonb,
  '고객앱에서 "품절" 표시, 장바구니 담기 불가',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '품절 처리' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '메뉴 품절 설정' AND product_id = p.id);

-- TC-S-013
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '품절 해제',
  '품절 해제 시 고객앱에서 정상 주문 가능 상태 복원 검증',
  '품절 상태 메뉴',
  '[{"order":1,"action":"품절 해제","expected":"품절 해제"},{"order":2,"action":"고객앱 확인","expected":"정상 주문 가능 상태로 복원"}]'::jsonb,
  '고객앱에서 정상 주문 가능 상태로 복원',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '품절 처리' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '품절 해제' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 메뉴 관리 > 옵션/가격 (2)
-- ============================================

-- TC-S-014
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '메뉴 옵션 그룹 추가',
  '옵션 그룹 생성 시 고객앱에서 가격 정확히 반영 검증',
  '메뉴 존재',
  '[{"order":1,"action":"옵션 그룹 생성(사이즈: S/M/L)","expected":"그룹 생성"},{"order":2,"action":"가격 차이 설정","expected":"가격 설정"},{"order":3,"action":"저장","expected":"고객앱에서 옵션 선택 시 가격 정확히 반영"}]'::jsonb,
  '고객앱에서 옵션 선택 시 가격 정확히 반영',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '옵션/가격' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '메뉴 옵션 그룹 추가' AND product_id = p.id);

-- TC-S-015
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id, l2.id]::BIGINT[],
  '필수/선택 옵션 구분',
  '필수 옵션 미선택 시 장바구니 담기 차단 검증',
  '메뉴에 옵션 존재',
  '[{"order":1,"action":"필수 옵션 미선택으로 담기 시도","expected":"필수 옵션 선택 필요 안내, 담기 차단"}]'::jsonb,
  '필수 옵션 선택 필요 안내, 담기 차단',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '메뉴 관리' AND l1.parent_id = root.id
JOIN segment l2 ON p.id = l2.product_id AND l2.name = '옵션/가격' AND l2.parent_id = l1.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '필수/선택 옵션 구분' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 매장 설정 (5) — L1 직접, path [root, l1]
-- ============================================

-- TC-S-016
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '영업시간 설정',
  '요일별 영업시간 설정 후 고객앱에서 영업 종료 표시 검증',
  '사장님 로그인',
  '[{"order":1,"action":"요일별 영업시간 설정","expected":"설정 입력"},{"order":2,"action":"저장","expected":"영업시간 외 고객앱에서 영업 종료 표시"}]'::jsonb,
  '영업시간 외 고객앱에서 "영업 종료" 표시',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 설정' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '영업시간 설정' AND product_id = p.id);

-- TC-S-017
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '임시 영업 중지',
  '임시 중지 설정 후 고객앱 표시 및 자동 재개 검증',
  '영업 중',
  '[{"order":1,"action":"임시 중지 설정","expected":"중지 설정"},{"order":2,"action":"중지 시간 선택","expected":"고객앱에서 잠시 쉬어가요 표시, 설정 시간 후 자동 재개"}]'::jsonb,
  '고객앱에서 "잠시 쉬어가요" 표시, 설정 시간 후 자동 재개',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 설정' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '임시 영업 중지' AND product_id = p.id);

-- TC-S-018
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달지역 설정',
  '배달 가능 반경 및 지역별 배달비 설정 후 고객앱 노출 검증',
  '사장님 로그인',
  '[{"order":1,"action":"배달 가능 반경 설정","expected":"반경 설정"},{"order":2,"action":"지역별 배달비 설정","expected":"고객앱에서 설정 지역 내 고객에게만 노출"}]'::jsonb,
  '고객앱에서 설정된 지역 내 고객에게만 노출',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 설정' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달지역 설정' AND product_id = p.id);

-- TC-S-019
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '최소주문금액 설정',
  '최소주문금액 설정 후 고객앱에서 미달 주문 차단 검증',
  '사장님 로그인',
  '[{"order":1,"action":"최소주문금액 설정","expected":"금액 설정"},{"order":2,"action":"저장","expected":"고객앱에서 해당 금액 미만 주문 시 차단"}]'::jsonb,
  '고객앱에서 해당 금액 미만 주문 시 차단',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 설정' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '최소주문금액 설정' AND product_id = p.id);

-- TC-S-020
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '휴무일 설정',
  '특정 날짜 휴무 설정 시 고객앱에서 휴무 표시 검증',
  '사장님 로그인',
  '[{"order":1,"action":"특정 날짜 휴무 설정","expected":"해당 날짜에 고객앱에서 휴무 표시, 주문 불가"}]'::jsonb,
  '해당 날짜에 고객앱에서 "휴무" 표시, 주문 불가',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매장 설정' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '휴무일 설정' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 정산/매출 (7) — L1 직접, path [root, l1]
-- ============================================

-- TC-S-021
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '일별 매출 통계 조회',
  '일별 매출 통계 정확성 검증',
  '당일 거래 존재',
  '[{"order":1,"action":"매출 통계 진입","expected":"통계 화면"},{"order":2,"action":"일별 탭 선택","expected":"주문건수, 총 매출, 취소 건수, 실매출 정확히 집계"}]'::jsonb,
  '주문건수, 총 매출, 취소 건수, 실매출 정확히 집계',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '일별 매출 통계 조회' AND product_id = p.id);

-- TC-S-022
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '월별 매출 통계 조회',
  '월별 매출 추이 그래프 및 전월 대비 증감 표시 검증',
  '월간 거래 존재',
  '[{"order":1,"action":"월별 탭 선택","expected":"월별 통계"},{"order":2,"action":"월 선택","expected":"월별 매출 추이 그래프, 전월 대비 증감 표시"}]'::jsonb,
  '월별 매출 추이 그래프, 전월 대비 증감 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '월별 매출 통계 조회' AND product_id = p.id);

-- TC-S-023
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달앱별 매출 분리',
  '플랫폼별 매출 분리 및 수수료 별도 계산 검증',
  '배민+쿠팡이츠 주문 존재',
  '[{"order":1,"action":"배달앱별 필터 적용","expected":"플랫폼별 매출 분리 표시, 수수료 별도 계산"}]'::jsonb,
  '플랫폼별 매출 분리 표시, 수수료 별도 계산',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달앱별 매출 분리' AND product_id = p.id);

-- TC-S-024
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '정산 내역 조회',
  '정산 금액 = 매출 - 수수료 - 배달비 항목별 상세 내역 검증',
  '정산 대상 거래 존재',
  '[{"order":1,"action":"정산 내역 탭 진입","expected":"정산 화면"},{"order":2,"action":"기간 선택","expected":"정산 금액 = 매출 - 수수료 - 배달비, 항목별 상세 내역"}]'::jsonb,
  '정산 금액 = 매출 - 수수료 - 배달비, 항목별 상세 내역',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정산 내역 조회' AND product_id = p.id);

-- TC-S-025
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '정산 금액 vs 실입금 비교',
  '정산 내역과 실제 입금액 일치 여부 검증',
  '정산 완료 건',
  '[{"order":1,"action":"정산 내역 확인","expected":"정산 내역"},{"order":2,"action":"통장 입금액 비교","expected":"정산 내역과 실제 입금액 일치"}]'::jsonb,
  '정산 내역과 실제 입금액 일치',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '정산 금액 vs 실입금 비교' AND product_id = p.id);

-- TC-S-026
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '오픈리스트 수수료 6.8% 확인',
  '오픈리스트 가입 매장의 수수료 6.8% 정확성 검증',
  '오픈리스트 가입 매장',
  '[{"order":1,"action":"정산 내역에서 수수료 확인","expected":"주문 금액의 6.8%가 수수료로 정확히 차감"}]'::jsonb,
  '주문 금액의 6.8%가 수수료로 정확히 차감',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오픈리스트 수수료 6.8% 확인' AND product_id = p.id);

-- TC-S-027
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배민1 수수료 매출 규모별 확인',
  '배민1 매출 규모별 차등 수수료(2%~9.8%) 정확성 검증',
  '배민1 가입 매장',
  '[{"order":1,"action":"정산 내역에서 수수료율 확인","expected":"매출 규모에 따라 2%~9.8% 차등 적용, 구간 정확"}]'::jsonb,
  '매출 규모에 따라 2%~9.8% 차등 적용, 구간 정확',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산/매출' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배민1 수수료 매출 규모별 확인' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 광고 관리 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-S-028
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '오픈리스트 가입',
  '오픈리스트 가입 후 고객앱 노출 시작 검증',
  '미가입 매장',
  '[{"order":1,"action":"오픈리스트 가입","expected":"가입 완료"},{"order":2,"action":"고객앱 노출 확인","expected":"고객앱 가게배달 목록에 노출 시작"}]'::jsonb,
  '가입 완료, 고객앱 가게배달 목록에 노출 시작',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '광고 관리' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오픈리스트 가입' AND product_id = p.id);

-- TC-S-029
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '오픈리스트 해지',
  '오픈리스트 해지 후 고객앱 목록에서 제거 검증',
  '가입 상태',
  '[{"order":1,"action":"오픈리스트 해지","expected":"해지 완료, 고객앱 가게배달 목록에서 제거"}]'::jsonb,
  '해지 완료, 고객앱 가게배달 목록에서 제거',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '광고 관리' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '오픈리스트 해지' AND product_id = p.id);

-- TC-S-030
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '매장 노출 순위 확인',
  '매장 노출 순위 조회 및 정보 표시 검증',
  '오픈리스트 가입',
  '[{"order":1,"action":"매장 노출 순위 조회","expected":"현재 순위, 주문 수/리뷰 수/거리 기반 순위 정보 표시"}]'::jsonb,
  '현재 노출 순위, 주문 수/리뷰 수/거리 기반 순위 정보 표시',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '광고 관리' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '매장 노출 순위 확인' AND product_id = p.id);

-- ============================================
-- 사장님앱 > 리뷰 관리 (2) — L1 직접, path [root, l1]
-- ============================================

-- TC-S-031
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '리뷰 답글 작성',
  '리뷰 답글 등록 후 고객앱에 표시 검증',
  '고객 리뷰 존재',
  '[{"order":1,"action":"리뷰 선택","expected":"리뷰 상세"},{"order":2,"action":"답글 작성","expected":"답글 입력"},{"order":3,"action":"등록","expected":"답글 등록, 고객앱에서 사장님 답글 표시"}]'::jsonb,
  '답글 등록, 고객앱에서 사장님 답글 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '리뷰 관리' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '리뷰 답글 작성' AND product_id = p.id);

-- TC-S-032
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '부적절 리뷰 신고',
  '부적절 리뷰 신고 접수 및 처리 결과 통보 검증',
  '비방/허위 리뷰 존재',
  '[{"order":1,"action":"리뷰 신고","expected":"신고 화면"},{"order":2,"action":"신고 사유 선택","expected":"신고 접수, 검토 후 삭제/유지 결과 통보"}]'::jsonb,
  '신고 접수, 검토 후 삭제/유지 결과 통보',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '사장님앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '리뷰 관리' AND l1.parent_id = root.id
WHERE p.name = '사장님앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '부적절 리뷰 신고' AND product_id = p.id);

-- ============================================
-- 10. TestCases — 배민오더 > QR오더 (7) — L1 직접, path [root, l1]
-- ============================================

-- TC-O-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR 스캔 — 메뉴 화면 진입',
  'QR 스캔 시 해당 매장 메뉴 화면 진입 및 테이블 매핑 검증',
  '테이블에 QR코드 부착',
  '[{"order":1,"action":"스마트폰으로 QR 스캔","expected":"해당 매장 메뉴 화면 진입, 테이블 번호 자동 매핑"}]'::jsonb,
  '해당 매장 메뉴 화면 진입, 테이블 번호 자동 매핑',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR 스캔 — 메뉴 화면 진입' AND product_id = p.id);

-- TC-O-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '잘못된 QR 스캔',
  '유효하지 않은 QR코드 스캔 시 오류 처리 검증',
  '유효하지 않은 QR코드',
  '[{"order":1,"action":"만료/위조 QR 스캔","expected":"유효하지 않은 QR코드입니다 오류, 매장 안내"}]'::jsonb,
  '"유효하지 않은 QR코드입니다" 오류, 매장 안내',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '잘못된 QR 스캔' AND product_id = p.id);

-- TC-O-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR오더 메뉴 선택 및 옵션',
  'QR 스캔 후 메뉴/옵션 선택 시 금액 정확 반영 검증',
  'QR 스캔 후 메뉴 화면',
  '[{"order":1,"action":"메뉴 선택","expected":"메뉴 상세"},{"order":2,"action":"옵션 선택","expected":"옵션 반영"},{"order":3,"action":"장바구니 담기","expected":"선택 항목 정확히 반영, 금액 계산 일치"}]'::jsonb,
  '선택 항목 정확히 반영, 금액 계산 일치',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR오더 메뉴 선택 및 옵션' AND product_id = p.id);

-- TC-O-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR오더 추가 주문 (같은 테이블)',
  '같은 테이블에서 추가 주문 시 POS 합산 처리 검증',
  '기존 주문 완료 상태',
  '[{"order":1,"action":"동일 QR 재스캔","expected":"메뉴 화면"},{"order":2,"action":"추가 메뉴 선택","expected":"메뉴 선택"},{"order":3,"action":"결제","expected":"같은 테이블 추가 주문으로 처리, POS에서 테이블 합산"}]'::jsonb,
  '같은 테이블의 추가 주문으로 처리, POS에서 테이블 합산',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR오더 추가 주문 (같은 테이블)' AND product_id = p.id);

-- TC-O-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR오더 선불 결제',
  '주문 시 즉시 선불 결제 후 POS 전달 검증',
  '메뉴 선택 완료',
  '[{"order":1,"action":"결제 수단 선택","expected":"결제 화면"},{"order":2,"action":"결제 완료","expected":"결제 완료 후 주문 POS 전달, 테이블에 주문 확인"}]'::jsonb,
  '결제 완료 후 주문 POS 전달, 테이블에 주문 확인',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR오더 선불 결제' AND product_id = p.id);

-- TC-O-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR오더 후불 결제',
  '후불 결제 매장에서 식사 후 별도 결제 프로세스 검증',
  '후불 결제 매장',
  '[{"order":1,"action":"메뉴 선택","expected":"메뉴 담기"},{"order":2,"action":"후불 결제 선택","expected":"주문 즉시 POS 전달"},{"order":3,"action":"식사 후 결제","expected":"별도 결제 프로세스 진행"}]'::jsonb,
  '주문 즉시 POS 전달, 식사 후 별도 결제 프로세스',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR오더 후불 결제' AND product_id = p.id);

-- TC-O-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR오더 분할 결제',
  'N명 분할 결제 시 각각 개별 결제 완료 검증',
  '주문 완료, 결제 단계',
  '[{"order":1,"action":"분할 결제 선택","expected":"분할 결제 화면"},{"order":2,"action":"인원수 입력","expected":"금액 분할"},{"order":3,"action":"각자 결제","expected":"총 금액 / N명, 각각 개별 결제 완료"}]'::jsonb,
  '총 금액 / N명, 각각 개별 결제 완료',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'QR오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR오더 분할 결제' AND product_id = p.id);

-- ============================================
-- 배민오더 > 태블릿오더 (6) — L1 직접, path [root, l1]
-- ============================================

-- TC-O-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 메뉴 탐색',
  '태블릿에서 카테고리별 메뉴 사진/설명/가격 표시 검증',
  '태블릿 정상 부팅',
  '[{"order":1,"action":"카테고리 탐색","expected":"카테고리별 메뉴 표시"},{"order":2,"action":"메뉴 상세 확인","expected":"메뉴 사진/설명/가격 표시, 카테고리별 정렬"}]'::jsonb,
  '메뉴 사진/설명/가격 표시, 카테고리별 정렬',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 메뉴 탐색' AND product_id = p.id);

-- TC-O-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 다국어 전환',
  '태블릿 다국어 전환 시 메뉴명/설명 언어 변경 검증',
  '태블릿 정상 작동',
  '[{"order":1,"action":"언어 선택 (영어/중국어/일본어)","expected":"언어 변경"},{"order":2,"action":"메뉴 확인","expected":"메뉴명/설명이 선택 언어로 표시"}]'::jsonb,
  '메뉴명/설명이 선택 언어로 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 다국어 전환' AND product_id = p.id);

-- TC-O-010
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 주문 정상 플로우',
  '태블릿 주문 전체 플로우 및 POS 즉시 전달 검증',
  '태블릿 정상 작동',
  '[{"order":1,"action":"메뉴 선택","expected":"메뉴 담기"},{"order":2,"action":"수량 설정","expected":"수량 반영"},{"order":3,"action":"주문 완료","expected":"주문 완료 확인 화면, POS에 즉시 전달"}]'::jsonb,
  '주문 완료 확인 화면, POS에 즉시 전달',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 주문 정상 플로우' AND product_id = p.id);

-- TC-O-011
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 추가 주문',
  '기존 주문에 추가 주문 시 POS 테이블 합산 검증',
  '기존 주문 존재',
  '[{"order":1,"action":"추가 메뉴 선택","expected":"메뉴 담기"},{"order":2,"action":"주문","expected":"기존 주문에 추가, POS에서 테이블 합산"}]'::jsonb,
  '기존 주문에 추가, POS에서 테이블 합산',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 추가 주문' AND product_id = p.id);

-- TC-O-012
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 결제 (카드)',
  '태블릿 카드 결제 및 영수증 옵션 검증',
  '주문 완료',
  '[{"order":1,"action":"카드 결제 선택","expected":"결제 화면"},{"order":2,"action":"카드 삽입/태그","expected":"결제 완료, 영수증 옵션(전자/종이)"}]'::jsonb,
  '결제 완료, 영수증 옵션(전자/종이)',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 결제 (카드)' AND product_id = p.id);

-- TC-O-013
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '태블릿 대기 화면 복귀',
  '일정 시간 미조작 시 대기 화면 자동 복귀 및 주문 초기화 검증',
  '태블릿 조작 중',
  '[{"order":1,"action":"일정 시간(2분) 미조작","expected":"대기 화면으로 자동 복귀, 미완료 주문 초기화"}]'::jsonb,
  '대기 화면으로 자동 복귀, 미완료 주문 초기화',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '태블릿오더' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '태블릿 대기 화면 복귀' AND product_id = p.id);

-- ============================================
-- 배민오더 > POS 연동 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-O-014
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'QR/태블릿 주문 → POS 수신',
  'QR/태블릿 주문이 POS에 즉시 정확히 수신되는지 검증',
  '주문 발생',
  '[{"order":1,"action":"QR 또는 태블릿에서 주문","expected":"주문 발생"},{"order":2,"action":"POS 확인","expected":"POS에 주문 즉시 수신, 테이블 번호/메뉴/금액 정확"}]'::jsonb,
  'POS에 주문 즉시 수신, 테이블 번호/메뉴/금액 정확',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'POS 연동' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'QR/태블릿 주문 → POS 수신' AND product_id = p.id);

-- TC-O-015
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'POS 품절 → QR/태블릿 반영',
  'POS에서 품절 처리 시 QR/태블릿에 즉시 반영 검증',
  'POS에서 메뉴 품절 설정',
  '[{"order":1,"action":"POS에서 품절 처리","expected":"품절 설정"},{"order":2,"action":"QR/태블릿 메뉴 확인","expected":"품절 메뉴 즉시 품절 표시, 주문 불가"}]'::jsonb,
  '품절 메뉴 즉시 "품절" 표시, 주문 불가',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'POS 연동' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'POS 품절 → QR/태블릿 반영' AND product_id = p.id);

-- TC-O-016
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'POS 주문 취소',
  'POS에서 주문 취소 시 고객 알림 및 환불 처리 검증',
  'QR/태블릿 주문 수신',
  '[{"order":1,"action":"POS에서 주문 취소","expected":"고객에게 취소 알림, 결제 완료 건 환불 처리"}]'::jsonb,
  '고객에게 취소 알림, 결제 완료 건 환불 처리',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = 'POS 연동' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'POS 주문 취소' AND product_id = p.id);

-- ============================================
-- 배민오더 > 비기능 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-O-017
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '네트워크 끊김 시 태블릿 동작',
  '네트워크 차단 시 안내 표시 및 재연결 후 자동 복구 검증',
  '정상 연결 상태',
  '[{"order":1,"action":"네트워크 차단","expected":"네트워크 연결 확인 안내"},{"order":2,"action":"주문 시도","expected":"네트워크 연결을 확인해주세요 안내, 재연결 시 자동 복구"}]'::jsonb,
  '"네트워크 연결을 확인해주세요" 안내, 재연결 시 자동 복구',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '네트워크 끊김 시 태블릿 동작' AND product_id = p.id);

-- TC-O-018
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '네트워크 복구 후 미전송 주문 처리',
  '네트워크 단절 중 발생 주문이 복구 후 POS에 자동 전송되는지 검증',
  '네트워크 단절 중 주문 발생',
  '[{"order":1,"action":"네트워크 복구","expected":"단절 중 발생 주문이 POS에 자동 전송, 누락 없음"}]'::jsonb,
  '단절 중 발생 주문이 POS에 자동 전송, 누락 없음',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '네트워크 복구 후 미전송 주문 처리' AND product_id = p.id);

-- TC-O-019
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '동시 주문 — 같은 테이블 2명',
  '같은 테이블에서 2명이 동시 주문 시 POS 합산 처리 검증',
  '같은 테이블 QR 동시 스캔',
  '[{"order":1,"action":"고객A, 고객B 동시 주문","expected":"두 주문 모두 POS 수신, 테이블 합산 처리"}]'::jsonb,
  '두 주문 모두 POS 수신, 테이블 합산 처리',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '배민오더' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '배민오더' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '동시 주문 — 같은 테이블 2명' AND product_id = p.id);

-- ============================================
-- 11. TestCases — 라이더앱 > 배달 배정 (7) — L1 직접, path [root, l1]
-- ============================================

-- TC-R-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 배정 수락',
  '배달 배정 수락 시 배달 정보 표시 및 네비게이션 안내 검증',
  '배달 가능 상태',
  '[{"order":1,"action":"배정 알림 수신","expected":"알림 수신"},{"order":2,"action":"배달 정보 확인","expected":"매장, 배달지, 예상 거리/시간 표시"},{"order":3,"action":"수락","expected":"수락 후 네비게이션 안내"}]'::jsonb,
  '배달 정보(매장, 배달지, 예상 거리/시간) 표시, 수락 후 네비게이션 안내',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 배정 수락' AND product_id = p.id);

-- TC-R-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 배정 거절',
  '배달 거절 시 재배정 및 거절 이력 기록 검증',
  '배정 알림 수신',
  '[{"order":1,"action":"거절 사유 선택","expected":"사유 선택"},{"order":2,"action":"거절","expected":"다른 라이더에게 재배정, 거절 이력 기록"}]'::jsonb,
  '다른 라이더에게 재배정, 거절 이력 기록',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 배정 거절' AND product_id = p.id);

-- TC-R-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배정 타임아웃',
  '제한 시간 내 미응답 시 자동 재배정 검증',
  '배정 알림 수신',
  '[{"order":1,"action":"제한 시간 내 미응답","expected":"자동 다음 라이더에게 재배정"}]'::jsonb,
  '자동 다음 라이더에게 재배정',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배정 타임아웃' AND product_id = p.id);

-- TC-R-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'AI 추천배차 — 최적 경로',
  'AI 추천배차의 최적 경로 및 예상 수입 표시 검증',
  '다건 배달 가능 상태',
  '[{"order":1,"action":"AI가 추천한 배달 건 확인","expected":"현재 위치/방향 기반 최적 배달 건 추천, 예상 수입 표시"}]'::jsonb,
  '현재 위치/방향 기반 최적 배달 건 추천, 예상 수입 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'AI 추천배차 — 최적 경로' AND product_id = p.id);

-- TC-R-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'AI 추천배차 — 안전 경로',
  '사고 다발 구간 우회 경로 제안 및 안전 경고 검증',
  '사고 다발 구간 포함 경로',
  '[{"order":1,"action":"배정 수락","expected":"수락"},{"order":2,"action":"경로 확인","expected":"사고 다발 구간 우회 경로 제안, 안전 경고 표시"}]'::jsonb,
  '사고 다발 구간 우회 경로 제안, 안전 경고 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'AI 추천배차 — 안전 경로' AND product_id = p.id);

-- TC-R-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '알뜰배달 묶음 배정',
  '근접 2건 묶음 배달 시 최적화 순서 및 총 예상 시간 검증',
  '근접 배달 2건 이상',
  '[{"order":1,"action":"묶음 배달 배정 알림","expected":"묶음 배정 알림"},{"order":2,"action":"배달 순서 확인","expected":"픽업 순서/배달 순서 최적화 표시, 총 예상 시간 안내"}]'::jsonb,
  '픽업 순서/배달 순서 최적화 표시, 총 예상 시간 안내',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '알뜰배달 묶음 배정' AND product_id = p.id);

-- TC-R-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '묶음배달 중 추가 배정',
  '배달 중 추가 배정 수락 시 경로 재계산 및 영향도 검증',
  '1건 배달 중',
  '[{"order":1,"action":"근접 추가 배달 배정 알림","expected":"추가 배정 알림"},{"order":2,"action":"수락/거절","expected":"추가 수락 시 경로 재계산, 기존 배달 예상 시간 영향도 표시"}]'::jsonb,
  '추가 수락 시 경로 재계산, 기존 배달 예상 시간 영향도 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 배정' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '묶음배달 중 추가 배정' AND product_id = p.id);

-- ============================================
-- 라이더앱 > 배달 수행 (6) — L1 직접, path [root, l1]
-- ============================================

-- TC-R-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '매장 도착 — 픽업 처리',
  '매장 도착 후 픽업 완료 시 상태 변경 및 고객 알림 검증',
  '매장으로 이동 중',
  '[{"order":1,"action":"매장 도착","expected":"도착 확인"},{"order":2,"action":"픽업 완료 처리","expected":"상태 픽업완료로 변경, 고객앱에 배달 중 알림"}]'::jsonb,
  '상태 "픽업완료"로 변경, 고객앱에 "배달 중" 알림',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '매장 도착 — 픽업 처리' AND product_id = p.id);

-- TC-R-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '음식 미준비 시 대기',
  '매장 도착 후 음식 미준비 시 대기 시간 기록 및 추가 배달비 검증',
  '매장 도착',
  '[{"order":1,"action":"음식 미준비 확인","expected":"미준비 확인"},{"order":2,"action":"대기 중 상태 설정","expected":"대기 시간 기록, 일정 시간 초과 시 추가 배달비 적용 여부"}]'::jsonb,
  '대기 시간 기록, 일정 시간 초과 시 추가 배달비 적용 여부',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '음식 미준비 시 대기' AND product_id = p.id);

-- TC-R-010
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달지 도착 — 배달 완료',
  '배달 완료 시 고객 알림 및 배달비 정산 검증',
  '배달지로 이동 중',
  '[{"order":1,"action":"배달지 도착","expected":"도착 확인"},{"order":2,"action":"배달 완료 처리","expected":"고객앱에 배달 완료 알림, 배달비 정산"}]'::jsonb,
  '고객앱에 "배달 완료" 알림, 배달비 정산',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달지 도착 — 배달 완료' AND product_id = p.id);

-- TC-R-011
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달지 부재 시 처리',
  '고객 부재 시 알림 및 대기 후 처리 방법 안내 검증',
  '배달지 도착, 고객 부재',
  '[{"order":1,"action":"고객 연락 시도","expected":"연락 시도"},{"order":2,"action":"부재 중 처리","expected":"고객에게 알림, 대기 시간 후 처리 방법 안내(문앞 배달/반송)"}]'::jsonb,
  '고객에게 알림, 대기 시간 후 처리 방법 안내 (문앞 배달/반송)',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달지 부재 시 처리' AND product_id = p.id);

-- TC-R-012
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 중 사고/문제 발생',
  '배달 중 문제 발생 보고 시 CS 전달 및 지연 알림 검증',
  '배달 수행 중',
  '[{"order":1,"action":"문제 발생 보고","expected":"보고 접수"},{"order":2,"action":"상세 사유 입력","expected":"CS팀에 즉시 전달, 고객/사장님에게 지연 알림"}]'::jsonb,
  'CS팀에 즉시 전달, 고객/사장님에게 지연 알림',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 중 사고/문제 발생' AND product_id = p.id);

-- TC-R-013
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '배달 완료 사진 촬영',
  '문앞 배달 시 완료 사진 촬영 및 고객 확인 가능 검증',
  '문앞 배달',
  '[{"order":1,"action":"음식 배달","expected":"배달 완료"},{"order":2,"action":"배달 완료 사진 촬영","expected":"사진 저장"},{"order":3,"action":"완료 처리","expected":"사진 저장, 고객앱에서 배달 완료 사진 확인 가능"}]'::jsonb,
  '사진 저장, 고객앱에서 배달 완료 사진 확인 가능',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달 수행' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '배달 완료 사진 촬영' AND product_id = p.id);

-- ============================================
-- 라이더앱 > 정산 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-R-014
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '건별 배달비 확인',
  '배달 완료 건별 배달비 및 할증 내역 정확성 검증',
  '배달 완료 건 존재',
  '[{"order":1,"action":"배달 이력 확인","expected":"건별 배달비, 거리/시간/할증 내역 정확히 표시"}]'::jsonb,
  '건별 배달비, 거리/시간/할증 내역 정확히 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '건별 배달비 확인' AND product_id = p.id);

-- TC-R-015
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '일별 수입 통계',
  '당일 총 배달 건수, 총 수입, 평균 건당 수입 정확성 검증',
  '당일 배달 완료',
  '[{"order":1,"action":"수입 통계 확인","expected":"총 배달 건수, 총 수입, 평균 건당 수입 표시"}]'::jsonb,
  '총 배달 건수, 총 수입, 평균 건당 수입 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '일별 수입 통계' AND product_id = p.id);

-- TC-R-016
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '주간/월간 정산 내역',
  '정산 금액 = 배달비 합계 - 수수료 및 입금 예정일 정확성 검증',
  '정산 대상 건 존재',
  '[{"order":1,"action":"정산 내역 조회","expected":"정산 금액 = 배달비 합계 - 수수료, 입금 예정일 표시"}]'::jsonb,
  '정산 금액 = 배달비 합계 - 수수료, 입금 예정일 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '정산' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '주간/월간 정산 내역' AND product_id = p.id);

-- ============================================
-- 라이더앱 > 비기능 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-R-017
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'GPS 위치 정확도',
  '앱 GPS 위치 오차 10m 이내 및 고객앱 반영 정확도 검증',
  '배달 수행 중',
  '[{"order":1,"action":"앱 지도와 실제 위치 비교","expected":"GPS 위치 오차 10m 이내, 고객앱 지도에 정확히 반영"}]'::jsonb,
  'GPS 위치 오차 10m 이내, 고객앱 지도에 정확히 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'GPS 위치 정확도' AND product_id = p.id);

-- TC-R-018
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '네비게이션 경로 안내',
  '실시간 교통 반영 최적 경로 안내 및 도착 예상 시간 검증',
  '배달 수락',
  '[{"order":1,"action":"매장/배달지 네비게이션 시작","expected":"실시간 교통 반영 최적 경로 안내, 도착 예상 시간 정확"}]'::jsonb,
  '실시간 교통 반영 최적 경로 안내, 도착 예상 시간 정확',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '네비게이션 경로 안내' AND product_id = p.id);

-- TC-R-019
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '연속 배달 시 앱 안정성',
  '8시간 연속 배달 후 메모리 누수, GPS, 배터리 소모 검증',
  '8시간 연속 배달',
  '[{"order":1,"action":"장시간 앱 사용 후 기능 확인","expected":"메모리 누수 없음, GPS 정확도 유지, 배터리 소모 합리적"}]'::jsonb,
  '메모리 누수 없음, GPS 정확도 유지, 배터리 소모 합리적',
  'MEDIUM', 'REGRESSION', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = '라이더앱' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '비기능' AND l1.parent_id = root.id
WHERE p.name = '라이더앱' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '연속 배달 시 앱 안정성' AND product_id = p.id);

-- ============================================
-- 12. TestCases — B마트 > 상품 탐색 (4) — L1 직접, path [root, l1]
-- ============================================

-- TC-B-001
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '카테고리별 상품 탐색',
  '카테고리 선택 시 상품 정렬 및 가격/할인 정보 표시 검증',
  'B마트 진입',
  '[{"order":1,"action":"카테고리 선택 (간식/음료/생활용품)","expected":"카테고리별 상품 표시"},{"order":2,"action":"상품 목록 확인","expected":"카테고리별 상품 정렬, 가격/할인 정보 표시"}]'::jsonb,
  '카테고리별 상품 정렬, 가격/할인 정보 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 탐색' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '카테고리별 상품 탐색' AND product_id = p.id);

-- TC-B-002
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '인기 상품/추천 상품',
  'B마트 메인 화면 인기/할인/추천 상품 섹션 노출 검증',
  'B마트 메인',
  '[{"order":1,"action":"메인 화면 확인","expected":"인기 상품, 할인 상품, 추천 상품 섹션 노출"}]'::jsonb,
  '인기 상품, 할인 상품, 추천 상품 섹션 노출',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 탐색' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '인기 상품/추천 상품' AND product_id = p.id);

-- TC-B-003
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 상품 검색',
  '상품명 검색 시 일치 상품 및 유사 상품 추천 검증',
  'B마트 진입',
  '[{"order":1,"action":"상품명 검색","expected":"검색 실행"},{"order":2,"action":"결과 확인","expected":"검색어 일치 상품 목록, 유사 상품 추천"}]'::jsonb,
  '검색어 일치 상품 목록, 유사 상품 추천',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 탐색' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 상품 검색' AND product_id = p.id);

-- TC-B-004
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '상품 상세 — 가격/설명/이미지',
  '상품 상세 화면에서 이미지/가격/설명/원산지/영양정보 표시 검증',
  '상품 목록',
  '[{"order":1,"action":"상품 선택","expected":"상세 화면"},{"order":2,"action":"상세 화면 확인","expected":"상품 이미지, 가격, 설명, 원산지, 영양정보 정확 표시"}]'::jsonb,
  '상품 이미지, 가격, 설명, 원산지, 영양정보 정확 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 탐색' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '상품 상세 — 가격/설명/이미지' AND product_id = p.id);

-- ============================================
-- B마트 > 주문 (5) — L1 직접, path [root, l1]
-- ============================================

-- TC-B-005
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 정상 주문 플로우',
  'B마트 주문 전체 플로우 및 30분 배달 표시 검증',
  '배달 가능 지역',
  '[{"order":1,"action":"상품 담기","expected":"장바구니 반영"},{"order":2,"action":"장바구니 확인","expected":"상품/금액 확인"},{"order":3,"action":"결제","expected":"주문 완료, 예상 배달 시간 30분 내외 표시"}]'::jsonb,
  '주문 완료, 예상 배달 시간 30분 내외 표시',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 정상 주문 플로우' AND product_id = p.id);

-- TC-B-006
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 복수 상품 주문',
  '여러 상품 주문 시 수량/금액 정확성 및 배달비 합산 검증',
  'B마트 진입',
  '[{"order":1,"action":"여러 상품 담기","expected":"장바구니 반영"},{"order":2,"action":"수량 변경","expected":"수량 반영"},{"order":3,"action":"결제","expected":"각 상품 수량/금액 정확, 배달비 합산 계산"}]'::jsonb,
  '각 상품 수량/금액 정확, 배달비 합산 계산',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 복수 상품 주문' AND product_id = p.id);

-- TC-B-007
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 장바구니 상품 재고 소진',
  '장바구니 상품 재고 소진 시 결제 차단 및 대체 상품 추천 검증',
  '상품 담은 후 시간 경과',
  '[{"order":1,"action":"결제 시도","expected":"재고 부족 안내, 해당 상품 제거, 대체 상품 추천"}]'::jsonb,
  '"재고 부족" 안내, 해당 상품 제거, 대체 상품 추천',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 장바구니 상품 재고 소진' AND product_id = p.id);

-- TC-B-008
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 부분 재고 부족',
  '복수 상품 중 일부 품절 시 나머지 주문 진행 옵션 검증',
  '3개 상품 주문, 1개 품절',
  '[{"order":1,"action":"결제 시도","expected":"품절 상품 알림, 나머지 상품만 주문 진행 옵션 제공"}]'::jsonb,
  '품절 상품 알림, 나머지 상품만 주문 진행 옵션 제공',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 부분 재고 부족' AND product_id = p.id);

-- TC-B-009
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 최소주문금액 미달',
  '최소주문금액 미달 시 안내 및 추가 상품 추천 검증',
  '장바구니 금액 < 최소금액',
  '[{"order":1,"action":"결제 시도","expected":"최소주문금액 안내, 추가 상품 추천"}]'::jsonb,
  '최소주문금액 안내, 추가 상품 추천',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 최소주문금액 미달' AND product_id = p.id);

-- ============================================
-- B마트 > 배달 (5) — L1 직접, path [root, l1]
-- ============================================

-- TC-B-010
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 30분 배달 SLA 확인',
  'B마트 주문 후 30분 내외 배달 완료 및 지연 알림 검증',
  'B마트 주문 완료',
  '[{"order":1,"action":"주문","expected":"주문 완료"},{"order":2,"action":"배달 시간 추적","expected":"30분 내외 배달 완료, 지연 시 알림"}]'::jsonb,
  '30분 내외 배달 완료, 지연 시 알림',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 30분 배달 SLA 확인' AND product_id = p.id);

-- TC-B-011
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  'B마트 배달 상태 추적',
  '포장중→배달중→도착예정→완료 상태 전이 실시간 반영 검증',
  '주문 완료',
  '[{"order":1,"action":"주문 상세 확인","expected":"포장중→배달중→도착예정→완료 상태 전이 실시간 반영"}]'::jsonb,
  '포장중→배달중→도착예정→완료 상태 전이 실시간 반영',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'B마트 배달 상태 추적' AND product_id = p.id);

-- TC-B-012
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '딜리 로봇배달 — 정상 수령',
  '딜리 로봇배달 도착 알림, 수령 코드 입력, 상품 수령 전체 플로우 검증',
  '강남 로봇배달 가능 지역',
  '[{"order":1,"action":"주문","expected":"주문 완료"},{"order":2,"action":"로봇배달 배정","expected":"로봇 배정"},{"order":3,"action":"건물 입구 도착 알림","expected":"도착 알림"},{"order":4,"action":"로봇에서 상품 수령","expected":"수령 코드 입력 후 적재함 열림, 상품 수령 완료"}]'::jsonb,
  '로봇 도착 알림, 수령 코드 입력 후 적재함 열림, 상품 수령 완료',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '딜리 로봇배달 — 정상 수령' AND product_id = p.id);

-- TC-B-013
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '딜리 로봇배달 — 수령 미완료',
  '로봇 도착 후 고객 부재 시 재알림 및 반송 처리 검증',
  '로봇 도착, 고객 부재',
  '[{"order":1,"action":"로봇 도착","expected":"도착 알림"},{"order":2,"action":"제한 시간 내 미수령","expected":"고객에게 재알림, 제한 시간 초과 시 반송 또는 CS 처리"}]'::jsonb,
  '고객에게 재알림, 제한 시간 초과 시 반송 또는 CS 처리',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '딜리 로봇배달 — 수령 미완료' AND product_id = p.id);

-- TC-B-014
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '딜리 로봇배달 — 경로 장애물',
  '로봇 이동 경로 장애물 자동 감지 및 우회, 지연 알림 검증',
  '로봇 배달 수행 중',
  '[{"order":1,"action":"로봇 이동 경로에 장애물 발생","expected":"장애물 자동 감지 및 우회, 배달 지연 알림"}]'::jsonb,
  '장애물 자동 감지 및 우회, 배달 지연 알림',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '배달' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '딜리 로봇배달 — 경로 장애물' AND product_id = p.id);

-- ============================================
-- B마트 > 특화 기능 (3) — L1 직접, path [root, l1]
-- ============================================

-- TC-B-015
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '전통주 즉시배송 주문',
  '전통주 성인 인증 후 주문 가능 및 미인증 시 차단 검증',
  '서울/인천/경기 지역',
  '[{"order":1,"action":"전통주 카테고리 진입","expected":"전통주 카테고리"},{"order":2,"action":"주류 선택","expected":"주류 선택"},{"order":3,"action":"성인 인증","expected":"인증 완료"},{"order":4,"action":"결제","expected":"성인 인증 완료 후 주문 가능, 미인증 시 차단"}]'::jsonb,
  '성인 인증 완료 후 주문 가능, 미인증 시 차단',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '특화 기능' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '전통주 즉시배송 주문' AND product_id = p.id);

-- TC-B-016
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '전통주 미성년자 차단',
  '미성년자 계정 전통주 주문 시 차단 검증',
  '미성년자 계정',
  '[{"order":1,"action":"전통주 주문 시도","expected":"성인 인증 실패, 주문 불가"}]'::jsonb,
  '성인 인증 실패, 주문 불가',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '특화 기능' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '전통주 미성년자 차단' AND product_id = p.id);

-- TC-B-017
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[root.id, l1.id]::BIGINT[],
  '신선식품 품질 이슈 반품',
  '신선식품 품질 불만 신고 시 반품/환불 처리 검증',
  '신선식품 배달 완료',
  '[{"order":1,"action":"품질 불만 신고","expected":"신고 화면"},{"order":2,"action":"사진 첨부","expected":"사진 첨부"},{"order":3,"action":"반품 요청","expected":"반품 접수, 환불 처리, CS 연결 안내"}]'::jsonb,
  '반품 접수, 환불 처리, CS 연결 안내',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p JOIN company c ON p.company_id = c.id
JOIN segment root ON p.id = root.product_id AND root.name = 'B마트' AND root.parent_id IS NULL
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '특화 기능' AND l1.parent_id = root.id
WHERE p.name = 'B마트' AND c.name = '배달의민족'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '신선식품 품질 이슈 반품' AND product_id = p.id);
