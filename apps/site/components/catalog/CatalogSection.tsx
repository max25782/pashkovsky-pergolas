import { CatalogImageGrid, type CatalogGridImage } from './CatalogImageGrid'

interface CatalogSectionProps {
  sectionId: string
  titleHe: string
  descriptionHe: string
  images: CatalogGridImage[]
}

export function CatalogSection({ sectionId, titleHe, descriptionHe, images }: CatalogSectionProps) {
  return (
    <section
      className="catalog-section-card catalog-section-wrap rounded-2xl border border-neutral-200/90 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8 print:border-neutral-300 print:shadow-none"
      data-section-id={sectionId}
      aria-labelledby={`catalog-heading-${sectionId}`}
    >
      <h2
        id={`catalog-heading-${sectionId}`}
        className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl md:text-4xl"
      >
        {titleHe}
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-neutral-600 sm:text-lg">{descriptionHe}</p>
      <div className="mt-8">
        <CatalogImageGrid images={images} />
      </div>
    </section>
  )
}
