-- 티켓 발행처를 Jira 전용에서 일반화 (기존 행은 JIRA)
ALTER TABLE ticket RENAME COLUMN jira_key TO issue_key;
ALTER TABLE ticket RENAME COLUMN jira_url TO issue_url;
ALTER TABLE ticket ADD COLUMN tracker VARCHAR(20) NOT NULL DEFAULT 'JIRA';
