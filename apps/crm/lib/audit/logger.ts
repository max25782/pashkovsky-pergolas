/**
 * Audit Logger
 * Log user actions for security and compliance
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { getUserContextAsync } from '@/lib/middleware/company-context'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface AuditLogEntry {
  action: string
  resourceType?: string
  resourceId?: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  status?: 'success' | 'error' | 'denied'
  errorMessage?: string
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  req: NextRequest,
  entry: AuditLogEntry
): Promise<void> {
  if (!supabase) {
    console.warn('[Audit] Supabase not configured, skipping audit log')
    return
  }

  try {
    const userContext = await getUserContextAsync(req)
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const method = req.method
    const path = new URL(req.url).pathname

    await supabase
      .from('audit_logs')
      .insert({
        company_id: userContext?.companyId || null,
        user_id: userContext?.userId || null,
        action: entry.action,
        resource_type: entry.resourceType || null,
        resource_id: entry.resourceId || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        method,
        path,
        changes: entry.changes || {},
        metadata: entry.metadata || {},
        status: entry.status || 'success',
        error_message: entry.errorMessage || null,
      })
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[Audit] Failed to log event:', error)
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  req: NextRequest,
  action: 'login' | 'logout' | 'register' | 'password_reset' | 'email_verify',
  status: 'success' | 'error' = 'success',
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent(req, {
    action,
    resourceType: 'auth',
    status,
    errorMessage,
    metadata,
  })
}

/**
 * Log resource operations
 */
export async function logResourceEvent(
  req: NextRequest,
  action: 'create' | 'update' | 'delete' | 'view',
  resourceType: string,
  resourceId?: string,
  changes?: Record<string, any>,
  status: 'success' | 'error' | 'denied' = 'success',
  errorMessage?: string
): Promise<void> {
  await logAuditEvent(req, {
    action: `${action}_${resourceType}`,
    resourceType,
    resourceId,
    changes,
    status,
    errorMessage,
  })
}

/**
 * Helper to log deal operations
 */
export async function logDealEvent(
  req: NextRequest,
  action: 'create' | 'update' | 'delete' | 'view',
  dealId?: string,
  changes?: Record<string, any>,
  status: 'success' | 'error' | 'denied' = 'success'
): Promise<void> {
  await logResourceEvent(req, action, 'deal', dealId, changes, status)
}

/**
 * Helper to log lead operations
 */
export async function logLeadEvent(
  req: NextRequest,
  action: 'create' | 'update' | 'delete' | 'view',
  leadId?: string,
  changes?: Record<string, any>,
  status: 'success' | 'error' | 'denied' = 'success'
): Promise<void> {
  await logResourceEvent(req, action, 'lead', leadId, changes, status)
}



