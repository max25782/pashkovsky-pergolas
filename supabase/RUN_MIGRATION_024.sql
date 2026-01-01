-- ==========================================
-- QUICK START: Apply Migration 024
-- ==========================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor

-- Step 1: Check if tables already exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    RAISE NOTICE '⚠️  WARNING: subscription_plans already exists. It will be dropped and recreated.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_subscriptions') THEN
    RAISE NOTICE '⚠️  WARNING: company_subscriptions already exists. It will be dropped and recreated.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_history') THEN
    RAISE NOTICE '⚠️  WARNING: subscription_history already exists. It will be dropped and recreated.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins') THEN
    RAISE NOTICE '⚠️  WARNING: platform_admins already exists. It will be dropped and recreated.';
  END IF;
END $$;

-- Step 2: Apply the full migration
-- Copy the ENTIRE content of: supabase/migrations/024_subscription_management.sql
-- and paste it here in Supabase SQL Editor

-- After running the migration, verify:
SELECT 'subscription_plans' as table_name, COUNT(*) as records FROM public.subscription_plans
UNION ALL
SELECT 'company_subscriptions', COUNT(*) FROM public.company_subscriptions
UNION ALL
SELECT 'subscription_history', COUNT(*) FROM public.subscription_history
UNION ALL
SELECT 'platform_admins', COUNT(*) FROM public.platform_admins;

-- Expected output:
-- | table_name              | records |
-- |-------------------------|---------|
-- | subscription_plans      | 4       | ✅ (trial, basic, pro, enterprise)
-- | company_subscriptions   | 1+      | ✅ (your company)
-- | subscription_history    | 0       | ✅ (empty initially)
-- | platform_admins         | 0       | ⚠️ (need to add yourself - see ADD_SUPERADMIN.sql)

-- Step 3: Add yourself as SUPERADMIN
-- Run: supabase/ADD_SUPERADMIN.sql

RAISE NOTICE '✅ Migration 024 verification complete!';

