-- AI usage log: tracks every AI API call (chat completion + embedding)
CREATE TABLE ai_usage_log (
    id              BIGSERIAL PRIMARY KEY,
    feature         VARCHAR(50)  NOT NULL,
    provider        VARCHAR(20)  NOT NULL,
    model           VARCHAR(80)  NOT NULL,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    total_tokens    INTEGER,
    estimated_cost  NUMERIC(10,6),
    duration_ms     BIGINT       NOT NULL,
    success         BOOLEAN      NOT NULL DEFAULT TRUE,
    error_message   VARCHAR(500),
    username        VARCHAR(50),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_log_feature    ON ai_usage_log(feature);
CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_provider   ON ai_usage_log(provider);

-- API access log: tracks every API request for feature usage statistics
CREATE TABLE api_access_log (
    id              BIGSERIAL PRIMARY KEY,
    method          VARCHAR(10)  NOT NULL,
    uri             VARCHAR(500) NOT NULL,
    feature         VARCHAR(50),
    status_code     INTEGER      NOT NULL,
    duration_ms     BIGINT       NOT NULL,
    username        VARCHAR(50),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_access_log_feature    ON api_access_log(feature);
CREATE INDEX idx_api_access_log_created_at ON api_access_log(created_at);
