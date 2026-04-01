-- Add category column for catalog grouping (pergolas, railings, fences, laundry_covers)
-- Tags remain for AI/search; catalog uses category only.

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets (company_id, category) WHERE category IS NOT NULL;

COMMENT ON COLUMN media_assets.category IS 'Catalog category: pergolas | railings | fences | laundry_covers';
