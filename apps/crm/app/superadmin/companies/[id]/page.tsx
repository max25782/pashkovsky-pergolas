/**
 * Company Details Page - SuperAdmin
 * Shows detailed information about a specific company
 * Authorization is handled by SuperAdmin layout
 */

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ArrowLeft, Building2, Mail, Calendar, CreditCard, Users } from 'lucide-react'
import { SendMagicLinkButton } from '@/components/superadmin/SendMagicLinkButton'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailsPage({ params }: PageProps) {
  const resolvedParams = await params
  const companyId = resolvedParams.id

  // Fetch company details
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Company not found</p>
        </div>
        <Link href="/superadmin/companies" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Companies
        </Link>
      </div>
    )
  }

  // Fetch subscription details
  const { data: subscriptionData, error: subError } = await supabaseAdmin
    .from('company_subscriptions')
    .select(`
      *,
      subscription_plans (
        plan_key,
        display_name,
        price_monthly,
        price_yearly
      )
    `)
    .eq('company_id', companyId)
    .limit(1)

  console.log('[CompanyDetails] Subscription query result:', {
    companyId,
    data: subscriptionData,
    error: subError,
  })

  const subscription = subscriptionData?.[0] || null

  // Fetch company members
  const { data: members, error: membersError } = await supabaseAdmin
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)

  console.log('[CompanyDetails] Members query result:', {
    companyId,
    count: members?.length || 0,
    error: membersError,
  })

  // Fetch subscription history
  const { data: history, error: historyError } = await supabaseAdmin
    .from('subscription_history')
    .select(`
      *,
      subscription_plans!subscription_history_new_plan_id_fkey (
        plan_key,
        display_name
      )
    `)
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false })
    .limit(10)

  console.log('[CompanyDetails] History query result:', {
    companyId,
    count: history?.length || 0,
    error: historyError,
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/superadmin/companies" 
          className="text-blue-600 hover:underline inline-flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-gray-500">{company.slug}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Company Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Primary Email
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{company.primary_email || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(company.created_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Company ID</dt>
              <dd className="mt-1 text-xs text-gray-600 font-mono">{company.id}</dd>
            </div>
          </dl>
        </div>

        {/* Subscription Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </h2>
          {subscription ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Plan</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscription.subscription_plans?.plan_key === 'enterprise'
                      ? 'bg-purple-100 text-purple-800'
                      : subscription.subscription_plans?.plan_key === 'trial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {subscription.subscription_plans?.plan_key || subscription.plan_id || 'Unknown'}
                  </span>
                  {subscription.subscription_plans?.display_name && (
                    <span className="ml-2 text-sm text-gray-600">
                      ({subscription.subscription_plans.display_name.en || subscription.subscription_plans.display_name.ru || 'N/A'})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscription.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : subscription.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {subscription.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Payment Provider</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    subscription.payment_provider === 'manual'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-blue-50 text-blue-700'
                  }`}>
                    {subscription.payment_provider || 'N/A'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Auto Renew</dt>
                <dd className="mt-1 text-sm text-gray-900">{subscription.auto_renew ? '✅ Yes' : '❌ No'}</dd>
              </div>
              {subscription.current_period_start && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Period</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(subscription.current_period_start).toLocaleDateString()}
                    {subscription.current_period_end && (
                      <> - {new Date(subscription.current_period_end).toLocaleDateString()}</>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Subscription ID</dt>
                <dd className="mt-1 text-xs text-gray-600 font-mono break-all">{subscription.id}</dd>
              </div>
            </dl>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No subscription found</p>
              <p className="text-xs text-gray-400">This company may not have an active subscription yet.</p>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({members?.length || 0})
          </h2>
          {members && members.length > 0 ? (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.user_id}</p>
                    <p className="text-xs text-gray-500">
                      Joined: {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {member.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No members found</p>
          )}
        </div>

        {/* Subscription History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription History</h2>
          {history && history.length > 0 ? (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="border-l-2 border-blue-200 pl-3 py-2">
                  <p className="text-sm font-medium text-gray-900">
                    Changed to: {entry.subscription_plans?.plan_key || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.changed_at).toLocaleString()}
                  </p>
                  {entry.change_reason && (
                    <p className="text-xs text-gray-600 mt-1">{entry.change_reason}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No history found</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-4">
        <div className="flex gap-4">
          <Link
            href={`/superadmin/companies/${companyId}/settings`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit Settings
          </Link>
        </div>

        {/* Send Magic Link to Owner */}
        {company.primary_email && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Send Login Access</h3>
            <p className="text-sm text-gray-600 mb-4">
              Send a magic login link to the company owner: <strong>{company.primary_email}</strong>
            </p>
            <SendMagicLinkButton 
              email={company.primary_email} 
              companyName={company.name}
            />
          </div>
        )}
      </div>
    </div>
  )
}

