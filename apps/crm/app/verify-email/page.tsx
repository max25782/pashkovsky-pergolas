'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'

function VerifyEmailPageContent({ params }: { params: { locale: Locale } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (token && email) {
      handleVerify()
    }
  }, [token, email])

  async function handleVerify() {
    if (!token || !email) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setSuccess(true)
      setVerified(true)
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend email')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to resend email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Email Verification</h1>
          <p className="text-white/60">אימות אימייל</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          {loading && !success && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white/60">Verifying email...</p>
            </div>
          )}

          {success && verified && (
            <div className="text-center">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6 text-green-200 mb-4">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-lg font-semibold">Email verified successfully!</p>
                <p className="text-sm mt-2">Your email has been confirmed.</p>
              </div>
              <Link
                href={`/${params.locale}/auth/login`}
                className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition font-semibold"
              >
                Continue to Login
              </Link>
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-red-200 mb-4">
                <div className="text-4xl mb-2">❌</div>
                <p className="text-lg font-semibold">Verification Failed</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
              
              {email && (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition font-semibold mb-4"
                >
                  {loading ? 'Sending...' : 'Resend Verification Email'}
                </button>
              )}
              
              <Link
                href={`/${params.locale}/auth/login`}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Back to login
              </Link>
            </div>
          )}

          {!loading && !success && !error && token && email && (
            <div className="text-center">
              <p className="text-white/60">Click the button below to verify your email:</p>
              <button
                onClick={handleVerify}
                className="mt-4 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition font-semibold"
              >
                Verify Email
              </button>
            </div>
          )}

          {!token && !email && (
            <div className="text-center">
              <p className="text-white/60 mb-4">
                No verification token found. Please check your email for the verification link.
              </p>
              <Link
                href={`/${params.locale}/auth/login`}
                className="text-blue-400 hover:text-blue-300"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function VerifyEmailPage({ params }: { params: { locale: Locale } }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="container flex items-center justify-center min-h-screen">
          <div className="text-white/60">Loading...</div>
        </div>
      </main>
    }>
      <VerifyEmailPageContent params={params} />
    </Suspense>
  )
}



