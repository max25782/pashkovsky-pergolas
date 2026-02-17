import { Header } from '@/components/layout/Header'
import { type Locale } from '@/lib/locales'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-gray-700 text-white">
      <Header locale={locale} />
      {children}
    </div>
  )
}
