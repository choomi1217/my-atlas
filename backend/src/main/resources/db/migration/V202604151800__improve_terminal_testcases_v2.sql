-- V202604151600: 결제 단말기 TC v2 개선
-- Feedback: PIN 상태전이, 기대결과 분리, 페이스페이 신규, 오라클 명확화, 복구 테스트 등

-- ============================================
-- 1. 신규 Segment: 페이스페이
-- ============================================
INSERT INTO segment (product_id, name, parent_id)
SELECT p.id, '페이스페이', l1.id
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment l1 ON p.id = l1.product_id AND l1.name = '결제'
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM segment s WHERE s.name = '페이스페이' AND s.product_id = p.id);

-- ============================================
-- 2. PIN 입력 TC 3개 (IC카드 결제 Segment)
-- ============================================

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'PIN 1회 오류 후 성공',
  'State Transition: 대기→재입력(잔여4회)→승인완료. PIN 오류 후에도 정상 승인이 가능한 복구 경로 검증.',
  'IC카드 삽입, PIN 입력 화면 표시',
  '[{"order":1,"action":"잘못된 PIN 입력","expected":"\"PIN이 일치하지 않습니다. 잔여 4회\" 메시지, 재입력 요청"},{"order":2,"action":"올바른 PIN 입력","expected":"승인 완료, 영수증 출력"}]'::jsonb,
  '1회 오류 후 정상 승인 완료',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'PIN 1회 오류 후 성공' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'PIN 5회 연속 오류 — 카드 잠금',
  'State Transition + Boundary Value: 경계값 5회째에 카드 잠금 발동. 잠금 후 추가 입력 불가.',
  'IC카드 삽입, PIN 입력 화면 표시',
  '[{"order":1,"action":"잘못된 PIN 1회차 입력","expected":"잔여 4회 안내"},{"order":2,"action":"잘못된 PIN 2회차 입력","expected":"잔여 3회 안내"},{"order":3,"action":"잘못된 PIN 3회차 입력","expected":"잔여 2회 안내"},{"order":4,"action":"잘못된 PIN 4회차 입력","expected":"잔여 1회 안내 (마지막 기회 경고)"},{"order":5,"action":"잘못된 PIN 5회차 입력","expected":"카드 잠금 처리, PIN 입력 불가, 카드사 문의 안내"}]'::jsonb,
  '5회째 카드 잠금, 추가 입력 불가',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'PIN 5회 연속 오류 — 카드 잠금' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'PIN 4회 오류 후 성공 — 잠금 직전 복구',
  'Boundary Value: 잠금 직전(4회 오류) 상태에서 마지막 기회에 성공하는 경계 복구 경로 검증.',
  'IC카드 삽입, PIN 입력 화면 표시',
  '[{"order":1,"action":"잘못된 PIN 4회 연속 입력","expected":"잔여 1회 안내 (마지막 기회 경고)"},{"order":2,"action":"올바른 PIN 입력","expected":"승인 완료"}]'::jsonb,
  '잠금 직전에 정상 승인 완료',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'PIN 4회 오류 후 성공 — 잠금 직전 복구' AND product_id = p.id);

-- ============================================
-- 3. IC카드 기대결과 분리: 기존 TC 수정 + 2개 추가
-- ============================================

-- 기존 IC카드 정상 결제 TC: 기대결과를 승인번호에 집중
UPDATE test_case
SET description = '단말기에서 IC카드를 사용한 정상 결제 시 VAN사 승인번호 발급 검증',
    expected_result = '화면에 승인번호 표시',
    steps = '[{"order":1,"action":"금액 10,000원 입력","expected":"금액 화면 표시"},{"order":2,"action":"IC 카드 삽입","expected":"카드 인식 메시지 표시"},{"order":3,"action":"PIN 입력","expected":"VAN사 승인 요청 전송"},{"order":4,"action":"결제 완료 대기","expected":"승인번호 화면에 표시"}]'::jsonb
WHERE title = 'IC카드 정상 결제'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

-- 영수증 출력 및 내용 검증 TC
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'IC카드 결제 — 영수증 출력 및 내용 검증',
  'Verification Point Atomicity: 영수증 출력 자체 + 내용(가맹점명, 카드번호 마스킹, 금액, 승인번호, 거래일시) 정확성을 별도 검증. 기대결과 확인이 Step보다 복잡한 전형적 사례.',
  'IC카드 결제 승인 완료 상태',
  '[{"order":1,"action":"영수증 출력 확인","expected":"영수증 정상 출력"},{"order":2,"action":"가맹점명 확인","expected":"등록된 가맹점명과 일치"},{"order":3,"action":"카드번호 확인","expected":"앞 6자리 + 뒤 4자리 외 마스킹 처리"},{"order":4,"action":"금액/부가세 확인","expected":"결제 금액 및 부가세 정확"},{"order":5,"action":"승인번호/거래일시 확인","expected":"화면 표시 승인번호와 일치, 거래일시 정확"}]'::jsonb,
  '영수증 출력 및 모든 항목(가맹점명, 마스킹, 금액, 승인번호, 일시) 정확',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'IC카드 결제 — 영수증 출력 및 내용 검증' AND product_id = p.id);

-- POS 매출 반영 확인 TC
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  'IC카드 결제 — POS 매출 반영 확인',
  'Verification Point Atomicity: 단말기 결제 완료 후 POS 매출 화면에 해당 거래가 반영되는지 독립 검증. 단말기↔POS 동기화 실패 결함 격리 목적.',
  'IC카드 결제 승인 완료 상태',
  '[{"order":1,"action":"POS 매출 화면 진입","expected":"매출 목록 표시"},{"order":2,"action":"방금 결제 건 확인","expected":"결제 금액, 카드종류, 승인번호가 단말기 결제 내역과 일치"}]'::jsonb,
  'POS 매출 화면에 해당 거래 반영, 금액/승인번호 일치',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = 'IC카드 결제' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = 'IC카드 결제 — POS 매출 반영 확인' AND product_id = p.id);

-- ============================================
-- 4. 페이스페이 TC 7개
-- ============================================

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 정상 결제',
  '페이스페이 버튼 → 카메라 → 얼굴 인식 → 계좌 연동 → 결제 완료 E2E 플로우 검증.',
  '페이스페이 등록 완료된 고객, 단말기 카메라 정상',
  '[{"order":1,"action":"페이스페이 버튼 클릭","expected":"카메라 활성화"},{"order":2,"action":"고객 얼굴 인식","expected":"얼굴 인식 성공, 고객 정보 표시"},{"order":3,"action":"결제 금액 확인 후 결제 진행","expected":"연동된 계좌에서 결제 성공, 영수증 출력"}]'::jsonb,
  '얼굴 인식 → 계좌 연동 → 결제 성공',
  'HIGH', 'E2E', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 정상 결제' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 — 얼굴-계좌 연동 정확성',
  '핵심 검증: 인식된 얼굴이 정확한 본인의 계좌와 매칭되는지 확인. 페이스페이에서 가장 중요한 검증 포인트.',
  '페이스페이 등록 고객 2명 이상 (각각 다른 계좌)',
  '[{"order":1,"action":"고객 A 얼굴 인식","expected":"고객 A 정보 + 고객 A 계좌 표시 (고객 B 계좌 아님)"},{"order":2,"action":"고객 B 얼굴 인식","expected":"고객 B 정보 + 고객 B 계좌 표시"}]'::jsonb,
  '인식된 얼굴과 연동된 계좌가 정확히 본인 것과 일치',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 — 얼굴-계좌 연동 정확성' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 실패 — 마스크 착용',
  'Equivalence Partitioning(인식 실패 파티션): 마스크로 얼굴 일부 가림 시 인식 실패 및 대체 결제 안내.',
  '페이스페이 등록 고객, 마스크 착용 상태',
  '[{"order":1,"action":"마스크 착용 상태로 페이스페이 시도","expected":"얼굴 인식 실패 메시지"},{"order":2,"action":"재시도 또는 대체 결제 안내 확인","expected":"\"마스크를 벗고 다시 시도\" 또는 대체 결제 수단 안내"}]'::jsonb,
  '인식 실패, 재시도 또는 대체 결제 안내',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 실패 — 마스크 착용' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 실패 — 머리카락 가림',
  'Equivalence Partitioning(인식 실패 파티션): 머리카락으로 얼굴 가림 시 인식 실패 처리.',
  '페이스페이 등록 고객, 머리카락으로 얼굴 상당 부분 가린 상태',
  '[{"order":1,"action":"머리카락으로 얼굴 가린 상태로 페이스페이 시도","expected":"얼굴 인식 실패 메시지"},{"order":2,"action":"안내 메시지 확인","expected":"재시도 안내 또는 대체 결제 수단 안내"}]'::jsonb,
  '인식 실패, 재시도 또는 대체 결제 안내',
  'MEDIUM', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 실패 — 머리카락 가림' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 실패 — 인식 불가 시 대체 결제 안내',
  '인식 실패 시 사용자가 막히지 않도록 대체 결제 수단(카드/QR 등)으로 유도되는지 검증.',
  '페이스페이 인식 연속 실패 상태',
  '[{"order":1,"action":"페이스페이 인식 3회 연속 실패","expected":"대체 결제 수단 안내 화면 표시"},{"order":2,"action":"카드 결제 선택","expected":"카드 결제 화면으로 전환, 정상 결제 가능"}]'::jsonb,
  '대체 결제 안내 표시, 카드 결제로 전환 가능',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 실패 — 인식 불가 시 대체 결제 안내' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 보안 — 유사 얼굴 거부',
  'Security Testing / FAR(False Acceptance Rate): 등록자와 유사한 외모의 타인이 결제를 시도할 때 거부되는지 검증.',
  '페이스페이 등록 고객 A, 외모가 유사한 비등록 고객 B',
  '[{"order":1,"action":"비등록 고객 B가 페이스페이 시도","expected":"인식 실패 또는 \"등록되지 않은 얼굴\" 안내"},{"order":2,"action":"결제 차단 확인","expected":"결제 진행 불가"}]'::jsonb,
  '유사 얼굴 거부, 결제 차단',
  'HIGH', 'REGRESSION', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 보안 — 유사 얼굴 거부' AND product_id = p.id);

INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '페이스페이 보안 — 사진/영상 공격 차단',
  'Security Testing: 등록자의 사진이나 영상을 카메라에 비추어 결제를 시도하는 스푸핑 공격 차단 검증.',
  '페이스페이 등록 고객의 사진/영상 준비',
  '[{"order":1,"action":"등록자 사진을 카메라에 비추어 페이스페이 시도","expected":"Liveness 검증 실패, 인식 거부"},{"order":2,"action":"등록자 영상을 카메라에 비추어 시도","expected":"Liveness 검증 실패, 인식 거부"}]'::jsonb,
  '사진/영상 스푸핑 공격 차단',
  'HIGH', 'REGRESSION', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '결제' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '페이스페이' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '페이스페이 보안 — 사진/영상 공격 차단' AND product_id = p.id);

-- ============================================
-- 5. 최대 금액 한도 TC → Negative Test로 수정
-- ============================================
UPDATE test_case
SET title = '카드 한도 초과 결제 시도 — 차단 확인',
    description = 'Test Oracle 명확화: "정상 승인 또는 한도 초과"라는 애매한 기대결과를 제거. Precondition에서 한도를 설정하여 결과를 단 하나로 확정한 Negative Test.',
    preconditions = '카드 결제 한도 100만원으로 설정된 테스트 카드',
    steps = '[{"order":1,"action":"150만원 금액 입력","expected":"금액 표시"},{"order":2,"action":"한도 100만원 카드로 결제 시도","expected":"\"한도 초과\" 메시지 표시, 결제 차단"}]'::jsonb,
    expected_result = '한도 초과 메시지 표시, 결제 차단',
    priority = 'HIGH',
    test_type = 'FUNCTIONAL'
WHERE title = '최대 금액 한도 결제'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

-- ============================================
-- 6. 중복 결제 방지 TC 2개 description 보완
-- ============================================
UPDATE test_case
SET description = 'TC Independence: 1건 결제 처리 "도중"(트랜잭션 진행 중) 재차 결제 시도 차단. 트랜잭션 Lock 메커니즘 검증. (참고: "동일 카드 연속 승인 차단"은 1건 완료 "직후" 새 건 시도이므로 다른 메커니즘)'
WHERE title = '중복 결제 방지 — 승인 중 재시도'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

UPDATE test_case
SET description = 'TC Independence: 1건 결제 완료 "직후"(트랜잭션 종료 후) 3초 내 동일 금액+카드로 새 건 시도 차단. 중복 결제 감지 메커니즘 검증. (참고: "승인 중 재시도"는 트랜잭션 진행 중 Lock이므로 다른 메커니즘)'
WHERE title = '동일 카드 연속 승인 차단'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

-- ============================================
-- 7. 부분 취소 TC precondition 보완
-- ============================================
UPDATE test_case
SET preconditions = '상품 A(5,000원) + 상품 B(3,000원) + 상품 C(2,000원) = 10,000원 합산 결제 완료 상태',
    steps = '[{"order":1,"action":"10,000원 합산 결제 건 선택","expected":"거래 상세 표시 (상품 A+B+C)"},{"order":2,"action":"상품 B(3,000원)에 대해 부분 취소","expected":"부분 취소 처리"},{"order":3,"action":"잔여 금액 확인","expected":"7,000원 잔여, 부분취소 영수증에 취소 항목(상품 B) 명시"}]'::jsonb,
    expected_result = '7,000원 잔여, 부분취소 영수증에 취소 항목(상품 B) 명시'
WHERE title = '부분 취소'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

-- ============================================
-- 8. 당일/익일 취소 분리 (1→2)
-- ============================================

-- 기존 TC 수정 → 당일 취소 (매입 전 승인취소)
UPDATE test_case
SET title = '당일 취소 — 매입 전 승인취소',
    description = '도메인 배경: 신용카드 결제는 승인→매입→정산 순서로 처리된다. 매입 전(당일)에는 "승인취소"로 처리되어 카드사 청구 자체가 발생하지 않는다. 매입 후(익일~)와는 API 호출 및 고객 체감이 다르므로 별도 검증.',
    preconditions = '당일 승인 완료 거래 존재 (아직 매입 전)',
    steps = '[{"order":1,"action":"당일 승인 거래 선택","expected":"거래 상세 표시, \"매입 전\" 상태 확인"},{"order":2,"action":"취소 진행","expected":"VAN사에 \"승인취소\" 요청 전송"},{"order":3,"action":"취소 완료 확인","expected":"즉시 취소 처리, 카드사 청구 없음"}]'::jsonb,
    expected_result = '즉시 승인취소, 카드사 청구 없음'
WHERE title = '당일/익일 취소 구분'
  AND product_id = (SELECT p.id FROM product p JOIN company c ON p.company_id = c.id WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%');

-- 신규: 익일 취소 (매입 후 환불)
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '익일 취소 — 매입 후 환불 처리',
  '도메인 배경: 매입 후(익일~)에는 "환불"로 처리되며, 카드사가 청구 후 환불금을 2~3영업일 뒤 입금한다. 당일 취소(승인취소)와는 API 호출 경로, 처리 시간, 고객 안내 문구가 모두 다르므로 별도 검증.',
  '전일 승인 + 매입 완료된 거래 존재',
  '[{"order":1,"action":"전일(매입 완료) 거래 선택","expected":"거래 상세 표시, \"매입 완료\" 상태 확인"},{"order":2,"action":"취소 진행","expected":"VAN사에 \"환불\" 요청 전송"},{"order":3,"action":"환불 안내 확인","expected":"\"환불 처리되었습니다. 2~3영업일 내 입금\" 안내 표시"}]'::jsonb,
  '환불 처리, 2~3영업일 입금 안내 표시',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '취소/환불' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '당일/익일 취소' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '익일 취소 — 매입 후 환불 처리' AND product_id = p.id);

-- ============================================
-- 9. 영수증 용지 복구 TC 추가
-- ============================================
INSERT INTO test_case (product_id, path, title, description, preconditions, steps, expected_result, priority, test_type, status)
SELECT p.id, ARRAY[s1.id, s2.id, s3.id]::BIGINT[],
  '용지 충전 후 복구 — 알림 해제 및 영수증 재출력',
  'Recovery Testing 3단계(감지→보호→복구) 중 복구 단계. 용지 충전 후 시스템이 정상 상태로 돌아가고, 미출력 영수증을 재출력할 수 있는지 검증.',
  '용지 없음 상태에서 결제 승인 완료 (영수증 미출력)',
  '[{"order":1,"action":"영수증 용지 충전","expected":"\"용지 없음\" 알림 해제"},{"order":2,"action":"미출력 영수증 재출력 시도","expected":"이전 결제의 영수증 정상 출력"},{"order":3,"action":"새 결제 진행","expected":"정상 결제 + 영수증 자동 출력 (복구 후 첫 정상 동작)"}]'::jsonb,
  '알림 해제, 미출력 영수증 재출력, 이후 결제 정상',
  'HIGH', 'FUNCTIONAL', 'ACTIVE'
FROM product p
JOIN company c ON p.company_id = c.id
JOIN segment s1 ON p.id = s1.product_id AND s1.name = '결제 단말기' AND s1.parent_id IS NULL
JOIN segment s2 ON p.id = s2.product_id AND s2.name = '영수증' AND s2.parent_id = s1.id
JOIN segment s3 ON p.id = s3.product_id AND s3.name = '용지 장애' AND s3.parent_id = s2.id
WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND NOT EXISTS (SELECT 1 FROM test_case WHERE title = '용지 충전 후 복구 — 알림 해제 및 영수증 재출력' AND product_id = p.id);

-- ============================================
-- 10. TestRun 재구성
-- ============================================

-- 기존 결제 단말기 TestRun의 TC 연결 해제
DELETE FROM test_run_test_case
WHERE test_run_id IN (
    SELECT tr.id FROM test_run tr
    JOIN product p ON tr.product_id = p.id
    JOIN company c ON p.company_id = c.id
    WHERE p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
);

-- Smoke Test (7개: 기존 5 + 페이스페이 정상 + 영수증 내용)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Smoke Test' AND p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND tc.title IN (
    'IC카드 정상 결제', 'QR 결제 (토스페이)', 'NFC 결제 (삼성페이)',
    '전체 취소', '일마감 집계 정확성',
    '페이스페이 정상 결제', 'IC카드 결제 — 영수증 출력 및 내용 검증'
  );

-- 결제 안전성 검증 (7개: 기존 5 + PIN 잠금 + 한도초과)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '결제 안전성 검증' AND p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND tc.title IN (
    '망취소(Reversal) 자동 처리', '중복 결제 방지 — 승인 중 재시도',
    'IC카드 중간 제거 시 롤백', 'VAN사 네트워크 타임아웃', '동일 카드 연속 승인 차단',
    'PIN 5회 연속 오류 — 카드 잠금', '카드 한도 초과 결제 시도 — 차단 확인'
  );

-- 보안 점검 (4개: 기존 2 + 페이스페이 보안 2)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '보안 점검' AND p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND tc.title IN (
    'PAN 마스킹 검증', '로그 평문 저장 금지',
    '페이스페이 보안 — 유사 얼굴 거부', '페이스페이 보안 — 사진/영상 공격 차단'
  );

-- 취소/환불 검증 (5개: 기존 4에서 당일/익일 분리 → 5)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = '취소/환불 검증' AND p.name = '결제 단말기' AND c.name LIKE '%Toss Place%'
  AND tc.title IN (
    '전체 취소', '부분 취소', '당일 취소 — 매입 전 승인취소',
    '익일 취소 — 매입 후 환불 처리', '망취소(Reversal) 자동 처리'
  );

-- Full Regression (전체)
INSERT INTO test_run_test_case (test_run_id, test_case_id)
SELECT tr.id, tc.id
FROM test_run tr
JOIN product p ON tr.product_id = p.id
JOIN company c ON p.company_id = c.id
JOIN test_case tc ON tc.product_id = p.id
WHERE tr.name = 'Full Regression' AND p.name = '결제 단말기' AND c.name LIKE '%Toss Place%';
