-- Add order_index to segment table for sibling ordering within same parent group.
-- Backfill existing rows by id ascending within each (product_id, parent_id) group.

-- 1. Add column with default 0
ALTER TABLE segment ADD COLUMN order_index INT NOT NULL DEFAULT 0;

-- 2. Backfill: assign 0..N within each (product_id, parent_id) group, ordered by id
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY product_id, COALESCE(parent_id, -1)
               ORDER BY id ASC
           ) - 1 AS rn
    FROM segment
)
UPDATE segment s
SET order_index = ranked.rn
FROM ranked
WHERE s.id = ranked.id;

-- 3. Composite index for ordered retrieval
CREATE INDEX idx_segment_parent_order
    ON segment(product_id, parent_id, order_index);
