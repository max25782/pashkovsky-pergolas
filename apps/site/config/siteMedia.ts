/**
 * Media slots for the new public site (/new).
 *
 * HOW TO REPLACE A PLACEHOLDER
 * Set `key` (or `video` / `poster`) to either:
 *   - an S3 object key in the existing bucket, e.g. 'new-site/hero/hero.mp4'
 *     (turned into https://{bucket}.s3.{region}.amazonaws.com/{key}), or
 *   - a full https URL (S3, CloudFront or any host listed in next.config.js remotePatterns).
 * An empty string keeps the labelled gradient placeholder. Nothing is copied into the repo.
 *
 * Optional: set NEXT_PUBLIC_MEDIA_BASE_URL (for example a CloudFront domain) and keys are
 * resolved against it instead of the S3 bucket URL. See lib/new-site/media-url.ts.
 *
 * `hue` is only used to paint the placeholder ("hue,saturation,lightness").
 */
import type { Localized } from './siteTypes'

export type WorkType = 'pergola' | 'rail' | 'fence' | 'glass'

export interface CarouselSlot {
  key: string
  hue: string
  title: Localized
  /** Free text shown under the title, e.g. '9495 x 7480 mm'. */
  size: string
}

export interface WorkSlot {
  key: string
  hue: string
  type: WorkType
  title: Localized
  size: string
  /** Tall tile spans two grid rows. */
  tall?: boolean
}

export interface ReviewVideoSlot {
  video: string
  poster: string
  name: Localized
  meta: string
}

export interface LogoSlot {
  key: string
  alt: string
}

export interface SiteMedia {
  hero: { video: string; poster: string }
  carousel: CarouselSlot[]
  works: WorkSlot[]
  reviewVideos: ReviewVideoSlot[]
  partnersLogos: LogoSlot[]
  certificates: LogoSlot[]
}

export const siteMedia: SiteMedia = {
  hero: {
    video: '', // e.g. 'new-site/hero/hero.mp4'
    poster: '', // e.g. 'new-site/hero/hero-poster.jpg' (the only preloaded asset)
  },

  carousel: [
    { key: '', hue: '200,60%,40%', title: { he: 'פרגולה עם למלות', en: 'Louvered pergola' }, size: '9495 x 7480 mm' },
    { key: '', hue: '18,45%,42%', title: { he: 'פרגולה קבועה', en: 'Fixed roof pergola' }, size: '6200 x 4100 mm' },
    { key: '', hue: '190,40%,32%', title: { he: 'קירוי לחניה', en: 'Carport canopy' }, size: '12000 x 5000 mm' },
    { key: '', hue: '30,35%,36%', title: { he: 'פרגולה צמודה לבית', en: 'Wall-mounted pergola' }, size: '7800 x 3600 mm' },
    { key: '', hue: '205,45%,26%', title: { he: 'פרגולה פינתית', en: 'Corner pergola' }, size: '5400 x 5400 mm' },
    { key: '', hue: '12,40%,32%', title: { he: 'פרגולה למסעדה', en: 'Restaurant pergola' }, size: '14000 x 6000 mm' },
    { key: '', hue: '175,35%,36%', title: { he: 'פרגולה עם זכוכית', en: 'Glass pergola' }, size: '6000 x 3500 mm' },
    { key: '', hue: '24,50%,40%', title: { he: 'פרגולה לגג', en: 'Rooftop pergola' }, size: '5000 x 4000 mm' },
  ],

  works: [
    { key: '', hue: '200,60%,40%', type: 'pergola', title: { he: 'חצר פרטית', en: 'Private yard' }, size: '9495 x 7480 mm', tall: true },
    { key: '', hue: '18,45%,42%', type: 'rail', title: { he: 'מעקה מרפסת', en: 'Balcony railing' }, size: '12 m' },
    { key: '', hue: '190,40%,32%', type: 'pergola', title: { he: 'מרפסת גג', en: 'Rooftop terrace' }, size: '6200 x 4100 mm' },
    { key: '', hue: '30,35%,36%', type: 'fence', title: { he: 'גדר אלומיניום', en: 'Aluminum fence' }, size: '34 m' },
    { key: '', hue: '205,45%,26%', type: 'glass', title: { he: 'מעקה זכוכית', en: 'Glass balustrade' }, size: '8 m', tall: true },
    { key: '', hue: '12,40%,32%', type: 'pergola', title: { he: 'מסעדה', en: 'Restaurant' }, size: '12000 x 5000 mm' },
  ],

  reviewVideos: [
    { video: '', poster: '', name: { he: 'שם הלקוח', en: 'Client name' }, meta: 'review-1' },
    { video: '', poster: '', name: { he: 'שם הלקוח', en: 'Client name' }, meta: 'review-2' },
    { video: '', poster: '', name: { he: 'שם הלקוח', en: 'Client name' }, meta: 'review-3' },
  ],

  partnersLogos: Array.from({ length: 10 }, (_, i) => ({
    key: '',
    alt: `Partner ${String(i + 1).padStart(2, '0')}`,
  })),

  certificates: Array.from({ length: 3 }, (_, i) => ({
    key: '',
    alt: `Certificate ${String(i + 1).padStart(2, '0')}`,
  })),
}
