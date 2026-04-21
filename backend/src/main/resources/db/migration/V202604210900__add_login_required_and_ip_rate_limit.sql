-- Platform v9: 로그인 bypass 토글 + IP Rate Limiting 지원

-- 1) system_settings 신규 키 시드 (기본값은 기존 동작 유지)
INSERT INTO system_settings (setting_key, setting_value)
VALUES ('login_required', 'true')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('ai_rate_limit_per_ip', '30')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('ai_rate_limit_window_seconds', '3600')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) ip_address 칼럼 추가 (Rate Limit 집계 및 비로그인 AI 사용 추적)
ALTER TABLE api_access_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);

-- 3) Rate Limit 집계 및 IP 단위 접근 로그 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_api_access_log_ip_created_at
    ON api_access_log(ip_address, created_at);
