import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscriptionPlan } from '@/lib/subscription/load-user-plan'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = await getUserSubscriptionPlan(user.id)
    return NextResponse.json({ plan })
  } catch (e) {
    console.error('[me/subscription]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
