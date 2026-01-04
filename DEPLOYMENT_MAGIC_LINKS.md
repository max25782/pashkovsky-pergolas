# Deployment Guide: Magic Links & Company Onboarding

## ✅ Yes, You Can Deploy!

The magic link system is now configured to work in both **development** and **production** environments.

## 🔧 Environment Variables Required

Make sure these environment variables are set in your **Vercel** project settings:

### Required for Production:
```bash
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
# OR
NEXT_PUBLIC_APP_URL=https://crm.pashkovsky-group.com
```

### Already Configured (from previous setup):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Other Supabase and AWS variables

## 📋 Deployment Steps

### 1. **Before Deployment (Optional)**
You can delete the test user `oryaron38@gmail.com` if you want:
- Go to Supabase Dashboard → Authentication → Users
- Delete the user (this will also delete their company if you want)
- Or keep it - it won't affect production

### 2. **Deploy to Vercel**
```bash
git add .
git commit -m "Fix magic links for production deployment"
git push
```

Vercel will automatically deploy.

### 3. **Set Environment Variables in Vercel**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add/Update:
   - `NEXT_PUBLIC_CRM_URL` = `https://crm.pashkovsky-group.com`
   - Or use `NEXT_PUBLIC_APP_URL` if that's your convention

### 4. **After Deployment - Create New Company**
Once deployed, you can create a new company using the SuperAdmin panel:

1. **Login as SuperAdmin** at: `https://crm.pashkovsky-group.com/superadmin/companies`
2. **Enter the email** (e.g., `newuser@example.com`)
3. **Check "Send invite email"** if you want to email the magic link
4. **Click "Create company + give full access"**

The magic link will automatically use the **production URL** (`https://crm.pashkovsky-group.com/app/admin`) instead of localhost!

## 🔍 How It Works

The magic link redirect URL is determined by:
1. `NEXT_PUBLIC_CRM_URL` (preferred)
2. `NEXT_PUBLIC_APP_URL` (fallback)
3. `http://localhost:3001` (development fallback)

**In Production:**
- Magic links will redirect to: `https://crm.pashkovsky-group.com/app/admin`
- Users can click the link and log in automatically

**In Development:**
- Magic links will redirect to: `http://localhost:3001/app/admin`
- Works perfectly for local testing

## ✅ Verification

After deployment, test the magic link:
1. Create a new company via SuperAdmin panel
2. Check the magic link URL in the response (or email)
3. Verify it points to `https://crm.pashkovsky-group.com/app/admin` (not localhost)
4. Click the link - it should log in and redirect correctly

## 🎯 Summary

- ✅ **Safe to deploy** - no hardcoded localhost in production
- ✅ **Delete test user** - optional, won't affect deployment
- ✅ **Create new users** - after deployment, magic links will use production URL
- ✅ **Environment-aware** - automatically uses correct URL based on environment

