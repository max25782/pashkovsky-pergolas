"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { SketchModal } from './SketchModal'
import { FileImage, FileText } from 'lucide-react'
import { useCRMTranslations } from './useCRMTranslations'
import { useToast } from '@/components/ui/toast'
import { WorkLogSection } from '../workers/WorkLogSection'
import { ProfitWidget } from '../workers/ProfitWidget'
import { useProjectRevenue } from '@/hooks/useProjectRevenue'
import { LaundryClosetModal } from './LaundryClosetModal'
import { MaterialOrdersList } from './MaterialOrdersList'
import { RailingsFormFields, type RailingsFormValue } from './RailingsFormFields'
import { FenceFormFields, type FenceFormValue } from './FenceFormFields'
import { DealPaymentsWidget } from './DealPaymentsWidget'
import { ContractorPaymentPlan } from './deals/templates/ContractorPaymentPlan'
import { authFetch } from '@/lib/api/auth-fetch'
import { useLanguage } from '@/lib/language-context'
import { FinanceBlock } from './deals/FinanceBlock'
import { CollapsibleSection } from './deals/CollapsibleSection'
import { DealQuickActions } from './deals/DealQuickActions'

const OffersListLoading = () => {
  const t = useCRMTranslations()
  return (
    <div className="flex min-h-[200px] items-center justify-center text-center text-sm text-white/50">
      {t.deals.loadingOffers}
    </div>
  )
}

const OffersList = dynamic(
  () => import('../offers/OffersList').then((m) => ({ default: m.OffersList })),
  {
    ssr: false,
    loading: () => <OffersListLoading />,
  },
)

const CreateOfferModal = dynamic(
  () => import('../offers/CreateOfferModal').then((m) => ({ default: m.CreateOfferModal })),
  { ssr: false, loading: () => null },
)

interface DealModalProps {
  deal: Deal
  onClose: () => void
  onUpdate: (updates: Partial<Deal>) => Promise<any>
  onDelete: () => void
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (dateStr: string | null | undefined) => string
  adminToken?: string
}

export function DealModal({
  deal,
  onClose,
  onUpdate,
  onDelete,
  formatCurrency,
  formatDate,
  adminToken = ''
}: DealModalProps) {
  const t = useCRMTranslations()
  const toast = useToast()
  const stages = getStages(t.deals)
  const [localDeal, setLocalDeal] = useState(deal)
  const [saving, setSaving] = useState(false)
  const [showSketchModal, setShowSketchModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showLaundryClosetModal, setShowLaundryClosetModal] = useState(false)
  const [offersRefreshTrigger, setOffersRefreshTrigger] = useState(0)
  const [shiftsRefreshTrigger, setShiftsRefreshTrigger] = useState(0)
  const [openPaymentFormSignal, setOpenPaymentFormSignal] = useState(0)
  const [openWorkShiftSignal, setOpenWorkShiftSignal] = useState(0)
  const { language } = useLanguage()

  function railingsGlazingFromRow(g: string | null | undefined): RailingsFormValue['glazing_system'] {
    return g === 'aluminum_glass' || g === 'wet_glazing' || g === 'dry_glazing' ? g : ''
  }

  const [railingsForm, setRailingsForm] = useState<RailingsFormValue>(() => {
    const rd = deal.deal_railings_details
    const row = Array.isArray(rd) ? rd[0] : rd
    return {
      meters_total: row?.meters_total ?? null,
      height_cm: row?.height_cm ?? null,
      profile_type: row?.profile_type ?? '',
      color: row?.color ?? '',
      location_type: (row?.location_type as RailingsFormValue['location_type']) ?? 'balcony',
      glazing_system: railingsGlazingFromRow(row?.glazing_system),
      glass_type: row?.glass_type ?? '',
      notes: row?.notes ?? '',
    }
  })

  const [fenceForm, setFenceForm] = useState<FenceFormValue>(() => {
    const fd = deal.deal_fence_details
    const row = Array.isArray(fd) ? fd[0] : fd
    const fv = row?.fence_variant
    return {
      meters_total: row?.meters_total ?? null,
      height_cm: row?.height_cm ?? null,
      fence_variant: fv === 'classic' || fv === 'hitech' || fv === 'hitech_angular' ? fv : '',
      color: row?.color ?? '',
      notes: row?.notes ?? '',
    }
  })
  
  // Get revenue from offers
  const revenue = useProjectRevenue(deal.id)

  useEffect(() => {
    setLocalDeal(deal)
    const rd = deal.deal_railings_details
    const row = Array.isArray(rd) ? rd[0] : rd
    if (deal.work_type === 'railings' && row) {
      setRailingsForm({
        meters_total: row.meters_total ?? null,
        height_cm: row.height_cm ?? null,
        profile_type: row.profile_type ?? '',
        color: row.color ?? '',
        location_type: (row.location_type as RailingsFormValue['location_type']) ?? 'balcony',
        glazing_system: railingsGlazingFromRow(row.glazing_system),
        glass_type: row.glass_type ?? '',
        notes: row.notes ?? '',
      })
    } else if (deal.work_type === 'railings') {
      setRailingsForm({
        meters_total: null,
        height_cm: null,
        profile_type: '',
        color: '',
        location_type: 'balcony',
        glazing_system: '',
        glass_type: '',
        notes: '',
      })
    }

    const fd = deal.deal_fence_details
    const frow = Array.isArray(fd) ? fd[0] : fd
    if (deal.work_type === 'fence' && frow) {
      const fv = frow.fence_variant
      setFenceForm({
        meters_total: frow.meters_total ?? null,
        height_cm: frow.height_cm ?? null,
        fence_variant: fv === 'classic' || fv === 'hitech' || fv === 'hitech_angular' ? fv : '',
        color: frow.color ?? '',
        notes: frow.notes ?? '',
      })
    } else if (deal.work_type === 'fence') {
      setFenceForm({
        meters_total: null,
        height_cm: null,
        fence_variant: '',
        color: '',
        notes: '',
      })
    }
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
      if (localDeal.work_type !== deal.work_type) updates.work_type = localDeal.work_type
      if (localDeal.customer_type !== deal.customer_type) updates.customer_type = localDeal.customer_type
      if (localDeal.pricing_model !== deal.pricing_model) updates.pricing_model = localDeal.pricing_model
      if (JSON.stringify(localDeal.contractor_payment_profile) !== JSON.stringify(deal.contractor_payment_profile)) {
        updates.contractor_payment_profile = localDeal.contractor_payment_profile
      }

      if (localDeal.work_type === 'railings' && railingsForm) {
        updates.meters_total = railingsForm.meters_total ?? undefined
        updates.height_cm = railingsForm.height_cm ?? undefined
        updates.profile_type = railingsForm.profile_type || undefined
        updates.color = railingsForm.color || undefined
        updates.location_type = railingsForm.location_type
        updates.glazing_system = railingsForm.glazing_system || undefined
        updates.glass_type = railingsForm.glass_type || undefined
        updates.railings_notes = railingsForm.notes || undefined
      }

      if (localDeal.work_type === 'railings') {
        if (!railingsForm.meters_total || railingsForm.meters_total <= 0) {
          toast.error(`${t.deals.metersTotal} ${t.deals.required}`)
          return
        }
        if (!railingsForm.profile_type?.trim()) {
          toast.error(`${t.deals.profileType} ${t.deals.required}`)
          return
        }
        if (!railingsForm.color?.trim()) {
          toast.error(`${t.deals.color} ${t.deals.required}`)
          return
        }
        if (!railingsForm.glazing_system) {
          toast.error(`${t.deals.glazingSystem} ${t.deals.required}`)
          return
        }
      }

      if (localDeal.work_type === 'fence' && fenceForm) {
        updates.fence_meters_total = fenceForm.meters_total ?? undefined
        updates.fence_height_cm = fenceForm.height_cm ?? undefined
        updates.fence_variant = fenceForm.fence_variant || undefined
        updates.fence_color = fenceForm.color || undefined
        updates.fence_notes = fenceForm.notes || undefined
      }

      if (localDeal.work_type === 'fence') {
        if (!fenceForm.meters_total || fenceForm.meters_total <= 0) {
          toast.error(`${t.deals.metersTotal} ${t.deals.required}`)
          return
        }
        if (!fenceForm.fence_variant) {
          toast.error(`${t.deals.fenceVariant} ${t.deals.required}`)
          return
        }
        if (!fenceForm.color?.trim()) {
          toast.error(`${t.deals.color} ${t.deals.required}`)
          return
        }
      }

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
          <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{t.deals.dealTitle}: {deal.customer_name || t.deals.withoutName}</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-6 p-3 sm:p-6" dir={language === 'he' ? 'rtl' : 'ltr'}>
          <FinanceBlock
            dealId={deal.id}
            breakdownRefreshKey={shiftsRefreshTrigger + offersRefreshTrigger}
            clientPrice={localDeal.price}
            totalCosts={localDeal.my_cost}
            onClientPriceChange={(v) => updateField('price', v)}
            onTotalCostsChange={(v) => updateField('my_cost', v)}
            formatCurrency={formatCurrency}
            labels={{
              clientPrice: t.deals.financeClientPrice,
              totalCosts: t.deals.financeTotalCosts,
              profit: t.deals.financeProfitLabel,
              margin: t.deals.financeMarginLabel,
              warnNoCostsYet: t.deals.financeWarnNoCostsYet,
              warnAddPriceCosts: t.deals.financeWarnAddPriceCosts,
              warnZeroCostsNoMargin: t.deals.financeWarnZeroCostsNoMargin,
              placeholderPrice: t.deals.financePlaceholderPrice,
              placeholderCosts: t.deals.financePlaceholderCosts,
              costBreakdownTitle: t.deals.financeCostBreakdown,
              laborFromShifts: t.deals.financeLaborFromShifts,
              materialOrdersFromSystem: t.deals.materialOrdersSystemTotal,
              materialOrdersOrderCountTemplate: t.deals.financeMaterialOrdersOrderCountTpl,
              noMaterialOrdersDash: t.deals.financeNoOrdersDash,
              totalInternalForProfit: t.deals.financeTotalInternalForProfit,
              loadingBreakdown: t.deals.financeLoadingBreakdown,
              financeProfitFootnote: t.deals.financeProfitFootnote,
            }}
          />
          <DealQuickActions
            labelExpense={t.deals.addExpense}
            labelWorkDay={t.deals.addWorkDay}
            onAddExpense={() => {
              setOpenPaymentFormSignal((s) => s + 1)
              requestAnimationFrame(() =>
                document.getElementById('deal-expenses-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              )
            }}
            onAddWorkDay={() => {
              setOpenWorkShiftSignal((s) => s + 1)
              requestAnimationFrame(() =>
                document.getElementById('deal-work-log-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              )
            }}
          />

          <CollapsibleSection title={t.deals.sectionClient} defaultClosed>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </CollapsibleSection>

          <CollapsibleSection title={t.deals.sectionProjectSpecs} defaultClosed>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.customerType}</label>
              <select
                value={localDeal.customer_type || 'private'}
                onChange={(e) => updateField('customer_type', (e.target.value || 'private') as 'private' | 'contractor')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="private">{t.deals.customerTypes.private}</option>
                <option value="contractor">{t.deals.customerTypes.contractor}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.workType}</label>
              <select
                value={localDeal.work_type || 'pergola'}
                onChange={(e) => updateField('work_type', (e.target.value || 'pergola') as 'pergola' | 'railings' | 'gates' | 'facade' | 'fence' | 'other')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="pergola">{t.deals.workTypes.pergola}</option>
                <option value="railings">{t.deals.workTypes.railings}</option>
                <option value="gates">{t.deals.workTypes.gates}</option>
                <option value="facade">{t.deals.workTypes.facade}</option>
                <option value="fence">{t.deals.workTypes.fence}</option>
                <option value="other">{t.deals.workTypes.other}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.pricingModel}</label>
              <select
                value={localDeal.pricing_model || 'fixed'}
                onChange={(e) => updateField('pricing_model', (e.target.value || 'fixed') as 'fixed' | 'per_meter' | 'per_sqm' | 'custom')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="fixed">{t.deals.pricingModels.fixed}</option>
                <option value="per_meter">{t.deals.pricingModels.per_meter}</option>
                <option value="per_sqm">{t.deals.pricingModels.per_sqm}</option>
                <option value="custom">{t.deals.pricingModels.custom}</option>
              </select>
            </div>
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
                <option value="fence">{t.deals.projectTypes.fence}</option>
              </select>
              {localDeal.project_type === 'laundry_closet' && (
                <button
                  type="button"
                  onClick={() => setShowLaundryClosetModal(true)}
                  className="mt-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm text-white"
                >
                  {t.deals.laundryDetails}
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
            {localDeal.work_type !== 'railings' && localDeal.work_type !== 'fence' && (
              <>
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
              </>
            )}
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
            {localDeal.project_type !== 'laundry_closet' && localDeal.work_type !== 'railings' && localDeal.work_type !== 'fence' && (
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
                    <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.laundryModel}</label>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                      {localDeal.laundry_model}
                    </div>
                  </div>
                )}
                {localDeal.laundry_distance && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.laundryDistance}</label>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                      {localDeal.laundry_distance}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.laundryLight}</label>
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
                    {localDeal.laundry_lighting ? t.common.yes : t.common.no}
                  </div>
                </div>
                {localDeal.shape && ['ר', 'ח', 'מקיר לקיר'].includes(localDeal.shape) && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.shape}</label>
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
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.shading}</label>
              <select
                value={localDeal.shading_ratio || ''}
                onChange={(e) => {
                  const value = (e.target.value as '40/20' | '50/20' | '70/20' | '') || null
                  updateField('shading_ratio', value)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">{t.deals.selectOption}</option>
                <option value="40/20">40/20</option>
                <option value="50/20">50/20</option>
                <option value="70/20">70/20</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.finishType}</label>
              <select
                value={localDeal.finish_type || ''}
                onChange={(e) => {
                  const value = (e.target.value as 'ral' | 'wood' | '') || null
                  updateField('finish_type', value)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">{t.deals.selectOption}</option>
                <option value="ral">RAL</option>
                <option value="wood">{t.deals.woodOption}</option>
              </select>
              <input
                value={localDeal.finish_value || ''}
                onChange={(e) => updateField('finish_value', e.target.value || null)}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.deals.ralPlaceholder}
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

          {/* Railings Details (when work_type is railings) */}
          {localDeal.work_type === 'railings' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t.deals.railingsDetails}</h3>
              <RailingsFormFields
                value={railingsForm}
                onChange={setRailingsForm}
                readOnly={false}
                translations={{
                  metersTotal: t.deals.metersTotal,
                  heightCm: t.deals.heightCm,
                  profileType: t.deals.profileType,
                  profilePlaceholder: t.deals.railingProfilePlaceholder,
                  color: t.deals.color,
                  locationType: t.deals.locationType,
                  glazingSystem: t.deals.glazingSystem,
                  glazingAluminumGlass: t.deals.glazingAluminumGlass,
                  glazingWet: t.deals.glazingWet,
                  glazingDry: t.deals.glazingDry,
                  glassType: t.deals.glassType,
                  notes: t.deals.notes,
                  required: t.deals.required,
                }}
              />
            </div>
          )}

          {localDeal.work_type === 'fence' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t.deals.fenceDetails}</h3>
              <FenceFormFields
                value={fenceForm}
                onChange={setFenceForm}
                readOnly={false}
                translations={{
                  metersTotal: t.deals.metersTotal,
                  heightCm: t.deals.heightCm,
                  fenceVariant: t.deals.fenceVariant,
                  fenceClassic: t.deals.fenceClassic,
                  fenceHitech: t.deals.fenceHitech,
                  fenceHitechAngular: t.deals.fenceHitechAngular,
                  color: t.deals.color,
                  notes: t.deals.notes,
                  required: t.deals.required,
                }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t.deals.notes}</label>
            <textarea
              value={localDeal.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="min-h-[120px] w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 focus:bg-white/10 focus:outline-none"
              placeholder={t.deals.notes}
            />
          </div>
          </CollapsibleSection>

          {/* Sketch & Offers Buttons (hide sketch for railings) */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {localDeal.work_type !== 'railings' && localDeal.work_type !== 'fence' && (
              <button
                onClick={() => setShowSketchModal(true)}
                className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-medium flex items-center justify-center gap-2"
              >
                <FileImage className="w-4 h-4" />
                {t.deals.openSketch}
              </button>
            )}
            <button
              onClick={() => setShowOfferModal(true)}
              className="px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-200 font-medium flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {t.deals.btnCreateOffer2}
            </button>
          </div>

          {/* Offers List */}
          {deal.customer_name && (
            <div className="min-h-[200px] border-t border-white/10 pt-4">
              <h3 className="mb-3 text-lg font-semibold">{t.deals.offersTitle}</h3>
              <OffersList
                dealId={deal.id}
                dealSource={localDeal.source ?? null}
                refreshTrigger={offersRefreshTrigger}
                adminToken={adminToken}
                onOffersChanged={() => setOffersRefreshTrigger((prev) => prev + 1)}
                onDealPromotedToCrm={() =>
                  setLocalDeal((prev) => ({ ...prev, source: 'quick_offer_saved' }))
                }
              />
            </div>
          )}

          {/* Material Orders List */}
          <div className="pt-4 border-t border-white/10">
            <MaterialOrdersList dealId={deal.id} adminToken={adminToken} refreshKey={offersRefreshTrigger} />
          </div>

          {/* Payment Plan (contractor only) */}
          {localDeal.customer_type === 'contractor' && (
            <div className="pt-4 border-t border-white/10">
              <ContractorPaymentPlan
                profile={localDeal.contractor_payment_profile}
                totalPrice={localDeal.price}
                formatCurrency={formatCurrency}
              />
            </div>
          )}

          {/* Payments Widget */}
          <div id="deal-expenses-anchor" className="border-t border-white/10 pt-4 scroll-mt-24">
            <DealPaymentsWidget
              dealId={deal.id}
              dealPrice={localDeal.price}
              formatCurrency={formatCurrency}
              openAddFormSignal={openPaymentFormSignal}
              emptyHint={t.deals.noExpensesYet}
              translations={{
                title: t.deals.payments,
                totalPaid: t.deals.totalPaid,
                paidThisMonth: t.deals.paidThisMonth,
                paidLastMonth: t.deals.paidLastMonth,
                percentOfPrice: t.deals.percentOfPrice,
                addPayment: t.deals.addPayment,
              }}
            />
          </div>

          {/* Work Log Section */}
          <div id="deal-work-log-anchor" className="border-t border-white/10 pt-4 scroll-mt-24">
            <WorkLogSection
              projectId={deal.id}
              openModalSignal={openWorkShiftSignal}
              emptyMessage={t.deals.noWorkDaysYet}
              onShiftAdded={() => setShiftsRefreshTrigger((prev) => prev + 1)}
            />
          </div>

          <CollapsibleSection title={t.deals.sectionDetailedProfit} defaultClosed>
            <ProfitWidget
              projectId={deal.id}
              revenue={revenue || localDeal.price || 0}
              materialCost={localDeal.my_cost || 0}
              refreshTrigger={shiftsRefreshTrigger}
            />
          </CollapsibleSection>

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

            // Use authFetch to automatically add JWT token from Supabase session
            const response = await authFetch('/admin-api/deals/sketch', {
              method: 'POST',
              body: formData,
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error('[DealModal] Sketch save error:', response.status, errorText)
              throw new Error(`Failed to save sketch: ${response.status} ${errorText}`)
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
          onCreated={() => {
            setOffersRefreshTrigger((prev) => prev + 1)
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

