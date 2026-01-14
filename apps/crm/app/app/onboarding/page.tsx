import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await searchParams
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=authentication_required')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-800 rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">
          Company Setup Required
        </h1>
        <p className="text-neutral-400 mb-6">
          You need to be a member of a company to access the CRM.
        </p>
        {resolvedParams.error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
            Error: {resolvedParams.error}
          </div>
        )}
        <div className="space-y-4">
          <p className="text-neutral-300 text-sm">
            Please contact your administrator to add you to a company, or create a new company.
          </p>
          <Link
            href="/app/settings/company"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go to Company Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
