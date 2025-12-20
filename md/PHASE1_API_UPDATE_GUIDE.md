# Phase 1: Multi-Tenant API Routes Update Guide

## ✅ Completed Files:
- `app/admin-api/deals/route.ts` - Fully updated with company_id filtering
- `app/admin-api/leads/route.ts` - GET method updated (POST/PATCH/DELETE need updating)

## 📋 Remaining API Routes to Update:

### High Priority (Contains User Data):
1. **`app/admin-api/leads/route.ts`** - Complete POST/PATCH/DELETE methods
2. **`app/api/admin/leads/route.ts`** - Add company_id filtering
3. **`app/admin-api/ai-chats/route.ts`** - Add company_id filtering
4. **`app/api/material-orders/route.ts`** - Add company_id filtering
5. **`app/api/workers/route.ts`** - Add company_id filtering
6. **`app/api/work-shifts/route.ts`** - Add company_id filtering

### Medium Priority (Gallery/Projects - Can be shared or per-company):
7. **`app/admin-api/pergola-projects/route.ts`** - Decision: Add company_id or keep shared?
8. **`app/admin-api/gallery/**` - Decision: Gallery shared across companies or per-company?

## 🔧 Update Pattern for Each Route:

### Step 1: Add Import
```typescript
import { getCompanyId } from '@/lib/middleware/company-context'
```

### Step 2: Add to GET Method
```typescript
export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  // Multi-tenant: Get company_id from request
  const companyId = getCompanyId(req)
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  let query = supabase
    .from('table_name')
    .select('*')
    .eq('company_id', companyId) // ADD THIS LINE
    .order('created_at', { ascending: false })
```

### Step 3: Add to POST Method
```typescript
export async function POST(req: NextRequest) {
  // ... auth and body parsing ...
  
  // Multi-tenant: Get company_id from request
  const companyId = getCompanyId(req)
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  const dataWithCompany = {
    ...data,
    company_id: companyId // ADD THIS
  }
  
  const { data: result, error } = await supabase
    .from('table_name')
    .insert(dataWithCompany) // Use modified data
```

### Step 4: Add to PATCH Method
```typescript
export async function PATCH(req: NextRequest) {
  // ... auth and body parsing ...
  
  // Multi-tenant: Get company_id from request
  const companyId = getCompanyId(req)
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  const { data, error } = await supabase
    .from('table_name')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId) // ADD THIS LINE
```

### Step 5: Add to DELETE Method
```typescript
export async function DELETE(req: NextRequest) {
  // ... auth and id extraction ...
  
  // Multi-tenant: Get company_id from request
  const companyId = getCompanyId(req)
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  const { error } = await supabase
    .from('table_name')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId) // ADD THIS LINE
```

## 🎯 Manual Update Checklist:

For each file:
- [ ] Add import: `import { getCompanyId } from '@/lib/middleware/company-context'`
- [ ] GET: Add `.eq('company_id', companyId)` to query
- [ ] POST: Add `company_id` to inserted data
- [ ] PATCH: Add `.eq('company_id', companyId)` to update query
- [ ] DELETE: Add `.eq('company_id', companyId)` to delete query
- [ ] Test: Verify data isolation works

## ⚠️ Important Notes:

1. **Gallery & Projects**: Need decision if these are per-company or shared
2. **Existing Data**: Already migrated to Pashkovsky company (migration 003)
3. **Admin Token**: Currently maps to Pashkovsky company ID
4. **Phase 2**: Will add user-based authentication with JWT tokens

## 🚀 Next Steps After API Update:

1. Run migrations in Supabase (001, 002, 003)
2. Test with existing admin token
3. Verify data isolation
4. Move to Phase 2 (User authentication)

---

**Status**: Phase 1 - API Routes Update in progress
**Est. Time**: ~2-3 hours for all routes
**Critical**: Must be completed before Phase 2

