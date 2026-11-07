import type { Metadata, Viewport } from 'next'
import { Heebo, IBM_Plex_Mono, Rubik } from 'next/font/google'
import '@/components/new-site/new-site.css'

/**
 * Layout of the new public site (/new). It deliberately lives outside app/[locale] so the old
 * Navbar, chat widget, WhatsApp button and cookie banner are not rendered around it.
 * The page is preview material, so it is kept out of search engines.
 */

const rubik = Rubik({ subsets: ['latin', 'hebrew'], display: 'swap', variable: '--font-rubik' })
const heebo = Heebo({ subsets: ['latin', 'hebrew'], display: 'swap', variable: '--font-heebo' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: { absolute: 'New site preview | Pashkovsky Group' },
  description: 'Preview of the new Pashkovsky Group website.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function NewSiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${rubik.variable} ${heebo.variable} ${plexMono.variable}`}>{children}</div>
}
