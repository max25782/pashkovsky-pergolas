'use client'

import type { Lead } from './lead-types'
import { PhoneActions } from './PhoneActions'
import { useCRMTranslations } from './useCRMTranslations'
import { followUpTiming, formatFollowUpDate, isFollowUpDue } from './follow-up'

interface FollowUpStripProps {
  leads: Lead[]
  onOpen: (lead: Lead) => void
  onDone: (lead: Lead) => void
}

export function FollowUpStrip({ leads, onOpen, onDone }: FollowUpStripProps) {
  const t = useCRMTranslations()
  const due = leads
    .filter((lead) => isFollowUpDue(lead.follow_up_at))
    .sort((a, b) => {
      const aOverdue = followUpTiming(a.follow_up_at) === 'overdue'
      const bOverdue = followUpTiming(b.follow_up_at) === 'overdue'
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
      return new Date(a.follow_up_at ?? 0).getTime() - new Date(b.follow_up_at ?? 0).getTime()
    })

  if (due.length === 0) return null

  return (
    <section className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
      <h2 className="mb-2 text-sm font-semibold text-amber-100">
        {t.leads.followUpToCall} · {due.length}
      </h2>
      <ul className="space-y-2">
        {due.map((lead) => {
          const timing = followUpTiming(lead.follow_up_at)
          return (
            <li key={lead.id} className="flex flex-wrap items-center gap-3 rounded-md bg-black/20 px-3 py-2">
              <button
                type="button"
                onClick={() => onOpen(lead)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="font-medium text-white">{lead.name}</span>
                <span
                  className={`ms-2 text-xs ${timing === 'overdue' ? 'text-red-300' : 'text-amber-200'}`}
                >
                  {lead.follow_up_at ? formatFollowUpDate(lead.follow_up_at) : ''}
                  {timing === 'overdue' ? ` · ${t.leads.followUpOverdue}` : ` · ${t.leads.followUpToday}`}
                </span>
              </button>
              <div onClick={(event) => event.stopPropagation()}>
                <PhoneActions phone={lead.phone ?? ''} leadName={lead.name ?? undefined} variant="compact" />
              </div>
              <button
                type="button"
                onClick={() => onDone(lead)}
                className="rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
              >
                {t.leads.followUpDone}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
