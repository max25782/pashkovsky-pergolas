-- Enable RLS with proper policies for multi-tenant SaaS
-- This ensures each company can only see their own data

-- =============================================
-- DEALS TABLE
-- =============================================

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see deals from their company
CREATE POLICY "Users can view own company deals"
ON public.deals
FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can insert deals for their company
CREATE POLICY "Users can insert own company deals"
ON public.deals
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can update deals from their company
CREATE POLICY "Users can update own company deals"
ON public.deals
FOR UPDATE
USING (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can delete deals from their company
CREATE POLICY "Users can delete own company deals"
ON public.deals
FOR DELETE
USING (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- =============================================
-- LEADS TABLE
-- =============================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company leads"
ON public.leads FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own company leads"
ON public.leads FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own company leads"
ON public.leads FOR UPDATE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own company leads"
ON public.leads FOR DELETE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

-- =============================================
-- WORKERS TABLE
-- =============================================

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company workers"
ON public.workers FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own company workers"
ON public.workers FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own company workers"
ON public.workers FOR UPDATE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own company workers"
ON public.workers FOR DELETE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

-- =============================================
-- OFFERS TABLE
-- =============================================

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company offers"
ON public.offers FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own company offers"
ON public.offers FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own company offers"
ON public.offers FOR UPDATE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own company offers"
ON public.offers FOR DELETE
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

-- =============================================
-- VERIFICATION
-- =============================================

-- Check RLS status
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('deals', 'leads', 'workers', 'offers')
ORDER BY tablename;

-- List all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('deals', 'leads', 'workers', 'offers')
ORDER BY tablename, policyname;

