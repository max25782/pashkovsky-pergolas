import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserContext } from './company-context'
import type { UserRole } from '@/types/roles'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * Get user's role in their company
 */
export async function getUserRole(
  userId: string,
  companyId: string
): Promise<UserRole | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .single()

  if (error || !data) return null
  return data.role as UserRole
}

/**
 * Check if user has specific permission
 */
export async function checkPermission(
  userId: string,
  companyId: string,
  resource: string,
  action: string
): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase
    .rpc('has_permission', {
      p_user_id: userId,
      p_company_id: companyId,
      p_resource: resource,
      p_action: action
    })

  if (error) {
    console.error('Permission check error:', error)
    return false
  }

  return data === true
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(
  resource: string,
  action: string
) {
  return async function(req: NextRequest): Promise<{ authorized: boolean; error?: NextResponse }> {
    const userContext = getUserContext(req)
    
    if (!userContext) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Unauthorized: No user context' },
          { status: 401 }
        )
      }
    }

    const { userId, companyId } = userContext

    const hasPermission = await checkPermission(userId, companyId, resource, action)

    if (!hasPermission) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: `Forbidden: Missing ${resource}:${action} permission` },
          { status: 403 }
        )
      }
    }

    return { authorized: true }
  }
}

/**
 * Middleware: Require admin role
 */
export async function requireAdmin(req: NextRequest): Promise<{ authorized: boolean; error?: NextResponse }> {
  const userContext = getUserContext(req)
  
  if (!userContext) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Unauthorized: No user context' },
        { status: 401 }
      )
    }
  }

  const role = await getUserRole(userContext.userId, userContext.companyId)

  if (role !== 'admin') {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }
  }

  return { authorized: true }
}

/**
 * Get user's full company member details including role
 */
export async function getCompanyMember(userId: string, companyId: string) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('company_members')
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .single()

  if (error || !data) return null
  return data
}

