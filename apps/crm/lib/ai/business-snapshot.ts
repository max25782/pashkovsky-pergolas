export interface SnapshotDeal {
  stage: string | null
  price: number | null
  projectType: string | null
  createdAt: string
  updatedAt: string
}

export interface SnapshotLead {
  source: string | null
  status: string | null
  createdAt: string
}

export interface SnapshotInput {
  now: Date
  deals: SnapshotDeal[]
  leads: SnapshotLead[]
  activeWorkers: number
  shiftsLast30Days: number
  /** Stage keys whose role is completed. The aluminium key is done. */
  closedStageKeys?: string[]
}

/** Kept under a few thousand characters. The session-state docs describe the field and do not publish a byte cap. */
export const SNAPSHOT_CHAR_LIMIT = 4000
const CACHE_TTL_MS = 10 * 60 * 1000

const cache = new Map<string, { at: number; text: string }>()

export function readSnapshotCache(companyId: string, nowMs: number): string | null {
  const row = cache.get(companyId)
  if (!row) return null
  if (nowMs - row.at > CACHE_TTL_MS) {
    cache.delete(companyId)
    return null
  }
  return row.text
}

export function writeSnapshotCache(companyId: string, text: string, nowMs: number): void {
  cache.set(companyId, { at: nowMs, text })
}

export function clearSnapshotCache(): void {
  cache.clear()
}

function daysAgo(now: Date, iso: string): number {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return 0
  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000))
}

function inWindow(iso: string, now: Date, days: number): boolean {
  return daysAgo(now, iso) <= days
}

function money(value: number): string {
  return Math.round(value).toString()
}

export function buildBusinessSnapshot(input: SnapshotInput): string {
  const closedKeys = new Set(input.closedStageKeys?.length ? input.closedStageKeys : ['done'])
  const byStage: Record<string, number> = {}
  let open = 0
  let closed = 0
  let pipeline = 0
  let closedValue = 0
  for (const deal of input.deals) {
    const stage = deal.stage || 'unknown'
    byStage[stage] = (byStage[stage] ?? 0) + 1
    const price = deal.price ?? 0
    if (closedKeys.has(stage)) {
      closed += 1
      closedValue += price
    } else {
      open += 1
      pipeline += price
    }
  }
  const leads30 = input.leads.filter((lead) => inWindow(lead.createdAt, input.now, 30)).length
  const leads90 = input.leads.filter((lead) => inWindow(lead.createdAt, input.now, 90)).length
  const deals30 = input.deals.filter((deal) => inWindow(deal.createdAt, input.now, 30)).length
  const deals90 = input.deals.filter((deal) => inWindow(deal.createdAt, input.now, 90)).length
  const sources: Record<string, number> = {}
  for (const lead of input.leads) {
    if (!inWindow(lead.createdAt, input.now, 90)) continue
    const source = lead.source || 'unknown'
    sources[source] = (sources[source] ?? 0) + 1
  }
  const topSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => `${source}:${count}`)
    .join(', ')
  const stuck = input.deals
    .filter((deal) => !closedKeys.has(deal.stage || '') && daysAgo(input.now, deal.updatedAt) >= 14)
    .sort((a, b) => daysAgo(input.now, b.updatedAt) - daysAgo(input.now, a.updatedAt))
    .slice(0, 5)
    .map((deal) => `${deal.projectType || 'project'}@${deal.stage || 'unknown'}:${daysAgo(input.now, deal.updatedAt)}d`)
    .join(', ')
  const recent = [...input.deals]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 5)
    .map((deal) => `${deal.projectType || 'project'}:${deal.stage || 'unknown'}`)
    .join(', ')
  const stages = Object.entries(byStage)
    .map(([stage, count]) => `${stage}:${count}`)
    .join(', ')
  const ratio = (deals: number, leads: number) => (leads === 0 ? 'n/a' : `${deals}/${leads}`)
  const text = [
    `stages ${stages || 'none'}`,
    `open ${open} closed ${closed}`,
    `closed_value ${money(closedValue)} pipeline ${money(pipeline)}`,
    `new_deals_per_leads 30d ${ratio(deals30, leads30)} 90d ${ratio(deals90, leads90)}`,
    `lead_sources_90d ${topSources || 'none'}`,
    `stuck_14d ${stuck || 'none'}`,
    `workers_active ${input.activeWorkers} shifts_30d ${input.shiftsLast30Days}`,
    `recent ${recent || 'none'}`,
  ].join('\n')
  return text.length <= SNAPSHOT_CHAR_LIMIT ? text : `${text.slice(0, SNAPSHOT_CHAR_LIMIT - 1)}…`
}
