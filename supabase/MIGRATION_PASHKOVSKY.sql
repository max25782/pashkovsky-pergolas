-- ============================================
-- DATA MIGRATION FOR PASHKOVSKY GROUP
-- From old company to: 6998295e-89ae-4e3d-afd2-8c2b0333eac2
-- ============================================

DO $$
DECLARE
  old_company_id UUID := '00000000-0000-0000-0000-000000000000';
  new_company_id UUID := '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
  leads_count INT;
  deals_count INT;
  offers_count INT;
BEGIN
  RAISE NOTICE '🚀 Starting migration from % to %', old_company_id, new_company_id;

  -- Leads
  UPDATE leads SET company_id = new_company_id WHERE company_id = old_company_id;
  GET DIAGNOSTICS leads_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % leads', leads_count;

  -- Deals
  UPDATE deals SET company_id = new_company_id WHERE company_id = old_company_id;
  GET DIAGNOSTICS deals_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % deals', deals_count;

  -- Offers
  UPDATE offers SET company_id = new_company_id WHERE company_id = old_company_id;
  GET DIAGNOSTICS offers_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % offers', offers_count;

  -- Workers
  UPDATE workers SET company_id = new_company_id WHERE company_id = old_company_id;
  RAISE NOTICE '✅ Migrated workers';

  -- Work Shifts
  UPDATE work_shifts SET company_id = new_company_id WHERE company_id = old_company_id;
  RAISE NOTICE '✅ Migrated work_shifts';

  -- Material Orders
  UPDATE material_orders SET company_id = new_company_id WHERE company_id = old_company_id;
  RAISE NOTICE '✅ Migrated material_orders';

  -- Settings & Subscriptions
  UPDATE company_settings SET company_id = new_company_id WHERE company_id = old_company_id;
  UPDATE company_subscriptions SET company_id = new_company_id WHERE company_id = old_company_id;
  RAISE NOTICE '✅ Migrated settings';

  -- AI & Analytics
  UPDATE ai_chat_sessions SET company_id = new_company_id WHERE company_id = old_company_id;
  UPDATE audit_logs SET company_id = new_company_id WHERE company_id = old_company_id;
  UPDATE weekly_digests SET company_id = new_company_id WHERE company_id = old_company_id;
  RAISE NOTICE '✅ Migrated AI & logs';

  RAISE NOTICE '🎉 Migration completed successfully!';
  RAISE NOTICE 'Total: % leads, % deals, % offers', leads_count, deals_count, offers_count;
END $$;

-- Verify migration
SELECT 
  (SELECT COUNT(*) FROM leads WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2') as leads,
  (SELECT COUNT(*) FROM deals WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2') as deals,
  (SELECT COUNT(*) FROM offers WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2') as offers,
  (SELECT COUNT(*) FROM workers WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2') as workers;

