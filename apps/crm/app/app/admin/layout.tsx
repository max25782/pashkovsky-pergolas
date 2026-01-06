/**
 * Admin Layout
 * Note: Auth check is handled client-side in AdminPage component
 * to avoid issues with SSR cookie hydration
 */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No server-side auth check here - let client handle it
  // AdminPage already has auth check and redirect logic
  return <>{children}</>
}
