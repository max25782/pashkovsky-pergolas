-- Rollback for 063_deal_stages.sql.
--
-- NOT APPLIED. Drops the per-firm column table. Custom columns, renames and
-- colors are lost; the app goes back to the aluminium set. Deals keep their
-- deals.stage value, so a deal in a custom column would have a key the
-- aluminium set does not know and is shown in the first column. Move such deals
-- first (see the count below) if there are any.
--
--   SELECT d.stage, count(*) FROM public.deals d
--   WHERE d.stage NOT IN ('new','measure','offer','offer_approved','material_ordered','approved','production','install','done')
--   GROUP BY d.stage;

BEGIN;

DROP TABLE IF EXISTS public.deal_stages;

COMMIT;
