# Migration Plan: Custom JWT → Supabase Auth

## Current State
- Custom JWT stored in localStorage
- Custom `/api/auth/oauth/google` endpoint
- RLS policies expect `auth.uid()` from Supabase Auth
- RLS currently ENABLED but blocks all queries

## Goal
- Use Supabase Auth with Google OAuth
- Keep existing RLS policies (they're perfect!)
- Multi-tenant security working

## Steps

### 1. Update Supabase Client to use Supabase Auth
File: `apps/crm/lib/supabase/client.ts`
- Remove custom JWT logic
- Use Supabase Auth session
- Keep singleton pattern

### 2. Update Login Page
File: `apps/crm/app/login/page.tsx`
- Replace custom Google OAuth with Supabase signInWithOAuth
- Handle Supabase Auth callback
- Remove custom token handling

### 3. Configure Google OAuth in Supabase Dashboard
- Add Google OAuth provider
- Set redirect URLs
- Get Google Client ID/Secret

### 4. Update all API routes that use authFetch
- Replace JWT extraction with Supabase session
- Use `supabase.auth.getUser()` for authentication

### 5. Test RLS
- Enable RLS (migration 019)
- Verify multi-tenant isolation
- Test all CRUD operations

## Benefits
✅ Proper RLS security
✅ Automatic session management
✅ Token refresh handled by Supabase
✅ Multi-tenant isolation
✅ Production-ready authentication

