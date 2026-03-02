-- ============================================================
-- media_assets — image tagging system for AI chat
-- Tags are stored in Supabase (NOT in S3 object tags).
-- Presigned URLs are generated at runtime; only S3 keys stored here.
-- Schema is multi-tenant ready (company_id on every row + RLS).
-- ============================================================

-- Available AI tag categories (Hebrew)
-- 'פרגולה קלאסית' | 'פרגולה היי-טק' | 'פרגולה למטבח חוץ' | 'פרגולה ביוקלמטיק'
-- 'פרגולה pvc'    | 'פרגולה תלויה'   | 'פרגולה דמוי עץ'   | 'פרגולה יוקרה עם כיסוי זכוכית'

CREATE TABLE IF NOT EXISTS media_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL,
  s3_bucket   TEXT NOT NULL,
  s3_key      TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  BIGINT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One key per company (same key can exist for different companies)
  UNIQUE (company_id, s3_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_company_id
  ON media_assets (company_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_company_key
  ON media_assets (company_id, s3_key);

-- GIN index for fast array containment queries: tags @> ARRAY['פרגולה קלאסית']
CREATE INDEX IF NOT EXISTS idx_media_assets_tags
  ON media_assets USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
  ON media_assets (created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_media_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON media_assets;
CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_media_assets_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Helper: get company_id for the current authenticated user
-- (reuse existing pattern from other tables in this project)
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT company_id
  FROM company_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Members of a company can read/write their own media_assets rows
CREATE POLICY media_assets_select ON media_assets
  FOR SELECT USING (company_id = current_company_id());

CREATE POLICY media_assets_insert ON media_assets
  FOR INSERT WITH CHECK (company_id = current_company_id());

CREATE POLICY media_assets_update ON media_assets
  FOR UPDATE USING (company_id = current_company_id());

-- TODO (multi-tenant v2): when companies can share buckets with prefixes,
-- add a check that s3_key starts with 'images/{company_id}/' here.
