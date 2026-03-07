"use client"
import { useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import type { GalleryImage } from './gallery-types'

interface PhotoUploadModalProps {
  categoryKey: string
  categoryName?: string
  onClose: () => void
  onUpload: (files: File[]) => Promise<{ success: boolean; uploaded: number; images: GalleryImage[] }>
}

export function PhotoUploadModal({ categoryKey, categoryName, onClose, onUpload }: PhotoUploadModalProps) {
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const imageFiles = Array.from(selectedFiles).filter(file => 
      file.type.startsWith('image/')
    )

    if (imageFiles.length === 0) {
      toast.error('Пожалуйста, выберите изображения')
      return
    }

    setFiles(prev => [...prev, ...imageFiles])

    // Создаем превью
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) {
      toast.error('Пожалуйста, выберите файлы для загрузки')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      setUploadProgress(10)
      
      const result = await onUpload(files)
      setUploadProgress(100)
      
      if (result.success && result.uploaded > 0) {
        // Даём время родительскому компоненту обновить состояние перед закрытием
        // onUpload уже выполнил все обновления (loadCategoryImages, loadCategories)
        // Используем requestAnimationFrame для гарантии, что React успел обновить DOM
        requestAnimationFrame(() => {
          setTimeout(() => {
            onClose()
          }, 300)
        })
      } else {
        toast.success(`Загружено ${result.uploaded} из ${files.length} файлов`)
      }
    } catch (e) {
      console.error('Upload error:', e)
      toast.error(`Ошибка загрузки: ${e instanceof Error ? e.message : "Error"}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            Загрузить фото в категорию: {categoryName || categoryKey}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging 
                ? 'border-green-500 bg-green-500/10' 
                : 'border-white/20 hover:border-white/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <div className="space-y-4">
              <div className="text-4xl">📸</div>
              <div className="text-white/70">
                Перетащите изображения сюда или{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-green-400 hover:text-green-300 underline"
                >
                  выберите файлы
                </button>
              </div>
              <div className="text-sm text-white/50">
                Поддерживаются форматы: JPEG, PNG, WebP, GIF (макс. 10MB)
              </div>
            </div>
          </div>

          {/* Preview Grid */}
          {files.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Выбрано файлов: {files.length}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {previews[index] && (
                        <img
                          src={previews[index]}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <div className="mt-1 text-xs text-white/60 truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-white/40">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/70">
                <span>Загрузка...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отмена
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Загрузка...' : `Загрузить ${files.length} файл${files.length !== 1 ? 'ов' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

