import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pinContourReferenceOnParams, type PlanConstructionParams, type Point2D } from '@pashkovsky/pergola-core'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import {
  applyConfiguratorSyncToOffer,
  type PergolaParamsPayload,
} from '@/lib/configurator/apply-configurator-sync-to-offer'
import { uploadConfiguratorScreenshot } from '@/lib/configurator/upload-configurator-screenshot'
import { mintConfiguratorLinkForOffer } from '@/lib/configurator/mint-configurator-link'

function pinPlanParamsFromBody(body: Record<string, unknown>): PlanConstructionParams | unknown {
  const rawParams = body.planParams
  if (!rawParams || typeof rawParams !== 'object') return rawParams
  const polygon = body.planPolygon
  if (!Array.isArray(polygon) || polygon.length < 3) return rawParams
  const contour: Point2D[] = []
  for (const pt of polygon) {
    if (!pt || typeof pt !== 'object') return rawParams
    const p = pt as { x?: unknown; y?: unknown }
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return rawParams
    contour.push([p.x, p.y])
  }
  return pinContourReferenceOnParams(contour, rawParams as PlanConstructionParams)
}

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

function parseParams(body: Record<string, unknown>): PergolaParamsPayload | null {
  // Old rectangular format
  if (typeof body.widthCm === 'number' && typeof body.depthCm === 'number') {
    const shapeRaw = body.shapeType
    const shapeType: 'rectangle' | 'L' | 'U' =
      shapeRaw === 'L' ? 'L' : shapeRaw === 'U' ? 'U' : 'rectangle'
    return {
      shapeType,
      widthCm: Number(body.widthCm),
      depthCm: Number(body.depthCm),
      heightCm: Number(body.heightCm) || 260,
      arm1WidthCm: typeof body.arm1WidthCm === 'number' ? Number(body.arm1WidthCm) : 200,
      arm1DepthCm: typeof body.arm1DepthCm === 'number' ? Number(body.arm1DepthCm) : 200,
      color: String(body.color ?? '#9aa0a6'),
      lamellaAngleDeg: Number(body.lamellaAngleDeg) || 0,
      attachedToWall: Boolean(body.attachedToWall),
      hangingPergola: Boolean(body.hangingPergola),
      hangerCount:
        typeof body.hangerCount === 'number'
          ? Math.min(8, Math.max(1, Math.round(Number(body.hangerCount))))
          : 2,
      lamellaGapCm: Number(body.lamellaGapCm) || 2,
      beamLed: Boolean(body.beamLed),
      lamellaStanding: Boolean(body.lamellaStanding),
      lamellaAlongWidth: Boolean(body.lamellaAlongWidth),
      postProfileId: typeof body.postProfileId === 'string' ? body.postProfileId : null,
      beamProfileId: typeof body.beamProfileId === 'string' ? body.beamProfileId : null,
      dividerProfileId: typeof body.dividerProfileId === 'string' ? body.dividerProfileId : null,
      lamellaProfileId: typeof body.lamellaProfileId === 'string' ? body.lamellaProfileId : null,
    }
  }
  
  // New plan editor format - just return null, will be handled separately
  return null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const offerId = params.id
  const { data: row, error: fe } = await supabase
    .from('offers')
    .select('company_id, configurator_meta')
    .eq('id', offerId)
    .single()
  if (fe || !row) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }
  const access = await requireCompanyAccess(req, row.company_id as string)
  if (!access.authorized) return access.error

  let locale = 'he'
  try {
    const body = await req.json()
    
    // Check if this is new plan editor format
    const isPlanFormat = Array.isArray(body.planPolygon)
    
    if (isPlanFormat) {
      // New plan editor format
      if (typeof body.locale === 'string' && body.locale.length <= 5) locale = body.locale

      const pinnedParams = pinPlanParamsFromBody(body as Record<string, unknown>)
      const bodyWithPin = { ...body, planParams: pinnedParams }
      if (bodyWithPin.plan && typeof bodyWithPin.plan === 'object') {
        bodyWithPin.plan = { ...(bodyWithPin.plan as object), params: pinnedParams }
      }
      
      const screenshot = typeof body.screenshot === 'string' ? body.screenshot : ''
      const configForRow = { ...bodyWithPin } as Record<string, unknown>
      delete configForRow.screenshot
      delete configForRow.locale
      
      const { data: inserted, error: insErr } = await supabase
        .from('pergola_config_submissions')
        .insert({
          config: configForRow as Record<string, unknown>,
          screenshot: screenshot && screenshot.length < 50000 ? screenshot : null,
          offer_id: offerId,
        })
        .select('id')
        .single()

      if (insErr) {
        console.error('[configurator-save] insert', insErr)
        return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
      }

      const submissionId = inserted?.id as string

      let previewUrl: string | null = null
      if (screenshot.startsWith('data:image/')) {
        previewUrl = await uploadConfiguratorScreenshot(supabase, offerId, screenshot)
      }

      const prevMeta =
        row.configurator_meta !== null && typeof row.configurator_meta === 'object'
          ? (row.configurator_meta as Record<string, unknown>)
          : {}

      // Update offer configurator_meta with plan data (merge — keep edit/view URLs).
      // supportBeams is a top-level plan field: persist when present; keep previous when omitted.
      const nextMeta: Record<string, unknown> = {
        ...prevMeta,
        planPolygon: bodyWithPin.planPolygon,
        planWallIndices: bodyWithPin.planWallIndices,
        planParams: pinnedParams,
        previewImageUrl: previewUrl ?? prevMeta.previewImageUrl,
        submissionId,
      }
      if (Object.prototype.hasOwnProperty.call(bodyWithPin, 'supportBeams')) {
        if (bodyWithPin.supportBeams == null) delete nextMeta.supportBeams
        else nextMeta.supportBeams = bodyWithPin.supportBeams
      }
      // Also store a full plan snapshot so unknown top-level keys round-trip.
      if (bodyWithPin.plan && typeof bodyWithPin.plan === 'object') {
        nextMeta.plan = bodyWithPin.plan
      } else {
        nextMeta.plan = {
          ...(typeof prevMeta.plan === 'object' && prevMeta.plan ? (prevMeta.plan as object) : {}),
          schemaVersion: 1,
          polygon: bodyWithPin.planPolygon,
          wallIndices: bodyWithPin.planWallIndices ?? [],
          params: pinnedParams,
          confirmed: false,
          ...(Object.prototype.hasOwnProperty.call(bodyWithPin, 'supportBeams')
            ? bodyWithPin.supportBeams == null
              ? {}
              : { supportBeams: bodyWithPin.supportBeams }
            : prevMeta.supportBeams != null
              ? { supportBeams: prevMeta.supportBeams }
              : {}),
        }
        if (
          Object.prototype.hasOwnProperty.call(bodyWithPin, 'supportBeams') &&
          bodyWithPin.supportBeams == null &&
          nextMeta.plan &&
          typeof nextMeta.plan === 'object'
        ) {
          delete (nextMeta.plan as Record<string, unknown>).supportBeams
        }
      }

      await supabase
        .from('offers')
        .update({
          configurator_meta: nextMeta,
        })
        .eq('id', offerId)

      return NextResponse.json({
        success: true,
        submissionId,
        planPolygon: bodyWithPin.planPolygon,
        planWallIndices: bodyWithPin.planWallIndices,
        planParams: pinnedParams,
        supportBeams: nextMeta.supportBeams ?? null,
        plan: nextMeta.plan ?? null,
      })
    }
    
    // Old rectangular format
    const pergolaParams = parseParams(body as Record<string, unknown>)
    if (!pergolaParams) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    if (typeof body.locale === 'string' && body.locale.length <= 5) locale = body.locale

    const screenshot = typeof body.screenshot === 'string' ? body.screenshot : ''
    const configForRow = { ...body } as Record<string, unknown>
    delete configForRow.screenshot
    delete configForRow.locale

    const { data: inserted, error: insErr } = await supabase
      .from('pergola_config_submissions')
      .insert({
        config: configForRow as Record<string, unknown>,
        screenshot: screenshot && screenshot.length < 50000 ? screenshot : null,
        offer_id: offerId,
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[configurator-save] insert', insErr)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    const submissionId = inserted?.id as string

    let previewUrl: string | null = null
    if (screenshot.startsWith('data:image/')) {
      previewUrl = await uploadConfiguratorScreenshot(supabase, offerId, screenshot)
    }

    const { data: offerSnap } = await supabase
      .from('offers')
      .select('configurator_meta')
      .eq('id', offerId)
      .single()
    const existingMeta = offerSnap?.configurator_meta as
      | { editUrl?: string | null; viewUrl?: string | null }
      | null
      | undefined

    let editUrl: string | null =
      typeof existingMeta?.editUrl === 'string' && existingMeta.editUrl.startsWith('http')
        ? existingMeta.editUrl
        : null
    let customerUrl: string | null =
      typeof existingMeta?.viewUrl === 'string' && existingMeta.viewUrl.startsWith('http')
        ? existingMeta.viewUrl
        : null

    const prefill = {
      shapeType: pergolaParams.shapeType,
      widthCm: pergolaParams.widthCm,
      depthCm: pergolaParams.depthCm,
      heightCm: pergolaParams.heightCm,
      arm1WidthCm: pergolaParams.arm1WidthCm,
      arm1DepthCm: pergolaParams.arm1DepthCm,
      color: pergolaParams.color,
      lamellaAngleDeg: pergolaParams.lamellaAngleDeg,
      attachedToWall: pergolaParams.attachedToWall,
      hangingPergola: pergolaParams.hangingPergola ?? false,
      hangerCount: pergolaParams.hangerCount ?? 2,
      lamellaGapCm: pergolaParams.lamellaGapCm,
      beamLed: pergolaParams.beamLed,
      lamellaStanding: pergolaParams.lamellaStanding,
      lamellaAlongWidth: pergolaParams.lamellaAlongWidth,
      postProfileId: pergolaParams.postProfileId,
      beamProfileId: pergolaParams.beamProfileId,
      dividerProfileId: pergolaParams.dividerProfileId,
      lamellaProfileId: pergolaParams.lamellaProfileId,
    }

    if (!editUrl || !customerUrl) {
      const minted = await mintConfiguratorLinkForOffer(supabase, offerId, locale)
      editUrl = minted.editUrl
      customerUrl = minted.customerUrl
      await supabase
        .from('configurator_link_tokens')
        .update({ prefill_config: prefill })
        .eq('id', minted.tokenRowId)
    } else {
      const { data: tokRow } = await supabase
        .from('configurator_link_tokens')
        .select('id')
        .eq('offer_id', offerId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tokRow?.id) {
        await supabase.from('configurator_link_tokens').update({ prefill_config: prefill }).eq('id', tokRow.id)
      }
    }

    const { skippedNonRectangle } = await applyConfiguratorSyncToOffer(supabase, offerId, {
      params: pergolaParams,
      previewImageUrl: previewUrl,
      editUrl,
      customerViewUrl: customerUrl,
      submissionId,
    })

    return NextResponse.json({
      success: true,
      submissionId,
      skippedNonRectangle,
      editUrl,
      customerUrl,
    })
  } catch (e) {
    console.error('[configurator-save]', e)
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
