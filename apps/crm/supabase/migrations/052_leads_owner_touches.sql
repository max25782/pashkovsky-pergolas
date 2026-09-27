-- =============================================================================
-- Migration 052: lead owner, next action, attempt counter, touch history
-- Purely additive — schema changes only. No data is written here.
-- Owner back-fill: run scripts/backfill-lead-owner.sql separately.
-- =============================================================================

-- 1. New columns on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_owner_id   uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_action_at  timestamp with time zone,
  ADD COLUMN IF NOT EXISTS attempt_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_result text
    CHECK (last_touch_result IS NULL OR last_touch_result IN
      ('דיברנו', 'לא ענה', 'תפוס', 'דחה', 'לא רלוונטי')),
  ADD COLUMN IF NOT EXISTS lost_reason     text;

-- 2. Back-fill is intentionally NOT done here.
--    Owner assignment is a data operation, not a schema operation.
--    Run scripts/backfill-lead-owner.sql separately after the migration
--    to assign the company owner to all existing leads.

-- 3. Indexes on new columns
CREATE INDEX IF NOT EXISTS idx_leads_owner
  ON public.leads(lead_owner_id);

CREATE INDEX IF NOT EXISTS idx_leads_next_action
  ON public.leads(company_id, next_action_at)
  WHERE next_action_at IS NOT NULL;

-- 4. Touch history table
CREATE TABLE IF NOT EXISTS public.lead_touches (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id         uuid    NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  touched_at      timestamp with time zone DEFAULT now() NOT NULL,
  touch_type      text    NOT NULL
    CHECK (touch_type IN ('call', 'message', 'visit', 'note')),
  result          text
    CHECK (result IS NULL OR result IN
      ('דיברנו', 'לא ענה', 'תפוס', 'דחה', 'לא רלוונטי')),
  author_id       uuid    NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note            text,
  next_action_at  timestamp with time zone  -- the date set at time of touch
);

CREATE INDEX IF NOT EXISTS idx_lead_touches_lead_id
  ON public.lead_touches(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_touches_touched_at
  ON public.lead_touches(touched_at DESC);

-- 5. RLS for lead_touches
ALTER TABLE public.lead_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own company lead touches"
  ON public.lead_touches AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    lead_id IN (
      SELECT l.id FROM public.leads l
      JOIN public.company_members cm ON cm.company_id = l.company_id
      WHERE cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT l.id FROM public.leads l
      JOIN public.company_members cm ON cm.company_id = l.company_id
      WHERE cm.user_id = auth.uid()
    )
  );

-- 6. Function: record a touch and update the lead in one transaction.
--    Called from the client: supabase.rpc('record_lead_touch', { ... })
--
--    Security model:
--      - SECURITY DEFINER: executes as the function owner (postgres), not the caller.
--        This is necessary to write to lead_touches bypassing per-table RLS inside
--        the function body. The function enforces authorization explicitly.
--      - EXECUTE revoked from PUBLIC and re-granted only to 'authenticated'.
--        Anonymous callers cannot invoke this function.
--      - The function checks that auth.uid() is a member of the company that owns
--        the lead. If not, an exception is raised and no rows are written.

CREATE OR REPLACE FUNCTION public.record_lead_touch(
  p_lead_id         uuid,
  p_touch_type      text,
  p_result          text,
  p_note            text,
  p_next_action_at  timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_is_member  boolean;
BEGIN
  -- 1. Resolve the company that owns this lead.
  SELECT company_id INTO v_company_id
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'lead not found: %', p_lead_id;
  END IF;

  -- 2. Verify the caller is a member of that company.
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = v_company_id
      AND user_id    = auth.uid()
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'unauthorized: caller is not a member of the lead''s company';
  END IF;

  -- 3. Validate touch_type.
  IF p_touch_type NOT IN ('call', 'message', 'visit', 'note') THEN
    RAISE EXCEPTION 'invalid touch_type: %. Allowed: call, message, visit, note', p_touch_type;
  END IF;

  -- 4. Validate result value.
  IF p_result IS NOT NULL AND p_result NOT IN
      ('דיברנו', 'לא ענה', 'תפוס', 'דחה', 'לא רלוונטי') THEN
    RAISE EXCEPTION 'invalid result value: %', p_result;
  END IF;

  -- 5. Insert touch record — author_id = auth.uid() (NOT NULL, enforced by column).
  INSERT INTO public.lead_touches (lead_id, touch_type, result, note, next_action_at, author_id)
  VALUES (p_lead_id, p_touch_type, p_result, p_note, p_next_action_at, auth.uid());

  -- 6. Update the lead — same transaction, either both commit or both roll back.
  UPDATE public.leads
  SET
    last_touch_result = p_result,
    next_action_at    = p_next_action_at,
    attempt_count     = COALESCE(attempt_count, 0) + 1
  WHERE id = p_lead_id;
END;
$$;

-- Revoke broad defaults, grant only to authenticated (not anon, not public).
REVOKE EXECUTE ON FUNCTION public.record_lead_touch(
  uuid, text, text, text, timestamp with time zone
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_lead_touch(
  uuid, text, text, text, timestamp with time zone
) TO authenticated;
