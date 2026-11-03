ALTER TABLE agent_execution_job
    ADD COLUMN started_at    TIMESTAMP,
    ADD COLUMN worker_id     VARCHAR(100),
    ADD COLUMN test_case_ids BIGINT[];

CREATE TABLE agent_step_screenshot (
    id           BIGSERIAL PRIMARY KEY,
    job_id       BIGINT      NOT NULL REFERENCES agent_execution_job(id) ON DELETE CASCADE,
    test_case_id BIGINT      NOT NULL,
    step_order   INT         NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    data         BYTEA       NOT NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT now(),
    UNIQUE (job_id, test_case_id, step_order)
);
CREATE INDEX idx_agent_step_screenshot_created ON agent_step_screenshot(created_at);
