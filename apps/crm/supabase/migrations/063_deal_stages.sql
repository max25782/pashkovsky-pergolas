-- Per-firm kanban columns.
--
-- NOT APPLIED. Review, then apply by hand (SQL editor or `supabase db push`).
-- Reversible: rollbacks/063_deal_stages_down.sql.
--
-- The app tolerates this migration not being applied yet: when the table is
-- missing or a firm has no rows, it uses the aluminium set (the nine columns
-- that used to be hardcoded). Deploying code first and applying this after is safe.
--
-- A column has:
--   key        immutable technical key; this is what deals.stage stores.
--   role       what the system relies on (statistics, profit, offer approval,
--              Tazrim, dashboard): signed | material_ordered | material_arrived |
--              in_production | installation | completed, or NULL for "no logic".
--   label      one name chosen by the firm; labels = per-language names
--              {"he","ru","en","sr"}. Both NULL = the built-in translated name.
--   color      Tailwind background class.
--   sort_order position; is_active = false hides the column.
--
-- Seed: every existing firm gets exactly the nine current columns (same keys,
-- colors, order, roles, built-in names). deals is not touched.

BEGIN;

CREATE TABLE IF NOT EXISTS public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  role text,
  label text,
  labels jsonb,
  color text NOT NULL DEFAULT 'bg-gray-500',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_stages_company_key_unique UNIQUE (company_id, key),
  CONSTRAINT deal_stages_key_check CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  CONSTRAINT deal_stages_role_check CHECK (
    role IS NULL OR role IN ('signed', 'material_ordered', 'material_arrived', 'in_production', 'installation', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_deal_stages_company_order
  ON public.deal_stages (company_id, sort_order);

ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;

-- Same model as public.workers: the API uses the service role and checks the
-- caller's role itself (owner/admin edit); signed-in members may read their own firm's rows.
DROP POLICY IF EXISTS "Service role can do everything on deal_stages" ON public.deal_stages;
CREATE POLICY "Service role can do everything on deal_stages"
  ON public.deal_stages AS PERMISSIVE FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "Users can view own company deal_stages" ON public.deal_stages;
CREATE POLICY "Users can view own company deal_stages"
  ON public.deal_stages AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()));

-- Seed the current nine columns for every existing firm (idempotent).
INSERT INTO public.deal_stages (company_id, key, role, label, labels, color, sort_order, is_active)
SELECT c.id, s.key, s.role, NULL, NULL, s.color, s.sort_order, true
FROM public.companies c
CROSS JOIN (VALUES
  ('new',              NULL::text,         'bg-gray-500',    0),
  ('measure',          NULL,               'bg-purple-500',  1),
  ('offer',            NULL,               'bg-yellow-500',  2),
  ('offer_approved',   'signed',           'bg-yellow-600',  3),
  ('material_ordered', 'material_ordered', 'bg-blue-500',    4),
  ('approved',         'material_arrived', 'bg-green-500',   5),
  ('production',       'in_production',    'bg-orange-500',  6),
  ('install',          'installation',     'bg-indigo-500',  7),
  ('done',             'completed',        'bg-emerald-600', 8)
) AS s(key, role, color, sort_order)
ON CONFLICT (company_id, key) DO NOTHING;

COMMIT;
