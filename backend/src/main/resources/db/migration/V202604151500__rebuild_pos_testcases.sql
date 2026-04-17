-- V202604151500: POS TestCase 세분화 리빌드
-- 피드백: TC가 너무 뭉침, 로그인 누락, 배달앱별 분리 필요
-- Before: 5 TC → After: 35 TC

-- ============================================
-- 1. 기존 POS 데이터 정리
-- ============================================

-- TestRun ↔ TestCase 연결 해제 (POS TestRun만)
DELETE FROM test_run_test_case
WHERE test_run_id IN (
    SELECT id FROM test_run WHERE product_id = (
        SELECT p.id FROM product p WHERE p.name = 'POS'
        AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
    )
);

-- 기존 POS TestCase 삭제
DELETE FROM test_case
WHERE product_id = (
    SELECT p.id FROM product p WHERE p.name = 'POS'
    AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
);

-- 기존 POS TestRun 삭제
DELETE FROM test_run
WHERE product_id = (
    SELECT p.id FROM product p WHERE p.name = 'POS'
    AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
);

-- 기존 POS Segment 삭제 (L2 → L1 → Root 순서, FK 제약)
DELETE FROM segment
WHERE product_id = (
    SELECT p.id FROM product p WHERE p.name = 'POS'
    AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
)
AND parent_id IS NOT NULL
AND parent_id IN (
    SELECT s2.id FROM segment s2 WHERE s2.parent_id IS NOT NULL
    AND s2.product_id = (
        SELECT p.id FROM product p WHERE p.name = 'POS'
        AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
    )
);

DELETE FROM segment
WHERE product_id = (
    SELECT p.id FROM product p WHERE p.name = 'POS'
    AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
)
AND parent_id IS NOT NULL;

DELETE FROM segment
WHERE product_id = (
    SELECT p.id FROM product p WHERE p.name = 'POS'
    AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
)
AND parent_id IS NULL;

-- ============================================
-- 2. 새 Segment 트리 (1 Root + 4 L1 + 10 L2 = 15)
-- ============================================

-- Root
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, 'POS', NULL
FROM product p WHERE p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L1: 인증
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '인증', root.id
FROM product p
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L1: 상품 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상품 관리', root.id
FROM product p
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L1: 주문 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '주문 관리', root.id
FROM product p
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L1: 매출 분석
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '매출 분석', root.id
FROM product p
JOIN segment root ON p.id = root.product_id AND root.name = 'POS' AND root.parent_id IS NULL
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L2 under 인증
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '로그인', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '인증'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L2 under 상품 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '카테고리', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '메뉴', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '상품 목록', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '상품 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L2 under 주문 관리
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '배달의민족', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '요기요', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '쿠팡이츠', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '동시 주문', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '테이블 관리', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '주문 관리'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- L2 under 매출 분석
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '리포트', l1.id
FROM product p
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '매출 분석'
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- ============================================
-- 3. TestCases (35개)
-- ============================================

-- === 인증 > 로그인 (4개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '관리자 로그인 성공',
  '유효한 계정으로 POS 관리자 로그인 시 정상 접근',
  'POS 앱 실행, 로그인 화면 표시',
  '[{"order":1,"action":"관리자 ID 입력","expected":"ID 필드에 입력됨"},{"order":2,"action":"비밀번호 입력","expected":"마스킹 처리된 비밀번호 표시"},{"order":3,"action":"로그인 버튼 클릭","expected":"메인 화면 진입, 관리자 권한 메뉴 표시"}]'::jsonb,
  '메인 화면 진입, 관리자 권한 메뉴 표시',
  'HIGH', 'SMOKE', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '인증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '로그인' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '로그인 실패 — 잘못된 비밀번호',
  '유효한 ID + 잘못된 비밀번호 입력 시 로그인 차단',
  'POS 앱 실행, 로그인 화면 표시',
  '[{"order":1,"action":"관리자 ID 입력","expected":"ID 필드에 입력됨"},{"order":2,"action":"잘못된 비밀번호 입력","expected":"마스킹 처리"},{"order":3,"action":"로그인 버튼 클릭","expected":"\"비밀번호가 일치하지 않습니다\" 오류 메시지, 로그인 화면 유지"}]'::jsonb,
  '오류 메시지 표시, 로그인 화면 유지',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '인증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '로그인' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '로그인 실패 — 미등록 계정',
  '존재하지 않는 계정으로 로그인 시도 시 차단',
  'POS 앱 실행, 로그인 화면 표시',
  '[{"order":1,"action":"미등록 ID 입력","expected":"ID 필드에 입력됨"},{"order":2,"action":"비밀번호 입력 후 로그인","expected":"\"등록되지 않은 계정입니다\" 오류 메시지, 로그인 화면 유지"}]'::jsonb,
  '오류 메시지 표시, 로그인 화면 유지',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '인증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '로그인' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '로그아웃',
  '로그인 상태에서 로그아웃 시 로그인 화면 복귀',
  '관리자 로그인 상태',
  '[{"order":1,"action":"로그아웃 버튼 클릭","expected":"로그인 화면으로 복귀"},{"order":2,"action":"뒤로가기 시도","expected":"메인 화면 접근 불가, 로그인 화면 유지"}]'::jsonb,
  '로그인 화면 복귀, 재접근 불가',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '인증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '로그인' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 상품 관리 > 카테고리 (4개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '카테고리 등록',
  '새 카테고리 등록 시 상품 목록에 카테고리 탭 추가',
  '관리자 로그인, 상품 관리 화면',
  '[{"order":1,"action":"카테고리 추가 버튼 클릭","expected":"카테고리명 입력 필드 표시"},{"order":2,"action":"카테고리명 입력 (예: \"음료\")","expected":"입력 완료"},{"order":3,"action":"저장","expected":"카테고리 목록에 \"음료\" 추가됨"}]'::jsonb,
  '카테고리 목록에 추가됨',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '카테고리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '카테고리 수정',
  '기존 카테고리명 변경 시 하위 메뉴 유지',
  '카테고리 1개 이상 등록됨',
  '[{"order":1,"action":"카테고리 선택 후 수정 버튼 클릭","expected":"수정 모드 진입"},{"order":2,"action":"카테고리명 변경 (\"음료\" → \"드링크\")","expected":"변경 입력됨"},{"order":3,"action":"저장","expected":"카테고리명 변경됨, 하위 메뉴 유지"}]'::jsonb,
  '카테고리명 변경, 하위 메뉴 유지',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '카테고리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '카테고리 삭제',
  '카테고리 삭제 시 하위 메뉴 처리 확인',
  '하위 메뉴가 있는 카테고리 존재',
  '[{"order":1,"action":"카테고리 삭제 버튼 클릭","expected":"확인 팝업 표시 (하위 메뉴 N개 포함 안내)"},{"order":2,"action":"확인","expected":"카테고리 및 하위 메뉴 삭제 또는 미분류로 이동"}]'::jsonb,
  '삭제 확인 팝업 후 처리 완료',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '카테고리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '카테고리 순서 변경',
  '카테고리 표시 순서 변경 시 POS 결제 화면 반영',
  '카테고리 2개 이상 등록됨',
  '[{"order":1,"action":"카테고리 순서 드래그 변경","expected":"순서 변경 반영"},{"order":2,"action":"결제 화면에서 카테고리 순서 확인","expected":"변경된 순서로 표시"}]'::jsonb,
  '변경된 순서로 결제 화면 표시',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '카테고리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 상품 관리 > 메뉴 (6개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '메뉴 등록',
  '카테고리에 새 메뉴 등록 시 결제 화면에 노출',
  '카테고리 1개 이상 등록됨',
  '[{"order":1,"action":"카테고리 선택 후 메뉴 추가","expected":"메뉴 입력 폼 표시"},{"order":2,"action":"메뉴명, 가격 입력","expected":"입력 완료"},{"order":3,"action":"저장","expected":"해당 카테고리에 메뉴 추가, 결제 화면 노출"}]'::jsonb,
  '카테고리에 메뉴 추가, 결제 화면 노출',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '메뉴에 옵션 추가',
  '메뉴에 옵션 그룹 및 항목 추가 (사이즈, 토핑 등)',
  '메뉴 1개 이상 등록됨',
  '[{"order":1,"action":"메뉴 선택 후 옵션 관리 진입","expected":"옵션 설정 화면 표시"},{"order":2,"action":"옵션 그룹 추가 (예: \"사이즈\")","expected":"그룹 생성됨"},{"order":3,"action":"옵션 항목 추가 (\"R +0원\", \"L +500원\")","expected":"항목 추가, 추가 금액 설정됨"},{"order":4,"action":"저장 후 결제 화면 확인","expected":"메뉴 선택 시 옵션 선택 화면 표시"}]'::jsonb,
  '결제 화면에서 옵션 선택 가능, 추가 금액 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '메뉴 수정',
  '메뉴명/가격 수정 시 즉시 반영',
  '메뉴 1개 이상 등록됨',
  '[{"order":1,"action":"메뉴 선택 후 수정","expected":"수정 폼 표시"},{"order":2,"action":"가격 변경 (5000 → 5500)","expected":"변경 입력됨"},{"order":3,"action":"저장","expected":"목록 및 결제 화면에 변경된 가격 반영"}]'::jsonb,
  '변경된 가격 즉시 반영',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '메뉴 삭제',
  '메뉴 삭제 시 결제 화면에서 제거',
  '메뉴 1개 이상 등록됨',
  '[{"order":1,"action":"메뉴 삭제 버튼 클릭","expected":"확인 팝업 표시"},{"order":2,"action":"확인","expected":"메뉴 목록 및 결제 화면에서 제거"}]'::jsonb,
  '메뉴 목록 및 결제 화면에서 제거',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '메뉴 품절 처리',
  '메뉴 품절 설정 시 결제 화면에서 선택 불가',
  '메뉴 1개 이상 등록됨, 판매 중 상태',
  '[{"order":1,"action":"메뉴 품절 토글 ON","expected":"품절 상태로 변경"},{"order":2,"action":"결제 화면에서 해당 메뉴 확인","expected":"품절 표시, 선택 불가"}]'::jsonb,
  '결제 화면에서 품절 표시, 선택 불가',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '품절 해제',
  '품절 메뉴 해제 시 결제 화면에서 다시 선택 가능',
  '품절 상태 메뉴 존재',
  '[{"order":1,"action":"메뉴 품절 토글 OFF","expected":"판매 중 상태로 변경"},{"order":2,"action":"결제 화면에서 해당 메뉴 확인","expected":"정상 표시, 선택 가능"}]'::jsonb,
  '결제 화면에서 정상 표시, 선택 가능',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '메뉴' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 상품 관리 > 상품 목록 (2개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '카테고리별 상품 조회',
  '카테고리 탭 선택 시 해당 카테고리 메뉴만 표시',
  '복수 카테고리에 메뉴 등록됨',
  '[{"order":1,"action":"\"음료\" 카테고리 탭 선택","expected":"음료 카테고리 메뉴만 표시"},{"order":2,"action":"\"식사\" 카테고리 탭 선택","expected":"식사 카테고리 메뉴만 표시"}]'::jsonb,
  '선택된 카테고리의 메뉴만 표시',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '상품 목록' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '상품 검색',
  '메뉴명 검색 시 일치하는 메뉴만 필터링',
  '메뉴 등록됨',
  '[{"order":1,"action":"검색창에 \"아메\" 입력","expected":"\"아메리카노\" 등 부분 일치 메뉴만 표시"},{"order":2,"action":"검색어 삭제","expected":"전체 메뉴 목록 복원"}]'::jsonb,
  '부분 일치 메뉴 필터링, 삭제 시 복원',
  'LOW', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '상품 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '상품 목록' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 주문 관리 > 배달의민족 (3개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배민 주문 수신',
  '배달의민족에서 주문 발생 시 POS에 주문 알림 및 상세 정보 수신',
  '배달의민족 연동 완료',
  '[{"order":1,"action":"배달의민족에서 주문 발생","expected":"POS에 주문 알림음 + 팝업 표시"},{"order":2,"action":"주문 상세 확인","expected":"메뉴명, 수량, 옵션, 배달 주소, 결제 금액 정확"}]'::jsonb,
  '주문 알림 수신, 상세 정보 정확',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배달의민족' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배민 주문 접수',
  '배달의민족 주문 접수 시 배민앱에 접수 상태 반영',
  '배민 주문 수신 상태',
  '[{"order":1,"action":"주문 접수 버튼 클릭","expected":"접수 완료, 조리 시간 설정 화면"},{"order":2,"action":"조리 시간 선택 (30분)","expected":"배민앱에 \"조리 중 (30분)\" 상태 반영"}]'::jsonb,
  '접수 완료, 배민앱에 조리 상태 반영',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배달의민족' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배민 주문 거절',
  '배달의민족 주문 거절 시 사유 입력 및 배민앱 반영',
  '배민 주문 수신 상태',
  '[{"order":1,"action":"주문 거절 버튼 클릭","expected":"거절 사유 선택 화면"},{"order":2,"action":"사유 선택 (재료 소진)","expected":"거절 처리, 배민앱에 거절 상태 및 사유 반영"}]'::jsonb,
  '거절 처리, 배민앱에 거절 사유 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '배달의민족' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 주문 관리 > 요기요 (3개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '요기요 주문 수신',
  '요기요에서 주문 발생 시 POS에 주문 알림 및 상세 정보 수신',
  '요기요 연동 완료',
  '[{"order":1,"action":"요기요에서 주문 발생","expected":"POS에 주문 알림음 + 팝업 표시"},{"order":2,"action":"주문 상세 확인","expected":"메뉴명, 수량, 옵션, 배달 주소, 결제 금액 정확"}]'::jsonb,
  '주문 알림 수신, 상세 정보 정확',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '요기요' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '요기요 주문 접수',
  '요기요 주문 접수 시 요기요앱에 접수 상태 반영',
  '요기요 주문 수신 상태',
  '[{"order":1,"action":"주문 접수 버튼 클릭","expected":"접수 완료"},{"order":2,"action":"조리 시간 선택","expected":"요기요앱에 조리 상태 반영"}]'::jsonb,
  '접수 완료, 요기요앱에 조리 상태 반영',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '요기요' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '요기요 주문 거절',
  '요기요 주문 거절 시 사유 입력 및 앱 반영',
  '요기요 주문 수신 상태',
  '[{"order":1,"action":"주문 거절 버튼 클릭","expected":"거절 사유 선택 화면"},{"order":2,"action":"사유 선택","expected":"거절 처리, 요기요앱에 반영"}]'::jsonb,
  '거절 처리, 요기요앱에 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '요기요' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 주문 관리 > 쿠팡이츠 (3개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '쿠팡이츠 주문 수신',
  '쿠팡이츠에서 주문 발생 시 POS에 주문 알림 및 상세 정보 수신',
  '쿠팡이츠 연동 완료',
  '[{"order":1,"action":"쿠팡이츠에서 주문 발생","expected":"POS에 주문 알림음 + 팝업 표시"},{"order":2,"action":"주문 상세 확인","expected":"메뉴명, 수량, 옵션, 배달 주소, 결제 금액 정확"}]'::jsonb,
  '주문 알림 수신, 상세 정보 정확',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠팡이츠' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '쿠팡이츠 주문 접수',
  '쿠팡이츠 주문 접수 시 쿠팡이츠앱에 접수 상태 반영',
  '쿠팡이츠 주문 수신 상태',
  '[{"order":1,"action":"주문 접수 버튼 클릭","expected":"접수 완료"},{"order":2,"action":"조리 시간 선택","expected":"쿠팡이츠앱에 조리 상태 반영"}]'::jsonb,
  '접수 완료, 쿠팡이츠앱에 조리 상태 반영',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠팡이츠' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '쿠팡이츠 주문 거절',
  '쿠팡이츠 주문 거절 시 사유 입력 및 앱 반영',
  '쿠팡이츠 주문 수신 상태',
  '[{"order":1,"action":"주문 거절 버튼 클릭","expected":"거절 사유 선택 화면"},{"order":2,"action":"사유 선택","expected":"거절 처리, 쿠팡이츠앱에 반영"}]'::jsonb,
  '거절 처리, 쿠팡이츠앱에 반영',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '쿠팡이츠' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 주문 관리 > 동시 주문 (2개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '배민+쿠팡이츠 동시 수신',
  '배민과 쿠팡이츠에서 동시에 주문 발생 시 각각 개별 표시',
  '배민 + 쿠팡이츠 동시 연동',
  '[{"order":1,"action":"배민 주문 + 쿠팡이츠 주문 동시 발생","expected":"각 주문 개별 알림, 개별 표시"},{"order":2,"action":"각 주문 순서대로 접수","expected":"누락 없이 모든 주문 처리 가능"}]'::jsonb,
  '각 주문 개별 표시, 누락 없음',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '동시 주문' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '3개 앱 동시 수신',
  '배민+요기요+쿠팡이츠 3개 앱에서 동시 주문 시 전체 처리',
  '3개 배달앱 동시 연동',
  '[{"order":1,"action":"3개 앱에서 동시 주문 발생","expected":"각 주문 개별 알림, 앱별 구분 표시"},{"order":2,"action":"순서대로 전체 접수","expected":"3건 모두 누락 없이 처리"}]'::jsonb,
  '3건 모두 개별 표시, 누락 없이 처리',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '동시 주문' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 주문 관리 > 테이블 관리 (4개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '테이블 주문 등록',
  '테이블 선택 후 주문 등록',
  '테이블 관리 활성화',
  '[{"order":1,"action":"테이블 선택","expected":"해당 테이블 주문 화면 진입"},{"order":2,"action":"메뉴 선택 후 주문 등록","expected":"테이블에 주문 기록, 금액 표시"}]'::jsonb,
  '테이블에 주문 기록, 금액 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '테이블 관리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '추가 주문',
  '기존 테이블 주문에 메뉴 추가',
  '테이블에 기존 주문 존재',
  '[{"order":1,"action":"주문 중인 테이블 선택","expected":"기존 주문 내역 표시"},{"order":2,"action":"메뉴 추가 선택","expected":"기존 주문에 추가, 합산 금액 갱신"}]'::jsonb,
  '기존 주문에 추가, 합산 금액 갱신',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '테이블 관리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '합산 결제',
  '테이블 전체 주문 합산 결제 후 테이블 초기화',
  '테이블에 복수 주문 존재',
  '[{"order":1,"action":"테이블 결제 버튼 클릭","expected":"전체 주문 합산 금액 표시"},{"order":2,"action":"결제 진행","expected":"결제 완료, 테이블 초기화 (빈 테이블)"}]'::jsonb,
  '전체 합산 결제 완료, 테이블 초기화',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '테이블 관리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '테이블 이동',
  '주문이 있는 테이블을 다른 테이블로 이동',
  '테이블에 주문 존재, 빈 테이블 존재',
  '[{"order":1,"action":"주문 테이블 선택 후 이동 버튼","expected":"이동할 테이블 선택 화면"},{"order":2,"action":"빈 테이블 선택","expected":"주문이 새 테이블로 이동, 기존 테이블 초기화"}]'::jsonb,
  '주문 이동 완료, 기존 테이블 초기화',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '주문 관리' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '테이블 관리' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- === 매출 분석 > 리포트 (4개) ===

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '일별 매출 조회',
  '특정 날짜 매출 조회 시 해당일 결제/취소/순매출 정확',
  '결제 이력 존재',
  '[{"order":1,"action":"일별 매출 탭 선택","expected":"오늘 날짜 매출 표시"},{"order":2,"action":"날짜 선택","expected":"해당일 결제 건수, 결제 금액, 취소 금액, 순매출 정확"}]'::jsonb,
  '해당일 결제/취소/순매출 정확',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '매출 분석' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '리포트' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '월별 매출 조회',
  '월 단위 매출 조회 시 일별 합산 정확',
  '1개월 이상 결제 이력 존재',
  '[{"order":1,"action":"월별 매출 탭 선택","expected":"이번 달 매출 요약 표시"},{"order":2,"action":"이전 달 선택","expected":"해당 월 일별 매출 합산, 총 매출 정확"}]'::jsonb,
  '월별 일별 합산 정확, 총 매출 정확',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '매출 분석' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '리포트' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '결제수단별 매출 분류',
  '카드/현금/배달앱별 매출 분류 정확성',
  '복수 결제수단 이력 존재',
  '[{"order":1,"action":"결제수단별 탭 선택","expected":"카드, 현금, 배달앱별 매출 분류 표시"},{"order":2,"action":"각 결제수단 금액 합산 확인","expected":"총 매출 = 카드 + 현금 + 배달앱 합산과 일치"}]'::jsonb,
  '결제수단별 분류 정확, 합산 일치',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '매출 분석' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '리포트' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '기간 필터링',
  '사용자 지정 기간으로 매출 조회',
  '결제 이력 존재',
  '[{"order":1,"action":"시작일/종료일 설정","expected":"기간 설정됨"},{"order":2,"action":"조회","expected":"설정 기간 내 매출만 표시"},{"order":3,"action":"종료일 < 시작일 입력","expected":"오류 메시지 또는 입력 차단"}]'::jsonb,
  '설정 기간 내 매출만 표시, 잘못된 기간 입력 차단',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN segment s1 ON p.id = s1.product_id AND s1.name = 'POS' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '매출 분석' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '리포트' AND s3.parent_id = s2.id
WHERE p.name = 'POS' AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- ============================================
-- 4. TestRuns (3개)
-- ============================================

-- Smoke Test (5개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Smoke Test', 'POS 핵심 기능 빠른 검증 — 로그인, 카테고리 등록, 메뉴 등록, 배민 주문 수신, 일별 매출'
FROM product p WHERE p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- 배달앱 연동 검증 (11개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, '배달앱 연동 검증', '배민/요기요/쿠팡이츠 전체 수신/접수/거절 + 동시 주문 처리'
FROM product p WHERE p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- Full Regression (35개)
INSERT INTO test_run (product_id, name, description)
SELECT p.id, 'Full Regression', 'POS 전체 TestCase 회귀 테스트 (35개)'
FROM product p WHERE p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');

-- ============================================
-- 5. TestRunTestCase 연결
-- ============================================

-- Smoke Test
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
AND tc.title IN ('관리자 로그인 성공', '카테고리 등록', '메뉴 등록', '배민 주문 수신', '일별 매출 조회');

-- 배달앱 연동 검증
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '배달앱 연동 검증' AND p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%')
AND tc.title IN (
  '배민 주문 수신', '배민 주문 접수', '배민 주문 거절',
  '요기요 주문 수신', '요기요 주문 접수', '요기요 주문 거절',
  '쿠팡이츠 주문 수신', '쿠팡이츠 주문 접수', '쿠팡이츠 주문 거절',
  '배민+쿠팡이츠 동시 수신', '3개 앱 동시 수신'
);

-- Full Regression (전체)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = 'POS'
AND p.company_id = (SELECT c.id FROM company c WHERE c.name LIKE '%Toss Place%');
