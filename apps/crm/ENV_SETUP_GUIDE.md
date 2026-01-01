# 🔐 CRM Environment Setup Guide

## Required Environment Variables

Add these to `apps/crm/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://kvqupacmdishpfnscnio.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Company
DEFAULT_COMPANY_ID=6998295e-89ae-4e3d-afd2-8c2b0333eac2

# Site Integration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRM_SITE_TOKEN=pashkovsky-crm-secure-token-2024

# AWS S3
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=pashkovsky-pergolas

# SuperAdmin Token (CRITICAL!)
SUPERADMIN_TOKEN=Hr11062015ks&
```

## 🔑 Where to Find Keys:

### 1. SUPABASE_SERVICE_ROLE_KEY
1. Go to: https://supabase.com/dashboard/project/kvqupacmdishpfnscnio/settings/api
2. Find section: **Project API keys**
3. Copy: **`service_role` secret** (NOT anon key!)
4. Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
Same page as above, copy the **`anon` `public`** key.

## ⚠️ After Adding Keys:

1. **Save** `.env.local`
2. **Restart** CRM server (kill and `npm run dev`)
3. **Hard refresh** browser (Ctrl+Shift+R)
4. **Test login** with phone: `0524494848` + token: `Hr11062015ks&`

## 🧪 Verify Setup:

Check server logs for:
```
✓ SUPERADMIN_TOKEN configured
✓ SUPABASE_SERVICE_ROLE_KEY configured
```

If missing, API will return 401 Unauthorized.

