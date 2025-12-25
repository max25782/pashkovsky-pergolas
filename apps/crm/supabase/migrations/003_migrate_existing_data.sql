-- ============================================
-- Phase 1: Multi-Tenant Foundation
-- Migrate existing data to Pashkovsky company
-- ============================================

-- Step 1: Create default company "Pashkovsky Group"
INSERT INTO companies (id, name, slug, status, plan, industry, primary_email)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Pashkovsky Group',
  'pashkovsky',
  'active',
  'enterprise', -- текущий владелец получает все фичи
  'pergola',
  'info@pashkovsky-group.com'
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Update all existing records to belong to Pashkovsky company
DO $$
DECLARE
  pashkovsky_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  deals_count INT := 0;
  leads_count INT := 0;
  workers_count INT := 0;
  shifts_count INT := 0;
  offers_count INT := 0;
  orders_count INT := 0;
  chats_count INT := 0;
  digests_count INT := 0;
BEGIN
  -- Update deals (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    UPDATE deals SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS deals_count = ROW_COUNT;
  END IF;
  
  -- Update leads (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    UPDATE leads SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS leads_count = ROW_COUNT;
  END IF;
  
  -- Update workers (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
    UPDATE workers SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS workers_count = ROW_COUNT;
  END IF;
  
  -- Update work_shifts (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_shifts') THEN
    UPDATE work_shifts SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS shifts_count = ROW_COUNT;
  END IF;
  
  -- Update offers (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offers') THEN
    UPDATE offers SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS offers_count = ROW_COUNT;
  END IF;
  
  -- Update material_orders (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_orders') THEN
    UPDATE material_orders SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS orders_count = ROW_COUNT;
  END IF;
  
  -- Update ai_chat_sessions (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_sessions') THEN
    UPDATE ai_chat_sessions SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS chats_count = ROW_COUNT;
  END IF;
  
  -- Update weekly_digests (if table exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_digests') THEN
    UPDATE weekly_digests SET company_id = pashkovsky_id WHERE company_id IS NULL;
    GET DIAGNOSTICS digests_count = ROW_COUNT;
  END IF;
  
  RAISE NOTICE '✅ Migrated existing data:';
  RAISE NOTICE '   - Deals: %', deals_count;
  RAISE NOTICE '   - Leads: %', leads_count;
  RAISE NOTICE '   - Workers: %', workers_count;
  RAISE NOTICE '   - Work Shifts: %', shifts_count;
  RAISE NOTICE '   - Offers: %', offers_count;
  RAISE NOTICE '   - Material Orders: %', orders_count;
  RAISE NOTICE '   - AI Chats: %', chats_count;
  RAISE NOTICE '   - Weekly Digests: %', digests_count;
END $$;

-- Step 3: Make company_id NOT NULL (only for tables that exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    ALTER TABLE deals ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ deals.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE leads ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ leads.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
    ALTER TABLE workers ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ workers.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_shifts') THEN
    ALTER TABLE work_shifts ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ work_shifts.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offers') THEN
    ALTER TABLE offers ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ offers.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_orders') THEN
    ALTER TABLE material_orders ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ material_orders.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_sessions') THEN
    ALTER TABLE ai_chat_sessions ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ ai_chat_sessions.company_id is now NOT NULL';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_digests') THEN
    ALTER TABLE weekly_digests ALTER COLUMN company_id SET NOT NULL;
    RAISE NOTICE '✅ weekly_digests.company_id is now NOT NULL';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All existing data migrated to Pashkovsky Group';
  RAISE NOTICE '✅ company_id is now required (NOT NULL)';
END $$;

