-- V7: Seed TestCase v1 - Product Test Suite 기능 테스트 데이터 (수정)
-- Product Test Suite 기능(3단계 드릴다운)에 대한 22개 TestCase 데이터 삽입
-- 경로(path)는 정확한 3단계 계층 구조를 반영

-- ============================================
-- 1. Company 삽입 (my-atlas)
-- ============================================
INSERT INTO company (name, is_active)
SELECT 'my-atlas', false
WHERE NOT EXISTS (SELECT 1 FROM company WHERE name = 'my-atlas');

-- ============================================
-- 2. Product 삽입 (Product Test Suite)
-- ============================================
INSERT INTO product (company_id, name, platform, description)
SELECT
  c.id,
  'Product Test Suite',
  'WEB',
  'Product Test Suite 기능의 통합 테스트를 위한 Product'
FROM company c
WHERE c.name = 'my-atlas'
  AND NOT EXISTS (
    SELECT 1 FROM product p
    WHERE p.name = 'Product Test Suite' AND p.company_id = c.id
  );

-- ============================================
-- 3. Segment 트리 삽입 (계층 구조)
-- ============================================

-- Root: Product Test Suite
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Product Test Suite', NULL
FROM product p
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (
    SELECT 1 FROM segment s
    WHERE s.name = 'Product Test Suite' AND s.parent_id IS NULL
  );

-- L1-1: Company 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Company 관리', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product Test Suite'
  AND s.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Company 관리'
  );

-- L1-2: Product 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Product 관리', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product Test Suite'
  AND s.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Product 관리'
  );

-- L1-3: Segment 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Segment 관리', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product Test Suite'
  AND s.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Segment 관리'
  );

-- L1-4: TestCase 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'TestCase 관리', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product Test Suite'
  AND s.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'TestCase 관리'
  );

-- L2-1: Company CRUD
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Company CRUD', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Company 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Company CRUD'
  );

-- L2-2: Company 검색
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Company 검색', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Company 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Company 검색'
  );

-- L2-3: Company 정렬
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Company 정렬', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Company 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Company 정렬'
  );

-- L2-4: Product CRUD
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Product CRUD', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Product CRUD'
  );

-- L2-5: Product 검색
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Product 검색', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Product 검색'
  );

-- L2-6: Product 정렬
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Product 정렬', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Product 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Product 정렬'
  );

-- L2-7: Segment CRUD
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'Segment CRUD', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'Segment 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'Segment CRUD'
  );

-- L2-8: TestCase CRUD
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'TestCase CRUD', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'TestCase 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'TestCase CRUD'
  );

-- L2-9: TestCase 필터링
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'TestCase 필터링', s.id
FROM product p
JOIN segment s ON p.id = s.product_id
WHERE p.name = 'Product Test Suite'
  AND s.name = 'TestCase 관리'
  AND NOT EXISTS (
    SELECT 1 FROM segment WHERE name = 'TestCase 필터링'
  );

-- ============================================
-- 4. TestCase 데이터 삽입 (22개) - 정확한 3단계 path
-- ============================================

-- TC-01: Company 신규 등록
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 신규 등록',
  'Product Test Suite UI에서 새로운 Company를 등록할 수 있는지 확인',
  'Product Test Suite UI에 접속 완료, Company 목록 페이지 확인',
  '[{"order": 1, "action": "\"Add New\" 버튼 클릭", "expected": "CompanyFormModal 열림"}, {"order": 2, "action": "Company 이름 입력 (예: \"TestCo\")", "expected": "텍스트 입력 완료"}, {"order": 3, "action": "\"Create\" 버튼 클릭", "expected": "Company 목록에 \"TestCo\" 추가 확인, 모달 닫힘"}]'::jsonb,
  '새 Company가 DB에 저장되고, 목록에 표시됨',
  'HIGH', 'SMOKE', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 신규 등록');

-- TC-02: Company 활성화
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 활성화',
  'Company를 활성화하면 한 시점에 최대 1개만 활성화 상태 유지',
  '최소 2개 이상의 Company가 등록됨, Product Test Suite UI에 접속 완료',
  '[{"order": 1, "action": "첫 번째 Company 카드의 \"Activate\" 버튼 클릭", "expected": "isActive 플래그 true로 변경, 카드 강조 표시"}, {"order": 2, "action": "다른 Company의 \"Activate\" 버튼 클릭", "expected": "이전 활성 Company는 비활성화, 새로운 Company만 활성화"}]'::jsonb,
  '한 시점에 최대 1개 Company만 활성화 상태 유지',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 활성화');

-- TC-03: Company 삭제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 삭제',
  'Company를 삭제하면 연관된 Product도 함께 삭제됨',
  'Product이 없는 Company 존재, Company 목록 페이지 열림',
  '[{"order": 1, "action": "Company 카드의 Delete 버튼 클릭", "expected": "확인 다이얼로그 표시"}, {"order": 2, "action": "확인 다이얼로그에서 \"Delete\" 선택", "expected": "Company 목록에서 제거됨"}]'::jsonb,
  'Company와 연관된 Product 모두 삭제됨 (CASCADE)',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 삭제');

-- TC-04: Company 이름 검색 — 일치
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 이름 검색 — 일치',
  'Company 검색 기능이 정상 작동하는지 확인',
  '\"TestCo\", \"AnotherCorp\", \"DevTeam\" 등 다양한 Company 존재, Company 목록 페이지 열림',
  '[{"order": 1, "action": "검색 입력창에 \"TestCo\" 입력", "expected": "Company 목록이 실시간 필터링됨, \"TestCo\"만 표시"}, {"order": 2, "action": "검색창을 비우기", "expected": "전체 Company 목록 복원"}]'::jsonb,
  '검색어에 부분 일치하는 Company만 표시',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company 검색' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 이름 검색 — 일치');

-- TC-05: Company 이름 검색 — 결과 없음
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 이름 검색 — 결과 없음',
  '검색 결과가 없을 때 사용자에게 명확한 메시지 전달',
  'Company 목록 페이지 열림',
  '[{"order": 1, "action": "검색 입력창에 존재하지 않는 이름 입력 (예: \"xyz123\")", "expected": "목록 비어 있음, \"No companies found\" 메시지 표시"}]'::jsonb,
  '검색 결과가 없을 때 명확한 메시지 표시',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company 검색' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 이름 검색 — 결과 없음');

-- TC-06: Company 이름순 정렬
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 이름순 정렬',
  'Company 목록을 이름 알파벳순으로 정렬할 수 있는지 확인',
  '\"Zebra Corp\", \"Apple Inc\", \"Beta Systems\" 등의 Company 존재, Company 목록 페이지 열림',
  '[{"order": 1, "action": "Sort 드롭다운에서 \"Name (A-Z)\" 선택", "expected": "목록이 알파벳순으로 정렬됨 (Apple, Beta, Zebra)"}]'::jsonb,
  'Company 목록이 이름순 오름차순 정렬',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company 정렬' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 이름순 정렬');

-- TC-07: Company 최신순 정렬
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Company 최신순 정렬',
  'Company 목록을 최신 생성순으로 정렬할 수 있는지 확인',
  '여러 시점에 생성된 Company 존재, Company 목록 페이지 열림',
  '[{"order": 1, "action": "Sort 드롭다운에서 \"Newest\" 선택", "expected": "목록이 createdAt 역순(최신)으로 정렬됨"}]'::jsonb,
  'Company 목록이 최신 생성순으로 정렬',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Company 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Company 정렬' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company 최신순 정렬');

-- TC-08: Product 신규 등록
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 신규 등록',
  'Company 선택 후 새로운 Product를 등록할 수 있는지 확인',
  'Company 선택 완료, Product 목록 페이지 열림',
  '[{"order": 1, "action": "\"Add New\" 버튼 클릭", "expected": "ProductFormModal 열림"}, {"order": 2, "action": "Product 이름 입력 (예: \"WebApp\")", "expected": "텍스트 입력 완료"}, {"order": 3, "action": "Platform 선택 (예: \"WEB\")", "expected": "드롭다운에서 선택됨"}, {"order": 4, "action": "\"Create\" 버튼 클릭", "expected": "Product 목록에 추가됨, 모달 닫힘"}]'::jsonb,
  '새 Product가 선택된 Company 아래에 저장되고 표시됨',
  'HIGH', 'SMOKE', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 신규 등록');

-- TC-09: Product 플랫폼별 등록
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 플랫폼별 등록',
  '각 플랫폼(WEB, DESKTOP, MOBILE, ETC)별로 Product를 등록할 수 있는지 확인',
  'Company 선택 완료, Product 목록 페이지 열림',
  '[{"order": 1, "action": "\"Add New\" 클릭 후 ProductFormModal 열기", "expected": "폼 표시"}, {"order": 2, "action": "Platform 드롭다운 확인", "expected": "WEB, DESKTOP, MOBILE, ETC 옵션 표시"}, {"order": 3, "action": "MOBILE 플랫폼 선택하고 Product 생성", "expected": "\"platform\" 필드가 MOBILE로 저장됨"}]'::jsonb,
  '각 플랫폼별로 Product가 정확하게 저장됨',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 플랫폼별 등록');

-- TC-10: Product 삭제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 삭제',
  'Product를 삭제하면 연관된 Segment와 TestCase도 함께 삭제됨',
  'Product이 최소 1개 이상 존재, Product 목록 페이지 열림',
  '[{"order": 1, "action": "Product 카드의 Delete 버튼 클릭", "expected": "확인 다이얼로그 표시"}, {"order": 2, "action": "\"Delete\" 선택", "expected": "Product 목록에서 제거됨"}]'::jsonb,
  'Product과 연관된 모든 Segment, TestCase 삭제됨 (CASCADE)',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 삭제');

-- TC-11: Product 이름 검색 — 일치
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 이름 검색 — 일치',
  'Product 검색 기능이 정상 작동하는지 확인',
  '\"WebApp\", \"MobileApp\", \"API Service\" 등의 Product 존재, Product 목록 페이지 열림',
  '[{"order": 1, "action": "검색 입력창에 \"WebApp\" 입력", "expected": "Product 목록 필터링, \"WebApp\"만 표시"}, {"order": 2, "action": "검색창 비우기", "expected": "전체 Product 목록 복원"}]'::jsonb,
  '검색어 부분 일치 필터링 정상 작동',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product 검색' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 이름 검색 — 일치');

-- TC-12: Product 이름 검색 — 결과 없음
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 이름 검색 — 결과 없음',
  '검색 결과가 없을 때 명확한 메시지를 표시',
  'Product 목록 페이지 열림',
  '[{"order": 1, "action": "검색 입력창에 존재하지 않는 이름 입력", "expected": "목록 비어 있음, \"No products found\" 메시지 표시"}]'::jsonb,
  '검색 결과 없음을 사용자에게 명확히 전달',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product 검색' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 이름 검색 — 결과 없음');

-- TC-13: Product 이름순 정렬
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 이름순 정렬',
  'Product 목록을 이름 알파벳순으로 정렬할 수 있는지 확인',
  '\"Zebra\", \"Apple\", \"Beta\" 등의 Product 존재, Product 목록 페이지 열림',
  '[{"order": 1, "action": "Sort 드롭다운에서 \"Name (A-Z)\" 선택", "expected": "목록이 이름순 정렬 (Apple, Beta, Zebra)"}]'::jsonb,
  'Product 목록이 알파벳순으로 정렬됨',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product 정렬' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 이름순 정렬');

-- TC-14: Product 최신순 정렬
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Product 최신순 정렬',
  'Product 목록을 최신 생성순으로 정렬할 수 있는지 확인',
  '여러 시점에 생성된 Product 존재, Product 목록 페이지 열림',
  '[{"order": 1, "action": "Sort 드롭다운에서 \"Newest\" 선택", "expected": "목록이 최신순 정렬됨 (createdAt DESC)"}]'::jsonb,
  'Product 목록이 최신 생성순으로 정렬됨',
  'LOW', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Product 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Product 정렬' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Product 최신순 정렬');

-- TC-15: Root Segment 추가
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Root Segment 추가',
  'Product 아래에 Root Segment를 추가할 수 있는지 확인',
  'Product 선택 완료, TestCase 페이지 열림, Segment가 없는 상태 또는 새로운 Product',
  '[{"order": 1, "action": "SegmentTreeView에서 \"Root Path 등록\" 버튼 클릭", "expected": "인라인 텍스트 입력 필드 표시"}, {"order": 2, "action": "Segment 이름 입력 (예: \"Authentication\")", "expected": "텍스트 입력 완료"}, {"order": 3, "action": "Enter 키 또는 확인 버튼 클릭", "expected": "Root Segment 생성, 트리에 표시됨"}]'::jsonb,
  'Root Segment가 Product 아래에 생성되고 트리에 표시됨',
  'HIGH', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Segment 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Segment CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Root Segment 추가');

-- TC-16: Child Segment 추가
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Child Segment 추가',
  'Root Segment 아래에 Child Segment를 추가할 수 있는지 확인',
  'Root Segment 존재 (예: \"Authentication\"), SegmentTreeView 열림',
  '[{"order": 1, "action": "Root Segment 노드에 마우스 호버", "expected": "\"+ \" 버튼 표시"}, {"order": 2, "action": "\"+ \" 버튼 클릭 또는 우클릭 메뉴에서 \"하단에 Path 추가\" 선택", "expected": "인라인 입력 필드 표시"}, {"order": 3, "action": "Child Segment 이름 입력 (예: \"Login\")", "expected": "텍스트 입력 완료"}, {"order": 4, "action": "Enter 키 클릭", "expected": "\"Login\"이 \"Authentication\"의 자식으로 생성, 트리에 표시됨"}]'::jsonb,
  'Child Segment가 올바른 부모 아래에 생성되고, 트리 구조 유지',
  'HIGH', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Segment 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Segment CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Child Segment 추가');

-- TC-17: Segment 삭제 (cascade)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Segment 삭제 (cascade)',
  'Segment 삭제 시 모든 하위 Segment가 함께 삭제됨을 확인',
  '다단계 Segment 트리 존재 (예: Authentication > Login > Social > Google), SegmentTreeView 열림',
  '[{"order": 1, "action": "\"Login\" Segment 우클릭, \"Path 삭제\" 선택", "expected": "확인 다이얼로그 표시"}, {"order": 2, "action": "\"Delete\" 선택", "expected": "\"Login\"과 모든 하위 Segment (Social, Google) 삭제됨"}]'::jsonb,
  '삭제된 Segment와 모든 자식 Segment가 제거되고, 관련 TestCase path는 유지 또는 정리됨',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'Segment 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'Segment CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Segment 삭제 (cascade)');

-- TC-18: TestCase 신규 생성
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'TestCase 신규 생성',
  'Segment 경로 선택 후 새로운 TestCase를 생성할 수 있는지 확인',
  'Product 선택 완료, Segment 트리에서 특정 경로(path) 선택됨, TestCase 페이지 열림',
  '[{"order": 1, "action": "SegmentTreeView에서 \"Authentication > Login\" 경로 선택", "expected": "경로 선택 상태 시각적으로 표시"}, {"order": 2, "action": "\"Add Test Case\" 버튼 클릭", "expected": "TestCaseFormModal 열림, path 필드는 읽기 전용으로 \"Authentication > Login\" 표시"}, {"order": 3, "action": "제목 입력, Priority/Type/Status 선택, Steps 추가 (최소 1개)", "expected": "폼 작성 완료"}, {"order": 4, "action": "\"Create\" 버튼 클릭", "expected": "TestCase 목록에 추가, 모달 닫힘"}]'::jsonb,
  '새 TestCase가 선택된 경로(path) 아래에 저장되고 표시됨',
  'HIGH', 'SMOKE', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'TestCase 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'TestCase CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'TestCase 신규 생성');

-- TC-19: TestCase 수정
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'TestCase 수정',
  'TestCase의 필드를 수정할 수 있는지 확인',
  'TestCase 최소 1개 존재, TestCase 목록 페이지 열림',
  '[{"order": 1, "action": "TestCase 카드의 \"Edit\" 버튼 클릭", "expected": "TestCaseFormModal 열림, 기존 데이터 로드됨"}, {"order": 2, "action": "제목 수정 (예: \"Updated Title\")", "expected": "텍스트 변경"}, {"order": 3, "action": "\"Save\" 버튼 클릭", "expected": "TestCase 업데이트, 목록에 변경 사항 반영"}]'::jsonb,
  'TestCase의 모든 필드(path 제외)가 업데이트되고, DB에 반영됨',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'TestCase 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'TestCase CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'TestCase 수정');

-- TC-20: TestCase 삭제
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'TestCase 삭제',
  'TestCase를 삭제할 수 있는지 확인',
  'TestCase 최소 1개 존재, TestCase 목록 페이지 열림',
  '[{"order": 1, "action": "TestCase 카드의 Delete 버튼 클릭", "expected": "확인 다이얼로그 표시"}, {"order": 2, "action": "\"Delete\" 선택", "expected": "TestCase 목록에서 제거됨"}]'::jsonb,
  'TestCase가 DB에서 삭제되고, 목록에서 제거됨',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'TestCase 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'TestCase CRUD' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'TestCase 삭제');

-- TC-21: Path별 TestCase 필터링
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'Path별 TestCase 필터링',
  'SegmentTreeView에서 경로 선택 시 해당 경로 아래의 TestCase만 필터링되는지 확인',
  '다양한 경로(path)에 다양한 TestCase 존재, 예: \"Auth > Login\" (3개), \"Auth > Logout\" (2개), \"Payment\" (5개), TestCase 페이지 열림',
  '[{"order": 1, "action": "SegmentTreeView에서 \"Auth\" 선택", "expected": "TestCase 목록이 \"Auth\" 아래의 모든 TestCase 표시 (5개)"}, {"order": 2, "action": "\"Auth > Login\" 선택", "expected": "목록이 \"Login\" 경로의 TestCase만 표시 (3개)"}, {"order": 3, "action": "\"Payment\" 선택", "expected": "목록이 \"Payment\" 경로의 TestCase만 표시 (5개)"}]'::jsonb,
  '선택된 경로(path)에 맞게 TestCase 목록이 필터링됨 (prefix match)',
  'MEDIUM', 'FUNCTIONAL', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = 'TestCase 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'TestCase 필터링' AND s3.parent_id = s2.id
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Path별 TestCase 필터링');

-- TC-22: Company → Product → TestCase 전체 흐름 (E2E)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT
  p.id,
  ARRAY[s1.id]::BIGINT[],
  'Company → Product → TestCase 전체 흐름',
  'Product Test Suite의 3단계 드릴다운 흐름을 전체적으로 테스트',
  'Product Test Suite UI (/features) 접속 가능, DB 초기 상태',
  '[{"order": 1, "action": "/features 접속 → Company 신규 등록 (예: \"QA Team\")", "expected": "Company 목록에 \"QA Team\" 추가됨"}, {"order": 2, "action": "\"QA Team\" 클릭 → Product 페이지로 이동", "expected": "경로 변경: /features/companies/:id"}, {"order": 3, "action": "Product 신규 등록 (예: \"Mobile App\", MOBILE)", "expected": "Product 목록에 추가됨"}, {"order": 4, "action": "\"Mobile App\" 클릭 → TestCase 페이지 이동", "expected": "경로 변경: /features/companies/:id/products/:id"}, {"order": 5, "action": "Segment 추가: \"Feature A\" → \"Scenario 1\"", "expected": "트리 구조 생성됨"}, {"order": 6, "action": "\"Scenario 1\" 선택 후 TestCase 생성", "expected": "TestCase 저장, \"Scenario 1\" 경로로 분류됨"}, {"order": 7, "action": "TestCase 수정, 삭제 작업 수행", "expected": "모든 CRUD 작업 정상 동작"}]'::jsonb,
  '전체 3단계 드릴다운 흐름이 끝에서 끝까지 정상 작동함',
  'HIGH', 'E2E', 'DRAFT'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'Product Test Suite' AND s1.parent_id IS NULL
WHERE p.name = 'Product Test Suite'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'Company → Product → TestCase 전체 흐름');
