-- ==========================================
-- Sync auth.users with public.users table
-- ==========================================
-- This migration creates a trigger to automatically sync
-- new users from auth.users to public.users table

-- Step 1: Fix password_hash constraint if it exists
-- Since we use Supabase Auth, password_hash is not needed in public.users
DO $$
BEGIN
  -- Check if password_hash column exists and make it nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'password_hash'
  ) THEN
    -- Make it nullable
    ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
    RAISE NOTICE '✅ Made password_hash nullable';
  ELSE
    RAISE NOTICE 'ℹ️  password_hash column does not exist';
  END IF;
END $$;

-- Step 2: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Create function to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users if not exists
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Step 3: Sync existing auth users to public.users
-- Strategy: Handle conflicts by email and id
DO $$
DECLARE
  auth_user RECORD;
  existing_user_id UUID;
  updated_count INT := 0;
  inserted_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting sync of auth.users to public.users...';
  
  -- Loop through all auth.users
  FOR auth_user IN SELECT * FROM auth.users LOOP
    -- Check if user exists by email (but with different ID)
    SELECT id INTO existing_user_id 
    FROM public.users 
    WHERE email = auth_user.email AND id != auth_user.id;
    
    IF existing_user_id IS NOT NULL THEN
      -- User exists with different ID - need to merge
      RAISE NOTICE 'Merging user %: old id=%, new id=%', auth_user.email, existing_user_id, auth_user.id;
      
      -- Update all foreign key references to point to the auth user id
      UPDATE company_members SET user_id = auth_user.id WHERE user_id = existing_user_id;
      
      -- Delete old record
      DELETE FROM public.users WHERE id = existing_user_id;
      
      updated_count := updated_count + 1;
    END IF;
    
    -- Insert or update the correct record
    INSERT INTO public.users (
      id,
      email,
      full_name,
      avatar_url,
      created_at,
      updated_at
    )
    VALUES (
      auth_user.id,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'full_name', SPLIT_PART(auth_user.email, '@', 1)),
      auth_user.raw_user_meta_data->>'avatar_url',
      auth_user.created_at,
      auth_user.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      updated_at = EXCLUDED.updated_at;
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Merged % existing users', updated_count;
  RAISE NOTICE '✅ Synced % total users', inserted_count;
END $$;

