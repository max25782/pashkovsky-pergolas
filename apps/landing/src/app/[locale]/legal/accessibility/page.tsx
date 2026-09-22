import { setRequestLocale } from 'next-intl/server'
import { routing, type Locale } from '@/i18n/routing'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AccessibilityStatement from '@/components/AccessibilityStatement'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  return (
    <>
      <Nav />
      <AccessibilityStatement />
      <Footer />
    </>
  )
}
