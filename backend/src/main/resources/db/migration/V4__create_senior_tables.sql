-- FAQ 테이블 (개인 QA 경험/위키)
CREATE TABLE faq (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    tags        VARCHAR(500),
    embedding   VECTOR(1536),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base 테이블 (QA 서적 프롬프트)
CREATE TABLE knowledge_base (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    category    VARCHAR(100),
    tags        VARCHAR(500),
    embedding   VECTOR(1536),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Convention 테이블 (팀 용어 컨벤션)
CREATE TABLE convention (
    id          BIGSERIAL PRIMARY KEY,
    term        VARCHAR(200) NOT NULL,
    definition  TEXT NOT NULL,
    category    VARCHAR(100),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 벡터 검색용 IVFFlat 인덱스
CREATE INDEX idx_faq_embedding ON faq USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kb_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
