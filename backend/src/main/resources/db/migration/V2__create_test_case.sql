CREATE TABLE test_case (
    id              BIGSERIAL PRIMARY KEY,
    feature_id      BIGINT NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    preconditions   TEXT,
    steps           JSONB NOT NULL DEFAULT '[]',
    expected_result TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    test_type       VARCHAR(20) NOT NULL DEFAULT 'FUNCTIONAL',
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_test_case_feature_id ON test_case(feature_id);
