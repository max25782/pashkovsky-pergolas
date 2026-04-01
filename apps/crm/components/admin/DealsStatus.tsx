import { useCRMTranslations } from './useCRMTranslations'

interface DealsStatusProps {
  loading: boolean
  error: string | null
}

/**
 * Reserves a fixed-height row when there is no error so switching loading on/off
 * does not shift the kanban/table below (CLS).
 */
export function DealsStatus({ loading, error }: DealsStatusProps) {
  const t = useCRMTranslations()
  if (error) {
    return (
      <div className="mb-3 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div
      className="mb-3 flex min-h-[44px] items-center justify-center text-center text-sm text-white/60"
      aria-busy={loading}
      aria-live="polite"
    >
      {loading ? t.status.loading : null}
    </div>
  )
}

