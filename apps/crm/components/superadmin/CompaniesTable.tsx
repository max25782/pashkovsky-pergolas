/**
 * Companies Table - Client Component
 * Handles company deletion
 */

'use client'

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
}

interface CompaniesTableProps {
  companies: Company[]
}

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleView = (company: Company) => {
    // Navigate to company details page
    router.push(`/superadmin/companies/${company.id}`)
  }

  const handleSettings = (company: Company) => {
    // Navigate to company settings page
    router.push(`/superadmin/companies/${company.id}/settings`)
  }

  const handleDelete = async (company: Company) => {
    // Confirm deletion
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
        credentials: 'include', // Include cookies
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to delete company'
        throw new Error(errorMessage)
      }

      console.log('[CompaniesTable] Company deleted:', company.name)
      
      // Show success message
      alert(`Company "${company.name}" deleted successfully`)
      
      // Refresh the page to show updated list
      router.refresh()
    } catch (error) {
      console.error('[CompaniesTable] Delete error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to delete company: ${errorMessage}\n\nCheck browser console for details.`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Company
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Plan
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {companies.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                No companies found
              </td>
            </tr>
          ) : (
            companies.map((company) => (
              <tr key={company.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {company.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {company.primary_email}
                      </div>
                    </div>
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
  )
}
