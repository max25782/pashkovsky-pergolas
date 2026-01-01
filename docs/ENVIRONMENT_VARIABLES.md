# Environment Variables Guide

## 🎯 Overview

Variables are organized by **deployment target**:
- **Shared:** Both Site & CRM
- **Site-only:** Marketing site
- **CRM-only:** Internal CRM application

---

## 📦 Vercel Projects

### **Project 1: Site (pashkovsky-site)**
Domain: `pashkovsky-group.com`

**Required Variables:**
```env
# Supabase (Shared)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Site-specific
NEXT_PUBLIC_SITE_URL=https://pashkovsky-group.com
NEXT_PUBLIC_ENABLE_CRM_LINK=false

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
VERCEL_ANALYTICS_ID=xxx
```

### **Project 2: CRM (pashkovsky-crm)**
Domain: `crm.pashkovsky-group.com`

**Required Variables:**
```env
# Supabase (Shared)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Supabase (Server)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars

# CRM
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
ENABLE_CRM_SUBDOMAIN=true

# S3 Storage
AWS_ACCESS_KEY_ID=AKIAxxxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=pashkovsky-gallery

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourapp@gmail.com
SMTP_PASSWORD=your-app-specific-password

# Optional: WhatsApp
WHATSAPP_API_KEY=xxx
WHATSAPP_PHONE=+972xxxxxxxxx
```

---

## 🔐 Security Notes

### **JWT_SECRET**
- **Length:** Minimum 32 characters
- **Generate:** `openssl rand -base64 32`
- **Important:** Different for dev/staging/production

### **SUPABASE_SERVICE_ROLE_KEY**
- **Only for CRM** (has full database access)
- **Never expose** to client
- **Do not** add to site project

### **AWS Credentials**
- Use **IAM user** with limited permissions
- Only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- Restrict to specific bucket

---

## 📝 Variable Prefix Convention

Use prefixes to identify variable scope:

| Prefix | Scope | Example |
|--------|-------|---------|
| `NEXT_PUBLIC_` | Client-side (both) | `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SITE_` | Client-side (site only) | `NEXT_PUBLIC_SITE_URL` |
| `NEXT_PUBLIC_CRM_` | Client-side (CRM only) | `NEXT_PUBLIC_CRM_URL` |
| No prefix | Server-side only | `JWT_SECRET`, `SMTP_PASSWORD` |

---

## 🛠️ Setup Instructions

### **1. Vercel Dashboard**

For each project:
1. Go to Settings → Environment Variables
2. Add variables for **Production**, **Preview**, **Development**
3. Click "Save"

### **2. Local Development**

Create `.env.local`:
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

**Never commit** `.env.local` to git!

---

## 🔄 Environment Stages

### **Production**
- Used for: main branch deploys
- Domain: `pashkovsky-group.com`, `crm.pashkovsky-group.com`
- Full configuration

### **Preview**
- Used for: PR deploys
- Domain: `*-git-*.vercel.app`
- Can use same values as Production (or separate staging DB)

### **Development**
- Used for: Local development (`vercel dev`)
- Can use separate test database

---

## ✅ Verification

### **Check Site Variables:**
```javascript
// Run in browser console on pashkovsky-group.com
console.log({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
})
```

### **Check CRM Variables:**
```javascript
// Run in browser console on crm.pashkovsky-group.com
console.log({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  crmUrl: process.env.NEXT_PUBLIC_CRM_URL,
})
```

**Server variables** won't be visible in browser (that's correct!).

---

## 🚨 Common Mistakes

### ❌ Adding JWT_SECRET to Site project
**Why it's wrong:** Site doesn't need it, reduces security

### ❌ Using same JWT_SECRET for dev/prod
**Why it's wrong:** If dev secret leaks, production is compromised

### ❌ Forgetting NEXT_PUBLIC_ prefix
**Why it's wrong:** Variable won't be available on client-side

### ❌ Adding SUPABASE_SERVICE_ROLE_KEY to Site
**Why it's wrong:** Gives full DB access from public site

---

## 📚 Related Files

- `.env.example` - Template for local development
- `docs/HYBRID_DEPLOYMENT.md` - Full deployment guide
- `lib/supabase.ts` - Supabase client configuration

---

## 🎉 Ready!

After configuring all variables, deploy and test both sites! 🚀

