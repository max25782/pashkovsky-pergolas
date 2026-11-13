'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import { authFetch } from '@/lib/api/auth-fetch'
import { useCRMTranslations } from '../useCRMTranslations'
import {
  DEFAULT_STAGES,
  activeStages,
  displayStageKey,
  firstStageKey,
  resolverFor,
  stageLabel,
  type DealStageDef,
  type StageRole,
  type StageRoleResolver,
} from '@/lib/deals/stages'
import type { DealStagesResponse } from '@/app/admin-api/deal-stages/route'

interface StagesSnapshot {
  stages: DealStageDef[]
  canEdit: boolean
  dealCounts: Record<string, number>
  isDefault: boolean
  isReady: boolean
}

const INITIAL: StagesSnapshot = {
  stages: [...DEFAULT_STAGES],
  canEdit: false,
  dealCounts: {},
  isDefault: true,
  isReady: false,
}

// One fetch shared by every component on the page (the table renders a hook per row).
let snapshot: StagesSnapshot = INITIAL
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: StagesSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function refreshDealStages(): Promise<void> {
  inflight = authFetch('/admin-api/deal-stages')
    .then((res) => (res.ok ? (res.json() as Promise<DealStagesResponse>) : null))
    .then((data) => {
      if (!data || !Array.isArray(data.stages)) return
      publish({
        stages: data.stages,
        canEdit: data.canEdit,
        dealCounts: data.dealCounts ?? {},
        isDefault: data.isDefault,
        isReady: true,
      })
    })
    .catch(() => {
      // Keep what is shown: the aluminium set before the first answer, the last answer after.
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface StageOption {
  id: string
  color: string
  label: string
  role: StageRole | null
}

export interface UseDealStages {
  /** Visible columns in order, labelled in the current language. */
  stages: StageOption[]
  /** Every column including hidden ones (settings). */
  allStages: DealStageDef[]
  roleOf: StageRoleResolver
  /** The column a deal is shown in (no stage or an unknown one: the first column). */
  columnOf: (dealStage: string | null | undefined) => string
  /** Key for a new deal. */
  firstKey: string
  labelOf: (key: string | null | undefined) => string
  canEdit: boolean
  dealCounts: Record<string, number>
  isDefault: boolean
  isReady: boolean
  reload: () => Promise<void>
}

/** The firm's kanban columns: what the board, the filters and the deal forms show. */
export function useDealStages(): UseDealStages {
  const t = useCRMTranslations()
  const locale = useLocale()
  const state = useSyncExternalStore(subscribe, () => snapshot, () => INITIAL)

  useEffect(() => {
    if (!snapshot.isReady && !inflight) void refreshDealStages()
  }, [])

  const defaultName = useCallback(
    (key: string) => (t.deals.stages as Record<string, string | undefined>)[key],
    [t.deals.stages],
  )

  return useMemo(() => {
    const labelFor = (stage: DealStageDef) => stageLabel(stage, locale, defaultName)
    const stages = activeStages(state.stages).map((s) => ({
      id: s.key,
      color: s.color,
      label: labelFor(s),
      role: s.role,
    }))
    return {
      stages,
      allStages: state.stages,
      roleOf: resolverFor(state.stages),
      columnOf: (dealStage) => displayStageKey(dealStage, state.stages),
      firstKey: firstStageKey(state.stages),
      labelOf: (key) => {
        const stage = state.stages.find((s) => s.key === key)
        return stage ? labelFor(stage) : (key ?? '')
      },
      canEdit: state.canEdit,
      dealCounts: state.dealCounts,
      isDefault: state.isDefault,
      isReady: state.isReady,
      reload: refreshDealStages,
    }
  }, [state, locale, defaultName])
}
