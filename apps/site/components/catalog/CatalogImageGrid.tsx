export interface CatalogGridImage {
  url: string
  caption: string | null
  key: string
}

interface CatalogImageGridProps {
  images: CatalogGridImage[]
}

export function CatalogImageGrid({ images }: CatalogImageGridProps) {
  if (images.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
        אין תמונות בתיקייה המתאימה ב-S3 (למשל images/pergulet/ או images/rails/).
      </p>
    )
  }

  return (
    <div className="catalog-image-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
      {images.map((img) => (
        <figure
          key={img.key}
          className="catalog-image-cell group overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-sm"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
            {/* Native img: next/image often hydrates differently with signed URLs + query params */}
            <img
              src={img.url}
              alt={img.caption ?? 'מוצר פשקובסקי גרופ'}
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              data-catalog-image
              loading="lazy"
              decoding="async"
            />
          </div>
          {img.caption ? (
            <figcaption className="line-clamp-2 px-2 py-2 text-center text-xs text-neutral-600">{img.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  )
}
