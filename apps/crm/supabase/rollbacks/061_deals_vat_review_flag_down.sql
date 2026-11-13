-- Rollback for 061_deals_vat_review_flag.sql.
--
-- NOT APPLIED. Removes the review flag columns. Migration 061 changed no
-- price, cost or stage, so nothing else needs undoing.
--
-- public.deals_backup_061 is intentionally kept: drop it by hand once you no
-- longer need the copy (DROP TABLE public.deals_backup_061;).

BEGIN;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_vat_review_status_check;
ALTER TABLE public.deals
  DROP COLUMN IF EXISTS vat_review_status,
  DROP COLUMN IF EXISTS vat_review_note;

COMMIT;
