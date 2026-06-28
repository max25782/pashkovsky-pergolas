/**
 * Company Details Page - SuperAdmin
 * Shows detailed information about a specific company
 * Authorization is handled by SuperAdmin layout
 */

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ArrowLeft, Building2, Mail, Calendar, CreditCard, Users, MousePointerClick } from 'lucide-react'
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

  const subscription = subscriptionData?.[0] || null

  // Fetch company members
  const { data: members, error: membersError } = await supabaseAdmin
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)

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
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch platform-level audit log events for this company
  const { data: auditEvents } = await supabaseAdmin
    .from('platform_audit_logs')
    .select('id, event_type, payload, created_at, actor_user_id, actor_admin_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)

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

        {/* Acquisition Source */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            Acquisition
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Registration Channel</dt>
              <dd className="mt-1">
                {company.registration_source ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    company.registration_source === 'google_ads'   ? 'bg-blue-100 text-blue-800'   :
                    company.registration_source === 'organic'      ? 'bg-green-100 text-green-800' :
                    company.registration_source === 'google_oauth' ? 'bg-red-100 text-red-800'     :
                    company.registration_source === 'manual'       ? 'bg-orange-100 text-orange-800':
                    company.registration_source === 'referral'     ? 'bg-purple-100 text-purple-800':
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {company.registration_source.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Unknown</span>
                )}
              </dd>
            </div>
            {company.utm_source && (
              <div>
                <dt className="text-sm font-medium text-gray-500">UTM Source</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.utm_source}</dd>
              </div>
            )}
            {company.utm_medium && (
              <div>
                <dt className="text-sm font-medium text-gray-500">UTM Medium</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.utm_medium}</dd>
              </div>
            )}
            {company.utm_campaign && (
              <div>
                <dt className="text-sm font-medium text-gray-500">UTM Campaign</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.utm_campaign}</dd>
              </div>
            )}
            {company.referrer_url && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Referrer URL</dt>
                <dd className="mt-1 text-sm text-gray-600 break-all">{company.referrer_url}</dd>
              </div>
            )}
            {!company.utm_source && !company.utm_medium && !company.utm_campaign && !company.referrer_url && (
              <p className="text-sm text-gray-400">No UTM parameters captured</p>
            )}
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
                    {new Date(entry.created_at).toLocaleString()}
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

        {/* Activity Log */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
          {auditEvents && auditEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          event.event_type === 'company_created' ? 'bg-green-100 text-green-800' :
                          event.event_type === 'plan_changed'    ? 'bg-blue-100 text-blue-800'  :
                          event.event_type === 'company_deleted' ? 'bg-red-100 text-red-800'    :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                        {event.payload && typeof event.payload === 'object' && Object.keys(event.payload).length > 0 ? (
                          <ul className="space-y-0.5">
                            {Object.entries(event.payload as Record<string, unknown>)
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .map(([k, v]) => (
                                <li key={k}>
                                  <span className="text-gray-400">{k.replace(/_/g, ' ')}:</span>{' '}
                                  <span className="text-gray-700">{String(v)}</span>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(event.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No activity recorded</p>
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

