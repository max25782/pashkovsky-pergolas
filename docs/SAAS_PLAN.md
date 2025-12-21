# SaaS Transformation Plan - Pashkovsky Pergolas CRM

## 📋 Overview

This document outlines the complete transformation of the Pashkovsky Pergolas CRM into a multi-tenant SaaS platform with role-based access control, subscription plans, and usage tracking.

---

## ✅ Phase 1: Roles & Permissions System (COMPLETED)

### Database Schema
**Migration:** `013_add_roles_and_permissions.sql`

**Roles:**
- `admin` - Full access, including user management and settings
- `manager` - Deals, offers, workers (no settings/user management)
- `worker` - Work shifts only, limited project access
- `viewer` - Read-only access

**Tables Created:**
1. `user_role` enum type
2. `role_permissions` table - Fine-grained permission matrix
3. Added `role` column to `company_members`

**Functions Created:**
- `has_permission(user_id, company_id, resource, action)` - Check if user has permission
- Automatic permission seeding for all roles

**TypeScript:**
- `types/roles.ts` - Role types, permission checks, labels
- `lib/middleware/permissions.ts` - Server-side permission middleware

---

## ✅ Phase 2: Company Settings (COMPLETED)

### Database Schema
**Migration:** `014_add_company_settings.sql`

**Settings Included:**
- **Branding:** Logo, company name, primary color
- **Financial:** Currency (₪), VAT% (18%)
- **Default Pricing:** Pergola (750), Santaf (220/450), Zip Screen (650/800), etc.
- **PDF Templates:** Payment terms, warranty text
- **Communication:** WhatsApp/Email templates

**Tables Created:**
1. `company_settings` table
2. Auto-create settings for new companies
3. Template variable replacement system

**Functions Created:**
- `get_company_settings(company_id)` - Get settings as JSON
- Auto-trigger to create settings on company creation

**TypeScript:**
- `types/company-settings.ts` - Settings types, defaults, template helpers

---

## ✅ Phase 3: Subscription Plans & Limits (COMPLETED)

### Database Schema
**Migration:** `015_add_subscription_plans.sql`

**Plans:**

| Plan | Price | Users | Deals/Month | Features |
|------|-------|-------|-------------|----------|
| **Free** | ₪0 | 1 | 30 | Basic CRM only |
| **Basic** | ₪249 | 3 | 500 | PDF, WhatsApp, Email, Worker logs |
| **Pro** | ₪499 | Unlimited | Unlimited | All features + AI, API, Custom branding |

**Tables Created:**
1. `subscription_plans` - Available plans
2. `company_subscriptions` - Active subscriptions per company
3. `company_usage` - Monthly usage tracking

**Functions Created:**
- `check_plan_limit(company_id, limit_type)` - Check if limit reached
- `has_feature(company_id, feature)` - Check feature access
- `increment_usage(company_id, counter, amount)` - Track usage

**Features Tracked:**
- PDF generation
- WhatsApp integration
- Email integration
- Worker logs
- AI analytics
- Lead scoring
- Automation
- API access
- Custom branding
- Priority support

**TypeScript:**
- `types/subscription.ts` - Plan types, features, usage tracking
- `lib/middleware/subscription.ts` - Plan limit checks, feature gates

---

## ⏳ Phase 4: UI Implementation (TODO)

### Tasks:
1. **Settings Page** (`app/[locale]/admin/settings/page.tsx`)
   - Company branding editor
   - Default pricing configuration
   - Template editor (PDF, WhatsApp, Email)
   - Only accessible to admins

2. **User Management Page** (`app/[locale]/admin/users/page.tsx`)
   - List company members with roles
   - Invite new users with role selection
   - Edit/remove users
   - Role badges and descriptions

3. **Subscription Page** (`app/[locale]/admin/subscription/page.tsx`)
   - Current plan display
   - Usage dashboard (deals, PDFs, storage)
   - Plan comparison table
   - Upgrade/downgrade buttons

4. **Role-Based UI**
   - Hide/disable buttons based on permissions
   - Show role badge in user menu
   - Plan limit warnings (e.g., "5/30 deals this month")
   - Feature gates (e.g., "Upgrade to use PDF")

---

## ⏳ Phase 5: API Integration (TODO)

### Update Existing Routes:

1. **Deals API** (`app/admin-api/deals/route.ts`)
   ```typescript
   // Check permission
   const permCheck = await requirePermission('deals', 'create')
   if (!permCheck.authorized) return permCheck.error
   
   // Check plan limit
   const limitCheck = await requirePlanLimit('deals')
   if (!limitCheck.allowed) return limitCheck.error
   
   // ... create deal ...
   
   // Increment usage
   await incrementUsage(companyId, 'deals')
   ```

2. **Offers API** (`app/api/offers/route.ts`)
   - Add permission check
   - Add usage tracking

3. **PDF Generation** (`app/api/offers/[id]/pdf/route.ts`)
   - Check `pdf_generation` feature
   - Increment PDF usage counter
   - Use company settings for templates

4. **WhatsApp/Email** 
   - Check feature access
   - Increment usage counters
   - Use company templates

---

## ⏳ Phase 6: Payment Integration (TODO)

### Options:

**Israeli Payment Providers:**
1. **Tranzila** - Most popular in Israel
2. **Pelecard** - Good for subscriptions
3. **Meshulam** - Modern, developer-friendly
4. **Stripe** - International (if applicable)

### Implementation:
1. Create payment intent on plan selection
2. Webhook handler for successful payments
3. Update `company_subscriptions` status
4. Handle recurring billing
5. Generate invoices

---

## 📊 Usage Examples

### Example 1: Check Permission Before Creating Deal

```typescript
// In API route
import { requirePermission } from '@/lib/middleware/permissions'

export async function POST(req: NextRequest) {
  // Check permission
  const permCheck = await requirePermission('deals', 'create')(req)
  if (!permCheck.authorized) return permCheck.error
  
  // ... proceed with creation ...
}
```

### Example 2: Check Plan Limit

```typescript
import { requirePlanLimit, incrementUsage } from '@/lib/middleware/subscription'

export async function POST(req: NextRequest) {
  const companyId = getCompanyId(req)
  
  // Check if company can create more deals this month
  const limitCheck = await requirePlanLimit('deals')(req)
  if (!limitCheck.allowed) return limitCheck.error
  
  // ... create deal ...
  
  // Increment usage counter
  await incrementUsage(companyId, 'deals')
}
```

### Example 3: Feature Gate (PDF Generation)

```typescript
import { requireFeature } from '@/lib/middleware/subscription'

export async function POST(req: NextRequest) {
  // Check if company has PDF generation feature
  const featureCheck = await requireFeature('pdf_generation')(req)
  if (!featureCheck.allowed) return featureCheck.error
  
  // ... generate PDF ...
  
  await incrementUsage(companyId, 'pdfs')
}
```

### Example 4: Client-Side Permission Check

```typescript
'use client'
import { hasPermission } from '@/types/roles'

function DealsPage({ userRole }: { userRole: UserRole }) {
  const canCreate = hasPermission(userRole, 'deals', 'create')
  
  return (
    <div>
      {canCreate && (
        <button onClick={createDeal}>
          Create Deal
        </button>
      )}
    </div>
  )
}
```

---

## 🗄️ Database Migrations

### Apply in Order:

```bash
# 1. Roles & Permissions
psql your_database < supabase/migrations/013_add_roles_and_permissions.sql

# 2. Company Settings
psql your_database < supabase/migrations/014_add_company_settings.sql

# 3. Subscription Plans
psql your_database < supabase/migrations/015_add_subscription_plans.sql
```

**Or via Supabase Dashboard:**
1. Go to SQL Editor
2. Copy-paste each migration
3. Run them in order

---

## 🚀 Rollout Strategy

### Stage 1: Testing (Current Company Only)
- Apply migrations
- Test all roles in dev environment
- Verify limits work correctly

### Stage 2: Beta (Invite 2-3 Companies)
- Give them 3-month Pro trial
- Collect feedback
- Fix bugs

### Stage 3: Public Launch
- Marketing site
- Self-signup flow
- Payment integration
- Support system

---

## 💰 Pricing Recommendations

### Option A: Simple
- Free: ₪0 (30 deals/month, 1 user)
- Basic: ₪199/month (500 deals/month, 3 users)
- Pro: ₪499/month (unlimited)

### Option B: Tiered
- Starter: ₪149/month (100 deals/month, 2 users)
- Growth: ₪299/month (500 deals/month, 5 users)
- Business: ₪599/month (unlimited, 10+ users)
- Enterprise: Custom pricing

---

## 📈 Next Steps

1. ✅ Apply database migrations
2. ⏳ Build Settings UI page
3. ⏳ Build User Management page
4. ⏳ Build Subscription page
5. ⏳ Add permission checks to all API routes
6. ⏳ Add usage tracking to all actions
7. ⏳ Add feature gates to UI
8. ⏳ Integrate payment provider
9. ⏳ Create marketing site
10. ⏳ Launch beta program

---

## 🔧 Technical Debt to Address

- [ ] Add role change audit log
- [ ] Add subscription change history
- [ ] Add usage alerts (e.g., "90% of limit reached")
- [ ] Add automatic plan upgrade suggestions
- [ ] Add webhook system for integrations
- [ ] Add API key generation for Pro users
- [ ] Add company-level analytics dashboard

---

## 📞 Support

For questions or issues:
- Check migrations in `supabase/migrations/`
- Check types in `types/roles.ts`, `types/subscription.ts`
- Check middleware in `lib/middleware/permissions.ts`, `lib/middleware/subscription.ts`

---

**Status**: Database and backend ready ✅  
**Next**: Build UI pages 🎨  
**Then**: Payment integration 💳

