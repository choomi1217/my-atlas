-- Chat session
CREATE TABLE chat_session (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat message
CREATE TABLE chat_message (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_message_session ON chat_message(session_id);
