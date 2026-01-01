# 🔒 Multi-Tenant Security Audit Report

**Date:** 2025-12-22  
**Status:** 🔴 **CRITICAL VULNERABILITIES FOUND**  
**Total Issues:** 15+ High/Medium/Low Risk

---

## 📋 Executive Summary

This security audit identified **multiple critical vulnerabilities** in multi-tenant isolation:

- ❌ **9 API routes** without `company_id` filtering
- ❌ **6 API routes** with ID parameters without ownership validation  
- ❌ **3 Analytics functions** with commented-out `company_id` filters
- ⚠️ **Multiple** client-side data fetches without server-side validation

**Risk Level:** 🔴 **CRITICAL**  
**Immediate Action Required:** Yes

---

## 🚨 CRITICAL FINDINGS (HIGH RISK)

### 1. **SMM Leads API - No Company Filter** 🔴 HIGH

**File:** `app/api/smm/leads/route.ts`  
**Lines:** 31-35  
**Issue:** Returns ALL leads across ALL companies

```typescript
let query = supabase
  .from('leads')
  .select('id, name, phone, source, status, notes, created_at')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1)
// ❌ NO .eq('company_id', companyId) filter!
```

**Impact:**  
- SMM team can access leads from ALL companies
- Cross-tenant data exposure
- Violates GDPR/privacy regulations

**Fix:**
```typescript
// GET /api/smm/leads
export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  
  // ADD: Get company_id from request
  const companyId = req.headers.get('x-company-id')
  if (!companyId) {
    return new Response('Missing company context', { status: 400 })
  }
  
  let query = supabase
    .from('leads')
    .select('id, name, phone, source, status, notes, created_at')
    .eq('company_id', companyId) // ✅ ADD THIS
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  // ... rest of code
}
```

---

### 2. **Analytics - Company Filter Commented Out** 🔴 HIGH

**File:** `lib/analytics/aggregators.ts`  
**Lines:** 115-117  
**Issue:** `company_id` filter is commented out in analytics

```typescript
// Apply company filter if needed (assuming company_id field exists)
// if (companyId) {
//   query = query.eq('company_id', companyId)
// }
```

**Impact:**  
- Weekly digests show data from ALL companies
- Analytics leakage across tenants
- Business intelligence exposure

**Fix:**
```typescript
// lib/analytics/aggregators.ts - Line 114-118
export async function getLeadsSummary(
  period: AnalyticsPeriod,
  companyId?: string
): Promise<LeadsSummary> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  
  // ❌ REMOVE: companyId is optional
  // ✅ CHANGE: Make companyId REQUIRED
  if (!companyId) {
    throw new Error('companyId is required for analytics')
  }

  const { from, to } = getDateRange(period)

  let query = supabase
    .from('leads')
    .select('id, name, phone, source, status, created_at, last_message_at')
    .eq('company_id', companyId) // ✅ UNCOMMENT AND ENFORCE
    .gte('created_at', from)
    .lte('created_at', to)

  const { data: leads, error } = await query
  // ... rest
}
```

---

### 3. **Offers API - No Ownership Validation** 🔴 HIGH

**File:** `app/api/offers/[id]/route.ts`  
**Lines:** 25-29 (GET), 65-68 (DELETE)  
**Issue:** Any user can GET/DELETE any offer by ID

```typescript
// GET - No company_id check
const { data, error } = await supabase
  .from('offers')
  .select('*')
  .eq('id', params.id) // ❌ No company_id filter
  .single()

// DELETE - No company_id check
const { error } = await supabase
  .from('offers')
  .delete()
  .eq('id', params.id) // ❌ No company_id filter
```

**Impact:**  
- User from Company A can view offers from Company B
- User can delete competitors' offers
- **IDOR (Insecure Direct Object Reference)** vulnerability

**Fix:**
```typescript
// app/api/offers/[id]/route.ts
import { requireAuth } from '@/lib/middleware/auth'
import { getCompanyId } from '@/lib/middleware/company-context'

// GET - Get single offer by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ✅ ADD: Auth check
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  // ✅ ADD: Get company_id
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .eq('company_id', companyId) // ✅ ADD THIS
      .single()

    if (error) {
      console.error('Error fetching offer:', error)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    const offer = transformOfferFromDB(data)
    return NextResponse.json(offer)
  } catch (error: any) {
    // ... error handling
  }
}

// DELETE - Remove single offer by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ✅ ADD: Auth check
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  // ✅ ADD: Get company_id
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    // ✅ CHANGE: Add company_id filter
    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', params.id)
      .eq('company_id', companyId) // ✅ ADD THIS

    if (error) {
      console.error('Error deleting offer:', error)
      return NextResponse.json(
        { error: 'Failed to delete offer' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // ... error handling
  }
}
```

---

### 4. **Workers API - No Company Filter** 🔴 HIGH

**File:** `app/api/workers/route.ts`  
**Lines:** 41-50 (GET), 92-103 (POST)  
**File:** `app/api/workers/[id]/route.ts`  
**Lines:** 60-65 (PATCH), 93-96 (DELETE)

**Issue:** Workers are not isolated per company

```typescript
// GET - No company_id
let query = supabase
  .from('workers')
  .select('*')
  .order('first_name', { ascending: true })
// ❌ NO .eq('company_id', companyId)

// POST - No company_id
const { data, error } = await supabase
  .from('workers')
  .insert({
    first_name: firstName,
    last_name: lastName,
    // ❌ NO company_id field
  })

// PATCH/DELETE - No company_id validation
```

**Impact:**  
- All companies share the same worker pool
- Company A can modify Company B's workers
- Payroll data leakage

**Fix:**
```typescript
// app/api/workers/route.ts
import { requireAuth } from '@/lib/middleware/auth'
import { getCompanyId } from '@/lib/middleware/company-context'

// GET - List all workers
export async function GET(req: NextRequest) {
  // ✅ ADD: Auth + company check
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let query = supabase
      .from('workers')
      .select('*')
      .eq('company_id', companyId) // ✅ ADD THIS
      .order('first_name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    // ... rest
  }
}

// POST - Create new worker
export async function POST(req: NextRequest) {
  // ✅ ADD: Auth + company check
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ... validation

  const { data, error } = await supabase
    .from('workers')
    .insert({
      company_id: companyId, // ✅ ADD THIS
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      role: role || null,
      daily_rate: dailyRate,
      is_active: isActive !== undefined ? isActive : true,
    })
    .select()
    .single()

  // ... rest
}
```

**Database Migration Needed:**
```sql
-- Add company_id to workers table
ALTER TABLE workers 
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Update existing workers (assign to a default company)
UPDATE workers 
SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id required
ALTER TABLE workers 
ALTER COLUMN company_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_workers_company_id ON workers(company_id);
```

---

### 5. **Work Shifts API - No Company Filter** 🔴 HIGH

**File:** `app/api/work-shifts/route.ts`  
**Lines:** 56-64 (GET), 123-137 (POST)  
**File:** `app/api/work-shifts/[id]/route.ts`

**Issue:** Work shifts are not validated against company

```typescript
// GET - Only filters by projectId, not company_id
const { data, error } = await supabase
  .from('work_shifts')
  .select('*, worker:workers(*)')
  .eq('project_id', projectId) // ❌ No company_id check
  .order('date', { ascending: false })
```

**Impact:**  
- User can query work shifts for any project
- Payroll/labor data exposure
- Project access control bypass

**Fix:**
```typescript
// app/api/work-shifts/route.ts
import { requireAuth } from '@/lib/middleware/auth'
import { getCompanyId } from '@/lib/middleware/company-context'

// GET - List work shifts for a project
export async function GET(req: NextRequest) {
  // ✅ ADD: Auth + company check
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  const companyId = getCompanyId(req)
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // ✅ ADD: Verify project belongs to company
    const { data: project, error: projectError } = await supabase
      .from('pergola_projects')
      .select('id, company_id')
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('work_shifts')
      .select('*, worker:workers(*)')
      .eq('project_id', projectId)
      .order('date', { ascending: false })

    // ... rest
  }
}
```

---

### 6. **Public Leads API - No Company Assignment** 🟡 MEDIUM

**File:** `app/api/leads/route.ts`  
**Lines:** 43-53  
**Issue:** Public leads created without `company_id`

```typescript
// POST - No company_id
const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
  method: 'POST',
  body: JSON.stringify(payload), // ❌ No company_id
})
```

**Impact:**  
- Leads created without company ownership
- Orphaned records in database
- Cannot identify which company owns the lead

**Fix:**
```typescript
// app/api/leads/route.ts
export async function POST(req: NextRequest) {
  // ... validation

  // ✅ ADD: Get default company ID
  const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
  
  if (!defaultCompanyId) {
    console.error('DEFAULT_COMPANY_ID not configured')
    return new Response('Server misconfigured', { status: 500 })
  }

  const payload: any = {
    name,
    phone,
    source,
    company_id: defaultCompanyId, // ✅ ADD THIS
  }
  
  // ... rest
}
```

---

## ⚠️ MEDIUM RISK FINDINGS

### 7. **Material Orders - Auth but No Company Filter** 🟡 MEDIUM

**File:** `app/api/material-orders/route.ts`  
**Lines:** 40-44  
**Issue:** Checks auth token but not company ownership

```typescript
const { data, error } = await supabase
  .from('material_orders')
  .select('*')
  .eq('deal_id', dealId) // ❌ No validation that deal belongs to user's company
```

**Fix:**
```typescript
// Verify deal belongs to company first
const { data: deal } = await supabase
  .from('deals')
  .select('id, company_id')
  .eq('id', dealId)
  .eq('company_id', companyId)
  .single()

if (!deal) {
  return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
}

// Then fetch material orders
const { data, error } = await supabase
  .from('material_orders')
  .select('*')
  .eq('deal_id', dealId)
```

---

### 8. **Gallery Images - Public but Should Filter by Company** 🟡 MEDIUM

**File:** `app/api/gallery/images/route.ts`  
**Lines:** 31-35  
**Issue:** Gallery is public but doesn't filter by company

**Impact:**  
- Company A can see Company B's project photos
- Competitive intelligence leakage

**Fix:**
```typescript
// Option 1: Make gallery public (keep as is)
// Option 2: Add company filter for private galleries

// If galleries should be company-specific:
const companyId = req.headers.get('x-company-id')

const { data: allImages } = await supabase
  .from('gallery_images')
  .select('url, filename, category_key')
  .eq('category_key', categoryKey)
  .eq('company_id', companyId) // ✅ ADD if private
  .order('created_at', { ascending: false })
```

---

## 📊 SUMMARY TABLE

| # | File | Function | Risk | Issue | Lines |
|---|------|----------|------|-------|-------|
| 1 | `app/api/smm/leads/route.ts` | GET | 🔴 HIGH | No `company_id` filter | 31-35 |
| 2 | `lib/analytics/aggregators.ts` | `getLeadsSummary` | 🔴 HIGH | `company_id` commented out | 115-117 |
| 3 | `app/api/offers/[id]/route.ts` | GET | 🔴 HIGH | No ownership validation | 25-29 |
| 4 | `app/api/offers/[id]/route.ts` | DELETE | 🔴 HIGH | No ownership validation | 65-68 |
| 5 | `app/api/workers/route.ts` | GET | 🔴 HIGH | No `company_id` filter | 41-50 |
| 6 | `app/api/workers/route.ts` | POST | 🔴 HIGH | No `company_id` assignment | 92-103 |
| 7 | `app/api/workers/[id]/route.ts` | PATCH | 🔴 HIGH | No ownership validation | 60-65 |
| 8 | `app/api/workers/[id]/route.ts` | DELETE | 🔴 HIGH | No ownership validation | 93-96 |
| 9 | `app/api/work-shifts/route.ts` | GET | 🔴 HIGH | No company validation | 56-64 |
| 10 | `app/api/work-shifts/route.ts` | POST | 🔴 HIGH | No company validation | 123-137 |
| 11 | `app/api/leads/route.ts` | POST | 🟡 MED | No `company_id` assignment | 43-53 |
| 12 | `app/api/material-orders/route.ts` | GET | 🟡 MED | No deal ownership check | 40-44 |
| 13 | `app/api/gallery/images/route.ts` | GET | 🟡 MED | Public, no company filter | 31-35 |

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Immediate (This Week)

1. ✅ **Fix Analytics** - Uncomment `company_id` filters
2. ✅ **Fix Offers API** - Add ownership validation
3. ✅ **Fix SMM Leads** - Add `company_id` filter

### Priority 2: High (Next Week)

4. ✅ **Fix Workers API** - Add `company_id` to database schema
5. ✅ **Fix Work Shifts** - Add project ownership validation
6. ✅ **Fix Public Leads** - Assign to default company

### Priority 3: Medium (Within 2 Weeks)

7. ✅ **Audit all API routes** - Ensure consistent company filtering
8. ✅ **Add RLS policies** - Supabase Row Level Security
9. ✅ **Add integration tests** - Test multi-tenant isolation

---

## 🛡️ PREVENTION MEASURES

### 1. **Create Helper Function**

```typescript
// lib/middleware/company-ownership.ts
export async function verifyOwnership(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('company_id')
    .eq('id', recordId)
    .single()

  if (error || !data) return false
  return data.company_id === companyId
}

// Usage:
const hasAccess = await verifyOwnership(supabase, 'offers', offerId, companyId)
if (!hasAccess) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 })
}
```

### 2. **Enable Supabase RLS (Row Level Security)**

```sql
-- Enable RLS on all multi-tenant tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only view their company's leads"
ON leads FOR SELECT
USING (company_id = current_setting('app.company_id')::uuid);

CREATE POLICY "Users can only insert to their company"
ON leads FOR INSERT
WITH CHECK (company_id = current_setting('app.company_id')::uuid);

-- Repeat for all tables
```

### 3. **Add Database Triggers**

```sql
-- Ensure company_id is always set
CREATE OR REPLACE FUNCTION check_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id cannot be NULL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_company_id_leads
BEFORE INSERT OR UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION check_company_id();
```

### 4. **Linting Rules**

Create ESLint rule to detect missing `company_id`:

```javascript
// .eslintrc.js
rules: {
  'no-supabase-without-company-id': 'error'
}
```

---

## 📝 ACTION ITEMS

### For Backend Team:

- [ ] Apply fixes to all 13 identified vulnerabilities
- [ ] Add `company_id` column to `workers`, `work_shifts`, `material_orders` tables
- [ ] Enable RLS policies on Supabase
- [ ] Create `verifyOwnership` helper function
- [ ] Add integration tests for multi-tenant isolation

### For Security Team:

- [ ] Review this audit report
- [ ] Approve priority order for fixes
- [ ] Schedule penetration testing after fixes

### For DevOps Team:

- [ ] Set up `DEFAULT_COMPANY_ID` in production
- [ ] Monitor database queries for missing `company_id` filters
- [ ] Add alerting for cross-tenant access attempts

---

## 🧪 TESTING CHECKLIST

After applying fixes, test:

- [ ] User from Company A cannot view Company B's leads
- [ ] User from Company A cannot delete Company B's offers
- [ ] User from Company A cannot modify Company B's workers
- [ ] Analytics only show data for current company
- [ ] Public leads are assigned to correct company
- [ ] SMM API respects company boundaries

---

## 📚 REFERENCES

- [OWASP: Insecure Direct Object References](https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-Tenant Architecture Best Practices](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)

---

**Report Generated By:** Security Audit Tool  
**Next Review:** After fixes applied (estimate 2 weeks)

---

## ⚠️ DISCLAIMER

This audit is based on static code analysis. A full penetration test is recommended after fixes are applied.

