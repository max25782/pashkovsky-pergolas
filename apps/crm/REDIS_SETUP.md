# 🔐 Redis Setup for SuperAdmin Sessions

## Why Redis?

✅ **Security:** Tokens never leave the server
✅ **httpOnly cookies:** Protected from XSS attacks  
✅ **Fast:** In-memory session storage
✅ **TTL:** Automatic session expiration

---

## 🚀 Quick Setup (Upstash - FREE)

### 1. Create Free Redis Database

1. Go to: **https://console.upstash.com/**
2. Sign up (GitHub or Email)
3. Click **"Create Database"**
4. Choose:
   - **Name:** `pashkovsky-crm-sessions`
   - **Region:** Closest to you (e.g., `eu-west-1`)
   - **Type:** `Regional` (FREE)
5. Click **"Create"**

### 2. Get Redis Credentials

After creation, you'll see:
- **UPSTASH_REDIS_REST_URL** (looks like: `https://us1-xxx.upstash.io`)
- **UPSTASH_REDIS_REST_TOKEN** (long string)

### 3. Add to `.env.local`

Add these to `apps/crm/.env.local`:

```bash
# Redis for SuperAdmin Sessions
UPSTASH_REDIS_REST_URL=https://your-region.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

### 4. Install Dependencies

```bash
cd apps/crm
npm install @upstash/redis
```

---

## 🧪 Test Redis Connection

Create `apps/crm/scripts/test-redis.ts`:

```typescript
import { redis } from '@/lib/session/redis-client'

async function testRedis() {
  try {
    // Test write
    await redis.set('test:key', 'Hello Redis!')
    console.log('✓ Write successful')
    
    // Test read
    const value = await redis.get('test:key')
    console.log('✓ Read successful:', value)
    
    // Test delete
    await redis.del('test:key')
    console.log('✓ Delete successful')
    
    console.log('\n✅ Redis is working!')
  } catch (error) {
    console.error('❌ Redis error:', error)
  }
}

testRedis()
```

Run:
```bash
npx ts-node scripts/test-redis.ts
```

---

## 📊 Monitor Sessions (Upstash Console)

1. Go to: https://console.upstash.com/
2. Click your database
3. Click **"Data Browser"**
4. See all active sessions: `superadmin:session:*`

---

## 🔒 How It Works

### 1. **Login Flow:**
```
User → API (/api/auth/superadmin-login)
  ↓
  API validates phone + token
  ↓
  API creates session in Redis
  ↓
  API returns httpOnly cookie (session ID)
  ↓
  Browser stores cookie (NOT accessible to JavaScript!)
```

### 2. **Protected Route:**
```
User → SuperAdmin Page
  ↓
  Layout calls /api/auth/superadmin-session
  ↓
  API reads cookie → Validates in Redis
  ↓
  Returns: authenticated = true/false
  ↓
  Page renders OR redirects to /login
```

### 3. **Logout Flow:**
```
User → Logout Button
  ↓
  API (/api/auth/superadmin-logout)
  ↓
  API deletes session from Redis
  ↓
  API clears cookie
  ↓
  Redirect to /login
```

---

## 🛡️ Security Benefits

| Method | localStorage | httpOnly Cookie + Redis |
|--------|--------------|-------------------------|
| **XSS Protection** | ❌ Vulnerable | ✅ Protected |
| **CSRF Protection** | ⚠️ Manual | ✅ SameSite=Strict |
| **Token Exposure** | ❌ Client-side | ✅ Server-side only |
| **Session Revocation** | ❌ Impossible | ✅ Delete from Redis |
| **Automatic Expiration** | ❌ Manual | ✅ Redis TTL |

---

## 🔧 Alternative: PostgreSQL Sessions (No Redis)

If you don't want Redis, you can use PostgreSQL:

### Create table:
```sql
CREATE TABLE superadmin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_expires ON superadmin_sessions(expires_at);
```

### Update `redis-client.ts`:
Replace Redis calls with PostgreSQL queries using Supabase client.

---

## 📝 Summary

1. ✅ Create Upstash Redis (FREE)
2. ✅ Add credentials to `.env.local`
3. ✅ Install `@upstash/redis`
4. ✅ Restart CRM server
5. ✅ Test login with phone + token
6. ✅ Cookie is set automatically (httpOnly)
7. ✅ Sessions stored in Redis (secure)

**No tokens in localStorage! No XSS vulnerability!** 🎉

