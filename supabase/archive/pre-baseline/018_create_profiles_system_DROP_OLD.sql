-- Migration: Drop old profiles tables and create new structure
-- Date: 2025-02-05
-- WARNING: This will delete existing profiles data!

-- Drop old tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS usage CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS profile_orders CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Old profiles tables dropped successfully';
  RAISE NOTICE 'Now run migration 018_create_profiles_system.sql to create new structure';
END $$;
