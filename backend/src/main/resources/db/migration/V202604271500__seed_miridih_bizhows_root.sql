-- V202604271500: Seed Miridih Company + Bizhows Product + Bizhows Root Segment
--
-- 목적: 미리디 비즈하우스 포트폴리오 작업의 DB 골격 추가
--   - Company: Miridih (is_active=false, my-atlas와 공존)
--   - Product: Bizhows (Miridih 산하, WEB)
--   - Segment Root: Bizhows (Bizhows Product 산하, parent_id=NULL)
--
-- 후속: Phase A~L의 Segment L1/L2 + TestCase는 이후 마이그레이션에서 단계적으로 추가한다.
--   참조: docs/qa/portfolio/miridih/phase_a.md
--
-- 멱등성: 모든 INSERT는 NOT EXISTS 가드로 보호한다 (V7 패턴 동일).

-- ============================================
-- 1. Company 삽입 (Miridih)
-- ============================================
INSERT INTO company (name, is_active)
SELECT 'Miridih', false
WHERE NOT EXISTS (SELECT 1 FROM company WHERE name = 'Miridih');

-- ============================================
-- 2. Product 삽입 (Bizhows)
-- ============================================
INSERT INTO product (company_id, name, platform, description)
SELECT
  c.id,
  'Bizhows',
  'WEB',
  '미리디 산하 POD 인쇄 커머스 플랫폼. 회원/디자인/주문/결제/제작/배송 전 과정의 QA 대상.'
FROM company c
WHERE c.name = 'Miridih'
  AND NOT EXISTS (
    SELECT 1 FROM product p
    WHERE p.name = 'Bizhows' AND p.company_id = c.id
  );

-- ============================================
-- 3. Segment Root 삽입 (Bizhows)
-- ============================================
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Bizhows', NULL
FROM product p
JOIN company c ON p.company_id = c.id
WHERE c.name = 'Miridih'
  AND p.name = 'Bizhows'
  AND NOT EXISTS (
    SELECT 1 FROM segment s
    WHERE s.product_id = p.id
      AND s.parent_id IS NULL
      AND s.name = 'Bizhows'
  );
