/**
 * Companies Management
 * View and manage all companies on the platform
 */

import { createClient } from '@supabase/supabase-js'
import { CompaniesTable } from '@/components/superadmin/CompaniesTable'
import CompanyOnboardingForm from '@/components/superadmin/CompanyOnboardingForm'
import { Suspense } from 'react'

// Force dynamic rendering - companies list changes frequently
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getCompanies() {
  // Use SERVICE_ROLE_KEY to bypass RLS (SuperAdmin has full access)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      slug,
      status,
      plan,
      industry,
      primary_email,
      created_at,
      trial_ends_at,
      registration_source,
      utm_source,
      utm_campaign
    `)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('[Companies] Error loading:', error)
    return []
  }
  
  return companies || []
}

export default async function CompaniesPage() {
  const companies = await getCompanies()
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600 mt-1">All companies on the platform</p>
        </div>
      </div>

      {/* Onboarding Form */}
      <Suspense fallback={<div className="text-gray-600">Loading onboarding form...</div>}>
        <CompanyOnboardingForm />
      </Suspense>

      {/* Companies Table with Delete */}
      <CompaniesTable companies={companies} />

      {/* Stats */}
      {(() => {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const thisMonthCount = companies.filter(c => new Date(c.created_at) >= firstOfMonth).length
        const last7Count     = companies.filter(c => new Date(c.created_at) >= sevenDaysAgo).length

        // Source breakdown
        const sourceMap: Record<string, number> = {}
        companies.forEach(c => {
          const src = c.registration_source ?? 'direct'
          sourceMap[src] = (sourceMap[src] ?? 0) + 1
        })
        const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0]

        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{companies.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {companies.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">Trial</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {companies.filter(c => c.status === 'trial').length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{thisMonthCount}</p>
              </div>
            </div>

            {/* Acquisition breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Acquisition Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{last7Count}</p>
                  <p className="text-xs text-blue-600 mt-1">Last 7 days</p>
                </div>
                {Object.entries(sourceMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <div key={src} className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{count}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{src.replace('_', ' ')}</p>
                    </div>
                  ))}
              </div>
              {topSource && (
                <p className="text-xs text-gray-400 mt-3">
                  Top channel: <span className="font-medium text-gray-600">{topSource[0].replace('_', ' ')}</span> ({topSource[1]} companies)
                </p>
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}
