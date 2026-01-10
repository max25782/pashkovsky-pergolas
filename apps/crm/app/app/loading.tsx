export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-4 text-white/70">Loading...</p>
      </div>
    </div>
  )
}

