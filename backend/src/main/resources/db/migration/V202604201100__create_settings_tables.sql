-- System-wide settings (key-value store)
CREATE TABLE system_settings (
    id            BIGSERIAL    PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(500) NOT NULL,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Seed default settings
INSERT INTO system_settings (setting_key, setting_value) VALUES
('ai_enabled', 'true'),
('session_timeout_seconds', '3600');

-- User-Company access mapping (N:M)
CREATE TABLE user_company_access (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    company_id  BIGINT    NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, company_id)
);
