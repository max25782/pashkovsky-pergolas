'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    company_name: '',
    industry: 'aluminum',
  })

  // UTM params and referrer captured at page load
  const utmSource   = searchParams.get('utm_source')   ?? undefined
  const utmMedium   = searchParams.get('utm_medium')   ?? undefined
  const utmCampaign = searchParams.get('utm_campaign') ?? undefined

  function getReferrer(): string | undefined {
    try {
      return document.referrer || undefined
    } catch {
      return undefined
    }
  }

  function deriveSource(medium?: string): string {
    if (!medium) return 'direct'
    if (medium === 'cpc' || medium === 'paid') return 'google_ads'
    if (medium === 'organic') return 'organic'
    if (medium === 'referral') return 'referral'
    return 'direct'
  }

  // Store UTM params in a short-lived cookie so the server-side OAuth callback can read them
  function storeUtmsForOAuth() {
    const utms = new URLSearchParams()
    if (utmSource)   utms.set('utm_source', utmSource)
    if (utmMedium)   utms.set('utm_medium', utmMedium)
    if (utmCampaign) utms.set('utm_campaign', utmCampaign)
    const referrer = getReferrer()
    if (referrer)    utms.set('referrer_url', referrer)
    document.cookie = `reg_utm=${encodeURIComponent(utms.toString())}; path=/; max-age=600; SameSite=Lax`
  }

  // Check if user is already logged in
  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      router.push('/app/admin')
    }
  }

  async function handleGoogleSignup() {
    try {
      setLoading(true)
      setError(null)

      // Persist UTMs in a cookie so the server-side OAuth callback can read them
      storeUtmsForOAuth()
      
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?setup=true`,
        },
      })

      if (error) {
        console.error('[Register] OAuth error:', error)
        setError(error.message)
        setLoading(false)
      }
      
      // User will be redirected to Google
    } catch (err) {
      console.error('[Register] Error:', err)
      setError('Failed to start Google signup')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      
      // Step 1: Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      })

      if (authError) {
        console.error('[Register] Auth error:', authError)
        setError(authError.message)
        return
      }

      if (!authData.user) {
        setError('Failed to create user')
        return
      }


      // Step 2: Create company and link to user
      const response = await fetch('/api/auth/setup-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id:             authData.user.id,
          email:               formData.email,
          full_name:           formData.full_name,
          company_name:        formData.company_name,
          industry:            formData.industry,
          registration_source: deriveSource(utmMedium),
          utm_source:          utmSource,
          utm_medium:          utmMedium,
          utm_campaign:        utmCampaign,
          referrer_url:        getReferrer(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If company setup fails, we should sign out the user
        await supabase.auth.signOut()
        throw new Error(data.error || 'Failed to setup company')
      }

      
      // Show success message (user needs to verify email)
      if (authData.user.identities?.length === 0) {
        // Email confirmation required
        setSuccess(true)
      } else {
        // Email auto-confirmed or OAuth
        router.push('/app/admin')
      }
    } catch (err: unknown) {
      console.error('[Register] Error:', err)
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Check your email!</h2>
            <p className="text-white/60 mb-6">
              We've sent a confirmation link to <strong>{formData.email}</strong>. 
              Please check your email and click the link to verify your account.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Create Account</h1>
          <p className="text-white/60">התחל את תקופת הניסיון שלך</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="Your Company Ltd"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                disabled={loading}
              >
                <option value="aluminum">Aluminum & Pergolas</option>
                <option value="construction">Construction</option>
                <option value="renovation">Renovation</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="new-password"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 font-semibold transition"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-white/60">OR</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full px-6 py-3 rounded-lg bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 font-semibold transition flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? 'Redirecting...' : 'Sign up with Google'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/60">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-white/50">
          <p>By signing up, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="container flex items-center justify-center min-h-screen">
          <div className="text-white/60">Loading...</div>
        </div>
      </main>
    }>
      <RegisterPageContent />
    </Suspense>
  )
}
