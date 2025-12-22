# Runtime Assertions - Usage Examples

## Overview

Runtime assertions provide an additional layer of security by throwing exceptions if security conditions are violated at runtime.

## Basic Usage

### 1. Import Assertions

```typescript
import { 
  assertCompanyOwnership,
  assertSameCompany,
  assertCompanyIdExists,
  SecurityViolationError 
} from '@/lib/auth/runtime-assertions'
```

### 2. Use in API Routes

#### Example 1: GET by ID with Ownership Check

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { assertCompanyOwnership } from '@/lib/auth/runtime-assertions'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authenticate
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // Step 2: Fetch resource
  const offer = await supabase
    .from('offers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!offer.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Step 3: Runtime assertion - throws if company mismatch
  try {
    assertCompanyOwnership(
      offer.data.company_id,
      auth.user.companyId,
      'offer'
    )
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    throw error
  }

  // Step 4: Return data (safe now)
  return NextResponse.json(offer.data)
}
```

#### Example 2: DELETE with Ownership Verification

```typescript
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  try {
    // Fetch to verify ownership
    const { data: worker } = await supabase
      .from('workers')
      .select('company_id')
      .eq('id', params.id)
      .single()

    if (!worker) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Runtime assertion
    assertCompanyOwnership(worker.company_id, auth.user.companyId, 'worker')

    // Safe to delete
    await supabase.from('workers').delete().eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    throw error
  }
}
```

#### Example 3: POST with Payload Validation

```typescript
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  const body = await req.json()

  try {
    // Assert company_id exists
    assertCompanyIdExists(auth.user.companyId, 'create worker')

    // If payload includes company_id, ensure it matches
    if (body.company_id) {
      assertSameCompany(body.company_id, auth.user.companyId)
    }

    // Safe to create
    const { data } = await supabase
      .from('workers')
      .insert({
        ...body,
        company_id: auth.user.companyId, // Force correct company
      })
      .select()
      .single()

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    throw error
  }
}
```

#### Example 4: Batch Operations

```typescript
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  const { data: workers } = await supabase
    .from('workers')
    .select('*')
    .eq('company_id', auth.user.companyId)

  try {
    // Verify all records belong to user's company
    assertAllBelongToCompany(workers, auth.user.companyId, 'workers')

    return NextResponse.json({ workers })
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      // This should never happen if query is correct, but good to check
      console.error('[CRITICAL] Query returned foreign records!', error)
      return NextResponse.json(
        { error: 'Data integrity violation' },
        { status: 500 }
      )
    }
    throw error
  }
}
```

## Advanced Usage

### Wrapper for Cleaner Code

```typescript
import { withSecurityErrorHandling } from '@/lib/auth/runtime-assertions'

export const GET = withSecurityErrorHandling(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  const { data: offer } = await supabase
    .from('offers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!offer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Will automatically catch and convert SecurityViolationError
  assertCompanyOwnership(offer.company_id, auth.user.companyId, 'offer')

  return NextResponse.json(offer)
})
```

## When to Use

### ✅ USE Runtime Assertions When:

1. **Fetching by ID** - Always verify ownership
2. **Before UPDATE/DELETE** - Ensure resource belongs to company
3. **Validating payloads** - Check company_id in request body
4. **Batch operations** - Verify all records belong to company
5. **Critical operations** - Extra safety for sensitive actions

### ❌ DON'T USE When:

1. **Already filtered by company_id** - Not needed if query has `.eq('company_id', ...)`
2. **Creating new records** - Just assign company_id
3. **Public endpoints** - No company context

## Logging

Runtime assertions automatically log security violations:

```
[Security Check abc123] Verifying offer ownership {
  resourceCompanyId: '12345678',
  expectedCompanyId: '87654321'
}
[Security Violation abc123] Company mismatch! {
  resourceCompanyId: '12345678',
  expectedCompanyId: '87654321',
  resourceType: 'offer'
}
[🚨 Security Event] {
  "timestamp": "2025-12-22T...",
  "event": "access_denied",
  "message": "Forbidden: Access denied to this offer",
  "reason": "company_mismatch",
  "resourceType": "offer"
}
```

## Testing

Test that assertions work correctly:

```typescript
import { assertCompanyOwnership, SecurityViolationError } from '@/lib/auth/runtime-assertions'

describe('Runtime Assertions', () => {
  test('throws on company mismatch', () => {
    expect(() => {
      assertCompanyOwnership('company-a', 'company-b', 'resource')
    }).toThrow(SecurityViolationError)
  })

  test('does not throw on match', () => {
    expect(() => {
      assertCompanyOwnership('company-a', 'company-a', 'resource')
    }).not.toThrow()
  })
})
```

## Best Practices

1. **Always catch SecurityViolationError**
   ```typescript
   try {
     assertCompanyOwnership(...)
   } catch (error) {
     if (error instanceof SecurityViolationError) {
       return NextResponse.json({ error: error.message }, { status: error.statusCode })
     }
     throw error
   }
   ```

2. **Use descriptive resource types**
   ```typescript
   // ✅ Good
   assertCompanyOwnership(id, cid, 'offer')
   
   // ❌ Bad
   assertCompanyOwnership(id, cid, 'resource')
   ```

3. **Check after fetching, before operations**
   ```typescript
   const resource = await fetchResource(id)
   assertCompanyOwnership(resource.company_id, auth.user.companyId)
   await updateResource(id, data)
   ```

4. **Combine with security layer functions**
   ```typescript
   const auth = await requireAuth(req) // ← Authentication
   assertCompanyOwnership(...) // ← Authorization
   ```

## Integration with Existing Code

### Before (without assertions):

```typescript
export async function DELETE(req: NextRequest, { params }) {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // ⚠️ VULNERABLE: No ownership check!
  await supabase.from('offers').delete().eq('id', params.id)
  
  return NextResponse.json({ success: true })
}
```

### After (with assertions):

```typescript
export async function DELETE(req: NextRequest, { params }) {
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  try {
    // Fetch to check ownership
    const { data: offer } = await supabase
      .from('offers')
      .select('company_id')
      .eq('id', params.id)
      .single()

    if (!offer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ✅ SECURE: Runtime assertion
    assertCompanyOwnership(offer.company_id, auth.user.companyId, 'offer')

    // Safe to delete
    await supabase.from('offers').delete().eq('id', params.id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
```

---

**Remember:** Runtime assertions are a **defense-in-depth** measure. They catch bugs and attacks that slip through other layers!

