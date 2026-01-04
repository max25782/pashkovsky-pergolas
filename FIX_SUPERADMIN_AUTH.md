# Fix: SuperAdmin Integrations Authentication

## Problem
The SuperAdmin integrations page was getting 401 Unauthorized errors when trying to load integrations.

## Root Cause
The `requireSuperAdmin()` function was incorrectly using JWT token authentication (`verifyAuthToken`), but the SuperAdmin session uses **httpOnly cookie-based authentication**, not JWT tokens.

## Solution
Updated `apps/crm/lib/middleware/superadmin-auth.ts` to:
1. Use the server-side Supabase client (`createClient()` from `@/lib/supabase/server`)
2. Get user from cookie-based session with `supabase.auth.getUser()`
3. Remove the `NextRequest` parameter requirement
4. Match the pattern used in existing `apps/crm/lib/auth/platform-admin.ts`

## Files Updated
- ✅ `apps/crm/lib/middleware/superadmin-auth.ts` - Changed auth method
- ✅ `apps/crm/app/api/platform/integrations/list/route.ts` - Removed request param
- ✅ `apps/crm/app/api/platform/integrations/activate/route.ts` - Removed request param
- ✅ `apps/crm/app/api/platform/integrations/suspend/route.ts` - Removed request param
- ✅ `apps/crm/app/api/platform/integrations/rotate-secret/route.ts` - Removed request param

## How It Works Now
```typescript
// Before (incorrect - JWT tokens)
const admin = await requireSuperAdmin(request) // ❌

// After (correct - cookie-based)
const admin = await requireSuperAdmin() // ✅
```

The function now:
1. Uses `createClient()` which automatically reads auth from cookies
2. Calls `supabase.auth.getUser()` to get the authenticated user
3. Checks `platform_admins` table to verify SuperAdmin role
4. Returns admin data or throws error

## Testing
Navigate to `/superadmin/integrations` and the page should now load successfully with proper authentication.

## Status
✅ **Fixed and ready to use**

