-- Safe migration script - checks if tables exist before updating
DO $$
DECLARE
  old_company_id UUID := '00000000-0000-0000-0000-000000000000';
  new_company_id UUID := '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
  row_count INT;
BEGIN
  RAISE NOTICE '🚀 Starting safe migration...';

  -- Leads
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads') THEN
    UPDATE leads SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % leads', row_count;
  END IF;

  -- Deals
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deals') THEN
    UPDATE deals SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % deals', row_count;
  END IF;

  -- Offers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'offers') THEN
    UPDATE offers SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % offers', row_count;
  END IF;

  -- Workers
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workers') THEN
    UPDATE workers SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % workers', row_count;
  END IF;

  -- Work Shifts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'work_shifts') THEN
    UPDATE work_shifts SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % work_shifts', row_count;
  END IF;

  -- Material Orders
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'material_orders') THEN
    UPDATE material_orders SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % material_orders', row_count;
  END IF;

  -- Company Settings
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_settings') THEN
    UPDATE company_settings SET company_id = new_company_id WHERE company_id = old_company_id;
    RAISE NOTICE '✅ Migrated company_settings';
  END IF;

  -- Company Subscriptions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_subscriptions') THEN
    UPDATE company_subscriptions SET company_id = new_company_id WHERE company_id = old_company_id;
    RAISE NOTICE '✅ Migrated company_subscriptions';
  END IF;

  -- Audit Logs
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    UPDATE audit_logs SET company_id = new_company_id WHERE company_id = old_company_id;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE '✅ Migrated % audit_logs', row_count;
  END IF;

  -- Weekly Digests
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weekly_digests') THEN
    UPDATE weekly_digests SET company_id = new_company_id WHERE company_id = old_company_id;
    RAISE NOTICE '✅ Migrated weekly_digests';
  END IF;

  -- AI Chat Sessions (if exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_chat_sessions') THEN
    UPDATE ai_chat_sessions SET company_id = new_company_id WHERE company_id = old_company_id;
    RAISE NOTICE '✅ Migrated ai_chat_sessions';
  ELSE
    RAISE NOTICE '⏭️  Skipped ai_chat_sessions (table does not exist)';
  END IF;

  -- AI Chat Messages (if exists)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_chat_messages') THEN
    UPDATE ai_chat_messages SET company_id = new_company_id WHERE company_id = old_company_id;
    RAISE NOTICE '✅ Migrated ai_chat_messages';
  ELSE
    RAISE NOTICE '⏭️  Skipped ai_chat_messages (table does not exist)';
  END IF;

  RAISE NOTICE '🎉 Migration completed successfully!';
END $$;

