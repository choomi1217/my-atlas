-- Convert test_case.expected_result (TEXT) to test_case.expected_results (JSONB array of strings)
-- Migration approach: add new column, backfill from old, drop old.

-- 1. Add new JSONB column
ALTER TABLE test_case ADD COLUMN expected_results JSONB;

-- 2. Backfill from old single-string column
--    - non-empty old value → wrap in 1-element JSON array
--    - NULL or empty old value → NULL (stays empty)
UPDATE test_case
SET expected_results = jsonb_build_array(expected_result)
WHERE expected_result IS NOT NULL
  AND expected_result <> '';

-- 3. Drop old column
ALTER TABLE test_case DROP COLUMN expected_result;
