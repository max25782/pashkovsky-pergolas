/**
 * Companies Management
 * View and manage all companies on the platform
 */

import { createClient } from '@supabase/supabase-js'
import { CompaniesTable } from '@/components/superadmin/CompaniesTable'
import { CompanyOnboardingForm } from '@/components/superadmin/CompanyOnboardingForm'

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
      trial_ends_at
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
      <CompanyOnboardingForm />

      {/* Companies Table with Delete */}
      <CompaniesTable companies={companies} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Companies</p>
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
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {companies.filter(c => {
              const created = new Date(c.created_at)
              const now = new Date()
              return created.getMonth() === now.getMonth() && 
                     created.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
      </div>
    </div>
  )
}
