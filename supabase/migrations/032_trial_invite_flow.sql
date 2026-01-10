-- Migration 032: Trial Invite Flow
-- Purpose: Enable magic link invites with automatic trial activation

-- ============================================
-- 1. CREATE FUNCTION: ensure_company_trial
-- ============================================
-- Idempotent function to ensure a company has a trial subscription
-- Called after first login via invite link
CREATE OR REPLACE FUNCTION public.ensure_company_trial(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_trial_plan_id UUID;
  v_existing_subscription UUID;
BEGIN
  -- Find the newest company membership for this user (prefer owner role)
  SELECT cm.company_id INTO v_company_id
  FROM public.company_members cm
  WHERE cm.user_id = p_user_id
  ORDER BY 
    CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END,
    cm.created_at DESC
  LIMIT 1;

  -- If no membership found, return NULL
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'No company membership found for user %', p_user_id;
    RETURN NULL;
  END IF;

  -- Get trial plan ID
  SELECT id INTO v_trial_plan_id
  FROM public.subscription_plans
  WHERE plan_key = 'trial'
  LIMIT 1;

  IF v_trial_plan_id IS NULL THEN
    RAISE EXCEPTION 'Trial plan not found';
  END IF;

  -- Check if subscription already exists
  SELECT id INTO v_existing_subscription
  FROM public.company_subscriptions
  WHERE company_id = v_company_id;

  -- If subscription exists and is active/paid, do nothing (idempotent)
  IF v_existing_subscription IS NOT NULL THEN
    -- Check if subscription is already active/paid (not trialing)
    IF EXISTS (
      SELECT 1 FROM public.company_subscriptions
      WHERE id = v_existing_subscription
      AND status IN ('active', 'past_due')
      AND trial_ends_at IS NULL
    ) THEN
      RAISE NOTICE 'Company % already has active/paid subscription, skipping trial', v_company_id;
      RETURN v_company_id;
    END IF;

    -- If subscription exists but is trialing or canceled, update it
    UPDATE public.company_subscriptions
    SET
      plan_id = v_trial_plan_id,
      status = 'trialing',
      trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '30 days'),
      current_period_end = COALESCE(trial_ends_at, NOW() + INTERVAL '30 days'),
      updated_at = NOW()
    WHERE id = v_existing_subscription
    AND (trial_ends_at IS NULL OR status = 'canceled');

    RETURN v_company_id;
  END IF;

  -- Create new trial subscription
  INSERT INTO public.company_subscriptions (
    company_id,
    plan_id,
    status,
    payment_provider,
    trial_ends_at,
    current_period_end
  ) VALUES (
    v_company_id,
    v_trial_plan_id,
    'trialing',
    'manual',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (company_id) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    status = 'trialing',
    trial_ends_at = COALESCE(company_subscriptions.trial_ends_at, EXCLUDED.trial_ends_at),
    current_period_end = COALESCE(company_subscriptions.trial_ends_at, EXCLUDED.current_period_end),
    updated_at = NOW();

  RETURN v_company_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_company_trial IS 'Ensures a company has a trial subscription. Idempotent - does not overwrite active/paid subscriptions.';

-- ============================================
-- 2. IMPROVE RLS POLICIES FOR COMPANIES TABLE
-- ============================================
-- Ensure companies table has proper RLS for authenticated users

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;

-- Create policy: Users can view companies where they are members
CREATE POLICY "Users can view companies they belong to"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.company_id = companies.id
    AND cm.user_id = auth.uid()
  )
);

-- ============================================
-- 3. IMPROVE RLS POLICIES FOR COMPANY_MEMBERS
-- ============================================
-- Ensure company_members can be joined properly

-- Policy already exists from migration 023, but ensure it's correct
DROP POLICY IF EXISTS "Users can view their own company membership" ON public.company_members;

CREATE POLICY "Users can view their own company membership"
ON public.company_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- ============================================
-- 4. GRANT EXECUTE PERMISSION
-- ============================================
GRANT EXECUTE ON FUNCTION public.ensure_company_trial TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_company_trial TO service_role;

