# 🌍 Environment Variables Setup for Local Development

## 📋 Overview

In **production** (Vercel), all environment variables are configured in the Vercel Dashboard.  
For **local development**, you need to create a `.env.local` file manually.

---

## 🔧 Required Variables

Create a `.env.local` file in the project root with the following content:

```bash
# ===== AWS S3 Configuration (for images) =====
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1

# AWS Credentials (optional - only needed for uploading images via admin panel)
# AWS_ACCESS_KEY_ID=your_access_key_here
# AWS_SECRET_ACCESS_KEY=your_secret_key_here

# ===== Supabase Configuration =====
# Get these from your Supabase project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ===== JWT Secret =====
# Used for JWT token generation and verification
JWT_SECRET=your-jwt-secret-here

# ===== Other Optional Variables =====
# DEFAULT_COMPANY_ID=your-default-company-id
# CRM_SITE_TOKEN=your-site-token-for-public-api
```

---

## 📝 Steps to Setup

### 1. Create `.env.local` file

In the project root, create a new file called `.env.local`:

```bash
# On Windows (PowerShell)
New-Item -Path ".env.local" -ItemType File

# On macOS/Linux
touch .env.local
```

### 2. Copy the template above

Copy all the variables from the "Required Variables" section above into your `.env.local` file.

### 3. Fill in your credentials

Replace the placeholder values with your actual credentials:
- Get Supabase credentials from: https://supabase.com/dashboard
- AWS credentials are optional (only needed for admin image uploads)

### 4. Restart the dev server

```bash
npm run dev
```

---

## ✅ Verify Setup

After adding `.env.local`:

1. **Restart the dev server** (Ctrl+C → `npm run dev`)
2. Open `http://localhost:3000/app/profiles`
3. **Images should now load** from S3

---

## 🔒 Security Notes

- ✅ `.env.local` is already in `.gitignore` - never commit it!
- ✅ Use different credentials for development and production
- ✅ In production, all variables are managed via Vercel Dashboard

---

## 🚀 Production (Vercel)

All environment variables are already configured in **Vercel Dashboard** → **Settings** → **Environment Variables**.

No changes needed for production! 🎉

---

## 🆘 Troubleshooting

### Problem: Images still not loading

**Solution:**
1. Check that `.env.local` file exists in project root
2. Verify variables are spelled correctly (check for typos)
3. Restart the dev server completely
4. Clear Next.js cache: `rm -rf .next` (or `rmdir /s .next` on Windows)

### Problem: Hydration warning about S3 URLs (different regions)

**Example:** Server uses `eu-north-1`, Client uses `us-east-1`

**Solution:**
1. Check your S3 bucket's actual region in AWS Console
2. Update `NEXT_PUBLIC_AWS_S3_REGION` in `.env.local` to match
3. **IMPORTANT**: Ensure production (Vercel) uses the same region
4. Restart dev server after changing `.env.local`

### Problem: AWS upload not working

**Solution:**
1. Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to `.env.local`
2. Ensure your AWS IAM user has S3 write permissions
3. Restart the dev server

---

## 📚 Related Documentation

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [AWS S3 Setup](docs/AWS_S3_SETUP.md) (if available)

