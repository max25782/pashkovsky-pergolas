-- Migration 044: Add missing RLS policies to tables that lack tenant isolation
-- Tables that store per-company or per-user sensitive data must be protected.

-- =============================================
-- users table (contains password_hash)
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own record
CREATE POLICY "Users can view own record"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own record
CREATE POLICY "Users can update own record"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role can manage all users (backend operations)
CREATE POLICY "Service role manages users"
ON public.users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- email_verification_tokens
-- =============================================
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email tokens"
ON public.email_verification_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages email tokens"
ON public.email_verification_tokens FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- password_reset_tokens
-- =============================================
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own password reset tokens"
ON public.password_reset_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages password reset tokens"
ON public.password_reset_tokens FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- refresh_tokens
-- =============================================
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own refresh tokens"
ON public.refresh_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages refresh tokens"
ON public.refresh_tokens FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- audit_logs (company-scoped)
-- =============================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages audit logs"
ON public.audit_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- company_settings (company-scoped)
-- =============================================
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings"
ON public.company_settings FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own company settings"
ON public.company_settings FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages company settings"
ON public.company_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- articles (company-scoped; global articles have company_id IS NULL)
-- =============================================
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Allow reading: published articles (no company_id = global) or own company's articles
CREATE POLICY "Users can view published articles and own company articles"
ON public.articles FOR SELECT
TO authenticated
USING (
  published = true
  OR company_id IS NULL
  OR company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages articles"
ON public.articles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- onboarding_tasks (company-scoped)
-- =============================================
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company onboarding tasks"
ON public.onboarding_tasks FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages onboarding tasks"
ON public.onboarding_tasks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- company_usage (company-scoped)
-- =============================================
ALTER TABLE public.company_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company usage"
ON public.company_usage FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role manages company usage"
ON public.company_usage FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- gallery_categories / gallery_images (read-only public, write via service role)
-- =============================================
ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gallery categories"
ON public.gallery_categories FOR SELECT
USING (true);

CREATE POLICY "Service role manages gallery categories"
ON public.gallery_categories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gallery images"
ON public.gallery_images FOR SELECT
USING (true);

CREATE POLICY "Service role manages gallery images"
ON public.gallery_images FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- Verify
-- =============================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'email_verification_tokens', 'password_reset_tokens',
    'refresh_tokens', 'audit_logs', 'company_settings', 'articles',
    'onboarding_tasks', 'company_usage', 'gallery_categories', 'gallery_images'
  )
ORDER BY tablename;
