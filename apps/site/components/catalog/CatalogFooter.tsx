interface CatalogFooterProps {
  phoneDisplay: string
  phoneTel: string
  websiteUrl: string
  ctaLabel: string
  ctaHref: string
}

export function CatalogFooter({ phoneDisplay, phoneTel, websiteUrl, ctaLabel, ctaHref }: CatalogFooterProps) {
  return (
    <footer className="catalog-section-card rounded-2xl border border-neutral-900/10 bg-neutral-900 px-6 py-10 text-center text-white sm:px-10 print:border-neutral-400">
      <p className="text-lg font-bold sm:text-xl">מוכנים לשדרג את החוץ?</p>
      <p className="mt-2 text-sm text-white/75 sm:text-base">{ctaLabel}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
        <a
          href={phoneTel}
          className="text-xl font-semibold tracking-wide text-white underline-offset-4 hover:underline"
        >
          {phoneDisplay}
        </a>
        <a
          href={websiteUrl}
          className="text-sm font-medium text-white/90 underline-offset-4 hover:underline sm:text-base"
          target="_blank"
          rel="noreferrer"
        >
          {websiteUrl.replace(/^https?:\/\//, '')}
        </a>
        <a
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-bold text-neutral-900 shadow-md transition hover:bg-neutral-100"
        >
          {ctaLabel}
        </a>
      </div>
    </footer>
  )
}
