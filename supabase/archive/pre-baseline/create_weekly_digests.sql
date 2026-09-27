-- Create weekly_digests table for AI-generated weekly reports
CREATE TABLE IF NOT EXISTS public.weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'failed')),
  error_message TEXT,
  
  -- Indexes for performance
  CONSTRAINT unique_company_period UNIQUE (company_id, period_from, period_to)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weekly_digests_company_id ON public.weekly_digests(company_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_period ON public.weekly_digests(period_from DESC, period_to DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_created_at ON public.weekly_digests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_status ON public.weekly_digests(status);

-- Enable RLS
ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role can do everything on weekly_digests"
  ON public.weekly_digests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

