# 🚀 Quick Start: Hybrid Deployment

## 📋 Overview

This project uses **Route Groups** for logical separation:
- Site (Public) → `app/(public)`
- CRM (Private) → `app/(crm)`

Deployed to **two Vercel projects** from same codebase.

---

## ⚡ Quick Deploy

### **1. Create Vercel Projects**

**Project A: Site**
```bash
Name: pashkovsky-site
Domain: pashkovsky-group.com
Git Branch: main
```

**Project B: CRM**
```bash
Name: pashkovsky-crm
Domain: crm.pashkovsky-group.com
Git Branch: main
```

### **2. Add Environment Variables**

**Site Project:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_SITE_URL=https://pashkovsky-group.com
```

**CRM Project:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
JWT_SECRET=xxx
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
ENABLE_CRM_SUBDOMAIN=true
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=pashkovsky-gallery
SMTP_HOST=smtp.gmail.com
SMTP_USER=xxx
SMTP_PASSWORD=xxx
```

See `docs/ENV_TEMPLATE.txt` for full list.

### **3. Deploy!**

Both projects will auto-deploy on `git push`.

---

## 🏗️ Project Structure

```
/
├── app/
│   ├── (public)/[locale]/    → Site pages
│   ├── (crm)/app/            → CRM pages  
│   ├── (auth)/               → Auth pages (shared)
│   ├── api/                  → API routes (shared)
│   └── admin-api/            → CRM-only APIs
├── components/
│   ├── (site components)     → Public components
│   └── admin/                → CRM components
├── lib/                      → Shared utilities
├── middleware.ts             → Route protection
└── docs/
    ├── HYBRID_DEPLOYMENT.md  → Full deployment guide
    ├── ENVIRONMENT_VARIABLES.md → Env vars guide
    └── ENV_TEMPLATE.txt      → Template
```

---

## 🌐 URLs

### **Production:**
- Site: `https://pashkovsky-group.com`
- CRM: `https://crm.pashkovsky-group.com`

### **Local Dev:**
- Site: `http://localhost:3000/he`
- CRM: `http://localhost:3000/app/admin`

---

## 📚 Documentation

- `docs/HYBRID_DEPLOYMENT.md` - Complete deployment guide
- `docs/ENVIRONMENT_VARIABLES.md` - Environment variables
- `docs/ROUTE_GROUPS_COMPLETE.md` - Route groups structure
- `docs/MIDDLEWARE_AUTH.md` - Authentication

---

## ✅ Checklist

- [ ] Create both Vercel projects
- [ ] Add environment variables
- [ ] Configure custom domains
- [ ] Test both sites
- [ ] Setup database migrations (Supabase)
- [ ] Configure S3 bucket (for CRM uploads)
- [ ] Setup SMTP (for CRM emails)

---

**Done! Both sites deployed!** 🎉

