-- Step 1: Add salesperson to user_role enum (must commit before using in CHECK)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'salesperson'
      AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'salesperson';
  END IF;
END $$;
