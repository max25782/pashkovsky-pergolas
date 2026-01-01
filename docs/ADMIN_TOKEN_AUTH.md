# Admin Token Authentication

## Overview

The CRM supports two authentication methods:
1. **JWT Authentication** (modern, recommended)
2. **Admin Token** (legacy, quick access)

## How Admin Token Works

### 1. Login Flow

```
User enters admin token on /login page
  ↓
Token saved to localStorage.setItem('admin_token', token)
  ↓
Redirect to /app/admin via window.location.href
  ↓
Client-side auth check in AdminPage component
  ↓
If token exists → show CRM dashboard
If no token → redirect back to /login
```

### 2. Middleware Behavior

**Important:** Middleware **DOES NOT** check admin tokens for `/app` routes.

**Reason:** Admin tokens are stored in `localStorage`, which is **not accessible** in Next.js middleware (runs on server).

**Solution:** Client-side auth check in each CRM page component.

```typescript
// middleware.ts
if (pathname.startsWith('/app')) {
  // SKIP middleware auth check for /app routes
  // Admin token is stored in localStorage (not accessible in middleware)
  // Client-side pages will handle auth check and redirect if needed
  return NextResponse.next()
}
```

### 3. Client-Side Auth Check

Each CRM page checks for tokens on mount:

```typescript
// app/(crm)/app/admin/page.tsx
useEffect(() => {
  // 1. Check JWT token first
  const jwtToken = localStorage.getItem('token')
  if (jwtToken) {
    setToken(jwtToken)
    setIsJWT(true)
    return
  }

  // 2. Fallback to admin token
  const adminToken = localStorage.getItem('admin_token')
  if (adminToken) {
    setToken(adminToken)
    setIsJWT(false)
    return
  }

  // 3. No token → redirect to login
  window.location.href = '/login'
}, [])
```

### 4. API Authentication

API routes check **both** JWT and admin tokens:

```typescript
// lib/middleware/auth.ts
export async function requireAuth(req: NextRequest) {
  // Check JWT token
  const jwtToken = req.cookies.get('token')?.value || 
                   req.headers.get('authorization')?.replace('Bearer ', '')
  
  if (jwtToken) {
    // Verify JWT...
  }
  
  // Check admin token
  const adminToken = req.headers.get('x-admin-token')
  if (adminToken) {
    // Validate admin token...
  }
  
  // No valid token
  return new Response('Unauthorized', { status: 401 })
}
```

## Security Considerations

### Admin Token Storage

- ✅ **Stored in:** `localStorage` (client-side only)
- ✅ **Sent via:** `x-admin-token` header in API requests
- ❌ **NOT in:** cookies, URL params, or server-side storage

### Token Priority

1. **JWT token** (from `/api/auth/login`)
2. **Admin token** (legacy)

If both exist, JWT is used.

### Logout

```typescript
function logout() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  window.location.href = '/login'
}
```

## Migration Path

### From Admin Token → JWT

1. User logs in with admin token
2. System shows "Upgrade to secure login" banner
3. User creates account via `/register`
4. JWT token replaces admin token in `localStorage`

### Deprecation Plan

- **Phase 1:** Both methods supported (current)
- **Phase 2:** Admin token shows deprecation warning
- **Phase 3:** Admin token disabled, JWT only

## Troubleshooting

### Issue: "Stays on /login after entering admin token"

**Cause:** Middleware was blocking `/app` routes without JWT.

**Fix:** Middleware now skips auth check for `/app` routes (see above).

### Issue: "content-script.js error in console"

**Cause:** Browser extension trying to connect.

**Fix:** Ignore this error (not from your app).

### Issue: "Token not persisting"

**Check:**
```javascript
// In browser console
localStorage.getItem('admin_token')
// Should return your token
```

**Fix:** Clear localStorage and try again:
```javascript
localStorage.clear()
```

## Code References

- **Login page:** `app/(auth)/login/page.tsx` (lines 52-72)
- **Admin page:** `app/(crm)/app/admin/page.tsx` (lines 25-47)
- **Middleware:** `middleware.ts` (lines 96-101)
- **API auth:** `lib/middleware/auth.ts`

## Testing

### Test Admin Token Login

1. Go to http://localhost:3000/login
2. Click "🔑 Sign in with Admin Token"
3. Enter token: `pash-f99e2c3b...`
4. Press Enter or click "Continue"
5. **Expected:** Redirect to `/app/admin`
6. **Verify:** Console shows "Admin token saved: pash-f99e2..."

### Test Token Persistence

```javascript
// In browser console
localStorage.getItem('admin_token')
// Should return: "pash-f99e2c3b..."

// Navigate away and back
window.location.href = '/login'
window.location.href = '/app/admin'
// Should still be authenticated
```

### Test Logout

1. Click "Logout" in CRM
2. **Expected:** Redirect to `/login`
3. **Verify:** `localStorage.getItem('admin_token')` returns `null`

## Environment Variables

No environment variables needed for admin token auth.

Admin token validation happens in API routes using hardcoded token or database lookup.

## Summary

| Feature | JWT Auth | Admin Token |
|---------|----------|-------------|
| Storage | Cookie + localStorage | localStorage only |
| Middleware | ✅ Verified | ❌ Skipped |
| Client Check | ✅ Optional | ✅ Required |
| API Auth | ✅ Supported | ✅ Supported |
| Company ID | ✅ In token | ❌ Not available |
| Expiration | ✅ Yes | ❌ No |
| Security | 🔒 High | ⚠️ Medium |
| Recommended | ✅ Yes | ⚠️ Legacy only |

---

**Last Updated:** 2025-12-22

