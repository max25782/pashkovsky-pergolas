/**
 * Platform Admin Utilities
 * Check if user is SuperAdmin for platform-wide operations
 */

import { createClient } from '@/lib/supabase/server'

export interface PlatformAdmin {
  id: string
  user_id: string
  email?: string | null
  role: 'SUPERADMIN' | 'SUPPORT'
  phone?: string | null
  permissions: {
    manage_all_companies?: boolean
    view_analytics?: boolean
    manage_plans?: boolean
    manage_billing?: boolean
    view_all_data?: boolean
    manage_users?: boolean
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Check if current user is a platform admin
 */
export async function isPlatformAdmin(user_id?: string): Promise<boolean> {
  const supabase = createClient()
  
  let userId = user_id
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    userId = user.id
  }

  const { data, error } = await supabase
    .from('platform_admins')
    .select('is_active, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return false
  return true
}

/**
 * Check if current user is SUPERADMIN
 */
export async function isSuperAdmin(user_id?: string): Promise<boolean> {
  const supabase = createClient()
  
  let userId = user_id
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    userId = user.id
  }

  const { data, error } = await supabase
    .from('platform_admins')
    .select('role, is_active')
    .eq('user_id', userId)
    .eq('role', 'SUPERADMIN')
    .eq('is_active', true)
    .single()

  if (error || !data) return false
  return true
}

/**
 * Get platform admin details
 */
export async function getPlatformAdmin(user_id?: string): Promise<PlatformAdmin | null> {
  const supabase = createClient()
  
  let userId = user_id
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    userId = user.id
  }

  const { data, error } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as PlatformAdmin
}

/**
 * Check if user has specific platform permission
 */
export async function hasPlatformPermission(
  permission: keyof PlatformAdmin['permissions'],
  user_id?: string
): Promise<boolean> {
  const admin = await getPlatformAdmin(user_id)
  if (!admin) return false
  
  return admin.permissions[permission] === true
}

/**
 * Verify SuperAdmin token from environment
 * For SuperAdmin API routes
 */
export function verifySuperAdminToken(token: string): boolean {
  const validToken = process.env.SUPERADMIN_TOKEN
  if (!validToken) {
    console.error('[SuperAdmin] SUPERADMIN_TOKEN not set in environment')
    return false
  }
  
  return token === validToken
}

/**
 * Get all platform admins (SuperAdmin only)
 */
export async function getAllPlatformAdmins(): Promise<PlatformAdmin[]> {
  const supabase = createClient()
  
  // Check if current user is SuperAdmin
  const isSuper = await isSuperAdmin()
  if (!isSuper) {
    throw new Error('Unauthorized: SuperAdmin only')
  }

  const { data, error } = await supabase
    .from('platform_admins')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch platform admins: ${error.message}`)
  }

  return data as PlatformAdmin[]
}

