'use client'

import Image from 'next/image'
import { Eye, Trash2 } from 'lucide-react'
import { RefreshCw } from 'lucide-react'
import type { GalleryImage } from './gallery-types'

interface Props {
  images: GalleryImage[]
  deletingId: string | null
  categoryKey: string
  onDelete: (id: string, filename: string) => void
}

export function ImageGrid({ images, deletingId, categoryKey, onDelete }: Props) {
  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p className="text-lg mb-2">אין תמונות בקטגוריה זו</p>
        <p className="text-sm">העלה תמונות דרך הכרטיסייה &quot;העלאת תמונות&quot;</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70">
        {images.length} תמונות בקטגוריה <span className="font-bold">{categoryKey}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative bg-black/30 rounded-lg border border-white/10 overflow-hidden hover:border-white/30 transition-all"
          >
            <div className="aspect-square relative">
              <Image src={img.url} alt={img.filename} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full"
                >
                  <Eye className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onDelete(img.id, img.filename)}
                  disabled={deletingId === img.id}
                  className="p-2 bg-red-600 hover:bg-red-700 rounded-full disabled:opacity-50"
                >
                  {deletingId === img.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="p-2 text-xs text-white/70 truncate" title={img.filename}>
              {img.filename}
            </div>
            <div className="px-2 pb-2 text-xs text-white/50">
              {new Date(img.created_at).toLocaleDateString('he-IL')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
