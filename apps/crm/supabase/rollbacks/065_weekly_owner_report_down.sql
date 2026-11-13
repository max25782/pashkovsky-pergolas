-- Rollback for 065_weekly_owner_report.sql.
--
-- NOT APPLIED. Drops the three tables (planned payments entered by firms are lost).
-- After the rollback the weekly report cron finds no settings table and sends nothing;
-- the planned-payments panel on a deal shows an error toast instead of rows.

BEGIN;

DROP TABLE IF EXISTS public.weekly_report_log;
DROP TABLE IF EXISTS public.weekly_report_settings;
DROP TABLE IF EXISTS public.planned_payments;

COMMIT;
