# SuperAdmin Setup Guide

## 📋 Overview

SuperAdmin - это платформенный администратор с доступом ко всем компаниям и настройкам.

---

## 🔧 Setup Steps

### 1. Run Migration

Применить миграцию `024_subscription_management.sql`:

```bash
# В Supabase Dashboard > SQL Editor
# Или через CLI:
supabase db push
```

Эта миграция создаст:
- ✅ `subscription_plans` table
- ✅ `company_subscriptions` table
- ✅ `subscription_history` table
- ✅ `platform_admins` table

---

### 2. Add SuperAdmin User

Запустить SQL скрипт `supabase/ADD_SUPERADMIN.sql`:

```sql
-- Find your user_id
SELECT id, email FROM auth.users WHERE email = 'office@pashkovsky-group.com';

-- Add as SUPERADMIN
INSERT INTO public.platform_admins (user_id, role)
VALUES ('41bc1d19-aa1f-4427-b739-98003bea8528', 'SUPERADMIN')
ON CONFLICT (user_id) DO UPDATE SET role = 'SUPERADMIN', is_active = true;
```

---

### 3. Add Environment Variable

Добавить в `apps/crm/.env.local`:

```bash
# SuperAdmin Token (generate a strong random token)
SUPERADMIN_TOKEN=your-super-secret-token-here-min-32-chars

# Example (DO NOT USE IN PRODUCTION):
# SUPERADMIN_TOKEN=sa_1234567890abcdef_pashkovsky_admin_2025
```

**Generate token:**
```bash
# Linux/Mac
openssl rand -hex 32

# PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## 🔐 Authentication Methods

SuperAdmin имеет **2 способа** аутентификации:

### Method 1: Supabase Auth (Recommended)
- Login через `/login` с email/password
- Система автоматически проверяет `platform_admins` table
- RLS policies обеспечивают безопасность

### Method 2: Token-based (Fallback)
- Для API доступа или backup
- Используется `SUPERADMIN_TOKEN` из env
- Хранить в секрете!

---

## 🛠️ Usage in Code

### Check if user is SuperAdmin:

```typescript
import { isSuperAdmin } from '@/lib/auth/platform-admin'

const isSuperAdminUser = await isSuperAdmin()
if (!isSuperAdminUser) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Check specific permission:

```typescript
import { hasPlatformPermission } from '@/lib/auth/platform-admin'

const canManagePlans = await hasPlatformPermission('manage_plans')
if (!canManagePlans) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Verify token (API routes):

```typescript
import { verifySuperAdminToken } from '@/lib/auth/platform-admin'

const token = req.headers.get('x-superadmin-token')
if (!token || !verifySuperAdminToken(token)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## 🎯 Permissions

Default SUPERADMIN permissions:

```json
{
  "manage_all_companies": true,
  "view_analytics": true,
  "manage_plans": true,
  "manage_billing": true,
  "view_all_data": true,
  "manage_users": true
}
```

---

## 🚀 Next Steps

1. ✅ Run migration 024
2. ✅ Add your user as SUPERADMIN
3. ✅ Set SUPERADMIN_TOKEN in .env.local
4. ⏳ Create SuperAdmin UI at `/superadmin`
5. ⏳ Create SuperAdmin API routes

---

## 🔒 Security Notes

- ⚠️ **NEVER** commit `.env.local` to git
- ⚠️ **NEVER** share `SUPERADMIN_TOKEN`
- ⚠️ Use strong tokens (min 32 characters)
- ⚠️ Rotate tokens regularly
- ⚠️ Limit SuperAdmin users (1-2 max)
- ⚠️ Log all SuperAdmin actions

---

## 📊 Database Schema

### `platform_admins` Table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users (unique) |
| `role` | text | 'SUPERADMIN' or 'SUPPORT' |
| `permissions` | jsonb | Permission flags |
| `is_active` | boolean | Active status |
| `created_at` | timestamptz | Created timestamp |
| `updated_at` | timestamptz | Updated timestamp |

### RLS Policies:

```sql
-- Only platform admins can view other platform admins
CREATE POLICY "Platform admins can view platform admins"
  ON public.platform_admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  );
```

---

## 🧪 Testing

```bash
# Test SuperAdmin check
curl -H "x-superadmin-token: YOUR_TOKEN" \
  http://localhost:3001/api/superadmin/health

# Expected: {"ok": true, "role": "SUPERADMIN"}
```

---

## ❓ Troubleshooting

### "User is not a SuperAdmin"
1. Check `platform_admins` table:
   ```sql
   SELECT * FROM public.platform_admins WHERE user_id = 'YOUR_USER_ID';
   ```
2. Ensure `is_active = true`
3. Ensure `role = 'SUPERADMIN'`

### "SUPERADMIN_TOKEN not set"
1. Check `.env.local` exists
2. Check variable name: `SUPERADMIN_TOKEN`
3. Restart dev server after adding env variable

### "Forbidden" errors
1. Login with SuperAdmin account
2. Check RLS policies are enabled
3. Check user_id matches in `platform_admins`

---

## 📝 Example: Add Another SuperAdmin

```sql
-- 1. Find user
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- 2. Add as SUPERADMIN
INSERT INTO public.platform_admins (user_id, role)
VALUES ('USER_ID_HERE', 'SUPERADMIN');

-- 3. Verify
SELECT pa.*, u.email 
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id;
```

---

## 🎉 Done!

Your SuperAdmin setup is complete. Proceed to create the SuperAdmin UI.

