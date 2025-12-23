/**
 * Runtime Security Assertions
 * 
 * These functions throw errors if security conditions are violated.
 * Use them in API routes to enforce multi-tenant isolation at runtime.
 * 
 * Usage:
 * ```typescript
 * import { assertCompanyOwnership, assertSameCompany } from '@/lib/auth/runtime-assertions'
 * 
 * // After fetching a resource
 * assertCompanyOwnership(resource.company_id, auth.user.companyId, 'offer')
 * 
 * // Before creating a resource
 * assertSameCompany(requestBody.company_id, auth.user.companyId)
 * ```
 */

import { NextResponse } from 'next/server'

export class SecurityViolationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'SecurityViolationError'
  }
}

/**
 * Assert that a resource belongs to the expected company
 * Throws 403 if company_id doesn't match
 * 
 * @param resourceCompanyId - The company_id from the database record
 * @param expectedCompanyId - The company_id of the authenticated user
 * @param resourceType - The type of resource (for error messages)
 * 
 * @throws {SecurityViolationError} If company_ids don't match
 */
export function assertCompanyOwnership(
  resourceCompanyId: string | null | undefined,
  expectedCompanyId: string | null | undefined,
  resourceType: string = 'resource'
): void {
  // Log the check
  const checkId = Math.random().toString(36).substring(7)
  console.log(`[Security Check ${checkId}] Verifying ${resourceType} ownership`, {
    resourceCompanyId: resourceCompanyId?.substring(0, 8),
    expectedCompanyId: expectedCompanyId?.substring(0, 8),
  })

  // Check 1: Resource must have company_id
  if (!resourceCompanyId) {
    console.error(`[Security Violation ${checkId}] ${resourceType} has no company_id!`, {
      expectedCompanyId: expectedCompanyId?.substring(0, 8),
    })
    throw new SecurityViolationError(
      `Forbidden: ${resourceType} has no company ownership`,
      403,
      { reason: 'missing_company_id', resourceType }
    )
  }

  // Check 2: User must have company_id
  if (!expectedCompanyId) {
    console.error(`[Security Violation ${checkId}] User has no company context!`)
    throw new SecurityViolationError(
      'Unauthorized: No company context',
      401,
      { reason: 'missing_user_company' }
    )
  }

  // Check 3: Company IDs must match
  if (resourceCompanyId !== expectedCompanyId) {
    console.error(`[Security Violation ${checkId}] Company mismatch!`, {
      resourceCompanyId: resourceCompanyId.substring(0, 8),
      expectedCompanyId: expectedCompanyId.substring(0, 8),
      resourceType,
    })
    throw new SecurityViolationError(
      `Forbidden: Access denied to this ${resourceType}`,
      403,
      {
        reason: 'company_mismatch',
        resourceType,
        resourceCompanyId: resourceCompanyId.substring(0, 8),
        userCompanyId: expectedCompanyId.substring(0, 8),
      }
    )
  }

  console.log(`[Security Check ${checkId}] ✅ Ownership verified`)
}

/**
 * Assert that two company IDs are the same
 * Useful for validating request payloads
 * 
 * @throws {SecurityViolationError} If company_ids don't match
 */
export function assertSameCompany(
  companyId1: string | null | undefined,
  companyId2: string | null | undefined
): void {
  if (companyId1 !== companyId2) {
    console.error('[Security Violation] Company ID mismatch in request', {
      provided: companyId1?.substring(0, 8),
      expected: companyId2?.substring(0, 8),
    })
    throw new SecurityViolationError(
      'Forbidden: Company ID mismatch',
      403,
      { reason: 'payload_company_mismatch' }
    )
  }
}

/**
 * Assert that a company ID is not null/undefined
 * 
 * @throws {SecurityViolationError} If company_id is missing
 */
export function assertCompanyIdExists(
  companyId: string | null | undefined,
  context: string = 'operation'
): asserts companyId is string {
  if (!companyId) {
    console.error(`[Security Violation] Missing company_id for ${context}`)
    throw new SecurityViolationError(
      `Unauthorized: No company context for ${context}`,
      401,
      { reason: 'missing_company_id', context }
    )
  }
}

/**
 * Assert that all records in an array belong to the expected company
 * 
 * @throws {SecurityViolationError} If any record doesn't belong to the company
 */
export function assertAllBelongToCompany<T extends { company_id?: string | null }>(
  records: T[],
  expectedCompanyId: string,
  resourceType: string = 'records'
): void {
  const foreignRecords = records.filter(
    record => record.company_id && record.company_id !== expectedCompanyId
  )

  if (foreignRecords.length > 0) {
    console.error('[Security Violation] Found records from other companies', {
      count: foreignRecords.length,
      expectedCompanyId: expectedCompanyId.substring(0, 8),
    })
    throw new SecurityViolationError(
      `Forbidden: Some ${resourceType} belong to other companies`,
      403,
      {
        reason: 'foreign_records',
        count: foreignRecords.length,
      }
    )
  }
}

/**
 * Wrap a handler with security error handling
 * Converts SecurityViolationError to proper HTTP responses
 * 
 * @example
 * export const GET = withSecurityErrorHandling(async (req) => {
 *   const resource = await getResource(id)
 *   assertCompanyOwnership(resource.company_id, auth.user.companyId, 'resource')
 *   return NextResponse.json(resource)
 * })
 */
export function withSecurityErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        console.error('[Security] Violation caught:', error.message, error.details)
        return NextResponse.json(
          {
            error: error.message,
            code: 'SECURITY_VIOLATION',
            details: error.details,
          },
          { status: error.statusCode }
        )
      }
      throw error // Re-throw non-security errors
    }
  }) as T
}

/**
 * Create an audit log entry for security events
 * This should be saved to a secure audit log table
 */
export function logSecurityEvent(
  event: 'access_denied' | 'unauthorized' | 'company_mismatch' | 'suspicious_activity',
  details: {
    userId?: string
    companyId?: string
    resourceType?: string
    resourceId?: string
    attemptedAction?: string
    ip?: string
    userAgent?: string
    [key: string]: any
  }
): void {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    event,
    ...details,
  }

  // Log to console (in production, send to secure logging service)
  console.warn('[🚨 Security Event]', JSON.stringify(logEntry))

  // TODO: In production, save to audit_logs table
  // await supabase.from('audit_logs').insert({
  //   event_type: event,
  //   user_id: details.userId,
  //   company_id: details.companyId,
  //   details: logEntry,
  //   created_at: timestamp,
  // })
}

/**
 * Middleware-style assertion wrapper
 * Use this to wrap entire route handlers
 * 
 * @example
 * export async function GET(req: NextRequest) {
 *   return withSecurityAssertions(req, async (auth) => {
 *     const resource = await getResource(id)
 *     assertCompanyOwnership(resource.company_id, auth.user.companyId)
 *     return NextResponse.json(resource)
 *   })
 * }
 */
export async function withSecurityAssertions<T>(
  req: Request,
  handler: (auth: { user: { userId: string; companyId: string } }) => Promise<T>
): Promise<T | NextResponse> {
  try {
    // This would integrate with your requireAuth function
    // For now, it's a placeholder
    const mockAuth = {
      user: {
        userId: 'user-id',
        companyId: 'company-id',
      },
    }
    
    return await handler(mockAuth)
  } catch (error) {
    if (error instanceof SecurityViolationError) {
      logSecurityEvent(
        error.statusCode === 401 ? 'unauthorized' : 'access_denied',
        {
          message: error.message,
          ...error.details,
        }
      )
      
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      ) as any
    }
    throw error
  }
}
