# 🚀 Migration 024 - Quick Start Checklist

## ✅ Step-by-Step Guide

### 📋 Prerequisites
- [ ] You have access to Supabase Dashboard
- [ ] You are logged in as `office@pashkovsky-group.com`
- [ ] Your `auth.users.id` is: `41bc1d19-aa1f-4427-b739-98003bea8528`

---

## 🔧 Step 1: Apply Migration

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the **ENTIRE** content of:
   ```
   supabase/migrations/024_subscription_management.sql
   ```
5. Paste into SQL Editor
6. Click **Run** (or press `Ctrl+Enter`)

### ✅ Expected Result:
```
Success. No rows returned
```

### ❌ If Error:
- Check error message
- Most common: `function update_updated_at() does not exist`
- **Solution**: The migration now includes this function at the top

---

## 🔧 Step 2: Verify Migration

Run this query in SQL Editor:

```sql
SELECT 'subscription_plans' as table_name, COUNT(*) as records 
FROM public.subscription_plans
UNION ALL
SELECT 'company_subscriptions', COUNT(*) 
FROM public.company_subscriptions
UNION ALL
SELECT 'subscription_history', COUNT(*) 
FROM public.subscription_history
UNION ALL
SELECT 'platform_admins', COUNT(*) 
FROM public.platform_admins;
```

### ✅ Expected Output:
| table_name | records |
|------------|---------|
| subscription_plans | 4 |
| company_subscriptions | 1+ |
| subscription_history | 0 |
| platform_admins | 0 |

---

## 🔧 Step 3: Add Yourself as SUPERADMIN

1. In SQL Editor, run:
   ```sql
   -- Find your user_id
   SELECT id, email FROM auth.users 
   WHERE email = 'office@pashkovsky-group.com';
   ```

2. Copy the `id` (should be `41bc1d19-aa1f-4427-b739-98003bea8528`)

3. Run:
   ```sql
   INSERT INTO public.platform_admins (user_id, role, permissions)
   VALUES (
     '41bc1d19-aa1f-4427-b739-98003bea8528', 
     'SUPERADMIN',
     '{
       "manage_all_companies": true,
       "view_analytics": true,
       "manage_plans": true,
       "manage_billing": true,
       "view_all_data": true,
       "manage_users": true
     }'::jsonb
   )
   ON CONFLICT (user_id) DO UPDATE 
   SET role = 'SUPERADMIN', is_active = true;
   ```

4. Verify:
   ```sql
   SELECT pa.*, u.email 
   FROM public.platform_admins pa
   JOIN auth.users u ON u.id = pa.user_id;
   ```

### ✅ Expected Output:
| id | user_id | role | email | is_active |
|----|---------|------|-------|-----------|
| ... | 41bc1d19... | SUPERADMIN | office@pashkovsky-group.com | true |

---

## 🔧 Step 4: Add Environment Variable

1. Open `apps/crm/.env.local`

2. Add this line:
   ```bash
   # SuperAdmin Token (keep secret!)
   SUPERADMIN_TOKEN=sa_pashkovsky_2025_YOUR_SECRET_TOKEN_HERE
   ```

3. Generate a secure token (optional):
   ```powershell
   # PowerShell
   [System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```

4. **Restart CRM dev server**:
   ```bash
   cd apps/crm
   npm run dev
   ```

---

## 🔧 Step 5: Test API

Open browser console on `http://localhost:3001/login` and run:

```javascript
// Test public endpoint
fetch('http://localhost:3001/api/public/subscriptions/plans')
  .then(r => r.json())
  .then(console.log)

// Expected: { plans: [{plan_key: "trial", ...}, ...] }
```

---

## ✅ Verification Checklist

- [ ] Migration 024 applied successfully
- [ ] 4 subscription plans created (trial, basic, pro, enterprise)
- [ ] Your company has a subscription
- [ ] You are added as SUPERADMIN in `platform_admins`
- [ ] `SUPERADMIN_TOKEN` added to `.env.local`
- [ ] CRM dev server restarted
- [ ] Public API endpoint returns plans

---

## 🎉 Done!

You are now ready to:
1. ✅ Use subscription management API
2. ✅ Build SuperAdmin UI (`/superadmin`)
3. ✅ Build Settings page for users

---

## 🆘 Troubleshooting

### Error: "function update_updated_at() does not exist"
**Solution**: The migration was updated. Re-copy the entire `024_subscription_management.sql` file.

### Error: "column does not exist"
**Solution**: Check if previous tables exist:
```sql
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.subscription_history CASCADE;
DROP TABLE IF EXISTS public.company_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
```
Then re-run migration.

### Error: "duplicate key value violates unique constraint"
**Solution**: Tables already exist. Drop them first (see above).

### "No rows returned" but no plans created
**Solution**: Check the INSERT statements in migration. The migration includes 4 INSERT statements for plans.

### Can't verify SUPERADMIN
**Solution**: 
```sql
SELECT * FROM public.platform_admins WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';
```
If empty, re-run Step 3.

---

## 📞 Need Help?

Check documentation:
- `docs/SUPERADMIN_SETUP.md` - Full setup guide
- `docs/API_SUBSCRIPTIONS.md` - API documentation

