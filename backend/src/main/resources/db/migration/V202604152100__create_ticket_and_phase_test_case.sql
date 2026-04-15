-- Ticket (test_result:ticket = 1:N, Jira 이슈 참조 전용)
CREATE TABLE ticket (
    id              BIGSERIAL PRIMARY KEY,
    test_result_id  BIGINT NOT NULL REFERENCES test_result(id) ON DELETE CASCADE,
    jira_key        VARCHAR(50) NOT NULL,
    jira_url        VARCHAR(500) NOT NULL,
    summary         VARCHAR(500) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_result ON ticket(test_result_id);

-- Phase-TestCase 직접 연결 (TestRun 경유 없이 개별 TC 추가)
CREATE TABLE version_phase_test_case (
    id                BIGSERIAL PRIMARY KEY,
    version_phase_id  BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_case_id      BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    added_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (version_phase_id, test_case_id)
);
CREATE INDEX idx_vptc_phase ON version_phase_test_case(version_phase_id);
CREATE INDEX idx_vptc_tc ON version_phase_test_case(test_case_id);

-- Product에 Jira 프로젝트 키 (선택)
ALTER TABLE product ADD COLUMN jira_project_key VARCHAR(20);
