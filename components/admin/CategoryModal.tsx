"use client"
import { useState, useEffect } from 'react'
import type { GalleryCategory } from './gallery-types'

interface CategoryModalProps {
  category?: GalleryCategory | null
  onClose: () => void
  onSave: (categoryData: Partial<GalleryCategory>) => Promise<any>
}

export function CategoryModal({ category, onClose, onSave }: CategoryModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    key: category?.key || '',
    name_he: category?.name_he || '',
    name_ru: category?.name_ru || '',
    name_en: category?.name_en || '',
    description_he: category?.description_he || '',
    description_ru: category?.description_ru || '',
    description_en: category?.description_en || '',
  })

  useEffect(() => {
    if (category) {
      setFormData({
        key: category.key || '',
        name_he: category.name_he || '',
        name_ru: category.name_ru || '',
        name_en: category.name_en || '',
        description_he: category.description_he || '',
        description_ru: category.description_ru || '',
        description_en: category.description_en || '',
      })
    }
  }, [category])

  async function handleSave() {
    if (!formData.key.trim()) {
      alert('Пожалуйста, заполните ключ категории')
      return
    }

    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (e: any) {
      console.error('Save error:', e)
      alert(`Ошибка сохранения: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {category ? 'Редактировать категорию' : 'Новая категория'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Ключ категории (key) {category ? '(нельзя изменить)' : '*'}
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
              disabled={!!category}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="fancy"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Название (HE)</label>
              <input
                type="text"
                value={formData.name_he}
                onChange={(e) => setFormData({ ...formData, name_he: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="פאנסי"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Название (RU)</label>
              <input
                type="text"
                value={formData.name_ru}
                onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Фэнси"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Название (EN)</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Fancy"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Описание (HE)</label>
              <textarea
                value={formData.description_he}
                onChange={(e) => setFormData({ ...formData, description_he: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Описание на иврите"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Описание (RU)</label>
              <textarea
                value={formData.description_ru}
                onChange={(e) => setFormData({ ...formData, description_ru: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Описание на русском"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Описание (EN)</label>
              <textarea
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Description in English"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


