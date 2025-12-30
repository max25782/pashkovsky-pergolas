-- ============================================
-- DATA MIGRATION SCRIPT
-- Migrate all data from old company to new company
-- ============================================

-- STEP 1: Find your new company ID
-- Run this first and copy the new company ID
SELECT id, name, status, plan 
FROM companies 
ORDER BY created_at DESC 
LIMIT 5;

-- STEP 2: Set variables (REPLACE WITH YOUR IDS!)
-- Old company (usually the one with enterprise plan or 00000000-0000-0000-0000-000000000000)
-- New company (the one you just created)

DO $$
DECLARE
  old_company_id UUID := '00000000-0000-0000-0000-000000000000'; -- REPLACE THIS
  new_company_id UUID := 'YOUR_NEW_COMPANY_ID_HERE'; -- REPLACE THIS
BEGIN
  RAISE NOTICE 'Starting migration from % to %', old_company_id, new_company_id;

  -- ============================================
  -- MIGRATE LEADS
  -- ============================================
  UPDATE leads 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % leads', (SELECT COUNT(*) FROM leads WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE DEALS
  -- ============================================
  UPDATE deals 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % deals', (SELECT COUNT(*) FROM deals WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE OFFERS
  -- ============================================
  UPDATE offers 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % offers', (SELECT COUNT(*) FROM offers WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE WORKERS
  -- ============================================
  UPDATE workers 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % workers', (SELECT COUNT(*) FROM workers WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE WORK SHIFTS
  -- ============================================
  UPDATE work_shifts 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % work_shifts', (SELECT COUNT(*) FROM work_shifts WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE MATERIAL ORDERS
  -- ============================================
  UPDATE material_orders 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % material_orders', (SELECT COUNT(*) FROM material_orders WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE COMPANY SETTINGS
  -- ============================================
  UPDATE company_settings 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated company_settings';

  -- ============================================
  -- MIGRATE COMPANY SUBSCRIPTIONS
  -- ============================================
  UPDATE company_subscriptions 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated company_subscriptions';

  -- ============================================
  -- MIGRATE WEEKLY DIGESTS
  -- ============================================
  UPDATE weekly_digests 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % weekly_digests', (SELECT COUNT(*) FROM weekly_digests WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE AI CHAT SESSIONS
  -- ============================================
  UPDATE ai_chat_sessions 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % ai_chat_sessions', (SELECT COUNT(*) FROM ai_chat_sessions WHERE company_id = new_company_id);

  -- ============================================
  -- MIGRATE AI CHAT MESSAGES
  -- ============================================
  UPDATE ai_chat_messages m
  SET company_id = new_company_id 
  FROM ai_chat_sessions s
  WHERE m.session_id = s.id 
  AND s.company_id = new_company_id;
  
  RAISE NOTICE 'Migrated ai_chat_messages';

  -- ============================================
  -- MIGRATE AUDIT LOGS
  -- ============================================
  UPDATE audit_logs 
  SET company_id = new_company_id 
  WHERE company_id = old_company_id;
  
  RAISE NOTICE 'Migrated % audit_logs', (SELECT COUNT(*) FROM audit_logs WHERE company_id = new_company_id);

  RAISE NOTICE '✅ Migration completed successfully!';
END $$;

-- ============================================
-- STEP 3: VERIFY MIGRATION
-- ============================================
-- Check counts in new company
SELECT 
  (SELECT COUNT(*) FROM leads WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as leads_count,
  (SELECT COUNT(*) FROM deals WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as deals_count,
  (SELECT COUNT(*) FROM offers WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as offers_count,
  (SELECT COUNT(*) FROM workers WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as workers_count,
  (SELECT COUNT(*) FROM work_shifts WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as shifts_count,
  (SELECT COUNT(*) FROM material_orders WHERE company_id = 'YOUR_NEW_COMPANY_ID_HERE') as orders_count;

-- ============================================
-- STEP 4: UPDATE OLD COMPANY STATUS (OPTIONAL)
-- Mark old company as inactive
-- ============================================
UPDATE companies 
SET status = 'suspended',
    name = name || ' (OLD - MIGRATED)'
WHERE id = '00000000-0000-0000-0000-000000000000';

