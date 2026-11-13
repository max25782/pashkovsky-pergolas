-- Deals: VAT review flag, with a full backup of the table first.
--
-- NOT APPLIED. Review, then apply by hand (SQL editor or `supabase db push`).
-- Reversible: rollbacks/061_deals_vat_review_flag_down.sql.
--
-- What this does NOT do: it does not recalculate or change any price, cost or
-- stage. VAT payable, net profit and the other new figures are derived on the
-- fly from deals.price (VAT included), deals.my_cost (VAT included), the worker
-- shifts and company_settings.vat_percent (lib/deals/deal-finance.ts), so old
-- deals already show the new numbers without touching a row.
--
-- What it does:
--   1. Backs up public.deals as public.deals_backup_061 (service role only).
--   2. Adds two nullable columns to deals for manual review:
--        vat_review_status  NULL                    never flagged
--                           'suspect_net_price'     price equals an offer's
--                                                   total BEFORE VAT, so it may
--                                                   have been typed without VAT
--                           'suspect_negative_margin' materials cost (with VAT)
--                                                   is above the price
--                           'reviewed_ok'           a person checked it, fine
--                           'reviewed_fixed'        a person corrected the price
--        vat_review_note    free text for the reviewer
--   3. Flags the suspicious deals by the two rules above. A flagged deal is
--      recalculated only by hand after review: the flag changes no money value.
--
-- Report of 2026-11-13 on production (company 6998295e-...), run before this
-- file was written: 225 deals, 137 with price 0 (all of them also materials 0),
-- 150 with materials 0, 0 with materials above price, 0 with a price equal to an
-- offer's pre-VAT total, 64 priced deals with no offer (VAT status of the price
-- cannot be verified from data). So steps 3 flags nothing today; it is here so
-- the same file is safe to run later or on other tenants.

BEGIN;

-- 1. Backup (data only; run once, never overwritten).
CREATE TABLE IF NOT EXISTS public.deals_backup_061 AS
  SELECT * FROM public.deals;

ALTER TABLE public.deals_backup_061 ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.deals_backup_061 IS
  'Full copy of public.deals taken before migration 061. Safe to drop after the review period.';

-- 2. Review flag.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS vat_review_status text,
  ADD COLUMN IF NOT EXISTS vat_review_note text;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_vat_review_status_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_vat_review_status_check
  CHECK (
    vat_review_status IS NULL
    OR vat_review_status IN (
      'suspect_net_price',
      'suspect_negative_margin',
      'reviewed_ok',
      'reviewed_fixed'
    )
  );

-- 3. Flag suspicious deals. Never overrides a status a person already set.
UPDATE public.deals d
SET vat_review_status = 'suspect_net_price',
    vat_review_note = 'Price equals an offer total before VAT; check that VAT was not left out.'
WHERE d.vat_review_status IS NULL
  AND coalesce(d.price, 0) > 0
  AND EXISTS (
    SELECT 1
    FROM public.offers o
    WHERE o.deal_id::text = d.id::text
      AND abs(coalesce(o.total_before_vat, 0) - d.price) <= 1
      AND abs(coalesce(o.final_price, 0) - d.price) > 1
  );

UPDATE public.deals d
SET vat_review_status = 'suspect_negative_margin',
    vat_review_note = 'Materials cost is above the price; check both amounts.'
WHERE d.vat_review_status IS NULL
  AND coalesce(d.price, 0) > 0
  AND coalesce(d.my_cost, 0) > d.price;

COMMIT;
