import { PlanBoundary } from '@/components/subscription/PlanBoundary'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanBoundary feature="profiles_catalog">{children}</PlanBoundary>
}
