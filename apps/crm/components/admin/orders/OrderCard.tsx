'use client'

import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useLanguage } from '@/lib/language-context'
import type { Order } from './order-types'

interface Props {
  order: Order
  onEdit: (order: Order) => void
  getStatusColor: (status: string) => string
  getStatusLabel: (status: string) => string
}

export function OrderCard({ order, onEdit, getStatusColor, getStatusLabel }: Props) {
  const t = useCRMTranslations()
  const { language } = useLanguage()

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">
            {order.order_number || order.id.slice(0, 8)}
          </h2>
          <div className="text-sm text-white/60 space-y-1">
            <p><strong>{t.orders.customer}:</strong> {order.customer_name}</p>
            <p>
              <strong>{language === 'he' ? 'טלפון' : language === 'ru' ? 'Телефон' : 'Phone'}:</strong>{' '}
              {order.customer_phone}
            </p>
            {order.customer_email && <p><strong>Email:</strong> {order.customer_email}</p>}
            <p>
              <strong>{language === 'he' ? 'עיר' : language === 'ru' ? 'Город' : 'City'}:</strong>{' '}
              {order.customer_city}
            </p>
            {order.delivery_address && (
              <p>
                <strong>{language === 'he' ? 'כתובת' : language === 'ru' ? 'Адрес' : 'Address'}:</strong>{' '}
                {order.delivery_address}
              </p>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 ml-4">
          <span className={`px-3 py-1 rounded border text-sm ${getStatusColor(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
          <p className="mt-2 text-lg font-bold">{order.final_amount?.toLocaleString('he-IL')} ₪</p>
          <p className="text-sm text-white/60">
            {new Date(order.created_at).toLocaleDateString(
              language === 'he' ? 'he-IL' : language === 'ru' ? 'ru-RU' : 'en-US'
            )}
          </p>
          <button
            onClick={() => onEdit(order)}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
          >
            {t.common.edit}
          </button>
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
