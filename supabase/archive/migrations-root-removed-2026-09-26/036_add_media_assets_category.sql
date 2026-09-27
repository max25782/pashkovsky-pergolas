-- Catalog grouping: media_assets.category (pergolas | railings | fences | laundry_covers)
-- Safe to run if column already exists (IF NOT EXISTS).

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets (company_id, category) WHERE category IS NOT NULL;

COMMENT ON COLUMN media_assets.category IS 'Catalog category: pergolas | railings | fences | laundry_covers';
