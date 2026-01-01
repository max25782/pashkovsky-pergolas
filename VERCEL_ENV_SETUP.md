# Vercel Environment Variables Setup

## Required Environment Variables for Deployment

### Core Supabase (Required for both apps)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### CRM App (@pashkovsky/crm)

#### Authentication & Security
```bash
JWT_SECRET=your-jwt-secret-key-here
SUPERADMIN_TOKEN=your-superadmin-token-here
```

#### Redis (Session Management)
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

#### AI Features (Optional but recommended)
```bash
GEMINI_API_KEY=your-gemini-api-key
```

#### Email (Optional - for notifications)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com
```

#### Google OAuth (Optional - for calendar integration)
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

#### Cron Jobs (Optional)
```bash
CRON_SECRET_TOKEN=your-cron-secret-token
```

### Site App (@pashkovsky/site)

#### AWS S3 (Optional - for image storage)
```bash
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=your-bucket-name
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### WhatsApp Integration (Optional)
```bash
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret
```

#### Legacy (Optional - for backward compatibility)
```bash
ADMIN_TOKEN=your-admin-token
```

## Setup Instructions

### 1. Vercel Dashboard
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable above with the appropriate value
4. Select which environment to apply to (Production, Preview, Development)

### 2. Important Notes

- **NEXT_PUBLIC_*** variables are exposed to the browser
- **Without NEXT_PUBLIC_ prefix** variables are server-side only
- All variables listed in `turbo.json` are available during build
- Variables not in `turbo.json` won't cause warnings but won't be available during build

### 3. Minimum Required for Basic Deployment

For a basic working deployment, you MUST have:
```bash
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
SUPERADMIN_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### 4. Testing Deployment

After setting variables:
1. Trigger a new deployment
2. Check build logs for any missing variables
3. Test SuperAdmin login
4. Test AI features (if GEMINI_API_KEY is set)

### 5. Local Development

For local development, copy these variables to:
- `apps/crm/.env.local`
- `apps/site/.env.local`

**Never commit `.env.local` files to Git!**

## Troubleshooting

### Build fails with "supabaseKey is required"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set

### Build fails with AWS S3 errors
- Set all AWS variables or remove S3 integration temporarily
- API routes will return empty arrays if S3 is not configured

### Redis connection errors
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash dashboard for Redis status

### AI features not working
- Verify `GEMINI_API_KEY` is set
- Check API quotas in Google AI Studio

