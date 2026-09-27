-- ============================================
-- Phase 1: Multi-Tenant Foundation
-- Add company_id to all tables (SAFE VERSION)
-- Only adds to tables that exist
-- ============================================

DO $$
BEGIN
  -- Deals
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
    RAISE NOTICE '✅ Added company_id to deals';
  ELSE
    RAISE NOTICE '⚠️  Table deals does not exist, skipping';
  END IF;

  -- Leads
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
    RAISE NOTICE '✅ Added company_id to leads';
  ELSE
    RAISE NOTICE '⚠️  Table leads does not exist, skipping';
  END IF;

  -- Workers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_workers_company ON workers(company_id);
    RAISE NOTICE '✅ Added company_id to workers';
  ELSE
    RAISE NOTICE '⚠️  Table workers does not exist, skipping';
  END IF;

  -- Work Shifts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_shifts') THEN
    ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_work_shifts_company ON work_shifts(company_id);
    RAISE NOTICE '✅ Added company_id to work_shifts';
  ELSE
    RAISE NOTICE '⚠️  Table work_shifts does not exist, skipping';
  END IF;

  -- Offers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offers') THEN
    ALTER TABLE offers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_offers_company ON offers(company_id);
    RAISE NOTICE '✅ Added company_id to offers';
  ELSE
    RAISE NOTICE '⚠️  Table offers does not exist, skipping';
  END IF;

  -- Material Orders
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_orders') THEN
    ALTER TABLE material_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_material_orders_company ON material_orders(company_id);
    RAISE NOTICE '✅ Added company_id to material_orders';
  ELSE
    RAISE NOTICE '⚠️  Table material_orders does not exist, skipping';
  END IF;

  -- AI Chat Sessions (OPTIONAL - may not exist)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_sessions') THEN
    ALTER TABLE ai_chat_sessions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_company ON ai_chat_sessions(company_id);
    RAISE NOTICE '✅ Added company_id to ai_chat_sessions';
  ELSE
    RAISE NOTICE '⚠️  Table ai_chat_sessions does not exist, skipping';
  END IF;

  -- Weekly Digests (OPTIONAL - may not exist)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_digests') THEN
    ALTER TABLE weekly_digests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_weekly_digests_company ON weekly_digests(company_id);
    RAISE NOTICE '✅ Added company_id to weekly_digests';
  ELSE
    RAISE NOTICE '⚠️  Table weekly_digests does not exist, skipping';
  END IF;

  -- Note: pergola_projects and gallery are shared across all companies (no company_id needed)

  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE '📋 Note: Some tables may have been skipped if they do not exist';
END $$;

