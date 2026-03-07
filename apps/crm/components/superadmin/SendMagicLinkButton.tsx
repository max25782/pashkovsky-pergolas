/**
 * Send Magic Link Button - SuperAdmin Component
 * Allows SuperAdmin to send magic link to company owner
 */

'use client'

import { useState } from 'react'
import { Mail, Check, AlertCircle } from 'lucide-react'

interface SendMagicLinkButtonProps {
  email: string
  companyName: string
}

export function SendMagicLinkButton({ email, companyName }: SendMagicLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSendMagicLink = async () => {
    setIsLoading(true)
    setStatus('idle')
    setMessage('')

    try {
      // Magic link will redirect to /auth/callback (for SSR cookies)
      // Then callback redirects to final destination
      const callbackUrl = `${window.location.origin}/auth/callback`

      const response = await fetch('/api/superadmin/users/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          redirectTo: callbackUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link')
      }

      setStatus('success')
      setMessage(`Magic link sent to ${email}`)
      
      // Copy link to clipboard if available
      if (data.magicLink) {
        await navigator.clipboard.writeText(data.magicLink)
        setMessage(`Magic link sent to ${email} and copied to clipboard!`)
      }
    } catch (error: unknown) {
      console.error('[SendMagicLink] Error:', error)
      setStatus('error')
      setMessage((error instanceof Error ? error.message : String(error)) || 'Failed to send magic link')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSendMagicLink}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Mail className="h-4 w-4" />
        {isLoading ? 'Sending...' : 'Send Magic Login Link'}
      </button>

      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}
    </div>
  )
}

