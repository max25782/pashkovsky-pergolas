'use client'

import { useToast } from '@/components/ui/toast'
/**
 * Companies Table - Client Component
 * Handles company deletion and source-aware filtering
 */

import { useState } from 'react'
import { Building2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Company {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  industry: string
  primary_email: string
  created_at: string
  trial_ends_at: string | null
  registration_source?: string | null
  utm_source?: string | null
  utm_campaign?: string | null
}

interface CompaniesTableProps {
  companies: Company[]
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  direct:       { label: 'Direct',      color: 'bg-gray-100 text-gray-700'   },
  organic:      { label: 'Organic',     color: 'bg-green-100 text-green-700' },
  google_ads:   { label: 'Google Ads',  color: 'bg-blue-100 text-blue-700'   },
  referral:     { label: 'Referral',    color: 'bg-purple-100 text-purple-700'},
  google_oauth: { label: 'Google',      color: 'bg-red-100 text-red-700'     },
  manual:       { label: 'Manual',      color: 'bg-orange-100 text-orange-700'},
}

function SourceBadge({ source }: { source?: string | null }) {
  const meta = SOURCE_LABELS[source ?? 'direct'] ?? { label: source ?? '—', color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  )
}

type FilterTab = 'all' | '7d' | 'month'

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const router = useRouter()
  const toast = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const filtered = companies.filter((c) => {
    if (activeTab === 'all') return true
    const created = new Date(c.created_at)
    if (activeTab === '7d') return created >= sevenDaysAgo
    return created >= firstOfMonth
  })

  const handleView = (company: Company) => {
    router.push(`/superadmin/companies/${company.id}`)
  }

  const handleSettings = (company: Company) => {
    router.push(`/superadmin/companies/${company.id}/settings`)
  }

  const handleDelete = async (company: Company) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${company.name}"?\n\n` +
      `This will permanently delete:\n` +
      `- Company data\n` +
      `- All users\n` +
      `- All deals, leads, and offers\n` +
      `- All subscriptions\n\n` +
      `This action CANNOT be undone!`
    )

    if (!confirmed) return

    setDeletingId(company.id)

    try {
      const response = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to delete company'
        throw new Error(errorMessage)
      }

      toast.success(`Company "${company.name}" deleted successfully`)
      window.location.reload()
    } catch (error) {
      console.error('[CompaniesTable] Delete error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to delete company: ${errorMessage}`)
    } finally {
      setDeletingId(null)
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all',   label: `All (${companies.length})`  },
    { id: '7d',    label: `Last 7 days (${companies.filter(c => new Date(c.created_at) >= sevenDaysAgo).length})` },
    { id: 'month', label: `This month (${companies.filter(c => new Date(c.created_at) >= firstOfMonth).length})`  },
  ]

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border-gray-200 border-b-white -mb-px z-10'
                : 'bg-gray-50 text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No companies found
                </td>
              </tr>
            ) : (
              filtered.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        <div className="text-sm text-gray-500">{company.primary_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <SourceBadge source={company.registration_source} />
                      {company.utm_campaign && (
                        <div className="text-xs text-gray-400 truncate max-w-[140px]" title={company.utm_campaign}>
                          {company.utm_campaign}
                        </div>
                      )}
                      {company.utm_source && !company.utm_campaign && (
                        <div className="text-xs text-gray-400">{company.utm_source}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {company.plan || 'trial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      company.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {company.status || 'trial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleView(company)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleSettings(company)}
                      className="text-gray-600 hover:text-gray-900 mr-4"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => handleDelete(company)}
                      disabled={deletingId === company.id}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === company.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
