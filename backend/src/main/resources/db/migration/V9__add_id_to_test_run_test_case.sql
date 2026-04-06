-- Add surrogate id column to test_run_test_case junction table
-- Required for JPA entity mapping (Hibernate expects a single-column @Id)
ALTER TABLE test_run_test_case DROP CONSTRAINT test_run_test_case_pkey;
ALTER TABLE test_run_test_case ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE test_run_test_case ADD CONSTRAINT uq_test_run_test_case UNIQUE (test_run_id, test_case_id);
