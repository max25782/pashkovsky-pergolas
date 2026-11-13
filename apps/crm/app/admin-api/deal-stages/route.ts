import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { getUserContextAsync } from '@/lib/middleware/company-context'
import { can, type Role } from '@/lib/permissions'
import {
  countDealsByStage,
  loadCompanyStages,
  resetCompanyStages,
  saveCompanyStages,
} from '@/lib/deals/stage-store'
import {
  STAGE_TEMPLATE_IDS,
  type DealStageDef,
  type StageDraft,
  type StageTemplateId,
} from '@/lib/deals/stages'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface DealStagesResponse {
  stages: DealStageDef[]
  /** The firm has no rows of its own and sees the aluminium set. */
  isDefault: boolean
  /** Owner and admin; manager and salesperson only view. */
  canEdit: boolean
  /** Deals per stage key; only sent to those who can edit. */
  dealCounts?: Record<string, number>
}

/** GET /admin-api/deal-stages: the firm's kanban columns, hidden ones included. */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const userContext = await getUserContextAsync(req)
  const companyId = userContext?.companyId
  if (!companyId) return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })

  try {
    const canEdit = can(userContext.role as Role, 'deal_stages:edit')
    const { stages, isDefault } = await loadCompanyStages(supabase, companyId)
    const body: DealStagesResponse = { stages, isDefault, canEdit }
    if (canEdit) body.dealCounts = await countDealsByStage(supabase, companyId)
    return NextResponse.json(body)
  } catch (error) {
    console.error('GET deal-stages error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load deal stages' },
      { status: 500 },
    )
  }
}

interface PutBody {
  /** The full new list, in order. Existing columns carry their key. */
  stages?: StageDraft[]
  /** Replace the list with an industry template instead. */
  resetToTemplate?: string
  /** For columns that are hidden or removed and hold deals: where to move the deals. */
  moves?: Record<string, string>
  acknowledgeWarnings?: boolean
}

/** PUT /admin-api/deal-stages: owner and admin save the columns. */
export async function PUT(req: NextRequest) {
  const permission = await requirePermissionAsync(req, 'deal_stages:edit')
  if (!permission.authorized) return permission.error as NextResponse
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const companyId = permission.companyId
  if (!companyId) return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  try {
    if (body.resetToTemplate !== undefined) {
      if (!(STAGE_TEMPLATE_IDS as string[]).includes(body.resetToTemplate)) {
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      }
      const result = await resetCompanyStages(supabase, companyId, body.resetToTemplate as StageTemplateId, {
        moves: body.moves,
        acknowledgeWarnings: body.acknowledgeWarnings,
      })
      return respond(result)
    }

    if (!Array.isArray(body.stages)) {
      return NextResponse.json({ error: 'stages must be an array' }, { status: 400 })
    }
    const result = await saveCompanyStages(supabase, companyId, {
      drafts: body.stages,
      moves: body.moves,
      acknowledgeWarnings: body.acknowledgeWarnings,
    })
    return respond(result)
  } catch (error) {
    console.error('PUT deal-stages error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save deal stages' },
      { status: 500 },
    )
  }
}

function respond(
  result:
    | { ok: true; stages: DealStageDef[] }
    | ({ ok: false; status: number } & Record<string, unknown>),
): NextResponse {
  if (result.ok) return NextResponse.json({ stages: result.stages })
  const { ok: _ok, status, ...rest } = result
  void _ok
  return NextResponse.json(rest, { status })
}
