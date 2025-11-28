# Fix 401 Unauthorized Error

## Problem
The admin token in localStorage doesn't match `ADMIN_TOKEN` in your `.env.local` file.

## Solution

### Step 1: Check your ADMIN_TOKEN in .env.local

Look for this line in `.env.local`:
```env
ADMIN_TOKEN=your-token-here
```

### Step 2: Check what's in localStorage

In browser console, run:
```javascript
localStorage.getItem('admin_token')
```

### Step 3: Make them match

**Option A: Update localStorage to match .env.local**
```javascript
// Replace 'YOUR_TOKEN_FROM_ENV' with the actual token from .env.local
localStorage.setItem('admin_token', 'YOUR_TOKEN_FROM_ENV')
```

**Option B: Update .env.local to match localStorage**
1. Get token from localStorage (Step 2)
2. Update `.env.local`:
   ```env
   ADMIN_TOKEN=token-from-localStorage
   ```
3. Restart dev server: `npm run dev`

### Step 4: Test again

```javascript
fetch('/admin-api/deals', {
  headers: { 'x-admin-token': localStorage.getItem('admin_token') }
})
  .then(r => r.text())
  .then(console.log)
```

Should return JSON with deals, not "Unauthorized".

## Quick Fix Script

Run this in browser console after updating localStorage:

```javascript
// Set your admin token (replace with actual token from .env.local)
const adminToken = 'YOUR_ADMIN_TOKEN_HERE';
localStorage.setItem('admin_token', adminToken);

// Test
fetch('/admin-api/deals', {
  headers: { 'x-admin-token': adminToken }
})
  .then(r => r.json())
  .then(data => {
    console.log('Success!', data);
    // Reload page to see deals
    window.location.reload();
  })
  .catch(err => console.error('Error:', err));
```

