import Image from 'next/image'

interface ProductImageProps {
  src?: string
  alt: string
}

export function ProductImage({ src, alt }: ProductImageProps) {
  return (
    <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
          {alt}
        </div>
      )}
    </div>
  )
}
