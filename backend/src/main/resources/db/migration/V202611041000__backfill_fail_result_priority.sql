-- v32 이전 FAIL 결과는 priority가 비어 있어 전부 '확인 필요'(릴리즈 NO-GO)로 잡힌다. 빈 값만 채운다.

-- 1) 티켓이 있는 FAIL: 마지막 티켓의 priority (발행할 때 사람이 정한 값)
UPDATE test_result tr
SET priority = t.priority
FROM (SELECT DISTINCT ON (test_result_id) test_result_id, priority
      FROM ticket
      ORDER BY test_result_id, created_at DESC) t
WHERE tr.id = t.test_result_id
  AND tr.status = 'FAIL'
  AND tr.priority IS NULL;

-- 2) 티켓 없는 사람·CI FAIL: TC priority (HIGH/MEDIUM/LOW). AI(AGENT) FAIL은 사람 확인 전이라 비워 둔다
UPDATE test_result tr
SET priority = tc.priority
FROM test_case tc
WHERE tr.test_case_id = tc.id
  AND tr.status = 'FAIL'
  AND tr.executed_by IN ('HUMAN', 'CI')
  AND tr.priority IS NULL;
