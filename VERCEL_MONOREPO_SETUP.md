# Vercel Monorepo Setup Guide

## The Problem

When deploying a Turborepo monorepo to Vercel, you may encounter:
```
Error: The file "/vercel/path0/.next/routes-manifest.json" couldn't be found.
```

This happens because Vercel doesn't know which app in the monorepo to deploy.

## Solution: Create Separate Vercel Projects

For a monorepo with multiple apps (CRM + Site), you need **TWO separate Vercel projects**.

---

## Step 1: Create First Project (CRM)

### 1.1 Import Project in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. **Do NOT click Deploy yet!**

### 1.2 Configure Project Settings

In "Configure Project" screen:

#### Project Name
```
pashkovsky-crm
```

#### Framework Preset
```
Next.js
```

#### Root Directory
```
apps/crm
```
✅ **CRITICAL:** Click "Edit" next to Root Directory and select `apps/crm`

#### Build & Development Settings

**Build Command:**
```bash
cd ../.. && npm run build --filter=@pashkovsky/crm
```

**Output Directory:**
```
.next
```
(Relative to Root Directory, so it's `apps/crm/.next`)

**Install Command:**
```bash
npm install
```

#### Environment Variables
Add all required variables from `VERCEL_ENV_SETUP.md`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `SUPERADMIN_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- etc.

### 1.3 Deploy
Click "Deploy" and wait for the build to complete.

---

## Step 2: Create Second Project (Site)

### 2.1 Import Same Repository Again
1. Go back to Vercel Dashboard
2. Click "Add New..." → "Project"
3. Import the **same** Git repository
4. **Do NOT click Deploy yet!**

### 2.2 Configure Project Settings

#### Project Name
```
pashkovsky-site
```

#### Framework Preset
```
Next.js
```

#### Root Directory
```
apps/site
```
✅ **CRITICAL:** Click "Edit" next to Root Directory and select `apps/site`

#### Build & Development Settings

**Build Command:**
```bash
cd ../.. && npm run build --filter=@pashkovsky/site
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

#### Environment Variables
Add required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` (if using S3)
- `NEXT_PUBLIC_AWS_S3_REGION` (if using S3)
- `AWS_S3_BUCKET_NAME` (if using S3)
- `AWS_S3_REGION` (if using S3)
- `AWS_ACCESS_KEY_ID` (if using S3)
- `AWS_SECRET_ACCESS_KEY` (if using S3)

### 2.3 Deploy
Click "Deploy" and wait for the build to complete.

---

## Step 3: Verify Deployment

### CRM (apps/crm)
1. Open your CRM Vercel URL
2. Navigate to `/login`
3. Try SuperAdmin login with phone + token
4. Check that all features work

### Site (apps/site)
1. Open your Site Vercel URL
2. Check homepage loads
3. Check gallery images (if S3 configured)
4. Test contact form

---

## Common Issues & Solutions

### Issue: "routes-manifest.json couldn't be found"
**Cause:** Wrong Root Directory or Build Command  
**Solution:** Make sure Root Directory is set to `apps/crm` or `apps/site`

### Issue: Build fails with "command not found: turbo"
**Cause:** Build command is wrong  
**Solution:** Use `cd ../.. && npm run build --filter=<package-name>`

### Issue: Environment variables not working
**Cause:** Not set in Vercel project  
**Solution:** Add all required env vars in Vercel dashboard

### Issue: Import paths not resolving
**Cause:** Wrong Root Directory  
**Solution:** Root Directory MUST be `apps/crm` or `apps/site`, not root

### Issue: Shared types not found
**Cause:** Turbo not building dependencies  
**Solution:** Build command should use `--filter` to include dependencies

---

## Alternative: Using Vercel CLI

If you prefer using CLI:

### For CRM:
```bash
cd apps/crm
vercel --prod
```

When prompted:
- Set up and deploy: Yes
- Which scope: Your scope
- Link to existing project: No
- Project name: pashkovsky-crm
- In which directory is your code located: ./
- Override settings: Yes
- Build Command: `cd ../.. && npm run build --filter=@pashkovsky/crm`
- Output Directory: .next
- Development Command: npm run dev

### For Site:
```bash
cd apps/site
vercel --prod
```

Follow the same prompts, but:
- Project name: pashkovsky-site
- Build Command: `cd ../.. && npm run build --filter=@pashkovsky/site`

---

## Project Structure

After setup, you'll have:

```
Vercel Dashboard
├── pashkovsky-crm (https://pashkovsky-crm.vercel.app)
│   ├── Root Directory: apps/crm
│   ├── Build: cd ../.. && npm run build --filter=@pashkovsky/crm
│   └── Env: CRM-specific variables
│
└── pashkovsky-site (https://pashkovsky-site.vercel.app)
    ├── Root Directory: apps/site
    ├── Build: cd ../.. && npm run build --filter=@pashkovsky/site
    └── Env: Site-specific variables
```

---

## Custom Domains

After successful deployment, you can add custom domains:

### For CRM:
1. Go to pashkovsky-crm project
2. Settings → Domains
3. Add: `crm.yourdomain.com`

### For Site:
1. Go to pashkovsky-site project
2. Settings → Domains
3. Add: `www.yourdomain.com` and `yourdomain.com`

---

## Automatic Deployments

Both projects will auto-deploy when you push to your Git repository:
- **CRM** deploys when changes in `apps/crm/**` or shared dependencies
- **Site** deploys when changes in `apps/site/**` or shared dependencies

You can configure this in:
Settings → Git → Ignored Build Step

---

## Summary

✅ Create 2 separate Vercel projects  
✅ Set correct Root Directory for each  
✅ Use Turbo filter in Build Command  
✅ Add all required Environment Variables  
✅ Deploy and verify  

**DO NOT** try to deploy both apps from a single Vercel project!

---

**Last Updated:** December 30, 2025  
**Status:** ✅ Production Ready

