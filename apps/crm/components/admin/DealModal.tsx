"use client"
import { useEffect, useState } from "react"
import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { SketchModal } from './SketchModal'
import { FileImage, FileText } from 'lucide-react'
import { useCRMTranslations } from './useCRMTranslations'
import { CreateOfferModal } from '../offers/CreateOfferModal'
import { OffersList } from '../offers/OffersList'
import { WorkLogSection } from '../workers/WorkLogSection'
import { ProfitWidget } from '../workers/ProfitWidget'
import { useProjectRevenue } from '@/hooks/useProjectRevenue'
import { LaundryClosetModal } from './LaundryClosetModal'
import { MaterialOrdersList } from './MaterialOrdersList'

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
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showLaundryClosetModal, setShowLaundryClosetModal] = useState(false)
  const [offersRefreshTrigger, setOffersRefreshTrigger] = useState(0)
  
  // Get revenue from offers
  const revenue = useProjectRevenue(deal.id)

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
      if (localDeal.laundry_model !== deal.laundry_model) updates.laundry_model = localDeal.laundry_model
      if (localDeal.laundry_distance !== deal.laundry_distance) updates.laundry_distance = localDeal.laundry_distance
      if (localDeal.laundry_lighting !== deal.laundry_lighting) updates.laundry_lighting = localDeal.laundry_lighting
      
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 shadow-2xl w-full h-full max-h-full rounded-none sm:rounded-xl sm:max-w-5xl sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{t.deals.dealTitle}: {deal.customer_name || t.deals.withoutName}</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 p-3 sm:p-6 space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="laundry_closet">{t.deals.projectTypes.laundry_closet}</option>
              </select>
              {localDeal.project_type === 'laundry_closet' && (
                <button
                  type="button"
                  onClick={() => setShowLaundryClosetModal(true)}
                  className="mt-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm text-white"
                >
                  פתח פרטי מסתור כביסה
                </button>
              )}
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
            {localDeal.project_type !== 'laundry_closet' && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.lighting}</label>
                <input
                  value={localDeal.lighting || ''}
                  onChange={(e) => updateField('lighting', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.lighting}
                />
              </div>
            )}
            
            {/* Laundry Closet Info Display */}
            {localDeal.project_type === 'laundry_closet' && (
              <>
                {localDeal.laundry_model && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">דגם מסתור</label>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                      {localDeal.laundry_model}
                    </div>
                  </div>
                )}
                {localDeal.laundry_distance && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">מרחק (ס"מ)</label>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                      {localDeal.laundry_distance}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">אור</label>
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                    {localDeal.laundry_lighting ? 'כן' : 'לא'}
                  </div>
                </div>
                {localDeal.shape && ['ר', 'ח', 'מקיר לקיר'].includes(localDeal.shape) && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">צורה</label>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                      {localDeal.shape}
                    </div>
                  </div>
                )}
              </>
            )}
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
              <label className="block text-sm font-medium text-white/70 mb-2">הצללה</label>
              <select
                value={localDeal.shading_ratio || ''}
                onChange={(e) => {
                  const value = (e.target.value as '40/20' | '50/20' | '70/20' | '') || null
                  updateField('shading_ratio', value)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">בחר</option>
                <option value="40/20">40/20</option>
                <option value="50/20">50/20</option>
                <option value="70/20">70/20</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">גמר (RAL / דמוי עץ)</label>
              <select
                value={localDeal.finish_type || ''}
                onChange={(e) => {
                  const value = (e.target.value as 'ral' | 'wood' | '') || null
                  updateField('finish_type', value)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">בחר</option>
                <option value="ral">RAL</option>
                <option value="wood">דמוי עץ</option>
              </select>
              <input
                value={localDeal.finish_value || ''}
                onChange={(e) => updateField('finish_value', e.target.value || null)}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="קוד RAL או שם העץ"
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

          {/* Sketch & Offers Buttons */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowSketchModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-medium flex items-center justify-center gap-2"
            >
              <FileImage className="w-4 h-4" />
              {t.deals.openSketch}
            </button>
            <button
              onClick={() => setShowOfferModal(true)}
              className="px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-200 font-medium flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              יצירת הצעת מחיר
            </button>
          </div>

          {/* Offers List */}
          {deal.customer_name && (
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold mb-3">הצעות מחיר</h3>
              <OffersList 
                dealId={deal.id} 
                refreshTrigger={offersRefreshTrigger} 
                adminToken={adminToken}
              />
            </div>
          )}

          {/* Material Orders List */}
          {(localDeal.stage === 'material_ordered' || localDeal.stage === 'approved' || localDeal.stage === 'production' || localDeal.stage === 'install' || localDeal.stage === 'done') && (
            <div className="pt-4 border-t border-white/10">
              <MaterialOrdersList dealId={deal.id} adminToken={adminToken} />
            </div>
          )}

          {/* Profit Widget */}
          <div className="pt-4 border-t border-white/10">
            <ProfitWidget projectId={deal.id} revenue={revenue} />
          </div>

          {/* Work Log Section */}
          <div className="pt-4 border-t border-white/10">
            <WorkLogSection projectId={deal.id} />
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

      {/* Offer Modal */}
      {showOfferModal && localDeal.customer_name && (
        <CreateOfferModal
          dealId={deal.id}
          customerName={localDeal.customer_name}
          customerPhone={localDeal.customer_phone || undefined}
          customerCity={localDeal.customer_city || undefined}
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          onCreated={(offer) => {
            console.log('Offer created:', offer)
            setOffersRefreshTrigger(prev => prev + 1)
            setShowOfferModal(false)
          }}
        />
      )}

      {/* Laundry Closet Modal */}
      {showLaundryClosetModal && (
        <LaundryClosetModal
          deal={localDeal}
          onClose={() => setShowLaundryClosetModal(false)}
          onSave={(data) => {
            updateField('laundry_model', data.laundry_model)
            updateField('laundry_distance', data.laundry_distance)
            updateField('laundry_lighting', data.laundry_lighting)
            updateField('shape', data.shape)
            if (data.width !== undefined) updateField('width', data.width)
            if (data.depth !== undefined) updateField('depth', data.depth)
            setShowLaundryClosetModal(false)
          }}
        />
      )}
    </div>
  )
}

