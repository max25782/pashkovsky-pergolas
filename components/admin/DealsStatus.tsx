interface DealsStatusProps {
  loading: boolean
  error: string | null
}

export function DealsStatus({ loading, error }: DealsStatusProps) {
  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-white/60 text-center py-4">Загрузка...</div>
    )
  }

  return null
}

