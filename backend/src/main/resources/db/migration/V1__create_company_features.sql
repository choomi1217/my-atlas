-- Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Create company table
CREATE TABLE company (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique index: only one is_active=true
CREATE UNIQUE INDEX idx_company_is_active_unique ON company(is_active) WHERE is_active = true;

-- Create product table
CREATE TABLE product (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_company FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_company_id ON product(company_id);

-- Create feature table
CREATE TABLE feature (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    path VARCHAR(500) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    prompt_text TEXT,
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feature_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);

CREATE INDEX idx_feature_product_id ON feature(product_id);
CREATE INDEX idx_feature_embedding ON feature USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
