-- Drop unique index on version_phase(version_id, order_index)
-- Reordering phases requires temporary duplicate order_index values during swap
DROP INDEX IF EXISTS idx_version_phase_order;
