# Force Vercel to Deploy Latest Commit

## Problem / Проблема

New commits (`b9c2385`, `026937e`, etc.) are pushed to GitHub but **don't appear in Vercel Deployments**.

## Solution / Решение

### Option 1: Check Git Integration (Recommended)

**Site project → Settings → Git:**

1. **Git Provider**: Should show GitHub icon + `max25782/pashkovsky-pergolas`
2. **Production Branch**: Should be `master`
3. **Automatic Deployments**: Should be **ON** (enabled)

If any of these are wrong or disconnected:
- Click **"Disconnect"** (if needed)
- Click **"Connect Git Repository"**
- Select `max25782/pashkovsky-pergolas`
- Set Production Branch to `master`

### Option 2: Disable "Skip deployments" temporarily

**Site project → Settings → Build and Deployment:**

Find: **"Skip deployments when there are no changes to the root directory or its dependencies"**

- Turn it **OFF**
- Click **Save**
- Make a tiny change in `apps/site/` and push
- Turn it back **ON** after first successful deploy

### Option 3: Manual Deploy via Vercel CLI

If Dashboard doesn't work, use CLI:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
vercel --prod
```

This will deploy the current local state directly.

### Option 4: Create deployment via Vercel API/Dashboard

In Vercel Dashboard:
1. **Deployments** → **"Create Deployment"** button (if available)
2. Or use the **"Redeploy"** button on ANY deployment and it will use latest Git commit

---

## Why this happens / Почему это происходит

**Root Directory + Monorepo:**
- Vercel Root Directory = `apps/site`
- When you push changes to `package.json` (root) or `apps/crm/`, Vercel thinks "no changes in `apps/site/`"
- So it **skips creating a deployment**
- The "Skip deployments..." setting makes this worse

**Solution:**
- Always push at least one change **inside `apps/site/`** when you want to deploy Site
- Or temporarily disable "Skip deployments..." setting

---

## Current commits / Текущие коммиты

Latest commits that should be deployed:
- `026937e` - chore(site): force deployment trigger
- `b9c2385` - chore: update package-lock.json with tailwindcss in dependencies
- `df96402` - Ensure tailwindcss is installed on Vercel
- `35e6bf9` - Fix CRM turbo filter to match workspace name

All of these have the fixes needed for successful build.

---

## Quick test / Быстрая проверка

In your terminal, check latest commit:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git log --oneline -1
```

Should show: `026937e chore(site): force deployment trigger`

If Vercel still doesn't show this commit in Deployments after 1-2 minutes, the Git integration is broken or disabled.




