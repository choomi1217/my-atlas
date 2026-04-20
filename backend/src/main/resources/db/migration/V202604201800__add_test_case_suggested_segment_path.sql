-- Test Studio v2: persist Claude-suggested Segment path names on each DRAFT TC.
-- `path` column (Long[] of segment IDs) stays empty until the user explicitly applies a recommendation
-- or manually assigns a path — no forced/automatic injection from code.
ALTER TABLE test_case
    ADD COLUMN suggested_segment_path TEXT[] NULL;

COMMENT ON COLUMN test_case.suggested_segment_path IS
    'Claude recommendation (segment name array). NULL for manually-created TCs. Applied to path only on explicit user action.';
