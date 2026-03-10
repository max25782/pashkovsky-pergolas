'use client'

import { useToast } from '@/components/ui/toast'
/**
 * SuperAdmin Integrations Management Page
 * View and manage all company integrations
 */

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'
import type { CompanyIntegration } from '@/types/integration'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface IntegrationWithCompany extends CompanyIntegration {
  companies?: {
    name: string
  }
}

export default function SuperAdminIntegrationsPage() {
  const toast = useToast()
  const t = useTranslations('integrations')
  
  const [integrations, setIntegrations] = useState<IntegrationWithCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadIntegrations()
  }, [])

  async function loadIntegrations() {
    try {
      setLoading(true)

      // Get auth token
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token')
      
      const response = await fetch('/api/platform/integrations/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load integrations')
      }

      const data = await response.json()
      setIntegrations(data.integrations || [])
    } catch (error) {
      console.error('[SuperAdmin] Load error:', error)
      // Fallback: load directly from Supabase
      const { data, error: dbError } = await supabase
        .from('company_integrations')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (!dbError && data) {
        setIntegrations(data as IntegrationWithCompany[])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action: 'activate' | 'suspend' | 'rotate', companyId: string) {
    if (!confirm(`Are you sure you want to ${action} this integration?`)) {
      return
    }

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token')
      const endpoint = `/api/platform/integrations/${action === 'rotate' ? 'rotate-secret' : action}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_id: companyId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Action failed')
      }

      if (action === 'rotate') {
        const result = await response.json()
        toast.info(`New webhook secret: ${result.new_secret}`)
      } else {
        toast.success(`Integration ${action}d successfully!`)
      }

      // Reload data
      loadIntegrations()
    } catch (error) {
      console.error('[SuperAdmin] Action error:', error)
      toast.error(error instanceof Error ? error.message : 'Action failed')
    }
  }

  const filteredIntegrations = statusFilter === 'all'
    ? integrations
    : integrations.filter(int => int.status === statusFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading integrations...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('superadmin.title')}</h1>
        <p className="text-gray-600">Manage website integrations for all companies</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Status Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('superadmin.filterAll')}</option>
            <option value="not_connected">Not Connected</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="text-sm text-gray-600">
            {filteredIntegrations.length} integration{filteredIntegrations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superadmin.companyName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superadmin.websiteUrl')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superadmin.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superadmin.lastEvent')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('superadmin.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredIntegrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('superadmin.noIntegrations')}
                  </td>
                </tr>
              ) : (
                filteredIntegrations.map((integration) => (
                  <tr key={integration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {integration.companies?.name || integration.company_id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {integration.website_url || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={integration.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {integration.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {integration.last_event_at
                        ? new Date(integration.last_event_at).toLocaleString()
                        : t('never')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {integration.status === 'pending_payment' && (
                          <button
                            onClick={() => handleAction('activate', integration.company_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                          >
                            {t('markAsPaid')}
                          </button>
                        )}
                        {integration.status === 'active' && (
                          <button
                            onClick={() => handleAction('suspend', integration.company_id)}
                            className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs"
                          >
                            {t('suspend')}
                          </button>
                        )}
                        {integration.status === 'suspended' && (
                          <button
                            onClick={() => handleAction('activate', integration.company_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                          >
                            {t('reactivate')}
                          </button>
                        )}
                        <button
                          onClick={() => handleAction('rotate', integration.company_id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                        >
                          {t('rotateSecret')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    not_connected: 'bg-gray-100 text-gray-700',
    pending_payment: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}




