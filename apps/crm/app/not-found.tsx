import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-4xl font-bold mb-4">404</h2>
        <p className="text-xl text-white/70 mb-6">הדף לא נמצא</p>
        <Link
          href="/app/admin"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          חזור לדף הבית
        </Link>
      </div>
    </div>
  )
}

