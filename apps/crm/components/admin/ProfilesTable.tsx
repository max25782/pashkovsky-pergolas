'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { Plus, Edit, Trash2, Image as ImageIcon } from 'lucide-react'

interface AluminumProfile {
  id: string
  code: string
  name_he?: string
  name_ru?: string
  name_en?: string
  dimensions?: string
  weight_per_meter: number
  available_lengths: number[]
  category: 'pergulas' | 'fancy' | 'railling' | 'concealed' | 'window'
  description_he?: string
  description_ru?: string
  description_en?: string
  image_url?: string
  price_per_kg: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// Category display names
const categoryNames: Record<string, string> = {
  pergulas: 'Перголы',
  fancy: 'Декоративные',
  railling: 'Перила',
  concealed: 'מסתורי כביסהת',
  window: 'Окна',
}

export function ProfilesTable() {
  const [profiles, setProfiles] = useState<AluminumProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<AluminumProfile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadProfiles()
  }, [])

  async function loadProfiles() {
    try {
      setLoading(true)
      setError(null)
      
      const response = await authFetch('/api/admin/profiles')
      
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || `Failed to load profiles (${response.status})`)
      }
      
      const data = await response.json()
      setProfiles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('[Profiles] Error loading:', error)
      setError(error instanceof Error ? error.message : 'Failed to load profiles')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editingProfile) return

    // Validation
    if (!editingProfile.code || !editingProfile.weight_per_meter || !editingProfile.price_per_kg) {
      alert('Заполните все обязательные поля (код, вес за метр, цена за кг)')
      return
    }

    try {
      const isNew = !editingProfile.id || editingProfile.id === ''
      const url = isNew 
        ? '/api/admin/profiles'
        : `/api/admin/profiles/${editingProfile.id}`

      // Prepare payload - remove fields that shouldn't be sent
      const payload: any = { ...editingProfile }
      
      // Remove server-managed fields (for both new and update)
      delete payload.id
      delete payload.company_id
      delete payload.created_at
      delete payload.updated_at

      const response = await authFetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save profile')
      }

      alert('Профиль сохранен!')
      loadProfiles()
      setShowForm(false)
      setEditingProfile(null)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert(error instanceof Error ? error.message : 'Ошибка сохранения')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Вы уверены, что хотите удалить этот профиль?')) return

    try {
      const response = await authFetch(`/api/admin/profiles/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete profile')
      }

      alert('Профиль удален!')
      loadProfiles()
    } catch (error) {
      console.error('Error deleting profile:', error)
      alert('Ошибка удаления')
    }
  }

  function handleNew() {
    setEditingProfile({
      id: '',
      code: '',
      name_he: '',
      name_ru: '',
      name_en: '',
      dimensions: '',
      weight_per_meter: 0,
      available_lengths: [6.0, 6.5, 7.0, 8.0],
      category: 'pergulas',
      description_he: '',
      description_ru: '',
      description_en: '',
      image_url: '',
      price_per_kg: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
    })
    setShowForm(true)
  }

  function handleEdit(profile: AluminumProfile) {
    setEditingProfile({ ...profile })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white/60">Загрузка профилей...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
        <p className="font-semibold">Ошибка:</p>
        <p>{error}</p>
        <button
          onClick={loadProfiles}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Управление профилями</h2>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
        >
          <Plus className="w-5 h-5" />
          Добавить профиль
        </button>
      </div>

      {/* Form Modal */}
      {showForm && editingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingProfile.id ? 'Редактировать профиль' : 'Новый профиль'}
            </h3>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium mb-1">Код профиля *</label>
                <input
                  type="text"
                  value={editingProfile.code}
                  onChange={(e) => setEditingProfile({ ...editingProfile, code: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  placeholder="F5020-BLACK"
                />
              </div>

              {/* Names */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Название (HE)</label>
                  <input
                    type="text"
                    value={editingProfile.name_he || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name_he: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Название (RU)</label>
                  <input
                    type="text"
                    value={editingProfile.name_ru || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name_ru: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Название (EN)</label>
                  <input
                    type="text"
                    value={editingProfile.name_en || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name_en: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Dimensions & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Размеры</label>
                  <input
                    type="text"
                    value={editingProfile.dimensions || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, dimensions: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                    placeholder="50x20mm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Вес за метр (кг) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.weight_per_meter}
                    onChange={(e) => setEditingProfile({ ...editingProfile, weight_per_meter: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Категория *</label>
                <select
                  value={editingProfile.category}
                  onChange={(e) => setEditingProfile({ ...editingProfile, category: e.target.value as any })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                >
                  <option value="pergulas">Перголы (Pergulas)</option>
                  <option value="fancy">Декоративные (Fancy)</option>
                  <option value="railling">Перила (Railling)</option>
                  <option value="concealed">מסתורי כביסהת (Concealed)</option>
                  <option value="window">Окна (Window)</option>
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-1">Цена за кг (₪) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProfile.price_per_kg}
                  onChange={(e) => setEditingProfile({ ...editingProfile, price_per_kg: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium mb-1">URL изображения</label>
                <input
                  type="text"
                  value={editingProfile.image_url || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, image_url: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  placeholder="https://..."
                />
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProfile.is_active}
                  onChange={(e) => setEditingProfile({ ...editingProfile, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Активен</label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold"
              >
                Сохранить
              </button>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingProfile(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {profiles.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-lg">
          <p className="text-white/60 text-lg mb-4">Профилей пока нет</p>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            Создать первый профиль
          </button>
        </div>
      ) : (
        <div className="bg-white/5 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/10">
              <tr>
                <th className="px-4 py-3 text-left">Изображение</th>
                <th className="px-4 py-3 text-left">Код</th>
                <th className="px-4 py-3 text-left">Название</th>
                <th className="px-4 py-3 text-left">Размеры</th>
                <th className="px-4 py-3 text-left">Категория</th>
                <th className="px-4 py-3 text-left">Цена (₪/кг)</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    {profile.image_url && !imageErrors.has(profile.id) ? (
                      <img
                        src={profile.image_url.startsWith('http') ? profile.image_url : `https://${profile.image_url}`}
                        alt={profile.name_ru || profile.code}
                        className="w-16 h-16 object-cover rounded border border-white/20"
                        onError={() => {
                          setImageErrors((prev) => new Set(prev).add(profile.id))
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-white/10 rounded border border-white/20 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">{profile.code}</td>
                  <td className="px-4 py-3">
                    {profile.name_ru || profile.name_he || profile.name_en || '-'}
                  </td>
                  <td className="px-4 py-3">{profile.dimensions || '-'}</td>
                  <td className="px-4 py-3">{categoryNames[profile.category] || profile.category}</td>
                  <td className="px-4 py-3">{profile.price_per_kg} ₪</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${profile.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {profile.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(profile)}
                        className="p-2 hover:bg-white/10 rounded"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
