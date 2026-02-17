import { getHebrewFontsCss } from './font-loader'

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_city: string
  status: string
  total_weight_kg: number
  total_amount: number
  final_amount: number
  discount_percent?: number
  discount_amount?: number
  delivery_address?: string
  delivery_date?: string
  notes?: string
  customer_notes?: string
  created_at: string
  order_items: Array<{
    id: string
    profile_id: string
    color: string
    length_meters: number
    quantity_pieces: number
    weight_per_piece: number
    total_weight_kg: number
    price_per_piece: number
    subtotal: number
    aluminum_profiles?: {
      code: string
      name_he: string
    }
  }>
}

export function renderOrderHtml(order: Order): string {
  const fonts = getHebrewFontsCss()
  const date = order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL')
  
  const statusLabels: Record<string, string> = {
    pending_price: 'ממתין למחיר',
    priced: 'מחיר הוגדר',
    confirmed: 'אושר',
    preparing: 'בהכנה',
    ready: 'מוכן',
    delivered: 'נמסר',
    cancelled: 'בוטל',
  }

  const statusLabel = statusLabels[order.status] || order.status || 'ממתין למחיר'
  
  // Ensure order_number exists
  const orderNumber = order.order_number || order.id?.slice(0, 8) || 'N/A'
  
  // Ensure order_items is an array
  const items = order.order_items || []

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הזמנה ${orderNumber}</title>
  <style>
    ${fonts}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Assistant', 'Arial', sans-serif;
      direction: rtl;
      color: #333;
      line-height: 1.6;
      padding: 20px;
      background: #fff;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 32px;
      color: #1e40af;
      margin-bottom: 10px;
    }
    
    .order-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    
    .info-section {
      flex: 1;
    }
    
    .info-section h2 {
      font-size: 18px;
      color: #1e40af;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 5px;
    }
    
    .info-row {
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .info-label {
      font-weight: bold;
      color: #4b5563;
      display: inline-block;
      width: 100px;
    }
    
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 14px;
      background: #fef3c7;
      color: #92400e;
      border: 2px solid #fbbf24;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .items-table thead {
      background: #1e40af;
      color: #fff;
    }
    
    .items-table th {
      padding: 12px;
      text-align: right;
      font-weight: bold;
      font-size: 14px;
    }
    
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .totals {
      margin-top: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
    }
    
    .total-row.final {
      font-size: 20px;
      font-weight: bold;
      color: #1e40af;
      border-top: 2px solid #1e40af;
      padding-top: 15px;
      margin-top: 10px;
    }
    
    .notes {
      margin-top: 30px;
      padding: 15px;
      background: #fef3c7;
      border-right: 4px solid #fbbf24;
      border-radius: 4px;
    }
    
    .notes h3 {
      color: #92400e;
      margin-bottom: 10px;
      font-size: 16px;
    }
    
    .notes p {
      color: #78350f;
      font-size: 14px;
      line-height: 1.8;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>הזמנה ${orderNumber}</h1>
    <div class="order-info">
      <div>
        <span class="status-badge">${statusLabel}</span>
      </div>
      <div>
        <div class="info-row">
          <span class="info-label">תאריך:</span>
          <span>${date}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="order-info">
    <div class="info-section">
      <h2>פרטי לקוח</h2>
      <div class="info-row">
        <span class="info-label">שם:</span>
        <span>${order.customer_name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">טלפון:</span>
        <span>${order.customer_phone}</span>
      </div>
      <div class="info-row">
        <span class="info-label">אימייל:</span>
        <span>${order.customer_email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">עיר:</span>
        <span>${order.customer_city}</span>
      </div>
      ${order.delivery_address ? `
      <div class="info-row">
        <span class="info-label">כתובת:</span>
        <span>${order.delivery_address}</span>
      </div>
      ` : ''}
      ${order.delivery_date ? `
      <div class="info-row">
        <span class="info-label">תאריך משלוח:</span>
        <span>${new Date(order.delivery_date).toLocaleDateString('he-IL')}</span>
      </div>
      ` : ''}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-right">קוד פרופיל</th>
        <th class="text-right">אורך</th>
        <th class="text-center">כמות</th>
        <th class="text-right">צבע</th>
        <th class="text-right">משקל יחידה</th>
        <th class="text-right">מחיר יחידה</th>
        <th class="text-right">סה"כ</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
                          <td class="text-right">${item.aluminum_profiles?.code || item.profile_id?.slice(0, 8) || 'N/A'}</td>
                          <td class="text-right">${(item.length_meters || 0).toFixed(1)}m</td>
                          <td class="text-center">${item.quantity_pieces || 0}</td>
                          <td class="text-right">${item.color && item.color !== 'default' ? item.color : '-'}</td>
                          <td class="text-right">${(item.weight_per_piece || 0).toFixed(2)} kg</td>
                          <td class="text-right">${(item.price_per_piece || 0).toFixed(2)} ₪</td>
                          <td class="text-right"><strong>${(item.subtotal || 0).toFixed(2)} ₪</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>סה"כ משקל:</span>
      <span><strong>${(order.total_weight_kg || 0).toFixed(2)} kg</strong></span>
    </div>
    <div class="total-row">
      <span>סה"כ לפני הנחה:</span>
      <span>${(order.total_amount || 0).toFixed(2)} ₪</span>
    </div>
    ${order.discount_percent && order.discount_percent > 0 ? `
    <div class="total-row">
      <span>הנחה ${order.discount_percent}%:</span>
      <span>-${((order.total_amount || 0) * order.discount_percent / 100).toFixed(2)} ₪</span>
    </div>
    ` : ''}
    ${order.discount_amount && order.discount_amount > 0 ? `
    <div class="total-row">
      <span>הנחה:</span>
      <span>-${order.discount_amount.toFixed(2)} ₪</span>
    </div>
    ` : ''}
    <div class="total-row final">
      <span>סה"כ לתשלום:</span>
      <span>${(order.final_amount || order.total_amount || 0).toFixed(2)} ₪</span>
    </div>
  </div>

  ${order.notes || order.customer_notes ? `
  <div class="notes">
    ${order.notes ? `
    <h3>הערות:</h3>
    <p>${order.notes}</p>
    ` : ''}
    ${order.customer_notes ? `
    <h3>הערות לקוח:</h3>
    <p>${order.customer_notes}</p>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>נוצר ב-${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}</p>
  </div>
</body>
</html>
  `
}
