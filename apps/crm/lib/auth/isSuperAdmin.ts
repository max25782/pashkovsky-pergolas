/**
 * SuperAdmin guard - server-side utility
 * Checks if a user is a platform admin
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

/**
 * Check if user is a SuperAdmin by user ID
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!supabaseAdmin || !userId) return false

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    return !error && !!data
  } catch {
    return false
  }
}

