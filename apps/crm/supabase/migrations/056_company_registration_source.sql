-- Acquisition source tracking on companies (was in archived 044, never applied).
-- Fixes SuperAdmin /superadmin/companies empty list (42703 registration_source).

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS utm_source        TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium        TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign      TEXT,
  ADD COLUMN IF NOT EXISTS referrer_url      TEXT;

COMMENT ON COLUMN companies.registration_source IS 'Acquisition channel: direct | google_oauth | manual | organic | referral | google_ads';
COMMENT ON COLUMN companies.utm_source       IS 'UTM source parameter captured at registration';
COMMENT ON COLUMN companies.utm_medium       IS 'UTM medium parameter captured at registration';
COMMENT ON COLUMN companies.utm_campaign     IS 'UTM campaign parameter captured at registration';
COMMENT ON COLUMN companies.referrer_url     IS 'document.referrer URL captured at registration';

-- Keep audit payload in sync when the trigger function exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_company_creation') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION log_company_creation()
      RETURNS TRIGGER AS $body$
      BEGIN
        INSERT INTO platform_audit_logs (
          event_type,
          company_id,
          actor_user_id,
          payload
        ) VALUES (
          'company_created',
          NEW.id,
          auth.uid(),
          jsonb_build_object(
            'company_name',         NEW.name,
            'company_slug',         NEW.slug,
            'plan',                 NEW.plan,
            'registration_source',  NEW.registration_source,
            'utm_source',           NEW.utm_source,
            'utm_medium',           NEW.utm_medium,
            'utm_campaign',         NEW.utm_campaign
          )
        );
        RETURN NEW;
      EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER;
    $fn$;
  END IF;
END $$;
