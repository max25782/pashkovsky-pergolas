import { NewSiteApp } from '@/components/new-site/NewSiteApp'
import { siteMedia } from '@/config/siteMedia'
import { mediaUrl } from '@/lib/new-site/media-url'

export default function NewSitePage() {
  const posterUrl = mediaUrl(siteMedia.hero.poster)

  return (
    <>
      {/* The hero poster is the only preloaded asset (LCP). Nothing is emitted while the slot is empty. */}
      {posterUrl !== null && <link rel="preload" as="image" href={posterUrl} fetchPriority="high" />}
      <NewSiteApp />
    </>
  )
}
