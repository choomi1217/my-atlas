-- Phase:TestRun 1:1 → 1:N migration
-- Adds junction table version_phase_test_run, migrates existing data, drops old column

-- Phase A: Create junction table (additive, zero risk)
CREATE TABLE version_phase_test_run (
    id               BIGSERIAL PRIMARY KEY,
    version_phase_id BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_run_id      BIGINT NOT NULL REFERENCES test_run(id) ON DELETE CASCADE,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (version_phase_id, test_run_id)
);
CREATE INDEX idx_vptr_phase ON version_phase_test_run(version_phase_id);
CREATE INDEX idx_vptr_run ON version_phase_test_run(test_run_id);

-- Phase B: Copy existing data from version_phase.test_run_id into junction
INSERT INTO version_phase_test_run (version_phase_id, test_run_id)
SELECT id, test_run_id FROM version_phase WHERE test_run_id IS NOT NULL;

-- Phase C: Drop old column, FK constraint, and index
ALTER TABLE version_phase DROP CONSTRAINT IF EXISTS version_phase_test_run_id_fkey;
DROP INDEX IF EXISTS idx_version_phase_test_run;
ALTER TABLE version_phase DROP COLUMN test_run_id;
