-- 결과 Priority (null = Unknown, AI 결과는 사람 확인 전까지 Unknown)
ALTER TABLE test_result ADD COLUMN priority VARCHAR(20);
