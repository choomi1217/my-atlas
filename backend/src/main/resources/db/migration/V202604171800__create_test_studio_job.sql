-- Create test_studio_job table
CREATE TABLE test_studio_job (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL,
    source_title VARCHAR(200) NOT NULL,
    source_content TEXT,
    source_file_path VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    generated_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX idx_test_studio_job_product_created ON test_studio_job(product_id, created_at DESC);

-- Add test_studio_job_id FK to test_case (nullable — manual TCs have NULL)
ALTER TABLE test_case ADD COLUMN test_studio_job_id BIGINT REFERENCES test_studio_job(id) ON DELETE SET NULL;
CREATE INDEX idx_test_case_test_studio_job ON test_case(test_studio_job_id);
