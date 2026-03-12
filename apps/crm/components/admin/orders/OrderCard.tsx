'use client'

import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { getStatusColor, getStatusLabel } from './order-constants'
import type { Language } from './order-constants'
import type { Order } from './order-types'

interface Props {
  order: Order
  lang: Language
  onEdit: (order: Order) => void
  onDelete: (order: Order) => void
  onGeneratePdf: (order: Order) => void
}

export function OrderCard({ order, lang, onEdit, onDelete, onGeneratePdf }: Props) {
  const t = useCRMTranslations()

  const phone = lang === 'ru' ? 'Телефон' : lang === 'en' ? 'Phone' : 'טלפון'
  const city = lang === 'ru' ? 'Город' : lang === 'en' ? 'City' : 'עיר'
  const address = lang === 'ru' ? 'Адрес' : lang === 'en' ? 'Address' : 'כתובת'

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold mb-2">
            {order.order_number || order.id.slice(0, 8)}
          </h2>
          <div className="text-sm text-white/60 space-y-1">
            <p><strong>{t.orders.customer}:</strong> {order.customer_name}</p>
            <p><strong>{phone}:</strong> {order.customer_phone}</p>
            {order.customer_email && <p><strong>Email:</strong> {order.customer_email}</p>}
            <p><strong>{city}:</strong> {order.customer_city}</p>
            {order.delivery_address && (
              <p><strong>{address}:</strong> {order.delivery_address}</p>
            )}
          </div>
        </div>

        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-3 sm:gap-0 flex-wrap">
          <div className="sm:text-right">
            <span className={`px-3 py-1 rounded border text-sm ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status, lang)}
            </span>
            <p className="mt-2 text-lg font-bold">
              {order.final_amount?.toLocaleString('he-IL')} ₪
            </p>
            <p className="text-sm text-white/60">
              {new Date(order.created_at).toLocaleDateString(
                lang === 'he' ? 'he-IL' : lang === 'ru' ? 'ru-RU' : 'en-US',
              )}
            </p>
          </div>
          <div className="mt-0 sm:mt-2 flex flex-wrap gap-2 justify-start sm:justify-end">
            <button
              onClick={() => onGeneratePdf(order)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition"
            >
              {t.orders.generatePdf}
            </button>
            <button
              onClick={() => onEdit(order)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
            >
              {t.common.edit}
            </button>
            <button
              onClick={() => onDelete(order)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition"
            >
              {t.common.delete}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <h3 className="font-semibold mb-2">{t.orders.items}:</h3>
        <div className="space-y-2">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between text-sm bg-white/5 rounded p-2">
              <div>
                <span className="font-medium">
                  {item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}
                </span>
                {' — '}
                {item.length_meters}m × {item.quantity_pieces}
                {item.color !== 'default' && ` (${item.color})`}
              </div>
              <div className="text-white/60">{item.subtotal?.toLocaleString('he-IL')} ₪</div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between font-semibold text-sm">
          <span>{t.orders.totalWeight}: {order.total_weight_kg?.toFixed(2)} kg</span>
          <span>{t.orders.totalAmount}: {order.total_amount?.toLocaleString('he-IL')} ₪</span>
        </div>
      </div>
    </div>
  )
}
