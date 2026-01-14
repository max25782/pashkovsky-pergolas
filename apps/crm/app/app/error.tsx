'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[AppError] Error:', error)
  }, [error])

  const handleRetry = () => {
    reset()
  }

  const handleGoToOnboarding = () => {
    router.push('/app/onboarding')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-white/70 mb-6">
          {error.message || 'Something went wrong'}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleGoToOnboarding}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Go to Onboarding
          </button>
        </div>
      </div>
    </div>
  )
}




