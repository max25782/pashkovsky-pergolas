"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Phone, MessageCircle, ExternalLink, Plus, LayoutDashboard,
  CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TOUCH_RESULTS, type TouchResult, type Lead } from './lead-types'

// ─── helpers ──────────────────────────────────────────────────────────────────

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function localDateStr(d = new Date()): string {
  return d.toLocaleDateString('sv')       // YYYY-MM-DD
}

/** Computes date range strings for a given date string (YYYY-MM-DD) or today. */
function dateBounds(dateStr?: string) {
  const base = dateStr ?? localDateStr()
  return {
    start: `${base}T00:00:00.000Z`,
    end:   `${base}T23:59:59.999Z`,
    today: base,
  }
}

function tomorrowStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function hebrewDateHeader(name: string, dateOverride?: string) {
  const now = dateOverride ? new Date(dateOverride + 'T12:00:00') : new Date()
  const day  = DAYS_HE[now.getDay()]
  const date = `${now.getDate()} ב${MONTHS_HE[now.getMonth()]}`
  const firstName = name.split(' ')[0]
  return `${day}, ${date} · ${firstName}`
}

/**
 * Unified waiting badge format (point 1):
 *  < 60 min  → "MM:SS דק׳"  (live, ticks every second)
 *  < 24 h    → "לפני N שעות"
 *  ≥ 24 h    → "לפני N ימים"
 * referenceIso = next_action_at if set, else created_at.
 */
function formatWaitingBadge(referenceIso: string, nowMs: number): string {
  const elapsedMs = nowMs - new Date(referenceIso).getTime()
  if (elapsedMs < 0) return '0:00 דק׳'
  const totalSec = Math.floor(elapsedMs / 1000)
  const totalMin = Math.floor(totalSec / 60)
  if (totalMin < 60) {
    const m = totalMin
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, '0')} דק׳`
  }
  const totalHours = Math.floor(elapsedMs / 3_600_000)
  if (totalHours < 24) return `לפני ${totalHours} שעות`
  const days = Math.floor(elapsedMs / 86_400_000)
  return `לפני ${days} ימים`
}

/** True if the badge needs per-second updates (< 60 min elapsed) */
function badgeIsLive(referenceIso: string, nowMs: number): boolean {
  return nowMs - new Date(referenceIso).getTime() < 3_600_000
}

function waLink(phone: string, name: string) {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${digits}?text=${encodeURIComponent(`שלום ${name}`)}`
}

function daysDiff(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function formatDateIL(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatHHMM(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}

const AVATAR_PALETTE = [
  { bg: '#2a3550', text: '#a9cdff' },
  { bg: '#3a2a50', text: '#d9b8ff' },
  { bg: '#4a3a1e', text: '#f0c48a' },
  { bg: '#1f2a22', text: '#8fdcae' },
]

function avatarColors(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  waiting:         { bg: '#1c1e26', text: '#9aa1ad', label: 'ממתין' },
  no_answer:       { bg: '#2d2000', text: '#f0c48a', label: 'לא ענה' },
  busy:            { bg: '#2d2000', text: '#f0c48a', label: 'תפוס' },
  thinking:        { bg: '#0d1a2d', text: '#a9cdff', label: 'חושב' },
  meeting_set:     { bg: '#1e1030', text: '#d9b8ff', label: 'נקבעה פגישה' },
  visited:         { bg: '#0f1e14', text: '#8fdcae', label: 'בוצע ביקור' },
  not_relevant:    { bg: '#1e0c0c', text: '#f0a6a0', label: 'לא רלוונטי' },
  not_interested:  { bg: '#1e0c0c', text: '#f0a6a0', label: 'לא מעוניין' },
  lost_contact:    { bg: '#1a1a1a', text: '#666',    label: 'אובד קשר' },
}

// ─── types ────────────────────────────────────────────────────────────────────

interface TodayLead extends Lead {
  _offerDate?: string | null
}

interface LeadTouch {
  lead_id: string
  touched_at: string
  result?: string | null
  note?: string | null
  next_action_at?: string | null
}

// ─── touch dialog ─────────────────────────────────────────────────────────────

interface TouchDialogProps {
  lead: TodayLead
  onClose: () => void
  onSaved: (lead: TodayLead, result: TouchResult, nextDate: string) => void
}

function TouchDialog({ lead, onClose, onSaved }: TouchDialogProps) {
  const [result, setResult] = useState<TouchResult | ''>('')
  const [nextDate, setNextDate] = useState('')
  const [note, setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')

  useEffect(() => {
    const tomorrow = new Date(Date.now() + 86_400_000)
    setNextDate(localDateStr(tomorrow))
  }, [])

  async function handleSave() {
    if (!result)   { setErr('חובה לבחור תוצאה'); return }
    if (!nextDate) { setErr('חובה לקבוע תאריך לפנייה הבאה'); return }
    setSaving(true); setErr('')
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('record_lead_touch', {
        p_lead_id:        lead.id,
        p_touch_type:     'call',
        p_result:         result,
        p_note:           note || null,
        p_next_action_at: new Date(nextDate + 'T00:00:00').toISOString(),
      })
      if (error) throw error
      onSaved(lead, result, nextDate)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const RESULT_LABELS: Record<string, string> = {
    'דיברנו': 'דיברנו', 'לא ענה': 'לא ענה', 'תפוס': 'תפוס', 'דחה': 'דחה', 'לא רלוונטי': 'לא רלוונטי',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" dir="rtl"
        style={{ background: '#14171d', border: '1px solid #272b34' }}>
        <h2 className="text-base font-semibold text-white mb-0.5">{lead.name}</h2>
        <p className="text-sm mb-5" style={{ color: '#9aa1ad' }}>{lead.phone}</p>

        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9aa1ad' }}>
          תוצאת הפנייה
        </p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {TOUCH_RESULTS.map((r) => (
            <button key={r} onClick={() => setResult(r)}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: result === r ? '#2563eb' : '#1a1e26',
                border: `1px solid ${result === r ? '#3b7aff' : '#272b34'}`,
                color: result === r ? '#fff' : '#c9cdd6',
              }}>
              {RESULT_LABELS[r] ?? r}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#9aa1ad' }}>
          תאריך פנייה הבאה
        </label>
        <input type="date" value={nextDate} min={localDateStr()}
          onChange={(e) => setNextDate(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#fff' }}
        />

        <textarea placeholder="הערה (אופציונלי)" value={note} rows={2}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#fff' }}
        />

        {err && <p className="text-sm mb-3" style={{ color: '#f0a6a0' }}>{err}</p>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg font-semibold py-2.5 text-sm transition-colors disabled:opacity-50"
            style={{ background: '#1f7a4d', color: '#fff' }}>
            {saving ? '...' : 'סיים פנייה'}
          </button>
          <button onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#9aa1ad' }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── stat tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  title: string
  value: number
  subtitle: string
  bg: string
  border: string
  accent: string
}

function StatTile({ title, value, subtitle, bg, border, accent }: StatTileProps) {
  return (
    <div className="rounded-[10px] flex flex-col justify-between"
      style={{ background: bg, border: `1px solid ${border}`, padding: '13px 15px', minHeight: 90 }}>
      <p className="text-sm font-medium leading-tight" style={{ color: accent }}>{title}</p>
      <p className="text-3xl font-bold mt-1 text-white">{value}</p>
      <p className="text-xs mt-1" style={{ color: accent }}>{subtitle}</p>
    </div>
  )
}

// ─── SLA card ─────────────────────────────────────────────────────────────────

interface SlaCardProps {
  lead: TodayLead
  nowMs: number
  onCall: (lead: TodayLead) => void
}

function SlaCard({ lead, nowMs, onCall }: SlaCardProps) {
  // Reference time: next_action_at if set, otherwise created_at
  const refIso = lead.next_action_at ?? lead.created_at!
  const badge = formatWaitingBadge(refIso, nowMs)
  const isLive = badgeIsLive(refIso, nowMs)

  // Body line: note or source only — time is in the badge
  const bodyLine = lead.last_message?.slice(0, 70) ?? lead.notes?.slice(0, 70) ?? (lead.source ?? 'facebook')

  return (
    <div className="rounded-xl" style={{
      background: '#14171d', border: '1px solid #5c3d16',
      padding: '12px 14px', marginBottom: 6,
    }}>
      {/* row 1: name + city + badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-white leading-tight truncate" style={{ fontSize: 15 }}>
            {lead.name}
          </span>
          {lead.city && (
            <span className="text-xs shrink-0" style={{ color: '#9aa1ad' }}>{lead.city}</span>
          )}
        </div>
        {/* Unified waiting badge */}
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{
            background: isLive ? '#f59e0b' : '#4a3a1e',
            color: isLive ? '#0f1115' : '#f0c48a',
            borderRadius: 999,
          }}>
          {badge}
        </span>
      </div>
      {/* row 2: note or source */}
      <p className="text-xs mb-2 truncate" style={{ color: '#9aa1ad' }}>{bodyLine}</p>
      {/* row 3: compact buttons */}
      <div className="flex gap-2">
        <button onClick={() => onCall(lead)}
          className="flex items-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors"
          style={{ background: '#1f7a4d', color: '#fff', paddingTop: 5, paddingBottom: 5 }}>
          <Phone className="h-3 w-3" />
          התקשר
        </button>
        <a href={waLink(lead.phone, lead.name)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors"
          style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#9aa1ad', paddingTop: 5, paddingBottom: 5 }}>
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      </div>
    </div>
  )
}

// ─── overdue row ──────────────────────────────────────────────────────────────

interface OverdueRowProps {
  lead: TodayLead
  onOpen: (lead: TodayLead) => void
}

function OverdueRow({ lead, onOpen }: OverdueRowProps) {
  const days = daysDiff(lead.next_action_at!)
  const tries = lead.attempt_count ?? 0
  const subLine = tries > 1
    ? `ניסיון ${tries} · באיחור ${days} ימים`
    : `מעקב היה ל-${formatDateIL(lead.next_action_at!)} · באיחור ${days} ימים`

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl"
      style={{
        background: '#14171d', border: '1px solid #5e2b28',
        padding: '12px 14px', marginBottom: 6,
      }}>
      <div className="min-w-0">
        <p className="font-medium truncate text-white" style={{ fontSize: 15 }}>{lead.name}</p>
        <p className="text-xs mt-0.5" style={{ color: '#f0a6a0' }}>{subLine}</p>
      </div>
      <button onClick={() => onOpen(lead)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
        style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#9aa1ad' }}>
        פתח
      </button>
    </div>
  )
}

// ─── follow-up row ────────────────────────────────────────────────────────────

interface FollowUpRowProps {
  lead: TodayLead
  todayTouch?: LeadTouch
  onCall: (lead: TodayLead) => void
}

function FollowUpRow({ lead, todayTouch, onCall }: FollowUpRowProps) {
  const done = !!todayTouch
  const av = avatarColors(lead.name)
  const statusDef = STATUS_PILL[lead.status ?? 'waiting']
  const router = useRouter()

  let secondLine: string
  if (done && todayTouch) {
    const t = formatHHMM(todayTouch.touched_at)
    const nextD = todayTouch.next_action_at ? formatDateIL(todayTouch.next_action_at) : '—'
    secondLine = `דיברנו ב-${t} · מעקב חדש נקבע ל-${nextD}`
  } else if (lead._offerDate) {
    secondLine = `הצעה נשלחה ${formatDateIL(lead._offerDate)}`
  } else if (lead.last_touch_result && lead.next_action_at) {
    secondLine = `${lead.last_touch_result} · ${formatDateIL(lead.next_action_at)}`
  } else {
    secondLine = `הגיע ${formatDateIL(lead.created_at!)} · ${lead.source ?? 'facebook'}`
  }

  function ActionButton() {
    if (done) return (
      <span className="text-xs font-semibold shrink-0" style={{ color: '#8fdcae' }}>בוצע</span>
    )
    if (lead.status === 'visited') return (
      <button
        onClick={() => router.push(`/app/quick-offer?name=${encodeURIComponent(lead.name)}&phone=${encodeURIComponent(lead.phone)}`)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ background: '#2563eb', color: '#fff' }}>
        בנה הצעה
      </button>
    )
    if (lead.status === 'meeting_set') return (
      <button onClick={() => onCall(lead)}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#9aa1ad' }}>
        אשר
      </button>
    )
    return (
      <button onClick={() => onCall(lead)}
        className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ background: '#1f7a4d', color: '#fff' }}>
        <Phone className="h-3 w-3" />
        התקשר
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-[10px] mb-2"
      style={{
        background: '#1a1e26', border: '1px solid #2a2f3a',
        padding: '12px 14px',
        opacity: done ? 0.55 : 1,
      }}>
      {/* avatar */}
      <div className="shrink-0 flex items-center justify-center rounded-full font-semibold text-sm"
        style={{ width: 34, height: 34, background: av.bg, color: av.text }}>
        {done
          ? <CheckCircle2 className="h-4 w-4" style={{ color: '#8fdcae' }} />
          : initials(lead.name)}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white" style={{
            fontSize: 15,
            textDecoration: done ? 'line-through' : 'none',
          }}>
            {lead.name}
          </span>
          {(lead.city || lead.source) && (
            <span className="text-xs" style={{ color: '#9aa1ad' }}>
              {[lead.city, lead.source].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#9aa1ad' }}>{secondLine}</p>
      </div>

      {/* status pill */}
      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: statusDef?.bg ?? '#1c1e26', color: statusDef?.text ?? '#9aa1ad' }}>
        {statusDef?.label ?? lead.status}
      </span>

      <ActionButton />
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function TodayQueue() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?date=YYYY-MM-DD overrides "today" for simulating future days
  const debugDate = searchParams.get('date') ?? undefined
  const [nowMs, setNowMs] = useState(Date.now())

  // data
  const [userName, setUserName]       = useState('')
  const [userId, setUserId]           = useState<string | null>(null)
  const [slaLeads, setSlaLeads]       = useState<TodayLead[]>([])
  const [overdueLeads, setOverdueLeads] = useState<TodayLead[]>([])
  const [todayLeads, setTodayLeads]   = useState<TodayLead[]>([])
  const [closedWeek, setClosedWeek]   = useState(0)
  const [todayTouches, setTodayTouches] = useState<Map<string, LeadTouch>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [touchTarget, setTouchTarget] = useState<TodayLead | null>(null)
  const [openLead, setOpenLead]       = useState<TodayLead | null>(null)

  // live timer
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => { // eslint-disable-line react-hooks/exhaustive-deps
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      setUserId(uid)

      // user name — try public.users first, fall back to auth metadata, then email
      if (uid) {
        const { data: pub } = await supabase.from('users').select('full_name').eq('id', uid).maybeSingle()
        const metaName = user?.user_metadata?.full_name as string | undefined
        setUserName(pub?.full_name || metaName || user?.email?.split('@')[0] || '')
      }

      // company
      const meRes = await fetch('/api/companies/me')
      const me = meRes.ok ? await meRes.json() : null
      const companyId: string | null = me?.company_id ?? null
      if (!companyId) return

      const { start, end, today } = dateBounds(debugDate)
      const tmrStr   = tomorrowStr(today)
      const tmrStart = `${tmrStr}T00:00:00.000Z`
      const tmrEnd   = `${tmrStr}T23:59:59.999Z`

      const [
        { data: allDue },
        { count: meetingTomorrow },
      ] = await Promise.all([
        // All my leads due today or overdue (next_action_at <= today)
        uid
          ? supabase.from('leads').select('*')
            .eq('company_id', companyId)
            .eq('lead_owner_id', uid)
            .lte('next_action_at', end)
            .not('status', 'in', '(not_relevant,not_interested,lost_contact)')
            .order('next_action_at', { ascending: true })
            .limit(300)
          : Promise.resolve({ data: [], error: null }),

        // Tile 4: meeting_set leads with next_action_at = tomorrow
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'meeting_set')
          .gte('next_action_at', tmrStart)
          .lte('next_action_at', tmrEnd),
      ])

      // Split: SLA = created today AND no touch; Follow-ups = everything else
      const sla: Lead[] = []
      const todayFollows: Lead[] = []
      for (const lead of (allDue ?? [])) {
        const createdToday = lead.created_at >= start && lead.created_at <= end
        if (createdToday && !lead.last_touch_result) {
          sla.push(lead)
        } else {
          todayFollows.push(lead)
        }
      }

      // Overdue = follow-ups with next_action_at before today
      const overdueLeadsLocal = todayFollows.filter(
        l => l.next_action_at && new Date(l.next_action_at) < new Date(start)
      )
      setOverdueLeads(overdueLeadsLocal)

      const todayArr: TodayLead[] = todayFollows.map(l => ({ ...l }))

      // fetch touches for today's leads to mark "done"
      if (todayArr.length > 0) {
        const ids = todayArr.map(l => l.id)
        const { data: touches } = await supabase.from('lead_touches')
          .select('lead_id, touched_at, result, note, next_action_at')
          .in('lead_id', ids)
          .gte('touched_at', start)
          .order('touched_at', { ascending: false })

        const tm = new Map<string, LeadTouch>()
        for (const t of (touches ?? []) as LeadTouch[]) {
          if (!tm.has(t.lead_id)) tm.set(t.lead_id, t)
        }
        setTodayTouches(tm)

        // fetch offer dates for leads that have deals
        const { data: deals } = await supabase.from('deals').select('id, lead_id')
          .in('lead_id', ids)
        if (deals && deals.length > 0) {
          const dealIds = deals.map((d: { id: string }) => d.id)
          const { data: offers } = await supabase.from('offers')
            .select('deal_id, created_at')
            .in('deal_id', dealIds)
            .order('created_at', { ascending: false })

          const offerByDeal = new Map<string, string>()
          for (const o of (offers ?? []) as { deal_id: string; created_at: string }[]) {
            if (!offerByDeal.has(o.deal_id)) offerByDeal.set(o.deal_id, o.created_at)
          }
          const offerByLead = new Map<string, string>()
          for (const d of deals as { id: string; lead_id: string }[]) {
            const oc = offerByDeal.get(d.id)
            if (oc) offerByLead.set(d.lead_id, oc)
          }
          for (const l of todayArr) {
            l._offerDate = offerByLead.get(l.id) ?? null
          }
        }
      }

      setSlaLeads(sla ?? [])
      setTodayLeads(todayArr)
      setClosedWeek(meetingTomorrow ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [debugDate]) // reload when debug date changes

  // stats
  const oldestSla = slaLeads[0]
  const slaBadge = oldestSla
    ? formatWaitingBadge(oldestSla.next_action_at ?? oldestSla.created_at!, nowMs)
    : null
  const doneTodayCount = todayLeads.filter(l => todayTouches.has(l.id)).length
  const remainingToday = todayLeads.length - doneTodayCount

  function handleTouchSaved(lead: TodayLead, result: TouchResult, nextDate: string) {
    setTouchTarget(null)
    // Optimistically move to done
    const touch: LeadTouch = {
      lead_id: lead.id,
      touched_at: new Date().toISOString(),
      result,
      next_action_at: new Date(nextDate + 'T00:00:00').toISOString(),
    }
    setTodayTouches(prev => new Map(prev).set(lead.id, touch))
    // Remove from SLA list
    setSlaLeads(prev => prev.filter(l => l.id !== lead.id))
    // Remove from overdue list
    setOverdueLeads(prev => prev.filter(l => l.id !== lead.id))
  }

  const dateHeader = hebrewDateHeader(userName, debugDate)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#0e0f12', fontFamily: "'Rubik', sans-serif" }}>
        <p style={{ color: '#9aa1ad' }}>טוען...</p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pb-8"
      style={{ background: '#0e0f12', fontFamily: "'Rubik', sans-serif", color: '#fff' }}>

      {/* ── Header: absolute positioning to sidestep RTL flex issues ── */}
      <div style={{ position: 'relative', height: 60, borderBottom: '1px solid #1a1e26' }}>
        {/* Buttons: pinned to the start (left in LTR context) */}
        <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/app/admin/leads')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ background: '#1a1e26', border: '1px solid #272b34', color: '#9aa1ad' }}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            לוח
          </button>
          <button onClick={() => router.push('/app/quick-offer')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ background: '#2563eb', color: '#fff' }}>
            <Plus className="h-3.5 w-3.5" />
            ליד חדש
          </button>
        </div>
        {/* Title: pinned to right edge */}
        <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#9aa1ad', fontSize: 14 }}>{dateHeader}</span>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: 0 }}>היום</h1>
        </div>
      </div>

      <div className="px-6 pt-5">
        {/* ── 4 stat tiles ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile
            title="ממתינים לתגובה ראשונה"
            value={slaLeads.length}
            subtitle={slaBadge ? `הוותיק ביותר — ${slaBadge}` : 'אין לידים ממתינים'}
            bg="#221a12" border="#5c3d16" accent="#f0c48a"
          />
          <StatTile
            title="בפיגור"
            value={overdueLeads.length}
            subtitle="מעקב שעבר תאריך"
            bg="#221415" border="#5e2b28" accent="#f0a6a0"
          />
          <StatTile
            title="מעקבים להיום"
            value={todayLeads.length}
            subtitle={`${doneTodayCount} כבר בוצעו`}
            bg="#14171d" border="#272b34" accent="#9aa1ad"
          />
          <StatTile
            title="פגישות מחר"
            value={closedWeek}
            subtitle="לידים עם meeting_set"
            bg="#13201a" border="#245c3c" accent="#8fdcae"
          />
        </div>

        {/* ── Two-column body ────────────────────────────────────────── */}
        <div className="flex gap-4 items-start">

          {/* LEFT: SLA + overdue */}
          <div style={{ width: 420, minWidth: 420 }}>
            {/* SLA section */}
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full" style={{ width: 8, height: 8, background: '#f59e0b', display: 'inline-block' }} />
              <span className="font-semibold" style={{ fontSize: 15 }}>עכשיו · שעון SLA רץ</span>
            </div>

            {slaLeads.length === 0 ? (
              <div className="rounded-xl flex flex-col items-center justify-center py-8 gap-2"
                style={{ background: '#14171d', border: '1px solid #272b34' }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: '#8fdcae' }} />
                <p className="text-sm" style={{ color: '#9aa1ad' }}>אין לידים חדשים ממתינים</p>
              </div>
            ) : (
              slaLeads.map(lead => (
                <SlaCard key={lead.id} lead={lead} nowMs={nowMs} onCall={setTouchTarget} />
              ))
            )}

            {/* Overdue section */}
            {overdueLeads.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-5 mb-3">
                  <span className="rounded-full" style={{ width: 8, height: 8, background: '#ef4444', display: 'inline-block' }} />
                  <span className="font-semibold" style={{ fontSize: 15 }}>פיגור</span>
                  <span className="text-sm" style={{ color: '#9aa1ad' }}>({overdueLeads.length})</span>
                </div>
                {overdueLeads.map(lead => (
                  <OverdueRow key={lead.id} lead={lead}
                    onOpen={(l) => router.push(`/app/admin/leads?id=${l.id}`)} />
                ))}
              </>
            )}
          </div>

          {/* RIGHT: today follow-ups */}
          <div className="flex-1 min-w-0 rounded-xl flex flex-col"
            style={{ background: '#14171d', border: '1px solid #272b34' }}>
            {/* panel header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid #1e2330' }}>
              <span className="font-semibold" style={{ fontSize: 15 }}>מעקבים להיום</span>
              <span style={{ color: '#9aa1ad', fontSize: 13 }}>
                {remainingToday} נותרו
              </span>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              {todayLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <CheckCircle2 className="h-10 w-10" style={{ color: '#8fdcae' }} />
                  <p className="text-sm" style={{ color: '#9aa1ad' }}>אין מעקבים להיום</p>
                </div>
              ) : (
                todayLeads.map(lead => (
                  <FollowUpRow
                    key={lead.id}
                    lead={lead}
                    todayTouch={todayTouches.get(lead.id)}
                    onCall={setTouchTarget}
                  />
                ))
              )}
            </div>

            {/* bottom hint */}
            <div className="mx-4 mb-4 mt-2 rounded-lg px-4 py-3 text-xs leading-relaxed"
              style={{ background: '#101822', border: '1px solid #23364d', color: '#a9cdff' }}>
              אחרי כל שיחה נבחרת תוצאה — דיברנו, לא ענה, תפוס, דחה, לא רלוונטי.
              התאריך הבא נקבע ואין ליד בלי צעד הבא.
            </div>
          </div>
        </div>
      </div>

      {/* Touch dialog */}
      {touchTarget && (
        <TouchDialog
          lead={touchTarget}
          onClose={() => setTouchTarget(null)}
          onSaved={handleTouchSaved}
        />
      )}
    </div>
  )
}
