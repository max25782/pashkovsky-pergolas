import Image from 'next/image'
import { isLeadDemo } from '@/lib/new-site/lead-mode'
import { placeholderGradient } from '@/lib/new-site/media-url'

interface MediaImageProps {
  /** Resolved URL from mediaUrl(); null paints the placeholder. */
  src: string | null
  alt: string
  hue: string
  /** Slot name shown on the placeholder in demo/Preview builds, e.g. 'carousel[0]'. */
  slot: string
  sizes: string
  className?: string
}

/**
 * Fills its positioned parent. Real photos go through next/image (lazy, with `sizes`);
 * an empty slot renders a labelled gradient so the layout is reviewable before photos exist.
 */
export function MediaImage({ src, alt, hue, slot, sizes, className }: MediaImageProps) {
  if (src === null) {
    return (
      <span className="ns-ph" style={{ background: placeholderGradient(hue) }} aria-hidden="true">
        {isLeadDemo() && <span className="ns-ph-label">{slot}</span>}
      </span>
    )
  }
  return <Image src={src} alt={alt} fill sizes={sizes} loading="lazy" className={className} />
}
