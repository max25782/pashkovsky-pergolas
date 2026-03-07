'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'

function ResetPasswordPageContent({ params }: { params: { locale: Locale } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'request' | 'reset'>(token && email ? 'reset' : 'request')
  const [formData, setFormData] = useState({
    email: email || '',
    password: '',
    confirmPassword: '',
    resetToken: token || '',
  })

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: formData.resetToken,
          email: formData.email,
          newPassword: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/${params.locale}/auth/login`)
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'request') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Reset Password</h1>
            <p className="text-white/60">איפוס סיסמה</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-8">
            {success ? (
              <div className="text-center">
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200 mb-4">
                  Password reset email sent! Check your inbox.
                </div>
                <Link
                  href={`/${params.locale}/auth/login`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleRequestReset} className="space-y-6">
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none"
                    placeholder="your@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                href={`/${params.locale}/auth/login`}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Reset password step
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Set New Password</h1>
          <p className="text-white/60">הגדר סיסמה חדשה</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          {success ? (
            <div className="text-center">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200 mb-4">
                Password reset successfully! Redirecting to login...
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">New Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none"
                  placeholder="At least 8 characters"
                />
                <p className="text-xs text-white/50 mt-1">
                  Must contain uppercase, lowercase, and number
                </p>
              </div>

              <div>
                <label className="block text-sm mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none"
                  placeholder="Confirm password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage({ params }: { params: { locale: Locale } }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="container flex items-center justify-center min-h-screen">
          <div className="text-white/60">Loading...</div>
        </div>
      </main>
    }>
      <ResetPasswordPageContent params={params} />
    </Suspense>
  )
}



