-- Weekly owner report: planned (stage) payments, per-firm report settings, send log.
--
-- NOT APPLIED. Review, then apply by hand. Reversible: rollbacks/065_weekly_owner_report_down.sql.
-- Independent of 063/064; nothing existing is altered (three new tables, no data touched).
--
-- planned_payments       Stage payments a firm enters per deal (advance, second payment, ...):
--                        amount and an optional due date. A row without a due date is reported on
--                        the weekly report's "no due date" line. Actual money stays in deal_payments.
-- weekly_report_settings One row per firm, created on first save. A firm without a row uses the
--                        defaults: ON, Sunday 08:00 Asia/Jerusalem, recipients = owners and admins.
-- weekly_report_log      One row per firm and week: the unique key is what stops a second send.
--                        week_start is the Sunday that starts the week of the send date.

BEGIN;

CREATE TABLE IF NOT EXISTS public.planned_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  due_date date,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planned_payments_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_planned_payments_company_due
  ON public.planned_payments (company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_planned_payments_deal
  ON public.planned_payments (deal_id);

CREATE TABLE IF NOT EXISTS public.weekly_report_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  -- NULL: owners and admins of the firm. A value: that single address.
  recipient_email text,
  -- 0 = Sunday ... 6 = Saturday
  weekday smallint NOT NULL DEFAULT 0,
  hour smallint NOT NULL DEFAULT 8,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  -- NULL: the firm's language (companies.settings.language), else Hebrew.
  language text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_report_settings_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT weekly_report_settings_hour_check CHECK (hour BETWEEN 0 AND 23),
  CONSTRAINT weekly_report_settings_language_check CHECK (language IS NULL OR language IN ('he', 'ru', 'en', 'sr'))
);

CREATE TABLE IF NOT EXISTS public.weekly_report_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  recipients text[],
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_report_log_company_week_unique UNIQUE (company_id, week_start),
  CONSTRAINT weekly_report_log_status_check CHECK (status IN ('sending', 'sent', 'no_data', 'no_recipients'))
);

-- Same model as deal_stages: the API uses the service role and checks the caller itself.
ALTER TABLE public.planned_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can do everything on planned_payments" ON public.planned_payments;
CREATE POLICY "Service role can do everything on planned_payments"
  ON public.planned_payments AS PERMISSIVE FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "Users can view own company planned_payments" ON public.planned_payments;
CREATE POLICY "Users can view own company planned_payments"
  ON public.planned_payments AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can do everything on weekly_report_settings" ON public.weekly_report_settings;
CREATE POLICY "Service role can do everything on weekly_report_settings"
  ON public.weekly_report_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "Users can view own company weekly_report_settings" ON public.weekly_report_settings;
CREATE POLICY "Users can view own company weekly_report_settings"
  ON public.weekly_report_settings AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can do everything on weekly_report_log" ON public.weekly_report_log;
CREATE POLICY "Service role can do everything on weekly_report_log"
  ON public.weekly_report_log AS PERMISSIVE FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);

COMMIT;
