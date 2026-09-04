'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type LoginMode = 'admin' | 'employee'

function LoginPageContent() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'employee' ? 'employee' : 'admin'
  const initialEmail = searchParams.get('email') ?? ''

  const [mode, setMode] = useState<LoginMode>(initialMode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    emailOrPhone: initialEmail,
    password: '',
  })
  const [employeeEmail, setEmployeeEmail] = useState(initialEmail)

  async function handleGoogleLogin() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setLoading(false)
      }
    } catch {
      setError('Failed to start Google login')
      setLoading(false)
    }
  }

  async function handleEmployeeLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeEmail.trim()) {
      setError('נא להזין אימייל')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: employeeEmail.trim() }),
      })

      const result = await response.json() as { error?: string; redirectTo?: string }

      if (!response.ok) {
        setError(result.error ?? 'האימייל לא אושר על ידי המנהל')
        setLoading(false)
        return
      }

      window.location.href = result.redirectTo ?? '/app'
    } catch {
      setError('שגיאה בכניסה')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.emailOrPhone || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const isPhone = /^[0+]/.test(formData.emailOrPhone.trim())

      if (isPhone) {
        const normalizedPhone = formData.emailOrPhone.trim().replace(/[\s-]/g, '')
        const response = await fetch('/api/auth/superadmin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalizedPhone,
            token: formData.password,
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          setError(result.error || 'Invalid credentials')
          setLoading(false)
          return
        }

        setTimeout(() => {
          window.location.href = '/superadmin'
        }, 100)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.emailOrPhone,
        password: formData.password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      window.location.href = '/app/admin'
    } catch {
      setError('Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/logo.svg"
            alt="AluminCRM"
            className="h-20 w-auto mx-auto mb-4 logo-animate"
          />
          <h1 className="text-4xl font-bold mb-2">
            {mode === 'employee' ? 'כניסת עובד' : 'Sign In'}
          </h1>
          <p className="text-white/60">
            {mode === 'employee'
              ? 'הזן את האימייל שאושר על ידי המנהל'
              : 'Sign in to your account'}
          </p>
        </div>

        <div className="flex mb-4 rounded-lg border border-white/10 p-1 bg-black/20">
          <button
            type="button"
            onClick={() => { setMode('admin'); setError(null) }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === 'admin' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            מנהל / בעלים
          </button>
          <button
            type="button"
            onClick={() => { setMode('employee'); setError(null) }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === 'employee' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            כניסת עובד
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          {mode === 'employee' ? (
            <form onSubmit={handleEmployeeLogin} className="space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">אימייל עבודה</label>
                <input
                  type="email"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  placeholder="sales@company.com"
                />
                <p className="text-xs text-white/40 mt-2">
                  רק אימיילים שהמנהל הוסיף למערכת יכולים להיכנס.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 font-semibold transition"
              >
                {loading ? 'נכנס...' : 'כניסה'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">Email or Phone</label>
                <input
                  type="text"
                  value={formData.emailOrPhone}
                  onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  placeholder="user@email.com"
                />
                <p className="text-xs text-white/40 mt-1">
                  SuperAdmin can login with phone number
                </p>
              </div>

              <div>
                <label className="block text-sm mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full px-4 py-2 pr-12 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  href="/reset-password"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 font-semibold transition"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-white/60">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 font-semibold transition"
              >
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </button>
            </form>
          )}

          {mode === 'admin' ? (
            <div className="mt-6 text-center">
              <p className="text-white/60">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-400 hover:text-blue-300">
                  Sign up
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
          <div className="container flex items-center justify-center min-h-screen">
            <div className="text-white/60">Loading...</div>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
