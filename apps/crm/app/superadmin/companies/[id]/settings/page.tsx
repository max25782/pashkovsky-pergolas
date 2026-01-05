/**
 * Company Settings Page - SuperAdmin
 * Allows SuperAdmin to modify company settings
 * Authorization is handled by SuperAdmin layout
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompanySettingsPage({ params }: PageProps) {
  const resolvedParams = await params
  const companyId = resolvedParams.id

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href={`/superadmin/companies/${companyId}`}
          className="text-blue-600 hover:underline inline-flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Company Details
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-gray-500 mt-2">Manage company configuration and subscription</p>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          {/* Placeholder for settings */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">Settings management coming soon</p>
            <p className="text-sm text-gray-400">
              This page will allow you to:
            </p>
            <ul className="text-sm text-gray-400 mt-2 space-y-1">
              <li>• Change company name and email</li>
              <li>• Modify subscription plan</li>
              <li>• Manage company members</li>
              <li>• Configure integrations</li>
            </ul>
          </div>

          {/* Back Button */}
          <div className="flex justify-end">
            <Link
              href={`/superadmin/companies/${companyId}`}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

