# Fix Fabric.js Import Error

## Problem
```
Module not found: Can't resolve 'fabric'
```

## Solution

### Step 1: Verify Installation
```bash
npm list fabric
```

If not installed:
```bash
npm install fabric@^4.6.0 --save
```

### Step 2: Clear Next.js Cache
```bash
# Delete .next folder
rm -rf .next
# Or on Windows PowerShell:
Remove-Item -Recurse -Force .next
```

### Step 3: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Why This Happens

The error occurs because:
1. Fabric.js wasn't installed when the component was first created
2. Next.js cached the old import
3. Dev server needs restart after installing new packages

## Verification

After restarting, check:
1. No error in terminal
2. No error in browser console
3. Sketch modal loads (shows "Загрузка редактора..." then canvas)

## If Still Not Working

1. **Check node_modules:**
   ```bash
   ls node_modules/fabric
   # Or Windows:
   dir node_modules\fabric
   ```

2. **Reinstall:**
   ```bash
   npm uninstall fabric
   npm install fabric@^4.6.0 --save
   ```

3. **Clear all caches:**
   ```bash
   rm -rf .next node_modules/.cache
   npm install
   npm run dev
   ```

## Current Implementation

The component uses **dynamic imports** which is correct:
```typescript
// This is correct - loads only on client side
import('fabric').then((fabricModule) => {
  fabricRef.current = fabricModule.fabric
})
```

No static `import { fabric } from 'fabric'` exists in the file.

