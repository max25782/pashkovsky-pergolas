"use client"
import { useState } from "react"
import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { useCRMTranslations } from './useCRMTranslations'

interface CreateDealModalProps {
  onClose: () => void
  onCreate: (dealData: Partial<Deal>) => Promise<any>
}

export function CreateDealModal({
  onClose,
  onCreate
}: CreateDealModalProps) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
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
      alert(t.deals.customerName === 'Customer Name' ? 'Please fill in customer name and phone' : t.deals.customerName === 'Имя клиента' ? 'Пожалуйста, заполните имя и телефон клиента' : 'אנא מלא שם וטלפון של הלקוח')
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
          <h2 className="text-2xl font-bold text-white">{t.deals.dealTitleCreate}</h2>
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
            <h3 className="text-lg font-semibold text-white mb-4">{t.deals.customerInfo}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  {t.deals.customerName} <span className="text-red-400">{t.deals.required}</span>
                </label>
                <input
                  value={dealData.customer_name || ''}
                  onChange={(e) => updateField('customer_name', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.customerName}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  {t.deals.customerPhone} <span className="text-red-400">{t.deals.required}</span>
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
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerEmail}</label>
                <input
                  type="email"
                  value={dealData.customer_email || ''}
                  onChange={(e) => updateField('customer_email', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerCity}</label>
                <input
                  value={dealData.customer_city || ''}
                  onChange={(e) => updateField('customer_city', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.customerCity}
                />
              </div>
            </div>
          </div>

          {/* Project Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t.deals.projectInfo}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.projectType}</label>
                <select
                  value={dealData.project_type || ''}
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
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.stage}</label>
                <select
                  value={dealData.stage || ''}
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
                  value={dealData.width || ''}
                  onChange={(e) => updateField('width', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.depth}</label>
                <input
                  type="number"
                  value={dealData.depth || ''}
                  onChange={(e) => updateField('depth', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.shape}</label>
                <select
                  value={dealData.shape || ''}
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
                  value={dealData.price || ''}
                  onChange={(e) => updateField('price', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.myCost}</label>
                <input
                  type="number"
                  value={dealData.my_cost || ''}
                  onChange={(e) => updateField('my_cost', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.orderDate}</label>
                <input
                  type="datetime-local"
                  value={dealData.order_date || ''}
                  onChange={(e) => updateField('order_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.materialOrderDate}</label>
                <input
                  type="datetime-local"
                  value={dealData.material_order_date || ''}
                  onChange={(e) => updateField('material_order_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.materialReceivedDate}</label>
                <input
                  type="datetime-local"
                  value={dealData.material_received_date || ''}
                  onChange={(e) => updateField('material_received_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.installationDate}</label>
                <input
                  type="datetime-local"
                  value={dealData.installation_date || ''}
                  onChange={(e) => updateField('installation_date', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.lighting}</label>
                <input
                  value={dealData.lighting || ''}
                  onChange={(e) => updateField('lighting', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.lighting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.material}</label>
                <input
                  value={dealData.material || ''}
                  onChange={(e) => updateField('material', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.material}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.colorRal}</label>
                <input
                  value={dealData.color_ral || ''}
                  onChange={(e) => updateField('color_ral', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.colorRal}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.manager}</label>
                <input
                  value={dealData.manager || ''}
                  onChange={(e) => updateField('manager', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder={t.deals.manager}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.notes}</label>
            <textarea
              value={dealData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none min-h-[120px]"
              placeholder={t.deals.notes}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !dealData.customer_name || !dealData.customer_phone}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t.common.saving : t.deals.createDeal}
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
    </div>
  )
}

