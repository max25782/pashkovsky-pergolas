'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Company {
  id: string
  name: string
  role: 'owner' | 'admin' | 'manager' | 'worker' | 'viewer'
}

function SelectCompanyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/app/admin'
  const tSC = useTranslations('selectCompany')
  
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/auth/companies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load companies')
      }

      const data = await response.json()
      setCompanies(data.companies || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function selectCompany(companyId: string) {
    try {
      setSelecting(companyId)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      // Request new token with company_id
      const response = await fetch('/api/auth/select-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ company_id: companyId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to select company')
      }

      const data = await response.json()
      
      // Save new token with company_id
      localStorage.setItem('token', data.token)
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken)
      }

      // Redirect to original destination
      router.push(redirectUrl)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSelecting(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-neutral-600 dark:text-neutral-400">{tSC('loading')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-neutral-900 dark:text-white">
            {tSC('title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {tSC('subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {companies.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 text-center">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-neutral-400" />
            <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-white">
              {tSC('noCompanies')}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {tSC('noCompaniesDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => selectCompany(company.id)}
                disabled={selecting !== null}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6 text-right hover:border-blue-500 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {company.name}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {tSC('role')} {tSC(`roles.${company.role}` as const)}
                      </p>
                    </div>
                  </div>
                  
                  {selecting === company.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function SelectCompanyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="container flex items-center justify-center min-h-screen">
          <div className="text-white/60">Loading...</div>
        </div>
      </main>
    }>
      <SelectCompanyPageContent />
    </Suspense>
  )
}

