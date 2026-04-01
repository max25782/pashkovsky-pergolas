import type { Locale } from '@/lib/locales'
import { Pergola3DPage } from './Pergola3DPage'

export default function Page({
  params,
  searchParams,
}: {
  params: { locale: Locale }
  searchParams?: { ct?: string; view?: string }
}) {
  const linkToken = searchParams?.ct?.trim() || undefined
  const readOnly =
    searchParams?.view === '1' ||
    searchParams?.view === 'true' ||
    searchParams?.view === 'yes'
  return (
    /* -mt-16 pulls the canvas up behind the sticky navbar (h-16); the canvas
       then fills the remaining viewport height so the 3D view is fullscreen. */
    <main className="-mt-16 flex h-screen w-full flex-col pt-16">
      <Pergola3DPage locale={params.locale} linkToken={linkToken} readOnly={readOnly} />
    </main>
  )
}
