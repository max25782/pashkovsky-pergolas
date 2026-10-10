// ==========================================
// POST /api/subscriptions/change-plan -- DISABLED (403)
// ==========================================
// Self-service plan changes are closed: the previous implementation wrote the
// subscription through the user-scoped client, so any company admin could
// upgrade their own plan for free. Plan changes belong to a trusted billing
// path (payment webhook / platform-admin service-role route).
//
// This handler deliberately does not authenticate, read the body or touch the
// database: it answers 403 for everyone.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PLAN_CHANGE_DISABLED_MESSAGE =
  'Plan changes are disabled. Contact the platform administrator.'

export async function POST() {
  return NextResponse.json(
    { error: PLAN_CHANGE_DISABLED_MESSAGE },
    { status: 403 },
  )
}
