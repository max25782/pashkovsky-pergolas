# 🚀 Quick Vercel Deployment Guide

## 🎯 TL;DR

This is a **monorepo** with 2 apps. You need **2 separate Vercel projects**.

---

## ⚡ Quick Steps

### 1️⃣ Create CRM Project

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Import your repository
3. **Before deploying:**
   - Project Name: `pashkovsky-crm`
   - Root Directory: `apps/crm` ← **CRITICAL!**
   - Build Command: `cd ../.. && npm run build --filter=@pashkovsky/crm`
   - Output Directory: `.next`
4. Add environment variables (see below)
5. Click Deploy

### 2️⃣ Create Site Project

1. Go to [Vercel Dashboard](https://vercel.com/new) **again**
2. Import the **same** repository
3. **Before deploying:**
   - Project Name: `pashkovsky-site`
   - Root Directory: `apps/site` ← **CRITICAL!**
   - Build Command: `cd ../.. && npm run build --filter=@pashkovsky/site`
   - Output Directory: `.next`
4. Add environment variables (see below)
5. Click Deploy

---

## 🔑 Required Environment Variables

### For CRM Project:
```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Auth (REQUIRED)
JWT_SECRET=your-jwt-secret
SUPERADMIN_TOKEN=your-superadmin-token

# Redis (REQUIRED)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# AI (Optional but recommended)
GEMINI_API_KEY=your-gemini-key
```

### For Site Project:
```bash
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# AWS S3 (Optional - for images)
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=your-bucket
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

---

## ❌ Common Mistakes

### ❌ DON'T: Deploy both apps from one project
```
Root Directory: ./ ← WRONG!
```

### ✅ DO: Create 2 separate projects
```
Project 1: Root Directory = apps/crm
Project 2: Root Directory = apps/site
```

---

### ❌ DON'T: Use default build command
```
Build Command: npm run build ← WRONG!
```

### ✅ DO: Use Turbo filter
```
Build Command: cd ../.. && npm run build --filter=@pashkovsky/crm
```

---

## 🆘 Troubleshooting

### "routes-manifest.json couldn't be found"
→ **Root Directory is wrong**. Set it to `apps/crm` or `apps/site`

### "Module not found" errors
→ **Build command is wrong**. Use the Turbo filter command above

### Environment variables not working
→ Add them in Vercel Dashboard → Project Settings → Environment Variables

---

## 📚 Full Documentation

- `VERCEL_MONOREPO_SETUP.md` - Complete setup guide
- `VERCEL_ENV_SETUP.md` - All environment variables
- `VERCEL_DEPLOY_FIXES.md` - All issues and fixes

---

## ✅ After Deployment

### Test CRM:
- Login at `https://your-crm.vercel.app/login`
- SuperAdmin: `0524494848` + your token

### Test Site:
- Visit `https://your-site.vercel.app`
- Check gallery, contact form

---

**Need help?** Check the full guides above or contact support.

🚀 **Happy Deploying!**

