-- ==========================================
-- OPTIONAL: Remove password_hash column
-- ==========================================
-- This migration completely removes password_hash from public.users
-- since we use Supabase Auth for authentication

-- ⚠️ WARNING: Only run this if you are SURE you don't need password_hash
-- ⚠️ This is irreversible - you cannot restore the data after dropping the column

-- Uncomment the line below to remove password_hash:
-- ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- If you ran this migration, verify:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'password_hash'
  ) THEN
    RAISE NOTICE '✅ password_hash column has been removed';
  ELSE
    RAISE NOTICE 'ℹ️  password_hash column still exists (nullable)';
  END IF;
END $$;



