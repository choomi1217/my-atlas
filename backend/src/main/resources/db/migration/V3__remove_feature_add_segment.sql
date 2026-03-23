-- V3: Remove Feature entity, add Segment table, modify TestCase to use Product + Segment path

-- 1. Create segment table (Adjacency List pattern)
CREATE TABLE segment (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    parent_id  BIGINT REFERENCES segment(id) ON DELETE CASCADE
);
CREATE INDEX idx_segment_product_id ON segment(product_id);
CREATE INDEX idx_segment_parent_id ON segment(parent_id);

-- 2. Delete existing test_case data (dev environment, destructive migration)
DELETE FROM test_case;

-- 3. Modify test_case: remove feature_id, add product_id + path + description + prompt_text
ALTER TABLE test_case DROP CONSTRAINT IF EXISTS test_case_feature_id_fkey;
ALTER TABLE test_case DROP COLUMN feature_id;
DROP INDEX IF EXISTS idx_test_case_feature_id;

ALTER TABLE test_case ADD COLUMN product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE;
ALTER TABLE test_case ADD COLUMN path BIGINT[] DEFAULT '{}';
ALTER TABLE test_case ADD COLUMN description TEXT;
ALTER TABLE test_case ADD COLUMN prompt_text TEXT;
CREATE INDEX idx_test_case_product_id ON test_case(product_id);

-- 4. Drop feature table
DROP TABLE IF EXISTS feature;
