-- =============================================================================
-- ANONYMIZE LOCAL DATABASE
-- Run immediately after restoring prod data to the local instance.
-- Safe to run multiple times (idempotent).
--
-- What is changed:
--   leads.phone   → '+9720000' || LPAD(ROW_NUMBER()::text, 7, '0')
--   leads.email   → 'lead+<id>@example.local'  (only where non-null)
--   leads.name    → 'לקוח <n>'
--   users.email   → 'user+<row>@example.local'
--   users.password_hash → NULL
--
-- What is NOT changed (needed for migration testing):
--   addresses, amounts, dates, statuses, geometry, company data, deal data
-- =============================================================================

-- 1. Anonymize leads
DO $$
DECLARE
  rec RECORD;
  n   INT := 0;
BEGIN
  FOR rec IN SELECT id FROM public.leads ORDER BY created_at LOOP
    n := n + 1;
    UPDATE public.leads SET
      phone = '+9720000' || LPAD(n::text, 7, '0'),
      email = CASE WHEN email IS NOT NULL THEN 'lead+' || id::text || '@example.local' ELSE NULL END,
      name  = 'לקוח ' || n
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 2. Anonymize users (keep IDs, wipe PII + credentials)
DO $$
DECLARE
  rec RECORD;
  n   INT := 0;
BEGIN
  FOR rec IN SELECT id FROM public.users ORDER BY created_at LOOP
    n := n + 1;
    UPDATE public.users SET
      email         = 'user+' || n || '@example.local',
      password_hash = NULL,
      full_name     = 'User ' || n,
      avatar_url    = NULL
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 3. Wipe sensitive tokens
TRUNCATE public.email_verification_tokens;
TRUNCATE public.password_reset_tokens;
TRUNCATE public.refresh_tokens;

-- 4. Verify
SELECT
  (SELECT COUNT(*) FROM public.leads WHERE phone NOT LIKE '+9720000%') AS leads_not_anonymized,
  (SELECT COUNT(*) FROM public.users WHERE email NOT LIKE '%@example.local') AS users_not_anonymized;
