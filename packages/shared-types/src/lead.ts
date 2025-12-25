/**
 * Shared types for API communication between Site and CRM
 */

export interface PublicLeadPayload {
  name: string
  phone: string
  email?: string
  message?: string
  source?: string
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  metadata?: Record<string, any> | null
}

export interface PublicLeadResponse {
  success: boolean
  id: string
}

