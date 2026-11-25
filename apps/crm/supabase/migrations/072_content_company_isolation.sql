-- 072_content_company_isolation.sql
--
-- Isolate pergola_projects and articles by company. Gallery columns and RLS
-- are in 071_gallery_company_id.sql — apply 071 first.
--
-- Backfill uses the Pashkovsky companies.id already stored in 057/058/064
-- and lib/tazrim/access.ts.
-- Do not run this from the app. Apply it yourself in Supabase.
--
-- Public reads are not granted to anon. Marketing routes use the service role
-- and must filter company_id plus published = true.

-- ---------------------------------------------------------------------------
-- pergola_projects.company_id + published
-- ---------------------------------------------------------------------------
ALTER TABLE public.pergola_projects
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.pergola_projects
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

UPDATE public.pergola_projects
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

UPDATE public.pergola_projects
SET published = true
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
  AND published = false;

ALTER TABLE public.pergola_projects
  ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pergola_projects_company_id_fkey'
  ) THEN
    ALTER TABLE public.pergola_projects
      ADD CONSTRAINT pergola_projects_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pergola_projects_company_id
  ON public.pergola_projects (company_id);

CREATE INDEX IF NOT EXISTS idx_pergola_projects_company_published
  ON public.pergola_projects (company_id, published);

-- ---------------------------------------------------------------------------
-- articles.company_id (column already exists, nullable, all null today)
-- ---------------------------------------------------------------------------
UPDATE public.articles
SET company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
WHERE company_id IS NULL;

ALTER TABLE public.articles
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_slug_key;

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_company_slug_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_company_slug_key'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_company_slug_key UNIQUE (company_id, slug);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- gallery_images.published — public routes return only published rows.
-- company_id is also added here so this script does not depend on 071
-- already being committed. 071 still owns the gallery FKs, uniques, and RLS.
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

ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

UPDATE public.gallery_images
SET published = true
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid;

CREATE INDEX IF NOT EXISTS idx_gallery_images_company_published
  ON public.gallery_images (company_id, published);

-- ---------------------------------------------------------------------------
-- Drop open SELECT policies. Membership reads only. No anon table read.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('pergola_projects', 'articles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.pergola_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pergola_projects FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.articles FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pergola_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.articles TO authenticated;
GRANT ALL ON TABLE public.pergola_projects TO service_role;
GRANT ALL ON TABLE public.articles TO service_role;

CREATE POLICY pergola_projects_select_member
  ON public.pergola_projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = pergola_projects.company_id
    )
  );

CREATE POLICY pergola_projects_insert_member
  ON public.pergola_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = pergola_projects.company_id
    )
  );

CREATE POLICY pergola_projects_update_member
  ON public.pergola_projects
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = pergola_projects.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = pergola_projects.company_id
    )
  );

CREATE POLICY pergola_projects_delete_member
  ON public.pergola_projects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = pergola_projects.company_id
    )
  );

CREATE POLICY articles_select_member
  ON public.articles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = articles.company_id
    )
  );

CREATE POLICY articles_insert_member
  ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = articles.company_id
    )
  );

CREATE POLICY articles_update_member
  ON public.articles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = articles.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = articles.company_id
    )
  );

CREATE POLICY articles_delete_member
  ON public.articles
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.user_id = auth.uid() AND m.company_id = articles.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- Storage quota. Limit is subscription_plans.limits.storage_mb (numeric).
-- NULL limit means unlimited. Usage is company_usage.storage_used_mb for the
-- current month, seeded from the previous month when the new row is still 0.
-- Service role only. The app calls this on upload and delete.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_consume_storage_mb(
  p_company_id uuid,
  p_delta_mb numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit numeric;
  v_used numeric;
  v_prev numeric;
  v_id uuid;
  v_next numeric;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF p_company_id IS NULL OR p_delta_mb IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_arguments');
  END IF;

  SELECT NULLIF(sp.limits->>'storage_mb', '')::numeric
    INTO v_limit
  FROM public.company_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.company_id = p_company_id
  ORDER BY cs.created_at DESC NULLS LAST
  LIMIT 1;

  v_start := date_trunc('month', timezone('utc', now()));
  v_end := v_start + interval '1 month';

  INSERT INTO public.company_usage (company_id, period_start, period_end, storage_used_mb)
  VALUES (p_company_id, v_start, v_end, 0)
  ON CONFLICT (company_id, period_start) DO NOTHING;

  SELECT id, COALESCE(storage_used_mb, 0)
    INTO v_id, v_used
  FROM public.company_usage
  WHERE company_id = p_company_id
    AND period_start = v_start
  FOR UPDATE;

  IF v_used = 0 AND p_delta_mb > 0 THEN
    SELECT COALESCE(storage_used_mb, 0)
      INTO v_prev
    FROM public.company_usage
    WHERE company_id = p_company_id
      AND period_start < v_start
    ORDER BY period_start DESC
    LIMIT 1;
    v_used := COALESCE(v_prev, 0);
  END IF;

  v_next := GREATEST(v_used + p_delta_mb, 0);

  IF v_limit IS NOT NULL AND p_delta_mb > 0 AND v_next > v_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'storage_quota_exceeded',
      'used_mb', v_used,
      'limit_mb', v_limit
    );
  END IF;

  UPDATE public.company_usage
  SET storage_used_mb = v_next,
      updated_at = now()
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'used_mb', v_next, 'limit_mb', v_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_storage_mb(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_storage_mb(uuid, numeric) TO service_role;
