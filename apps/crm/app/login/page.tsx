'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginPageContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    emailOrPhone: '', // Changed to support both email and phone
    password: '',
  })

  // NOTE: Removed auto-redirect check to prevent redirect loops
  // If user is already logged in, they can manually navigate to /app/admin

  async function handleGoogleLogin() {
    try {
      setLoading(true)
      setError(null)
      
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error('[Login] OAuth error:', error)
        setError(error.message)
        setLoading(false)
      }
      
      // User will be redirected to Google, don't set loading to false
    } catch (err) {
      console.error('[Login] Error:', err)
      setError('Failed to start Google login')
      setLoading(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    console.log('[Login] Form submitted!')
    e.preventDefault()
    
    console.log('[Login] Email or Phone:', formData.emailOrPhone)
    console.log('[Login] Password length:', formData.password.length)
    
    if (!formData.emailOrPhone || !formData.password) {
      console.log('[Login] Missing fields')
      setError('Please fill in all fields')
      return
    }

    try {
      console.log('[Login] Starting login...')
      setLoading(true)
      setError(null)
      
      const supabase = createClient()
      
      // Check if input is phone number (starts with 0 or +972)
      const isPhone = /^[0+]/.test(formData.emailOrPhone.trim())
      
      let loginData: any = null // Define at function scope
      
      if (isPhone) {
        console.log('[Login] Detected phone number, using SuperAdmin token login...')
        
        // Normalize phone number (remove spaces, dashes)
        const normalizedPhone = formData.emailOrPhone.trim().replace(/[\s-]/g, '')
        console.log('[Login] Normalized phone:', normalizedPhone)
        
        // SuperAdmin login with token (password field = SUPERADMIN_TOKEN)
        const response = await fetch('/api/auth/superadmin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalizedPhone,
            token: formData.password, // Password field used for token
          }),
        })
        
        const result = await response.json()
        
        if (!response.ok) {
          console.error('[Login] SuperAdmin login failed:', result)
          setError(result.error || 'Invalid credentials')
          setLoading(false)
          return
        }
        
        console.log('[Login] ✓ SuperAdmin login successful!', result)
        console.log('[Login] ✓ httpOnly cookie set by server')
        
        // Session is stored server-side (Redis)
        // Cookie is httpOnly (not accessible from JavaScript)
        // Just redirect - middleware will handle auth
        console.log('[Login] Redirecting to /superadmin')
        
        // Use setTimeout to ensure cookie is set
        setTimeout(() => {
          window.location.href = '/superadmin'
        }, 100)
        return
      } else {
        // Email login
        console.log('[Login] Calling signInWithPassword with email...')
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.emailOrPhone,
          password: formData.password,
        })

        console.log('[Login] Response:', { user: data?.user?.email, error: error?.message })

        if (error) {
          console.error('[Login] Email login error:', error)
          setError(error.message)
          setLoading(false)
          return
        }
        
        loginData = data
        
        // Redirect to CRM admin
        console.log('[Login] Successfully logged in:', loginData.user?.email)
        console.log('[Login] Redirecting to /app/admin')
        window.location.href = '/app/admin'
        return
      }
    } catch (err) {
      console.error('[Login] Error:', err)
      setError('Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Sign In</h1>
          <p className="text-white/60">התחבר לחשבון שלך</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
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
                placeholder="your@email.com or 0524494848"
              />
              <p className="text-xs text-white/40 mt-1">
                SuperAdmin can login with phone number
              </p>
            </div>

            <div>
              <label className="block text-sm mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/20 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="Enter your password"
              />
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
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-white/60">OR</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
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
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/60">
              Don't have an account?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="container flex items-center justify-center min-h-screen">
          <div className="text-white/60">Loading...</div>
        </div>
      </main>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
