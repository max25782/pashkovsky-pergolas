/**
 * Company Context Middleware
 * Phase 1: Extract company_id from admin token
 * Phase 2: Extract company_id from user JWT token
 */

import { NextRequest } from 'next/server'

const PASHKOVSKY_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Get company ID from request
 * Phase 1: From admin token (temporary)
 * Phase 2: From JWT token (future)
 */
export function getCompanyId(req: NextRequest): string | null {
  // Phase 1: из admin token (временно)
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expectedToken = process.env.ADMIN_TOKEN
  
  if (token && expectedToken && token === expectedToken) {
    // Admin token - return Pashkovsky company ID
    return PASHKOVSKY_COMPANY_ID
  }
  
  // Phase 2: из JWT токена пользователя (будет реализовано позже)
  // const user = await getUserFromToken(req)
  // return user?.company_id
  
  return null
}

/**
 * Get company ID asynchronously (for future JWT validation)
 * Currently just returns the sync version
 */
export async function getCompanyIdAsync(req: NextRequest): Promise<string | null> {
  return getCompanyId(req)
}

/**
 * Middleware to ensure company_id is present
 */
export function requireCompanyId(req: NextRequest): string {
  const companyId = getCompanyId(req)
  
  if (!companyId) {
    throw new Error('Unauthorized: No company context')
  }
  
  return companyId
}

