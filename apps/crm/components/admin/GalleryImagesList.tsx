"use client"
import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import type { GalleryImage } from './gallery-types'

interface GalleryImagesListProps {
  images: GalleryImage[]
  onDelete: (id: string) => Promise<void>
  loading?: boolean
}

export function GalleryImagesList({ images, onDelete, loading }: GalleryImagesListProps) {
  const toast = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Логируем изменения для отладки
  useEffect(() => {
    images.forEach((img, idx) => {
    })
  }, [images])

  async function handleDelete(id: string) {
    if (!confirm('Удалить это изображение?')) return

    setDeletingId(id)
    try {
      await onDelete(id)
    } catch (e) {
      console.error('Delete error:', e)
      toast.error(e instanceof Error ? `Ошибка удаления: ${e.message}` : "Ошибка удаления")
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center text-white/60 py-8">
        Загрузка изображений...
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="text-center text-white/60 py-8">
        Нет изображений в этой категории
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <div key={image.id} className="relative group">
          <div className="aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10">
            <img
              src={image.url}
              alt={image.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <button
            onClick={() => handleDelete(image.id)}
            disabled={deletingId === image.id}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title="Удалить"
          >
            {deletingId === image.id ? '...' : '×'}
          </button>
          <div className="mt-2 text-xs text-white/60 truncate" title={image.filename}>
            {image.filename}
          </div>
          {image.size && (
            <div className="text-xs text-white/40">
              {(image.size / 1024 / 1024).toFixed(2)} MB
              {image.width && image.height && ` • ${image.width}×${image.height}`}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

