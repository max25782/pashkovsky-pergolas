# Setup .env.local for Admin Token

## Problem
You have `ADMIN_TOKEN` in `.env` but Next.js needs it in `.env.local` for local development.

## Solution

### Step 1: Find your ADMIN_TOKEN

Check your `.env` file and find the line:
```env
ADMIN_TOKEN=your-token-here
```

### Step 2: Create .env.local

Create a new file called `.env.local` in the root directory with:

```env
# Copy ADMIN_TOKEN from .env
ADMIN_TOKEN=your-token-from-env

# Also copy these if you have them:
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Restart Dev Server

```powershell
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Use the Same Token

When you go to `/admin/deals` page:
1. Enter the **same token** that's in `.env.local`
2. Click "Continue"
3. Deals should now load!

## Quick Copy Script

If you want to copy ADMIN_TOKEN from .env to .env.local automatically:

```powershell
# Get ADMIN_TOKEN from .env
$token = (Get-Content .env | Select-String "ADMIN_TOKEN").Line.Split('=')[1].Trim()

# Create .env.local
"ADMIN_TOKEN=$token" | Out-File .env.local -Encoding utf8

# Add other important vars if they exist
Get-Content .env | Select-String "SUPABASE|ADMIN_TOKEN" | Add-Content .env.local

Write-Host "Created .env.local with ADMIN_TOKEN"
```

## Important Notes

1. **`.env.local` is gitignored** - Your tokens won't be committed
2. **`.env.local` takes precedence** - Next.js reads it first
3. **Restart required** - Changes to `.env.local` need server restart
4. **Token must match** - localStorage token must match `.env.local` ADMIN_TOKEN

## Verify It Works

After setting up `.env.local` and restarting:

1. Go to `/admin/deals`
2. Enter your ADMIN_TOKEN
3. Check browser console (F12) - should see successful API calls
4. Deals should appear!

