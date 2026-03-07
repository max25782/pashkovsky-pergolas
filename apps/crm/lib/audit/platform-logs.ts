/**
 * Platform Audit Logs Helper
 * Functions to log platform-level events
 */

import { createClient } from '@supabase/supabase-js'

export type PlatformEventType =
  | 'company_created'
  | 'company_deleted'
  | 'plan_changed'
  | 'payment_confirmed'
  | 'admin_added'
  | 'admin_deactivated'
  | 'settings_updated'
  | 'user_invited'
  | 'subscription_canceled'
  | 'integration_setup_requested'
  | 'integration_activated'
  | 'integration_suspended'
  | 'integration_secret_rotated'

interface LogEventParams {
  event_type: PlatformEventType
  payload: Record<string, any>
  company_id?: string
  actor_admin_id?: string
  actor_user_id?: string
}

export async function logPlatformEvent(params: LogEventParams): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { error } = await supabase
      .from('platform_audit_logs')
      .insert({
        event_type: params.event_type,
        payload: params.payload,
        company_id: params.company_id || null,
        actor_admin_id: params.actor_admin_id || null,
        actor_user_id: params.actor_user_id || null,
      })

    if (error) {
      console.error('[Audit Log] Failed to log event:', error)
    } else {
    }
  } catch (error) {
    console.error('[Audit Log] Exception:', error)
  }
}

export async function getRecentActivity(limit: number = 10) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('platform_audit_logs')
      .select(`
        id,
        event_type,
        payload,
        created_at,
        company_id,
        companies(name),
        platform_admins(email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Get Recent Activity] Error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[Get Recent Activity] Exception:', error)
    return []
  }
}

