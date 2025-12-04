"use client"
import { useEffect, useState } from "react"
import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { SketchModal } from './SketchModal'
import { FileImage } from 'lucide-react'
import { useCRMTranslations } from './useCRMTranslations'

interface DealModalProps {
  deal: Deal
  onClose: () => void
  onUpdate: (updates: Partial<Deal>) => Promise<any>
  onDelete: () => void
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (dateStr: string | null | undefined) => string
  adminToken: string
}

export function DealModal({
  deal,
  onClose,
  onUpdate,
  onDelete,
  formatCurrency,
  formatDate,
  adminToken
}: DealModalProps) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
  const [localDeal, setLocalDeal] = useState(deal)
  const [saving, setSaving] = useState(false)
  const [showSketchModal, setShowSketchModal] = useState(false)

  useEffect(() => {
    setLocalDeal(deal)
  }, [deal])

  async function handleSave() {
    setSaving(true)
    try {
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
        onClose()
        return
      }
      
      await onUpdate(updates)
      onClose()
    } catch (e) {
      console.error('Save error:', e)
    } finally {
      setSaving(false)
    }
  }

  function updateField<K extends keyof Deal>(field: K, value: Deal[K]) {
    setLocalDeal(prev => ({ ...prev, [field]: value }))
  }

  // Преобразует дату из datetime-local в ISO формат для базы данных
  function formatDateForDB(dateValue: string | null): string | null {
    if (!dateValue || !dateValue.trim()) return null
    
    // datetime-local возвращает формат "YYYY-MM-DDTHH:mm"
    // Преобразуем в ISO формат "YYYY-MM-DDTHH:mm:ss.sssZ"
    try {
      // Если дата уже в ISO формате (содержит Z или +), используем как есть
      if (dateValue.includes('Z') || dateValue.includes('+')) {
        const date = new Date(dateValue)
        if (!isNaN(date.getTime())) {
          return date.toISOString()
        }
      }
      
      // Для формата "YYYY-MM-DDTHH:mm" создаем дату в локальном времени
      // и преобразуем в ISO
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        return null
      }
      
      return date.toISOString()
    } catch (error) {
      return null
    }
  }

  // Преобразует дату из базы данных в формат для datetime-local
  function formatDateForInput(dateValue: string | null | undefined): string {
    if (!dateValue) return ''
    
    try {
      // Создаем дату из строки
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        return ''
      }
      
      // Преобразуем в локальное время и форматируем для datetime-local
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day}T${hours}:${minutes}`
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
          <h2 className="text-2xl font-bold text-white">{t.deals.dealTitle}: {deal.customer_name || t.deals.withoutName}</h2>
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
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerName}</label>
              <input
                value={localDeal.customer_name || ''}
                onChange={(e) => updateField('customer_name', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.customerName}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerPhone}</label>
              <input
                value={localDeal.customer_phone || ''}
                onChange={(e) => updateField('customer_phone', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="+972..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerEmail}</label>
              <input
                type="email"
                value={localDeal.customer_email || ''}
                onChange={(e) => updateField('customer_email', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerCity}</label>
              <input
                value={localDeal.customer_city || ''}
                onChange={(e) => updateField('customer_city', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.customerCity}
              />
            </div>
          </div>

          {/* Project Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.projectType}</label>
              <select
                value={localDeal.project_type || ''}
                onChange={(e) => updateField('project_type', (e.target.value || null) as any)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">-</option>
                <option value="pergola">{t.deals.projectTypes.pergola}</option>
                <option value="railing">{t.deals.projectTypes.railing}</option>
                <option value="gates">{t.deals.projectTypes.gates}</option>
                <option value="windows">{t.deals.projectTypes.windows}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.stage}</label>
              <select
                value={localDeal.stage || ''}
                onChange={(e) => updateField('stage', (e.target.value || null) as any)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">-</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.width}</label>
              <input
                type="number"
                value={localDeal.width || ''}
                onChange={(e) => updateField('width', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.depth}</label>
              <input
                type="number"
                value={localDeal.depth || ''}
                onChange={(e) => updateField('depth', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.shape}</label>
              <select
                value={localDeal.shape || ''}
                onChange={(e) => updateField('shape', (e.target.value || null) as any)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">-</option>
                <option value="прямоугольник">{t.deals.rectangle}</option>
                <option value="Г-образная">{t.deals.lShape}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.price}</label>
              <input
                type="number"
                value={localDeal.price || ''}
                onChange={(e) => updateField('price', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.myCost}</label>
              <input
                type="number"
                value={localDeal.my_cost || ''}
                onChange={(e) => updateField('my_cost', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.orderDate}</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.order_date)}
                onChange={(e) => {
                  updateField('order_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.materialOrderDate}</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.material_order_date)}
                onChange={(e) => {
                  updateField('material_order_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.materialReceivedDate}</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.material_received_date)}
                onChange={(e) => {
                  updateField('material_received_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.installationDate}</label>
              <input
                type="datetime-local"
                value={formatDateForInput(localDeal.installation_date)}
                onChange={(e) => {
                  updateField('installation_date', e.target.value || null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.lighting}</label>
              <input
                value={localDeal.lighting || ''}
                onChange={(e) => updateField('lighting', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.lighting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.material}</label>
              <input
                value={localDeal.material || ''}
                onChange={(e) => updateField('material', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.material}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.colorRal}</label>
              <input
                value={localDeal.color_ral || ''}
                onChange={(e) => updateField('color_ral', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.colorRal}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.manager}</label>
              <input
                value={localDeal.manager || ''}
                onChange={(e) => updateField('manager', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.manager}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.notes}</label>
            <textarea
              value={localDeal.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none min-h-[120px]"
              placeholder={t.deals.notes}
            />
          </div>

          {/* Sketch Button */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={() => setShowSketchModal(true)}
              className="w-full px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-medium flex items-center justify-center gap-2"
            >
              <FileImage className="w-4 h-4" />
              {t.deals.openSketch}
            </button>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-white/10 text-sm text-white/50 space-y-1">
            {deal.lead_id && <div>{t.deals.leadId}: {deal.lead_id}</div>}
            <div>{t.deals.createdAt}: {formatDate(deal.created_at)}</div>
            <div>{t.deals.updatedAt}: {formatDate(deal.updated_at)}</div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t.common.saving : t.common.save}
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-200 font-semibold"
            >
              {t.common.delete}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 font-semibold"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>

      {/* Sketch Modal */}
      {showSketchModal && (
        <SketchModal
          dealId={deal.id}
          existingImageUrl={localDeal.sketch_image_url}
          existingJson={localDeal.sketch_json}
          onClose={() => setShowSketchModal(false)}
          onSave={async (imageBlob: Blob, jsonData: any) => {
            const formData = new FormData()
            formData.append('dealId', deal.id)
            formData.append('image', imageBlob, 'sketch.png')
            formData.append('sketchJson', JSON.stringify(jsonData))

            const response = await fetch('/admin-api/deals/sketch', {
              method: 'POST',
              headers: {
                'x-admin-token': adminToken,
              },
              body: formData,
            })

            if (!response.ok) {
              throw new Error('Failed to save sketch')
            }

            const result = await response.json()
            
            setLocalDeal(prev => ({
              ...prev,
              sketch_image_url: result.imageUrl,
              sketch_json: jsonData,
            }))

            await onUpdate({
              sketch_image_url: result.imageUrl,
              sketch_json: jsonData,
            })
          }}
          adminToken={adminToken}
        />
      )}
    </div>
  )
}

