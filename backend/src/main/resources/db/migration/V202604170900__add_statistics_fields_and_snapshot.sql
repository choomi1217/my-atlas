-- =============================================================================
-- V202604170900: 통계 기능을 위한 기존 테이블 필드 추가 + daily_test_snapshot 신설
-- =============================================================================

-- 1. ticket 테이블에 통계 필드 추가
ALTER TABLE ticket ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'MAJOR';
ALTER TABLE ticket ADD COLUMN closed_at TIMESTAMP;
ALTER TABLE ticket ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0;

-- 2. version_phase 테이블에 유형/기간 필드 추가
ALTER TABLE version_phase ADD COLUMN phase_type VARCHAR(20) NOT NULL DEFAULT 'FIRST';
ALTER TABLE version_phase ADD COLUMN start_date DATE;
ALTER TABLE version_phase ADD COLUMN end_date DATE;

-- Backfill: start_date를 created_at 기준으로 설정
UPDATE version_phase SET start_date = created_at::date WHERE start_date IS NULL;

-- 3. daily_test_snapshot 테이블 생성
CREATE TABLE daily_test_snapshot (
    id                BIGSERIAL PRIMARY KEY,
    version_id        BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    phase_id          BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    snapshot_date     DATE NOT NULL,

    -- TC 실행 통계
    total_tc          INTEGER NOT NULL DEFAULT 0,
    pass_count        INTEGER NOT NULL DEFAULT 0,
    fail_count        INTEGER NOT NULL DEFAULT 0,
    blocked_count     INTEGER NOT NULL DEFAULT 0,
    skipped_count     INTEGER NOT NULL DEFAULT 0,
    retest_count      INTEGER NOT NULL DEFAULT 0,
    untested_count    INTEGER NOT NULL DEFAULT 0,

    -- 버그 통계 (당일 기준)
    new_bug_critical  INTEGER NOT NULL DEFAULT 0,
    new_bug_major     INTEGER NOT NULL DEFAULT 0,
    new_bug_minor     INTEGER NOT NULL DEFAULT 0,
    new_bug_trivial   INTEGER NOT NULL DEFAULT 0,
    closed_bug_count  INTEGER NOT NULL DEFAULT 0,
    open_bug_count    INTEGER NOT NULL DEFAULT 0,
    aging_bug_count   INTEGER NOT NULL DEFAULT 0,

    -- 산출 지표
    pass_rate         DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    progress_rate     DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (phase_id, snapshot_date)
);

CREATE INDEX idx_snapshot_version ON daily_test_snapshot(version_id);
CREATE INDEX idx_snapshot_phase_date ON daily_test_snapshot(phase_id, snapshot_date);
CREATE INDEX idx_snapshot_date ON daily_test_snapshot(snapshot_date);
