"use client"
import { useEffect, useState } from "react"
import type { Deal } from './deal-types'
import { STAGES } from './deal-types'

interface DealModalProps {
  deal: Deal
  onClose: () => void
  onUpdate: (updates: Partial<Deal>) => Promise<any>
  onDelete: () => void
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (dateStr: string | null | undefined) => string
}

export function DealModal({
  deal,
  onClose,
  onUpdate,
  onDelete,
  formatCurrency,
  formatDate
}: DealModalProps) {
  const [localDeal, setLocalDeal] = useState(deal)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    console.log('DealModal received deal with dates:', {
      id: deal.id,
      order_date: deal.order_date,
      material_order_date: deal.material_order_date,
      material_received_date: deal.material_received_date,
      installation_date: deal.installation_date
    })
    console.log('DealModal setting localDeal to:', deal)
    setLocalDeal(deal)
  }, [deal])
  
  // Логируем текущее состояние localDeal при каждом рендере
  console.log('DealModal render - current localDeal dates:', {
    order_date: localDeal.order_date,
    material_order_date: localDeal.material_order_date,
    material_received_date: localDeal.material_received_date,
    installation_date: localDeal.installation_date
  })

  async function handleSave() {
    setSaving(true)
    try {
      console.log('handleSave - localDeal dates before formatting:', {
        order_date: localDeal.order_date,
        material_order_date: localDeal.material_order_date,
        material_received_date: localDeal.material_received_date,
        installation_date: localDeal.installation_date
      })
      
      // Создаем объект только с измененными полями (updates)
      const updates: Partial<Deal> = {}
      
      // Обрабатываем даты - преобразуем в ISO формат
      if (localDeal.order_date !== deal.order_date) {
        updates.order_date = localDeal.order_date && localDeal.order_date.trim() 
          ? formatDateForDB(localDeal.order_date) 
          : null
      }
      
      if (localDeal.material_order_date !== deal.material_order_date) {
        updates.material_order_date = localDeal.material_order_date && localDeal.material_order_date.trim() 
          ? formatDateForDB(localDeal.material_order_date) 
          : null
      }
      
      if (localDeal.material_received_date !== deal.material_received_date) {
        updates.material_received_date = localDeal.material_received_date && localDeal.material_received_date.trim() 
          ? formatDateForDB(localDeal.material_received_date) 
          : null
      }
      
      if (localDeal.installation_date !== deal.installation_date) {
        updates.installation_date = localDeal.installation_date && localDeal.installation_date.trim() 
          ? formatDateForDB(localDeal.installation_date) 
          : null
      }
      
      // Добавляем остальные измененные поля
      if (localDeal.customer_name !== deal.customer_name) updates.customer_name = localDeal.customer_name
      if (localDeal.customer_phone !== deal.customer_phone) updates.customer_phone = localDeal.customer_phone
      if (localDeal.customer_email !== deal.customer_email) updates.customer_email = localDeal.customer_email
      if (localDeal.customer_city !== deal.customer_city) updates.customer_city = localDeal.customer_city
      if (localDeal.project_type !== deal.project_type) updates.project_type = localDeal.project_type
      if (localDeal.width !== deal.width) updates.width = localDeal.width
      if (localDeal.depth !== deal.depth) updates.depth = localDeal.depth
      if (localDeal.shape !== deal.shape) updates.shape = localDeal.shape
      if (localDeal.material !== deal.material) updates.material = localDeal.material
      if (localDeal.color_ral !== deal.color_ral) updates.color_ral = localDeal.color_ral
      if (localDeal.price !== deal.price) updates.price = localDeal.price
      if (localDeal.my_cost !== deal.my_cost) updates.my_cost = localDeal.my_cost
      if (localDeal.lighting !== deal.lighting) updates.lighting = localDeal.lighting
      if (localDeal.stage !== deal.stage) updates.stage = localDeal.stage
      if (localDeal.notes !== deal.notes) updates.notes = localDeal.notes
      if (localDeal.manager !== deal.manager) updates.manager = localDeal.manager
      
      // Проверяем, что есть хотя бы одно поле для обновления
      if (Object.keys(updates).length === 0) {
        console.log('No changes detected, closing modal')
        onClose()
        return
      }
      
      console.log('Saving deal updates with dates:', {
        order_date: updates.order_date,
        material_order_date: updates.material_order_date,
        material_received_date: updates.material_received_date,
        installation_date: updates.installation_date,
        allUpdates: updates,
        updatesCount: Object.keys(updates).length
      })
      
      const result = await onUpdate(updates)
      console.log('Save result:', result)
      
      onClose()
    } catch (e) {
      console.error('Save error:', e)
    } finally {
      setSaving(false)
    }
  }

  function updateField<K extends keyof Deal>(field: K, value: Deal[K]) {
    console.log(`updateField: ${field} =`, value)
    setLocalDeal(prev => {
      const updated = { ...prev, [field]: value }
      console.log(`updateField: updated localDeal.${field} =`, updated[field])
      return updated
    })
  }

  // Преобразует дату из datetime-local в ISO формат для базы данных
  function formatDateForDB(dateValue: string | null): string | null {
    if (!dateValue || !dateValue.trim()) return null
    
    console.log('formatDateForDB input:', dateValue)
    
    // datetime-local возвращает формат "YYYY-MM-DDTHH:mm"
    // Преобразуем в ISO формат "YYYY-MM-DDTHH:mm:ss.sssZ"
    try {
      // Если дата уже в ISO формате (содержит Z или +), используем как есть
      if (dateValue.includes('Z') || dateValue.includes('+')) {
        const date = new Date(dateValue)
        if (!isNaN(date.getTime())) {
          const result = date.toISOString()
          console.log('formatDateForDB ISO result:', result)
          return result
        }
      }
      
      // Для формата "YYYY-MM-DDTHH:mm" создаем дату в локальном времени
      // и преобразуем в ISO
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        console.log('formatDateForDB: Invalid date:', dateValue)
        return null
      }
      
      const result = date.toISOString()
      console.log('formatDateForDB result:', result)
      return result
    } catch (error) {
      console.error('formatDateForDB error:', error, 'for value:', dateValue)
      return null
    }
  }

  // Преобразует дату из базы данных в формат для datetime-local
  function formatDateForInput(dateValue: string | null | undefined): string {
    if (!dateValue) return ''
    console.log('formatDateForInput input:', dateValue)
    
    try {
      // Создаем дату из строки
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        console.log('Invalid date:', dateValue)
        return ''
      }
      
      // Преобразуем в локальное время и форматируем для datetime-local
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      const result = `${year}-${month}-${day}T${hours}:${minutes}`
      console.log('formatDateForInput result:', result)
      return result
    } catch (error) {
      console.error('formatDateForInput error:', error, 'for value:', dateValue)
      return ''
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
          <h2 className="text-2xl font-bold text-white">Сделка: {deal.customer_name || 'Без имени'}</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Имя клиента</label>
              <input
                value={localDeal.customer_name || ''}
                onChange={(e) => updateField('customer_name', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Имя"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Телефон</label>
              <input
                value={localDeal.customer_phone || ''}
                onChange={(e) => updateField('customer_phone', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="+972..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Email</label>
              <input
                type="email"
                value={localDeal.customer_email || ''}
                onChange={(e) => updateField('customer_email', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Город</label>
              <input
                value={localDeal.customer_city || ''}
                onChange={(e) => updateField('customer_city', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Город"
              />
            </div>
          </div>

          {/* Project Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Тип проекта</label>
              <select
                value={localDeal.project_type || ''}
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
                value={localDeal.stage || ''}
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
                value={localDeal.width || ''}
                onChange={(e) => updateField('width', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Глубина (см)</label>
              <input
                type="number"
                value={localDeal.depth || ''}
                onChange={(e) => updateField('depth', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Форма</label>
              <select
                value={localDeal.shape || ''}
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
                value={localDeal.price || ''}
                onChange={(e) => updateField('price', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Моя стоимость (₪)</label>
              <input
                type="number"
                value={localDeal.my_cost || ''}
                onChange={(e) => updateField('my_cost', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">תאריך הזמנה (Дата заказа)</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.order_date)}
                onChange={(e) => {
                  console.log('order_date onChange:', e.target.value)
                  updateField('order_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">תאריך הזמנת חומר (Дата заказа материала)</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.material_order_date)}
                onChange={(e) => {
                  console.log('material_order_date onChange:', e.target.value)
                  updateField('material_order_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">תאריך קבלת חומר (Дата получения материала)</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.material_received_date)}
                onChange={(e) => {
                  console.log('material_received_date onChange:', e.target.value)
                  updateField('material_received_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">תאריך התקנה (Дата установки)</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.installation_date)}
                onChange={(e) => {
                  console.log('installation_date onChange:', e.target.value)
                  updateField('installation_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">תאורה (Освещение)</label>
              <input
                value={localDeal.lighting || ''}
                onChange={(e) => updateField('lighting', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Описание освещения"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Материал</label>
              <input
                value={localDeal.material || ''}
                onChange={(e) => updateField('material', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Материал"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">RAL</label>
              <input
                value={localDeal.color_ral || ''}
                onChange={(e) => updateField('color_ral', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="RAL код"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Менеджер</label>
              <input
                value={localDeal.manager || ''}
                onChange={(e) => updateField('manager', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="Менеджер"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Заметки</label>
            <textarea
              value={localDeal.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none min-h-[120px]"
              placeholder="Заметки о сделке..."
            />
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-white/10 text-sm text-white/50 space-y-1">
            {deal.lead_id && <div>ID лида: {deal.lead_id}</div>}
            <div>Создано: {formatDate(deal.created_at)}</div>
            <div>Обновлено: {formatDate(deal.updated_at)}</div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-200 font-semibold"
            >
              Удалить
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

