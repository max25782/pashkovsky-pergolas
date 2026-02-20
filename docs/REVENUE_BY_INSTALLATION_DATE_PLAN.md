# Revenue by Installation Date - Complete File Changes

All deal-related locations that need updates for the new logic.

---

## 1. Database Migration

**New file:** `apps/crm/supabase/migrations/020_add_installation_date_index.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_deals_company_installation_date 
  ON public.deals (company_id, installation_date) 
  WHERE installation_date IS NOT NULL;
```

- `installation_date` column already exists
- No `closed_at`; app uses `stage = 'done'`

---

## 2. API Routes (Server-Side)

### 2.1 admin-api/deals PATCH
**File:** [apps/crm/app/admin-api/deals/route.ts](apps/crm/app/admin-api/deals/route.ts)

**Change:** Before `supabase.from('deals').update(updates)` (~line 237), add:
```ts
if (updates.stage === 'done') {
  const { data: current } = await supabase
    .from('deals')
    .select('installation_date')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()
  if (current?.installation_date == null) {
    updates.installation_date = new Date().toISOString()
  }
}
```

### 2.2 api/reports/monthly
**File:** [apps/crm/app/api/reports/monthly/route.ts](apps/crm/app/api/reports/monthly/route.ts)

**Change:** Replace `created_at` filter (lines 41-44) with:
```ts
.gte('installation_date', `${startDate}T00:00:00.000Z`)
.lte('installation_date', `${endDate}T23:59:59.999Z`)
.eq('stage', 'done')
```
Add `company_id` filter if missing (verify RLS).

### 2.3 api/ai/reports/monthly
**File:** [apps/crm/app/api/ai/reports/monthly/route.ts](apps/crm/app/api/ai/reports/monthly/route.ts)

**Change:** Deals query (lines 92-97) - use `installation_date`:
```ts
.gte('installation_date', startISO)
.lte('installation_date', endISO)
.eq('stage', 'done')
```

### 2.4 api/ai/reports/weekly
**File:** [apps/crm/app/api/ai/reports/weekly/route.ts](apps/crm/app/api/ai/reports/weekly/route.ts)

**Change:** Deals query (lines 87-91) - use `installation_date`:
```ts
.gte('installation_date', startISO)
.lte('installation_date', endISO)
.eq('stage', 'done')
```
Note: Weekly route uses `deal.status` and `deal.estimated_value` - verify schema. Deals use `stage` and `price`.

### 2.5 api/ai-director/data/analytics
**File:** [apps/crm/app/api/ai-director/data/analytics/route.ts](apps/crm/app/api/ai-director/data/analytics/route.ts)

**Change:** Deals query (lines 73-77) - use `installation_date` for revenue:
```ts
.select('id, stage, price, my_cost, installation_date')
.eq('company_id', companyId)
.eq('stage', 'done')
.gte('installation_date', startDate)
.lte('installation_date', endDate)
```
Then filter revenue from this result (deals with installation_date in range).

---

## 3. Lib / Analytics

### 3.1 lib/analytics/aggregators.ts
**File:** [apps/crm/lib/analytics/aggregators.ts](apps/crm/lib/analytics/aggregators.ts)

**Change:** `getFinanceSummary` (lines 378-383) - filter by `installation_date`:
```ts
.eq('stage', 'done')
.gte('installation_date', from)
.lte('installation_date', to)
```
Add `company_id` if not present.

---

## 4. Client / Hooks / Components

### 4.1 useDealActions
**File:** [apps/crm/components/admin/hooks/useDealActions.ts](apps/crm/components/admin/hooks/useDealActions.ts)

**Change:** Route `patch` through admin-api instead of direct Supabase so server sets `installation_date` when `stage === 'done'`:
- Get session: `const { data: { session } } = await supabase.auth.getSession()`
- Call: `fetch('/admin-api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer ${session?.access_token}\` }, body: JSON.stringify({ id, ...updates }) })`
- Parse response and call `onUpdate`

### 4.2 DealsStatistics
**File:** [apps/crm/components/admin/DealsStatistics.tsx](apps/crm/components/admin/DealsStatistics.tsx)

**Change:** For `statisticType === 'money'`, only count deals with `installation_date`:
```ts
if (statisticType === 'money' && !deal.installation_date) return
```
Add inside `validDeals` filter or at start of `monthlyStats` forEach.

### 4.3 MonthlyDealsModal
**File:** [apps/crm/components/admin/MonthlyDealsModal.tsx](apps/crm/components/admin/MonthlyDealsModal.tsx)

**Change:** For `statisticType === 'money'`, exclude deals without `installation_date`:
```ts
if (statisticType === 'money' && !deal.installation_date) return false
```
Add to filter in `monthlyDeals` useMemo (line 30).

---

## 5. No Changes Needed

| File | Reason |
|------|--------|
| [DealModal.tsx](apps/crm/components/admin/DealModal.tsx) | Already shows and allows editing `installation_date` |
| [DealsCharts.tsx](apps/crm/components/admin/DealsCharts.tsx) | Receives pre-filtered deals from DealsStatistics |
| [buildAnalyticsContext.ts](apps/crm/lib/ai/buildAnalyticsContext.ts) | Uses `getFinanceSummary` from aggregators - fixed by aggregators change |
| [weeklyDigest.ts](apps/crm/lib/analytics/weeklyDigest.ts) | Uses `buildAnalyticsContext` - fixed indirectly |
| [deal-types.ts](apps/crm/components/admin/deal-types.ts) | `installation_date` already in Deal interface |
| [CreateDealModal.tsx](apps/crm/components/admin/CreateDealModal.tsx) | Has installation_date field for new deals |

---

## 6. Optional / Verify

| File | Note |
|------|------|
| [admin-api/deals GET](apps/crm/app/admin-api/deals/route.ts) | start_date/end_date filter on created_at - used for listing, not revenue. Leave as is. |
| [api/ai-director/data/deals](apps/crm/app/api/ai-director/data/deals/route.ts) | General deal listing; date filter on created_at. If used for revenue context, consider installation_date. |
| [api/ai/reports/weekly](apps/crm/app/api/ai/reports/weekly/route.ts) | Uses `deal.status` and `deal.estimated_value` - schema has `stage` and `price`. Fix field names. |

---

## 7. Summary Table

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/020_add_installation_date_index.sql` | New migration |
| 2 | `admin-api/deals/route.ts` | PATCH: set installation_date when stage=done |
| 3 | `api/reports/monthly/route.ts` | Filter by installation_date + stage=done |
| 4 | `api/ai/reports/monthly/route.ts` | Filter deals by installation_date |
| 5 | `api/ai/reports/weekly/route.ts` | Filter deals by installation_date; fix stage/price |
| 6 | `api/ai-director/data/analytics/route.ts` | Filter deals by installation_date for revenue |
| 7 | `lib/analytics/aggregators.ts` | getFinanceSummary: filter by installation_date |
| 8 | `hooks/useDealActions.ts` | Call admin-api for updates (with auth) |
| 9 | `DealsStatistics.tsx` | Skip deals without installation_date for money stats |
| 10 | `MonthlyDealsModal.tsx` | Skip deals without installation_date for money stats |

---

## 8. Testing (3 Steps)

1. **Drag to Completed:** Move deal to "הושלם" column. Check DB: `SELECT id, stage, installation_date FROM deals WHERE id = '<id>'` — installation_date set.
2. **Check DB:** Verify deal with stage=done and installation_date in specific month.
3. **Check dashboard:** Statistics "עם כסף" — revenue appears in correct month. Change installation_date — revenue moves.
