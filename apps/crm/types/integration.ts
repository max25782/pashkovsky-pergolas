/**
 * Website Integration Types
 * One-time paid service for connecting company websites to CRM
 */

export type IntegrationType = 'webhook' | 'wordpress'
export type IntegrationStatus = 'not_connected' | 'pending_payment' | 'active' | 'suspended'
export type IntegrationEventType = 'lead_received' | 'test_ping' | 'setup_requested' | 'activated' | 'suspended'
export type PaymentMethodType = 'bit' | 'paybox' | 'bank' | 'paypal'
export type IntegrationPackageType = 'basic' | 'advanced' | 'custom'

export interface CompanyIntegration {
  id: string
  company_id: string
  type: IntegrationType
  status: IntegrationStatus
  website_url?: string
  webhook_secret: string
  last_event_at?: string
  created_at: string
  updated_at: string
}

export interface IntegrationEvent {
  id: string
  company_id: string
  integration_id?: string
  event_type: IntegrationEventType
  payload: Record<string, any>
  created_at: string
}

export interface RequestSetupDTO {
  website_url: string
  form_plugin?: string
  notes?: string
  payment_method: PaymentMethodType
}

export interface PaymentInstructions {
  bit_phone?: string
  paybox_link?: string
  /** PayPal.me link, hosted button URL, or checkout URL */
  paypal_link?: string
  bank_details?: {
    bank_name: string
    account_number: string
    branch: string
  }
  payment_note_template: string
}

export interface WebhookLeadPayload {
  name: string
  phone: string
  email?: string
  message?: string
  source_url?: string
  utm?: Record<string, string>
  extra?: Record<string, any>
}




