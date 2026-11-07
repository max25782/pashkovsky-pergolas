-- 057_tazrim_tables.sql
--
-- Tazrim (cash flow) inside the CRM. Tables are prefixed tz_ to avoid clashes
-- with CRM tables and reuse the CRM `companies` and `company_members`
-- (no separate Tazrim companies/app_users).
--
-- Access model: only owner/admin members of the Pashkovsky company can read or
-- write any tz_* row. Enforced here by RLS (tz_has_access) and again in the app
-- (lib/tazrim/access.ts). anon has no access.
--
-- NOT applied automatically: review, then run on a Supabase branch or staging
-- first. Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tz_has_access(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2'::uuid
    AND EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.user_id = auth.uid()
        AND m.company_id = p_company_id
        AND m.role IN ('owner', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.tz_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tz_has_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tz_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'other',
  payment_mode text,
  pdf_format text,
  contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  purpose text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  last4 text,
  purpose text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tz_integrations_company_provider_key UNIQUE (company_id, provider)
);

CREATE TABLE IF NOT EXISTS public.tz_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_type text,
  related_table text,
  related_id uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  plate_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cash flow core
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tz_recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(14, 2),
  currency text NOT NULL DEFAULT 'ILS',
  frequency text NOT NULL DEFAULT 'monthly',
  is_variable boolean NOT NULL DEFAULT false,
  next_due_date date,
  vendor_id uuid REFERENCES public.tz_vendors(id),
  category_id uuid REFERENCES public.tz_expense_categories(id),
  integration_id uuid REFERENCES public.tz_integrations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_supplier_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.tz_vendors(id),
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0,
  current_balance numeric(14, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tz_supplier_debts_company_vendor_key UNIQUE (company_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS public.tz_cash_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  due_date date NOT NULL,
  cleared_date date,
  status text NOT NULL DEFAULT 'planned',
  source text NOT NULL DEFAULT 'manual',
  external_source text,
  external_id text,
  payment_method text,
  notes text,
  vendor_id uuid REFERENCES public.tz_vendors(id),
  category_id uuid REFERENCES public.tz_expense_categories(id),
  card_id uuid REFERENCES public.tz_payment_cards(id),
  debt_id uuid REFERENCES public.tz_supplier_debts(id),
  recurring_rule_id uuid REFERENCES public.tz_recurring_rules(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Required by upsert(..., { onConflict: 'company_id,external_source,external_id' })
  -- in the CRM sync. Multiple NULL external ids stay allowed (manual rows).
  CONSTRAINT tz_cash_events_external_key UNIQUE (company_id, external_source, external_id)
);

CREATE TABLE IF NOT EXISTS public.tz_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_event_id uuid NOT NULL REFERENCES public.tz_cash_events(id) ON DELETE CASCADE,
  check_number text,
  bank_name text,
  bounce_risk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_bank_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.tz_bank_accounts(id) ON DELETE CASCADE,
  balance numeric(14, 2) NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Invoices, orders, payroll, taxes (schema carried over; not all used in UI yet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tz_vendor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.tz_vendors(id),
  document_id uuid REFERENCES public.tz_documents(id),
  total_amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_invoice_id uuid NOT NULL REFERENCES public.tz_vendor_invoices(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.tz_vehicles(id),
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  description text,
  line_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.tz_vendors(id),
  document_id uuid REFERENCES public.tz_documents(id),
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  description text,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_pdf_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.tz_documents(id) ON DELETE CASCADE,
  extracted_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_payroll_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deduction_type text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  period_start date,
  period_end date,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  recipient_vendor_id uuid REFERENCES public.tz_vendors(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_tax_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_type text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  period_start date,
  period_end date,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_vendor_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.tz_vendors(id) ON DELETE CASCADE,
  term_description text,
  default_split jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tz_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tz_cash_events_company_due ON public.tz_cash_events (company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tz_cash_events_vendor ON public.tz_cash_events (vendor_id);
CREATE INDEX IF NOT EXISTS idx_tz_cash_events_debt ON public.tz_cash_events (debt_id);
CREATE INDEX IF NOT EXISTS idx_tz_checks_cash_event ON public.tz_checks (cash_event_id);
CREATE INDEX IF NOT EXISTS idx_tz_snapshots_account_at ON public.tz_bank_balance_snapshots (bank_account_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_tz_recurring_rules_next_due ON public.tz_recurring_rules (company_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_tz_vendors_company ON public.tz_vendors (company_id);

-- ---------------------------------------------------------------------------
-- RLS: owner/admin of the Pashkovsky company only; anon has nothing
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tz_tables text[] := ARRAY[
    'tz_vendors', 'tz_expense_categories', 'tz_bank_accounts', 'tz_payment_cards',
    'tz_integrations', 'tz_documents', 'tz_vehicles', 'tz_recurring_rules',
    'tz_supplier_debts', 'tz_cash_events', 'tz_checks', 'tz_bank_balance_snapshots',
    'tz_vendor_invoices', 'tz_invoice_line_items', 'tz_orders', 'tz_pdf_extractions',
    'tz_payroll_deductions', 'tz_tax_liabilities', 'tz_vendor_payment_terms', 'tz_audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tz_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS tz_owner_admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tz_owner_admin_all ON public.%I AS PERMISSIVE FOR ALL TO authenticated '
      'USING (public.tz_has_access(company_id)) WITH CHECK (public.tz_has_access(company_id))',
      t
    );
  END LOOP;
END $$;
