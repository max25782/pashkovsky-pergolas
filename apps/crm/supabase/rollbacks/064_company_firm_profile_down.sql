-- Rollback for 064_company_firm_profile.sql.
--
-- NOT APPLIED. Drops the three added columns. The seeded phone, vat_number and
-- primary_email of the first customer's row stay (they were filled into columns that
-- existed before); clear them by hand if you need the exact pre-064 state.
-- After the rollback the app reads the new fields as empty: WhatsApp buttons are hidden.

BEGIN;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS whatsapp_template,
  DROP COLUMN IF EXISTS whatsapp_number,
  DROP COLUMN IF EXISTS website;

COMMIT;
