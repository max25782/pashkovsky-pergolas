"use client"
import { useState } from "react"
import type { Deal } from './deal-types'
import { STAGES } from './deal-types'

interface CreateDealModalProps {
  onClose: () => void
  onCreate: (dealData: Partial<Deal>) => Promise<any>
}

export function CreateDealModal({
  onClose,
  onCreate
}: CreateDealModalProps) {
  const [dealData, setDealData] = useState<Partial<Deal>>({
    stage: 'new',
    project_type: null,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    customer_city: null,
    width: null,
    depth: null,
    shape: null,
    material: null,
    color_ral: null,
    price: null,
    my_cost: null,
    order_date: null,
    material_order_date: null,
    material_received_date: null,
    installation_date: null,
    lighting: null,
    notes: null,
    manager: null
  })
  const [saving, setSaving] = useState(false)

  function updateField<K extends keyof Deal>(field: K, value: Deal[K]) {
    setDealData(prev => ({ ...prev, [field]: value }))
  }

  // Преобразует дату из datetime-local в ISO формат для базы данных
  function formatDateForDB(dateValue: string | null): string | null {
    if (!dateValue) return null
    try {
      // Если дата уже в ISO формате (содержит Z или +), используем как есть
      if (dateValue.includes('Z') || dateValue.includes('+') || dateValue.includes('-', 10)) {
        const date = new Date(dateValue)
        if (!isNaN(date.getTime())) {
          return date.toISOString()
        }
      }
      // Иначе создаем новую дату из локального формата
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return null
      return date.toISOString()
    } catch {
      return null
    }
  }

  async function handleCreate() {
    if (!dealData.customer_name || !dealData.customer_phone) {
      alert('Пожалуйста, заполните имя и телефон клиента')
      return
    }

    setSaving(true)
    try {
      // Преобразуем даты в правильный формат перед отправкой
      const dealToCreate = {
        ...dealData,
        order_date: dealData.order_date ? formatDateForDB(dealData.order_date) : null,
        material_order_date: dealData.material_order_date ? formatDateForDB(dealData.material_order_date) : null,
        material_received_date: dealData.material_received_date ? formatDateForDB(dealData.material_received_date) : null,
        installation_date: dealData.installation_date ? formatDateForDB(dealData.installation_date) : null,
      }
      await onCreate(dealToCreate)
      onClose()
    } catch (e) {
      console.error('Create error:', e)
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
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Создать новую сделку</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Информация о клиенте</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Имя клиента <span className="text-red-400">*</span>
                </label>
                <input
                  value={dealData.customer_name || ''}
                  onChange={(e) => updateField('customer_name', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="Имя"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Телефон <span className="text-red-400">*</span>
                </label>
                <input
                  value={dealData.customer_phone || ''}
                  onChange={(e) => updateField('customer_phone', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="+972..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Email</label>
                <input
                  type="email"
                  value={dealData.customer_email || ''}
                  onChange={(e) => updateField('customer_email', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Город</label>
                <input
                  value={dealData.customer_city || ''}
                  onChange={(e) => updateField('customer_city', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="Город"
                />
              </div>
            </div>
          </div>

          {/* Project Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Информация о проекте</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Тип проекта</label>
                <select
                  value={dealData.project_type || ''}
                  onChange={(e) => updateField('project_type', (e.target.value || null) as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                >
                  <option value="">-</option>
                  <option value="pergola">Пергола</option>
                  <option value="railing">Перила</option>
                  <option value="gates">Ворота</option>
                  <option value="windows">Окна</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Этап</label>
                <select
                  value={dealData.stage || ''}
                  onChange={(e) => updateField('stage', (e.target.value || null) as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                >
                  <option value="">-</option>
                  {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Ширина (см)</label>
                <input
                  type="number"
                  value={dealData.width || ''}
                  onChange={(e) => updateField('width', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Глубина (см)</label>
                <input
                  type="number"
                  value={dealData.depth || ''}
                  onChange={(e) => updateField('depth', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Форма</label>
                <select
                  value={dealData.shape || ''}
                  onChange={(e) => updateField('shape', (e.target.value || null) as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                >
                  <option value="">-</option>
                  <option value="прямоугольник">Прямоугольник</option>
                  <option value="Г-образная">Г-образная</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Цена клиенту (₪)</label>
                <input
                  type="number"
                  value={dealData.price || ''}
                  onChange={(e) => updateField('price', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Моя стоимость (₪)</label>
                <input
                  type="number"
                  value={dealData.my_cost || ''}
                  onChange={(e) => updateField('my_cost', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">תאריך הזמנה (Дата заказа)</label>
                <input
                  type="datetime-local"
                  value={dealData.order_date || ''}
                  onChange={(e) => updateField('order_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">תאריך הזמנת חומר (Дата заказа материала)</label>
                <input
                  type="datetime-local"
                  value={dealData.material_order_date || ''}
                  onChange={(e) => updateField('material_order_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">תאריך קבלת חומר (Дата получения материала)</label>
                <input
                  type="datetime-local"
                  value={dealData.material_received_date || ''}
                  onChange={(e) => updateField('material_received_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">תאריך התקנה (Дата установки)</label>
                <input
                  type="datetime-local"
                  value={dealData.installation_date || ''}
                  onChange={(e) => updateField('installation_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">תאורה (Освещение)</label>
                <input
                  value={dealData.lighting || ''}
                  onChange={(e) => updateField('lighting', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="Описание освещения"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Материал</label>
                <input
                  value={dealData.material || ''}
                  onChange={(e) => updateField('material', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="Материал"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">RAL</label>
                <input
                  value={dealData.color_ral || ''}
                  onChange={(e) => updateField('color_ral', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="RAL код"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Менеджер</label>
                <input
                  value={dealData.manager || ''}
                  onChange={(e) => updateField('manager', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="Менеджер"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Заметки</label>
            <textarea
              value={dealData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none min-h-[120px]"
              placeholder="Заметки о сделке..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !dealData.customer_name || !dealData.customer_phone}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Создание...' : 'Создать сделку'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 font-semibold"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

