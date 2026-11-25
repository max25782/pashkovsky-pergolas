-- 071_gallery_company_id.sql
--
-- Tenant-isolate gallery_categories and gallery_images.
-- Backfill uses the Pashkovsky companies.id already stored in 057/058/064
-- and lib/tazrim/access.ts.
--
-- Public marketing reads must go through app routes that filter by company_id from the
-- request (service_role). There is no table-wide anon SELECT.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.gallery_categories
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.gallery_categories
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

UPDATE public.gallery_images
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.gallery_categories
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.gallery_images
  ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gallery_categories_company_id_fkey'
  ) THEN
    ALTER TABLE public.gallery_categories
      ADD CONSTRAINT gallery_categories_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gallery_images_company_id_fkey'
  ) THEN
    ALTER TABLE public.gallery_images
      ADD CONSTRAINT gallery_images_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gallery_categories_company_id
  ON public.gallery_categories (company_id);

CREATE INDEX IF NOT EXISTS idx_gallery_images_company_id
  ON public.gallery_images (company_id);

CREATE INDEX IF NOT EXISTS idx_gallery_images_company_category
  ON public.gallery_images (company_id, category_key);

-- ---------------------------------------------------------------------------
-- Uniques + composite FK (key is per-company, not global)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_category_key_fkey;

ALTER TABLE public.gallery_categories
  DROP CONSTRAINT IF EXISTS gallery_categories_key_key;

ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_category_key_filename_key;

ALTER TABLE public.gallery_categories
  DROP CONSTRAINT IF EXISTS gallery_categories_company_id_key_key;

ALTER TABLE public.gallery_categories
  ADD CONSTRAINT gallery_categories_company_id_key_key UNIQUE (company_id, key);

ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_company_category_filename_key;

ALTER TABLE public.gallery_images
  ADD CONSTRAINT gallery_images_company_category_filename_key
  UNIQUE (company_id, category_key, filename);

ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_company_category_fkey;

ALTER TABLE public.gallery_images
  ADD CONSTRAINT gallery_images_company_category_fkey
  FOREIGN KEY (company_id, category_key)
  REFERENCES public.gallery_categories (company_id, key)
  ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- image_count trigger: scope by company_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_gallery_category_image_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.gallery_categories
    SET image_count = image_count + 1
    WHERE key = NEW.category_key
      AND company_id = NEW.company_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.gallery_categories
    SET image_count = GREATEST(image_count - 1, 0)
    WHERE key = OLD.category_key
      AND company_id = OLD.company_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.category_key IS DISTINCT FROM OLD.category_key
       OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      UPDATE public.gallery_categories
      SET image_count = GREATEST(image_count - 1, 0)
      WHERE key = OLD.category_key
        AND company_id = OLD.company_id;
      UPDATE public.gallery_categories
      SET image_count = image_count + 1
      WHERE key = NEW.category_key
        AND company_id = NEW.company_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_category_count_on_update ON public.gallery_images;
CREATE TRIGGER update_category_count_on_update
  AFTER UPDATE OF category_key, company_id ON public.gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gallery_category_image_count();

-- ---------------------------------------------------------------------------
-- RLS: drop any existing policies, membership-only for authenticated.
-- No anon table-wide SELECT. Public reads use service_role + company_id filter.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('gallery_categories', 'gallery_images')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gallery_categories FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.gallery_images FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_images TO authenticated;
GRANT ALL ON TABLE public.gallery_categories TO service_role;
GRANT ALL ON TABLE public.gallery_images TO service_role;

CREATE POLICY gallery_categories_select_member
  ON public.gallery_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_categories.company_id
    )
  );

CREATE POLICY gallery_categories_insert_member
  ON public.gallery_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_categories.company_id
    )
  );

CREATE POLICY gallery_categories_update_member
  ON public.gallery_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_categories.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_categories.company_id
    )
  );

CREATE POLICY gallery_categories_delete_member
  ON public.gallery_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_categories.company_id
    )
  );

CREATE POLICY gallery_images_select_member
  ON public.gallery_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_images.company_id
    )
  );

CREATE POLICY gallery_images_insert_member
  ON public.gallery_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_images.company_id
    )
  );

CREATE POLICY gallery_images_update_member
  ON public.gallery_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_images.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_images.company_id
    )
  );

CREATE POLICY gallery_images_delete_member
  ON public.gallery_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = gallery_images.company_id
    )
  );
