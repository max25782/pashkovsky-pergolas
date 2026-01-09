/**
 * Company Settings Page - SuperAdmin
 * Allows SuperAdmin to modify company settings
 * Authorization is handled by SuperAdmin layout
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CompanySettingsForm } from '@/components/superadmin/CompanySettingsForm'

export const dynamic = 'force-dynamic'

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
        <CompanySettingsForm companyId={companyId} />
      </div>
    </div>
  )
}

