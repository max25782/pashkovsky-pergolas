import { createClient } from '@/lib/supabase/server'
import { TrialBannerClient } from './TrialBannerClient'

/**
 * Server component that resolves the current user's company trial state
 * and renders the dismissible client banner if the trial is ending soon.
 *
 * Renders nothing when:
 *  - user has no company
 *  - no trial deadline set
 *  - trial already ended (>0 days past — separate UX handles lockout later)
 *  - more than 7 days remaining
 */
export async function TrialBanner() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.company_id) return null

  const { data: company } = await supabase
    .from('companies')
    .select('trial_ends_at, early_bird_position')
    .eq('id', membership.company_id)
    .maybeSingle()

  if (!company?.trial_ends_at) return null

  const trialEndsAt = new Date(company.trial_ends_at).getTime()
  const now = Date.now()
  const msLeft = trialEndsAt - now
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  // Show only when trial is active and within 7-day reminder window
  if (daysLeft <= 0 || daysLeft > 7) return null

  return (
    <TrialBannerClient
      daysLeft={daysLeft}
      isEarlyBird={company.early_bird_position !== null && company.early_bird_position !== undefined}
      earlyBirdPosition={company.early_bird_position ?? null}
    />
  )
}
