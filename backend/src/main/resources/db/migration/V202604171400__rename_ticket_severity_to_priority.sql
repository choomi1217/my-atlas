-- =============================================================================
-- Ticket: severity → priority 변환 (Jira Priority 체계로 통일)
-- CRITICAL/MAJOR/MINOR/TRIVIAL → HIGHEST/HIGH/MEDIUM/LOW/LOWEST
-- =============================================================================

-- 1. 컬럼 이름 변경
ALTER TABLE ticket RENAME COLUMN severity TO priority;

-- 2. 기존 값 변환
UPDATE ticket SET priority = 'HIGHEST' WHERE priority = 'CRITICAL';
UPDATE ticket SET priority = 'MEDIUM'  WHERE priority = 'MAJOR';
UPDATE ticket SET priority = 'LOW'     WHERE priority = 'MINOR';
UPDATE ticket SET priority = 'LOWEST'  WHERE priority = 'TRIVIAL';
