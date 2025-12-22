# Security Layer Implementation Guide

## ✅ Completed Files

### 1. Core Security Module
- ✅ `lib/auth/security.ts` - Main security functions
- ✅ `lib/auth/index.ts` - Exports

### 2. API Routes with Security Applied
- ✅ `app/api/offers/[id]/route.ts` (GET, DELETE)
- ✅ `app/api/workers/route.ts` (GET, POST)
- ✅ `app/api/workers/[id]/route.ts` (PATCH, DELETE)

---

## 🔄 Pending Files (Need Security Layer)

### Priority 1: HIGH RISK (From Security Audit)

1. ❌ `app/api/smm/leads/route.ts` - GET
   - **Issue:** No company_id filter
   - **Fix:** Add `requireAuth()` + `.eq('company_id', auth.user.companyId)`

2. ❌ `lib/analytics/aggregators.ts` - `getLeadsSummary()`
   - **Issue:** company_id filter commented out
   - **Fix:** Make `companyId` required, uncomment filter

3. ❌ `app/api/work-shifts/route.ts` - GET, POST
   - **Issue:** No company validation
   - **Fix:** Verify project ownership before accessing shifts

4. ❌ `app/api/work-shifts/[id]/route.ts` - PATCH, DELETE
   - **Issue:** No ownership validation
   - **Fix:** Add `verifyResourceOwnership()`

5. ❌ `app/api/material-orders/route.ts` - GET, POST
   - **Issue:** No deal ownership check
   - **Fix:** Verify deal belongs to company

### Priority 2: MEDIUM RISK

6. ❌ `app/api/leads/route.ts` - POST
   - **Issue:** No company_id assignment
   - **Fix:** Assign `DEFAULT_COMPANY_ID` or user's company

7. ❌ `app/api/gallery/images/route.ts` - GET
   - **Decision needed:** Public or company-specific?
   - **Fix:** If company-specific, add `.eq('company_id', ...)`

8. ❌ `app/api/pergola-projects/route.ts` - GET, POST
   - **Issue:** Likely missing company filter
   - **Fix:** Add company isolation

9. ❌ `app/api/ai-chat/route.ts` - POST
   - **Issue:** Needs review
   - **Fix:** Apply security layer

10. ❌ `app/api/reports/monthly/route.ts` - GET
    - **Issue:** Analytics without company filter
    - **Fix:** Add company context

11. ❌ `app/api/reports/weekly-digest/route.ts` - GET
    - **Issue:** Analytics without company filter
    - **Fix:** Add company context

### Priority 3: Already Secured (admin-api)

These routes already have `requireAuth()` and `getCompanyId()`:
- ✅ `app/admin-api/deals/route.ts` - Already has company filter
- ✅ `app/admin-api/leads/route.ts` - Already has company filter
- ✅ `app/admin-api/ai-chats/route.ts` - Already has company filter
- ✅ `app/admin-api/users/route.ts` - Company-based user management
- ✅ `app/admin-api/gallery/*` - Gallery management

**Action:** Migrate these to use new security layer for consistency.

---

## 📝 Implementation Template

### Pattern 1: Simple GET with Company Filter

```typescript
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // Fetch data with company filter
  let query = supabase
    .from('table_name')
    .select('*')
    .eq('company_id', auth.user.companyId) // Multi-tenant filter
    .order('created_at', { ascending: false })

  const { data, error } = await query
  
  // ... rest of code
}
```

### Pattern 2: POST with Company Assignment

```typescript
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  const body = await req.json()
  
  // Validation ...

  // Insert with company_id
  const { data, error } = await supabase
    .from('table_name')
    .insert({
      ...body,
      company_id: auth.user.companyId, // Multi-tenant assignment
    })
    .select()
    .single()

  // ... rest of code
}
```

### Pattern 3: GET by ID with Ownership Check

```typescript
import { requireAuth, requireCompanyAccess } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // Fetch resource
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 🔒 Security: Verify company access
  const access = await requireCompanyAccess(req, data.company_id)
  if (!access.authorized) return access.error

  return NextResponse.json(data)
}
```

### Pattern 4: PATCH/DELETE with Ownership Verification

```typescript
import { requireAuth, verifyResourceOwnership } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // 🔒 Security: Verify ownership
  const ownership = await verifyResourceOwnership(req, 'table_name', params.id)
  if (!ownership.authorized) return ownership.error

  // Now safe to update
  const body = await req.json()
  
  const { data, error } = await supabase
    .from('table_name')
    .update(body)
    .eq('id', params.id)
    .eq('company_id', auth.user.companyId) // Extra safety
    .select()
    .single()

  // ... rest of code
}
```

### Pattern 5: Related Resource Check (e.g., Shifts for Project)

```typescript
import { requireAuth, requireCompanyAccess } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  // 🔒 Security: Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const access = await requireCompanyAccess(req, project.company_id)
  if (!access.authorized) return access.error

  // Now safe to fetch related resources
  const { data: shifts } = await supabase
    .from('work_shifts')
    .select('*')
    .eq('project_id', projectId)

  return NextResponse.json({ shifts })
}
```

---

## 🎯 Migration Checklist

For EACH API route, verify:

- [ ] Import `requireAuth` from `@/lib/auth`
- [ ] Call `requireAuth(req)` at start of handler
- [ ] Return `auth.error` if not authorized
- [ ] Use `auth.user.companyId` for queries
- [ ] Add `.eq('company_id', auth.user.companyId)` to SELECT queries
- [ ] Add `company_id: auth.user.companyId` to INSERT operations
- [ ] Verify ownership before UPDATE/DELETE operations
- [ ] Add company safety filter to UPDATE/DELETE queries

---

## 🧪 Testing Checklist

After applying security layer:

### Unit Tests
- [ ] Request without auth token → 401
- [ ] Request with invalid token → 401
- [ ] Request with valid token but no company → 401
- [ ] Request to resource from different company → 403

### Integration Tests
- [ ] User A cannot GET User B's resources
- [ ] User A cannot DELETE User B's resources
- [ ] User A cannot UPDATE User B's resources
- [ ] Queries filter correctly by company_id

### Manual Tests
- [ ] Login as Company A user
- [ ] Try to access Company B resource by ID → 403
- [ ] Verify only own company data is returned

---

## 🚨 Common Pitfalls

### 1. **Forgetting to check ownership**
❌ **BAD:**
```typescript
const { data } = await supabase
  .from('offers')
  .delete()
  .eq('id', offerId) // No company check!
```

✅ **GOOD:**
```typescript
// Verify ownership first
const ownership = await verifyResourceOwnership(req, 'offers', offerId)
if (!ownership.authorized) return ownership.error

// Then delete
const { data } = await supabase
  .from('offers')
  .delete()
  .eq('id', offerId)
  .eq('company_id', auth.user.companyId) // Extra safety
```

### 2. **Not filtering by company_id**
❌ **BAD:**
```typescript
const { data } = await supabase
  .from('leads')
  .select('*')
  .order('created_at', { ascending: false })
// Returns ALL companies' leads!
```

✅ **GOOD:**
```typescript
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('company_id', auth.user.companyId) // Filter by company
  .order('created_at', { ascending: false })
```

### 3. **Forgetting company_id on INSERT**
❌ **BAD:**
```typescript
const { data } = await supabase
  .from('workers')
  .insert({
    first_name: 'John',
    last_name: 'Doe',
    // No company_id!
  })
```

✅ **GOOD:**
```typescript
const { data } = await supabase
  .from('workers')
  .insert({
    company_id: auth.user.companyId, // Assign to company
    first_name: 'John',
    last_name: 'Doe',
  })
```

---

## 📊 Progress Tracking

| API Route | Method | Priority | Status | Notes |
|-----------|--------|----------|--------|-------|
| `/api/offers/[id]` | GET | HIGH | ✅ | Done |
| `/api/offers/[id]` | DELETE | HIGH | ✅ | Done |
| `/api/workers` | GET | HIGH | ✅ | Done |
| `/api/workers` | POST | HIGH | ✅ | Done |
| `/api/workers/[id]` | PATCH | HIGH | ✅ | Done |
| `/api/workers/[id]` | DELETE | HIGH | ✅ | Done |
| `/api/smm/leads` | GET | HIGH | ❌ | Needs fix |
| `/api/work-shifts` | GET | HIGH | ❌ | Needs fix |
| `/api/work-shifts` | POST | HIGH | ❌ | Needs fix |
| `/api/work-shifts/[id]` | PATCH | HIGH | ❌ | Needs fix |
| `/api/work-shifts/[id]` | DELETE | HIGH | ❌ | Needs fix |
| `/api/material-orders` | GET | MED | ❌ | Needs fix |
| `/api/material-orders` | POST | MED | ❌ | Needs fix |
| `/api/leads` | POST | MED | ❌ | Needs fix |
| `/api/gallery/images` | GET | MED | ❌ | Decision needed |
| `lib/analytics/aggregators.ts` | - | HIGH | ❌ | Uncomment filter |

---

## 🎓 Security Best Practices

1. **Always authenticate first**
   - Call `requireAuth()` at the start of EVERY protected route

2. **Always filter by company**
   - Add `.eq('company_id', auth.user.companyId)` to ALL queries

3. **Always verify ownership**
   - Before UPDATE/DELETE, verify resource belongs to company

4. **Never trust IDs from client**
   - Always fetch and verify company_id from database

5. **Use type-safe functions**
   - Import from `@/lib/auth` for consistency

6. **Log security events**
   - Log denied access attempts for monitoring

7. **Test, test, test**
   - Write tests for multi-tenant isolation

---

## 🔒 Database Schema Requirements

Ensure all multi-tenant tables have:

```sql
-- Add company_id column if missing
ALTER TABLE table_name 
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Make it required
ALTER TABLE table_name 
ALTER COLUMN company_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_table_name_company_id ON table_name(company_id);
```

Tables that NEED `company_id`:
- [x] `leads` - already has
- [x] `deals` - already has
- [x] `offers` - already has
- [ ] `workers` - **NEEDS MIGRATION**
- [ ] `work_shifts` - **NEEDS MIGRATION**
- [ ] `material_orders` - **NEEDS MIGRATION**
- [ ] `pergola_projects` - **NEEDS MIGRATION**
- [ ] `gallery_images` - **NEEDS MIGRATION** (if company-specific)
- [ ] `ai_chats` - check if needed

---

## 📦 Next Steps

1. **Apply security layer to remaining HIGH RISK routes** (Priority 1)
2. **Create database migrations** for missing `company_id` columns
3. **Write integration tests** for multi-tenant isolation
4. **Enable Supabase RLS** for defense-in-depth
5. **Audit ALL API routes** - no exceptions!
6. **Document any exceptions** (if route is intentionally public)

---

**Last Updated:** 2025-12-22  
**Status:** 🟡 In Progress (6 of 20+ routes secured)

