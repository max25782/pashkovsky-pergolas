/**
 * Platform Settings Types
 */

export interface PlatformSettings {
  id: string
  
  // System
  maintenance_mode: boolean
  maintenance_message: {
    en: string
    he: string
    ru: string
  }
  
  // Subscription
  default_plan: string
  trial_days: number
  
  // Payments
  manual_payments_enabled: boolean
  manual_payment_methods: string[]
  
  // AI
  ai_enabled: boolean
  ai_daily_limit: number
  
  // Billing
  vat_percent: number
  
  // Feature Flags
  feature_flags: Record<string, boolean>
  
  // Audit
  updated_at: string
  updated_by: string | null
}

export interface PlatformSettingsUpdate {
  maintenance_mode?: boolean
  maintenance_message?: {
    en?: string
    he?: string
    ru?: string
  }
  default_plan?: string
  trial_days?: number
  manual_payments_enabled?: boolean
  manual_payment_methods?: string[]
  ai_enabled?: boolean
  ai_daily_limit?: number
  vat_percent?: number
  feature_flags?: Record<string, boolean>
}

