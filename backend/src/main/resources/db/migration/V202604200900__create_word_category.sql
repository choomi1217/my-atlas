-- Word Category table for convention category autocomplete
CREATE TABLE word_category (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_word_category_name UNIQUE (name)
);

-- Seed existing convention categories into word_category
INSERT INTO word_category (name)
SELECT DISTINCT TRIM(category)
FROM convention
WHERE category IS NOT NULL AND TRIM(category) != ''
ON CONFLICT (name) DO NOTHING;
