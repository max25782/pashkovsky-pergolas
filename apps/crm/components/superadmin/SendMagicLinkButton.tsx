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
  const [magicLink, setMagicLink] = useState<string | null>(null)

  const handleSendMagicLink = async () => {
    setIsLoading(true)
    setStatus('idle')
    setMessage('')
    setMagicLink(null)

    try {
      // Get current origin for redirect URL
      const redirectUrl = `${window.location.origin}/app/admin`

      const response = await fetch('/api/superadmin/users/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          redirectTo: redirectUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link')
      }

      setStatus('success')
      setMessage(`Magic link generated for ${email}`)
      
      // Store link to display on screen
      if (data.magicLink) {
        setMagicLink(data.magicLink)
      }
    } catch (error: any) {
      console.error('[SendMagicLink] Error:', error)
      setStatus('error')
      setMessage(error.message || 'Failed to send magic link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!magicLink) return
    
    try {
      await navigator.clipboard.writeText(magicLink)
      setMessage(`Magic link copied to clipboard!`)
    } catch (error) {
      // Fallback: select text for manual copy
      console.error('[SendMagicLink] Clipboard error:', error)
      setMessage('Please copy the link manually from below')
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleSendMagicLink}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Mail className="h-4 w-4" />
        {isLoading ? 'Generating...' : 'Send Magic Login Link'}
      </button>

      {status === 'success' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
            <Check className="h-4 w-4" />
            {message}
          </div>
          
          {magicLink && (
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm break-all">
                <div className="font-medium text-gray-700 mb-1">Magic Link:</div>
                <div className="text-blue-600 select-all">{magicLink}</div>
              </div>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Copy Link
              </button>
            </div>
          )}
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

