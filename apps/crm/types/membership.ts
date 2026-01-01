/**
 * Company Membership Types
 */

export interface CompanyMember {
  id: string
  user_id: string
  company_id: string
  role: 'owner' | 'admin' | 'member'
  permissions?: {
    all?: boolean
    leads?: boolean
    deals?: boolean
    offers?: boolean
    workers?: boolean
    settings?: boolean
  }
  created_at?: string
  updated_at?: string
}

export interface PlatformAdmin {
  id: string
  user_id: string
  email: string
  phone?: string
  role: 'superadmin' | 'admin' | 'support'
  is_active: boolean
  created_at?: string
}

