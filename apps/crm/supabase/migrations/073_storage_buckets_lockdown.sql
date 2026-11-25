-- 073_storage_buckets_lockdown.sql
--
-- Close anonymous writes on configurator buckets and make deal-files private.
-- Apply yourself. This file is not pushed and is not run by the app.
--
-- gallery-images stays a public marketing bucket (10 MiB, images only).
-- Objects must live under {company_id}/... — the app enforces that prefix.
-- There is no anon INSERT policy on any of these buckets after this migration.
--
-- deal-files, configurator-photos, and configurator-results are private.
-- The browser cannot insert into them. Uploads go through server routes that
-- check the session, size, MIME type, rate limit, and storage quota, then
-- return a signed URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'gallery-images',
    'gallery-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
  ),
  (
    'configurator-photos',
    'configurator-photos',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
  ),
  (
    'configurator-results',
    'configurator-results',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'deal-files',
    'deal-files',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  )
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- gallery-images is a public catalog. Do not flip it to private here.
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE id = 'gallery-images';

-- Drop every storage.objects policy that names the locked buckets.
-- Also drop INSERT/UPDATE/DELETE policies that name gallery-images.
DO $$
DECLARE
  r record;
  qual text;
  chk text;
BEGIN
  FOR r IN
    SELECT pol.polname AS name,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk,
           pol.polcmd AS cmd
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'storage'
      AND cls.relname = 'objects'
  LOOP
    qual := coalesce(r.qual, '');
    chk := coalesce(r.chk, '');
    IF qual ILIKE '%deal-files%'
       OR chk ILIKE '%deal-files%'
       OR qual ILIKE '%configurator-photos%'
       OR chk ILIKE '%configurator-photos%'
       OR qual ILIKE '%configurator-results%'
       OR chk ILIKE '%configurator-results%'
       OR (
         (qual ILIKE '%gallery-images%' OR chk ILIKE '%gallery-images%')
         AND r.cmd::text IN ('a', 'w', 'd', '*')
       )
    THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.name);
    END IF;
  END LOOP;
END $$;

-- No client INSERT. service_role bypasses RLS and is the only writer.
-- Public marketing reads of gallery-images stay SELECT-only.
DROP POLICY IF EXISTS gallery_images_public_read ON storage.objects;
CREATE POLICY gallery_images_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'gallery-images');
