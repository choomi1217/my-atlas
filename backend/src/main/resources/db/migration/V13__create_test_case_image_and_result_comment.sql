-- TestCase에 첨부된 이미지 (1:N)
CREATE TABLE test_case_image (
    id             BIGSERIAL PRIMARY KEY,
    test_case_id   BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    filename       VARCHAR(255) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    order_index    INT NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_test_case_image_tc ON test_case_image(test_case_id);

-- TestResult 댓글 스레드 (대댓글: self-ref parent_id)
CREATE TABLE test_result_comment (
    id              BIGSERIAL PRIMARY KEY,
    test_result_id  BIGINT NOT NULL REFERENCES test_result(id) ON DELETE CASCADE,
    parent_id       BIGINT REFERENCES test_result_comment(id) ON DELETE CASCADE,
    author          VARCHAR(100),
    content         TEXT NOT NULL,
    image_url       VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trc_result ON test_result_comment(test_result_id);
CREATE INDEX idx_trc_parent ON test_result_comment(parent_id);
