/**
 * Client-side utility for submitting leads to CRM
 * 
 * Usage on public site:
 * 
 * import { submitLead } from '@/lib/api/submit-lead'
 * 
 * const result = await submitLead({
 *   name: 'John Doe',
 *   phone: '+972501234567',
 *   email: 'john@example.com',
 *   message: 'Interested in pergola',
 *   source: 'contact-form'
 * })
 */

import { useState } from 'react'

export interface LeadSubmissionData {
  name: string
  phone: string
  email?: string
  message?: string
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  metadata?: Record<string, any>
}

export interface LeadSubmissionResult {
  success: boolean
  id?: string
  error?: string
  retryAfter?: number
}

/**
 * Submit a lead to the CRM
 */
export async function submitLead(
  data: LeadSubmissionData
): Promise<LeadSubmissionResult> {
  try {
    // Get CRM URL from environment
    const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || 'https://app.alumincrm.com'
    const siteToken = process.env.NEXT_PUBLIC_SITE_TOKEN

    if (!siteToken) {
      console.error('[Lead Submission] NEXT_PUBLIC_SITE_TOKEN not configured')
      return {
        success: false,
        error: 'Configuration error',
      }
    }

    // Add UTM parameters from URL if not provided
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      data.utm_source = data.utm_source || urlParams.get('utm_source') || undefined
      data.utm_medium = data.utm_medium || urlParams.get('utm_medium') || undefined
      data.utm_campaign = data.utm_campaign || urlParams.get('utm_campaign') || undefined
    }

    // Submit to CRM
    const response = await fetch(`${crmUrl}/api/public/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-site-token': siteToken,
      },
      body: JSON.stringify({
        ...data,
        website: '', // Honeypot field (should always be empty)
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited
        return {
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        }
      }

      return {
        success: false,
        error: result.error || 'Failed to submit lead',
      }
    }

    return {
      success: true,
      id: result.id,
    }
  } catch (error) {
    console.error('[Lead Submission] Error:', error)
    return {
      success: false,
      error: 'Network error. Please try again.',
    }
  }
}

/**
 * React hook for lead submission
 */
export function useLeadSubmission() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (data: LeadSubmissionData) => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    const result = await submitLead(data)

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      return true
    } else {
      setError(result.error || 'Unknown error')
      return false
    }
  }

  const reset = () => {
    setError(null)
    setSuccess(false)
  }

  return {
    submit,
    loading,
    error,
    success,
    reset,
  }
}

