/**
 * Server-to-server: apply 3D configurator submission to an offer (2D geometry + totals).
 * Called from site sendPergolaConfig with CONFIGURATOR_SYNC_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  applyConfiguratorSyncToOffer,
  type PergolaParamsPayload,
} from '@/lib/configurator/apply-configurator-sync-to-offer'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SYNC_SECRET = process.env.CONFIGURATOR_SYNC_SECRET

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function POST(req: NextRequest) {
  if (!SYNC_SECRET) {
    return NextResponse.json({ error: 'Configurator sync not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const offerId = body.offerId as string
    const params = body.params as PergolaParamsPayload
    const previewImageUrl = body.previewImageUrl as string | undefined
    const editUrlBody = body.editUrl as string | undefined
    const customerViewUrlBody = body.customerViewUrl as string | undefined
    const legacyViewUrl = body.viewUrl as string | undefined
    const submissionId = body.submissionId as string | undefined

    if (!offerId || !params || typeof params.widthCm !== 'number') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { skippedNonRectangle } = await applyConfiguratorSyncToOffer(supabase, offerId, {
      params,
      previewImageUrl: previewImageUrl ?? null,
      editUrl: editUrlBody ?? null,
      customerViewUrl: customerViewUrlBody ?? null,
      legacyViewUrl: legacyViewUrl ?? null,
      submissionId: submissionId ?? null,
    })

    return NextResponse.json({ success: true, skippedNonRectangle })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid request'
    if (msg === 'Offer not found') {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }
    console.error('[configurator-sync]', e)
    return NextResponse.json({ error: 'Invalid request', details: msg }, { status: 400 })
  }
}
