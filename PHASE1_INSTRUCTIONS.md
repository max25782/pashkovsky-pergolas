# Phase 1: Database & Core Setup - Instructions

## Step 1: Apply Database Migration ⚠️ MANUAL STEP

**You need to apply the SQL migration in Supabase:**

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the file: `apps/crm/supabase/migrations/018_create_profiles_system.sql`
5. Copy the entire SQL content
6. Paste into Supabase SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected output:**
```
✓ Migration 018_create_profiles_system completed successfully
✓ Created 7 tables: suppliers, profiles, batches, stock, profile_orders, order_items, usage
✓ Indexes created for performance
✓ RLS policies enabled for multi-tenancy
✓ Triggers set up for auto-generation
```

**Verify tables were created:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'batches', 'stock', 'profile_orders', 'order_items', 'usage', 'suppliers')
ORDER BY table_name;
```

Should return 7 rows.

---

## Step 2: Get Your Company ID

You'll need your Pashkovsky company UUID for feature flags:

```sql
SELECT id, name FROM companies WHERE name LIKE '%Pashkov%';
```

Copy the UUID - you'll need it for `.env` file.

---

## Step 3: Initialize NestJS API

**I'll do this automatically in the next steps.**

---

## ⏸️ PAUSE HERE

**Please apply the migration in Supabase SQL Editor first, then tell me:**
1. ✓ Migration applied successfully
2. Your company UUID (from Step 2)

Then I'll continue with NestJS setup!
