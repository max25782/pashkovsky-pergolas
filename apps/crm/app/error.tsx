'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('CRM Error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">שגיאה</h2>
        <p className="text-white/70 mb-6">
          {error.message || 'משהו השתבש'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          נסה שוב
        </button>
      </div>
    </div>
  )
}

