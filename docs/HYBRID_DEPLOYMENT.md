# 🚀 Hybrid Deployment: Site + CRM Separation

## 📋 Обзор

Проект использует **Next.js Route Groups** для логического разделения:
- `app/(public)` → Public site (marketing)
- `app/(crm)` → CRM application
- `app/(auth)` → Authentication pages

Deployment происходит на **два отдельных Vercel projects**:
- `pashkovsky-site` → `pashkovsky-group.com`
- `pashkovsky-crm` → `crm.pashkovsky-group.com`

---

## 🎯 Архитектура

```
Single Codebase
├── app/
│   ├── (public)/      → Deploy to SITE
│   ├── (crm)/         → Deploy to CRM
│   ├── (auth)/        → Deploy to BOTH
│   └── api/           → Deploy to BOTH
├── components/
├── lib/
└── ...

↓ Deploy ↓

Site Project               CRM Project
pashkovsky-group.com       crm.pashkovsky-group.com
```

---

## 🔧 Vercel Configuration

### **Vercel Project 1: Site (Public)**

**Settings:**
- **Project Name:** `pashkovsky-site`
- **Domain:** `pashkovsky-group.com`, `www.pashkovsky-group.com`
- **Root Directory:** `.` (same as CRM)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

**Environment Variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Site-specific
NEXT_PUBLIC_SITE_URL=https://pashkovsky-group.com
NEXT_PUBLIC_ENABLE_CRM_LINK=false

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
VERCEL_ANALYTICS_ID=xxx
```

**Ignored Build Step:** (optional)
```bash
# Only build if public site files changed
git diff HEAD^ HEAD --quiet app/(public) || exit 1
```

---

### **Vercel Project 2: CRM**

**Settings:**
- **Project Name:** `pashkovsky-crm`
- **Domain:** `crm.pashkovsky-group.com`
- **Root Directory:** `.` (same repo)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

**Environment Variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx (server-only)

# JWT
JWT_SECRET=your-secret-key-change-in-production

# CRM-specific
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
ENABLE_CRM_SUBDOMAIN=true

# S3 for uploads
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=pashkovsky-gallery

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASSWORD=xxx
```

**Ignored Build Step:** (optional)
```bash
# Only build if CRM files changed
git diff HEAD^ HEAD --quiet app/(crm) app/admin-api || exit 1
```

---

## 🌐 Middleware Routing

`middleware.ts` уже настроен для работы с обоими доменами:

```typescript
// Automatically handles:
// - pashkovsky-group.com → serves (public) routes
// - crm.pashkovsky-group.com → redirects to /app
```

**Для Site domain:**
- Локали: `/he`, `/ru`, `/en`
- Public pages работают

**Для CRM subdomain:**
- Redirect на `/app/admin`
- Защита через JWT

---

## 📦 Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    
    "build:site": "DEPLOYMENT_TARGET=site npm run build",
    "build:crm": "DEPLOYMENT_TARGET=crm npm run build"
  }
}
```

---

## 🔐 Environment Variables Structure

### **Shared (both projects):**
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### **Site-only:**
```env
NEXT_PUBLIC_SITE_URL=https://pashkovsky-group.com
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_ENABLE_CRM_LINK=false
```

### **CRM-only:**
```env
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
```

---

## 🚀 Deployment Steps

### **Initial Setup:**

1. **Create two Vercel projects** from same GitHub repo:
   ```bash
   # Project 1
   Name: pashkovsky-site
   Domain: pashkovsky-group.com
   
   # Project 2
   Name: pashkovsky-crm
   Domain: crm.pashkovsky-group.com
   ```

2. **Configure environment variables** for each project (see above)

3. **Set custom domains:**
   - Site: Add `pashkovsky-group.com` + `www` redirect
   - CRM: Add `crm.pashkovsky-group.com`

4. **Deploy!**

### **Subsequent Deploys:**

Both projects auto-deploy on `git push` to main.

**Optional:** Use ignored build step to skip builds when files didn't change.

---

## 🎨 Development Workflow

### **Local Development:**

```bash
# Start dev server (both site + CRM available)
npm run dev

# Access:
# - http://localhost:3000/he → Site
# - http://localhost:3000/app/admin → CRM
```

### **Testing Subdomain Logic:**

Add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 crm.localhost
```

Then access: `http://crm.localhost:3000`

---

## 📊 Cost & Performance

### **Benefits:**
✅ **Shared code** - no duplication  
✅ **Shared dependencies** - faster builds  
✅ **Single repository** - easier management  
✅ **Independent scaling** - CRM can scale separately  

### **vs Full Monorepo:**
- ✅ Simpler setup
- ✅ No import rewrites needed
- ✅ Faster build times
- ✅ Less configuration

---

## 🔄 Migration to Full Monorepo (Future)

If you need full separation later:

```bash
# Split into separate repos
/pashkovsky-site/     → Site only
/pashkovsky-crm/      → CRM only
/pashkovsky-shared/   → Shared package (npm)
```

Current structure makes this migration easy!

---

## 🛠️ Troubleshooting

### **Issue: CRM not accessible on subdomain**

Check `middleware.ts`:
```typescript
const isCRMSubdomain = subdomain === 'crm' || subdomain === 'admin'
```

### **Issue: Environment variables not working**

Verify in Vercel dashboard:
- Settings → Environment Variables
- Redeploy after adding new vars

### **Issue: Build failing**

Check if all dependencies in `package.json`:
```bash
npm install
```

---

## 📚 Related Docs

- `docs/ROUTE_GROUPS_COMPLETE.md` - Route groups structure
- `docs/MIDDLEWARE_AUTH.md` - Authentication & company selection
- `docs/SAAS_PLAN.md` - SaaS features roadmap

---

## ✅ Checklist

**Setup:**
- [ ] Create Vercel project for Site
- [ ] Create Vercel project for CRM
- [ ] Configure custom domains
- [ ] Add environment variables
- [ ] Test both deployments

**Optional:**
- [ ] Setup ignored build steps
- [ ] Configure preview deployments
- [ ] Setup Vercel Analytics (separate per project)
- [ ] Configure error tracking (Sentry)

---

**🎉 Ready for production deployment!**

