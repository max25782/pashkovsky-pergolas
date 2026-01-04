/**
 * Company Onboarding Form - Client Component
 * SuperAdmin UI for manually onboarding new companies
 */

'use client'

import { useState } from 'react'
import { UserPlus, Mail, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

export function CompanyOnboardingForm() {
  const [email, setEmail] = useState('')
  const [sendInviteEmail, setSendInviteEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{
    company_name: string
    company_id: string
    user_id: string
    magic_link_url?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validate email
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/superadmin/companies/onboard', {
        method: 'POST',
        credentials: 'include', // Include SuperAdmin session cookie
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          sendInviteEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to onboard company')
      }

      console.log('[CompanyOnboardingForm] Onboarding successful:', data)

      setSuccess({
        company_name: data.company_name,
        company_id: data.company_id,
        user_id: data.user_id,
        magic_link_url: data.magic_link_url,
      })

      // Reset form
      setEmail('')
      setSendInviteEmail(true)
    } catch (err: any) {
      console.error('[CompanyOnboardingForm] Error:', err)
      setError(err.message || 'Failed to onboard company')
    } finally {
      setLoading(false)
    }
  }

  const copyMagicLink = () => {
    if (success?.magic_link_url) {
      navigator.clipboard.writeText(success.magic_link_url)
      alert('Magic link copied to clipboard!')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <UserPlus className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Onboard New Company</h2>
          <p className="text-sm text-gray-600">
            Create company + user + grant full enterprise access
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-1">
                Company Created Successfully!
              </h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>
                  <strong>Company:</strong> {success.company_name}
                </p>
                <p className="text-xs text-green-700">
                  Company ID: {success.company_id}
                </p>
                <p className="text-xs text-green-700">
                  User ID: {success.user_id}
                </p>
              </div>

              {/* Magic Link */}
              {success.magic_link_url && (
                <div className="mt-3 p-3 bg-white rounded border border-green-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Magic Login Link:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={success.magic_link_url}
                      readOnly
                      className="flex-1 text-xs p-2 border border-gray-300 rounded bg-gray-50 font-mono"
                    />
                    <button
                      onClick={copyMagicLink}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Share this link with the user to log in without a password
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSuccess(null)}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Onboard Another Company
                </button>
                <a
                  href="/superadmin/companies"
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  View All Companies
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Form */}
      {!success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              User Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              If user does not exist, they will be created automatically
            </p>
          </div>

          {/* Send Invite Checkbox */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="sendInviteEmail"
              checked={sendInviteEmail}
              onChange={(e) => setSendInviteEmail(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={loading}
            />
            <label htmlFor="sendInviteEmail" className="text-sm text-gray-700">
              <span className="font-medium">Generate magic login link</span>
              <p className="text-xs text-gray-500">
                Creates a one-time login link you can share with the user (no password required)
              </p>
            </label>
          </div>

          {/* What Will Happen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              What will happen:
            </h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✅ Create or find user in the system</li>
              <li>✅ Create new company (named after email prefix)</li>
              <li>✅ Assign user as company owner</li>
              <li>✅ Grant full enterprise access (no expiration)</li>
              <li>✅ No payment required</li>
              {sendInviteEmail && <li>✅ Generate magic login link</li>}
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating Company...
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                Create Company + Give Full Access
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

