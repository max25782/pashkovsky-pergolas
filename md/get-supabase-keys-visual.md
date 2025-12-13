# Visual Guide: Getting Supabase Keys

## Where to Find Your Keys

### Location in Supabase Dashboard:

```
┌─────────────────────────────────────────┐
│  Supabase Dashboard                    │
│                                         │
│  [Projects List]                       │
│  └─ Your Project Name                  │
│     └─ [Click to open]                 │
│                                         │
│  Left Sidebar:                         │
│  ├─ Table Editor                       │
│  ├─ SQL Editor                         │
│  ├─ Authentication                     │
│  ├─ Storage                            │
│  ├─ ...                                │
│  └─ ⚙️ Settings  ← CLICK HERE         │
│     └─ API  ← THEN CLICK HERE         │
│                                         │
│  You'll see:                           │
│  ┌─────────────────────────────────┐  │
│  │ Project URL                     │  │
│  │ https://xxxxx.supabase.co       │  │
│  │ [Copy]                          │  │
│  └─────────────────────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │ Project API keys                │  │
│  │                                 │  │
│  │ anon public                     │  │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI... │  │
│  │ [Copy]                          │  │
│  │                                 │  │
│  │ service_role [SECRET] ⚠️       │  │
│  │ 👁️ [Reveal] ← CLICK TO SHOW   │  │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI... │  │
│  │ [Copy] ← COPY THIS ONE!        │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Step-by-Step Screenshots Guide

### 1. Login
- Go to: https://supabase.com/dashboard
- Sign in

### 2. Select Project
- Click on your project from the list

### 3. Open Settings
- Scroll down in left sidebar
- Click **Settings** (⚙️ icon)

### 4. Click API
- In settings menu, click **API**

### 5. Find service_role Key
- Look for **"Project API keys"** section
- Find **"service_role"** row
- It will say **[SECRET]** next to it
- Click the **eye icon** 👁️ or **"Reveal"** button
- Copy the key (it's very long, starts with `eyJ...`)

## What Each Key Is For

| Key | Variable Name | Used For | Security |
|-----|--------------|----------|----------|
| **Project URL** | `SUPABASE_URL` | Connection URL | Safe to expose |
| **anon public** | `SUPABASE_ANON_KEY` | Client-side (browser) | Safe to expose |
| **service_role** ⚠️ | `SUPABASE_SERVICE_ROLE_KEY` | Server-side (API) | **SECRET - Never expose!** |

## Your .env.local Should Look Like:

```env
# From "Project URL" section
SUPABASE_URL=https://abcdefghijklmnop.supabase.co

# From "service_role" key (click Reveal first!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ1MTkyMDAwLCJleHAiOjE5NjA3NjgwMDB9.very-long-secret-key-here

# Your admin token
ADMIN_TOKEN=your-admin-token
```

## Quick Checklist

- [ ] Logged into Supabase Dashboard
- [ ] Selected correct project
- [ ] Clicked Settings → API
- [ ] Found "Project URL" → Copy to `SUPABASE_URL`
- [ ] Found "service_role" key → Clicked "Reveal"
- [ ] Copied service_role key → Paste to `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Added both to `.env.local`
- [ ] Restarted dev server (`npm run dev`)

## Still Stuck?

If you can't find the service_role key:
1. Make sure you're the project owner (or have admin access)
2. Check if project is paused (unpause it first)
3. Try refreshing the page
4. Check browser console for errors




