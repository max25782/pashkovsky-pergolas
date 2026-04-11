import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pashkovsky Group - הצעת מחיר',
  description: 'צפייה ואישור הצעת מחיר',
}

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

