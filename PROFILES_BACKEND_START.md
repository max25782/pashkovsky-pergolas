# 🚀 Profiles Shop Backend - Quick Start Guide

## ✅ What I Just Created

### 1. Database Migration
📁 `apps/crm/supabase/migrations/018_create_profiles_system.sql`
- 7 tables for complete profiles e-commerce system
- RLS policies for multi-tenancy
- Indexes for performance
- Auto-generate order numbers

### 2. NestJS API (Skeleton)
📁 `apps/profiles-api/` - Complete NestJS application
- Profiles module (FULLY implemented with CRUD)
- Stubs for other modules (Batches, Stock, Orders, Usage, Suppliers, WebSockets)
- Authentication guards (JWT + company access control)
- Supabase integration
- Ready to run!

---

## 🎯 YOUR ACTION ITEMS (15 minutes)

### ⚠️ Step 1: Apply Database Migration

**Open:** `apps/crm/supabase/migrations/018_create_profiles_system.sql`

**Copy entire file content**

**Paste into:** Supabase Dashboard → SQL Editor → Run

**Expected output:**
```
✓ Migration 018_create_profiles_system completed successfully
✓ Created 7 tables
```

---

### Step 2: Get Company UUID

In Supabase SQL Editor, run:

```sql
SELECT id, name FROM companies;
```

**Copy your company UUID** (you'll need it next)

---

### Step 3: Install & Configure

```bash
cd apps/profiles-api

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

**Edit `.env`** and fill in (copy from `apps/crm/.env` or Supabase dashboard):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-jwt-secret
PORT=3002
PASHKOVSKY_COMPANY_ID=<your-company-uuid-from-step-2>
```

---

### Step 4: Start API

```bash
npm run start:dev
```

**Expected output:**
```
🚀 Profiles API running on http://localhost:3002
```

---

### Step 5: Test It Works

**Simple test (no auth needed):**
```bash
curl "http://localhost:3002/profiles?company_id=<your-company-uuid>"
```

Should return: `[]` (empty array - no profiles yet)

✅ **SUCCESS!** Phase 1 is complete.

---

## 📋 What's Next

Once you confirm Phase 1 works, tell me:

**"Phase 1 working! Continue to Phase 2"**

Then I'll implement:
- **Phase 2:** Batches & Stock modules
- **Phase 3:** Orders & Pricing logic
- **Phase 4:** Supplier reports & WebSockets

---

## 📁 All Created Files

### Database
- `apps/crm/supabase/migrations/018_create_profiles_system.sql`

### NestJS API (apps/profiles-api/)
- `package.json`, `tsconfig.json`, `nest-cli.json`
- `.env.example`, `.gitignore`, `README.md`
- `src/main.ts`, `src/app.module.ts`
- `src/config/supabase.config.ts`
- `src/common/guards/` (2 files)
- `src/common/decorators/` (1 file)
- `src/profiles/` (5 files) - **FULLY IMPLEMENTED**
- `src/batches/` (3 stub files)
- `src/stock/` (3 stub files)
- `src/orders/` (3 stub files)
- `src/usage/` (3 stub files)
- `src/suppliers/` (3 stub files)
- `src/webhooks/` (2 stub files)

### Documentation
- `PHASE1_INSTRUCTIONS.md`
- `PHASE1_COMPLETE.md`
- `apps/profiles-api/README.md`
- `.cursor/skills-cursor/create-skill/BACKEND_SUMMARY.md`

**Total:** ~25 files created

---

## 🔍 Key Features Implemented

### Profiles Module (CRUD)
- ✅ Create profile (POST /profiles) - Admin only, Pashkovsky only
- ✅ List profiles (GET /profiles) - Public for active, Admin for all
- ✅ Get profile (GET /profiles/:id)
- ✅ Update profile (PATCH /profiles/:id) - Admin only
- ✅ Soft delete (DELETE /profiles/:id) - Admin only
- ✅ List with stock (GET /profiles/with-stock) - Admin only

### Security
- ✅ JWT authentication via Supabase
- ✅ Company-based access control (only Pashkovsky)
- ✅ RLS policies at database level
- ✅ Validation for all inputs

### Multi-tenancy
- ✅ All data isolated by `company_id`
- ✅ Feature flag system (Pashkovsky only for now)
- ✅ Ready to enable for other companies in future

---

## 💡 Quick Test Commands

### 1. Health Check
```bash
curl http://localhost:3002/profiles?company_id=YOUR_UUID
# Should return: []
```

### 2. Create Profile (need JWT token)
Get token from CRM → DevTools → Application → supabase.auth.token

```bash
curl -X POST http://localhost:3002/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "code": "F5020",
    "name_he": "פרופיל מבני F5020",
    "dimensions": "50x20mm",
    "weight_per_meter": 0.85,
    "available_lengths": [6.0, 6.5, 7.0, 8.0],
    "category": "structural",
    "price_per_kg": 120,
    "is_active": true
  }'
```

### 3. List Profiles Again
```bash
curl http://localhost:3002/profiles?company_id=YOUR_UUID
# Should return: [{ id: "...", code: "F5020", ... }]
```

---

## 🎯 Ready for Phase 2?

Once you've completed the 5 steps above and confirmed the API works, we'll move to:

**Phase 2: Batches & Stock Modules**
- Create supplier deliveries
- Track inventory by profile/color/length
- Auto-create stock when batch arrives
- Low stock alerts

**Just tell me:** "Ready for Phase 2!"

---

## 📞 Need Help?

If you encounter any issues:

1. **Check logs:** API terminal shows clear error messages
2. **Verify `.env`:** All variables set correctly
3. **Check migration:** Tables exist in Supabase
4. **Token issues:** Get fresh JWT from CRM login

**Common issues documented in:** `apps/profiles-api/README.md` (Troubleshooting section)

---

**🎊 Phase 1 Complete! Great progress!** 

Next: Apply migration → Install → Run → Test → Phase 2
