-- Fix version_phase.test_run_id FK to cascade on delete
-- Without this, deleting a test_run that's still referenced by version_phase fails
ALTER TABLE version_phase DROP CONSTRAINT IF EXISTS version_phase_test_run_id_fkey;
ALTER TABLE version_phase ADD CONSTRAINT version_phase_test_run_id_fkey
    FOREIGN KEY (test_run_id) REFERENCES test_run(id) ON DELETE CASCADE;
