-- V17: Knowledge Base Soft Delete + Category Table

-- 1. Soft Delete 컬럼 추가
ALTER TABLE knowledge_base ADD COLUMN deleted_at TIMESTAMP;

-- 2. 카테고리 테이블 생성 (자동 완성용)
CREATE TABLE kb_category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_kb_category_name UNIQUE (name)
);

-- 3. 기존 카테고리 데이터를 kb_category로 마이그레이션
INSERT INTO kb_category (name)
SELECT DISTINCT category FROM knowledge_base
WHERE category IS NOT NULL AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

-- 4. Soft Delete 인덱스 (삭제되지 않은 항목 필터용)
CREATE INDEX idx_kb_deleted_at ON knowledge_base (deleted_at)
    WHERE deleted_at IS NULL;
