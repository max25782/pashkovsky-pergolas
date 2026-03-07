import { getHebrewFontsCss, getLogoDataUri } from './font-loader'

interface OrderItem {
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
    image_url?: string
  }
}

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
  order_items: Array<OrderItem>
}

// Israel VAT rate since January 2025
const VAT_RATE = 0.18

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getColorLabel(color: string): string {
  if (!color || color === 'default') return '-'
  const map: Record<string, string> = {
    bronze: 'ברונזה',
    ברונזה: 'ברונזה',
    white: 'לבן',
    לבן: 'לבן',
    black: 'שחור',
    שחור: 'שחור',
    silver: 'כסף/מטאלי',
    מטאלי: 'מטאלי',
    anodized: 'מגורען',
    מגורען: 'מגורען',
    ral: 'RAL',
    wood: 'דמוי עץ',
    'דמוי עץ': 'דמוי עץ',
    raw: 'ללא ציפוי',
    גולמי: 'ללא ציפוי',
    passivation: 'פסיבציה',
    פסיבציה: 'פסיבציה',
  }
  return map[color] ?? map[color.toLowerCase()] ?? color
}

function groupByColor(items: OrderItem[]): Array<{ name: string; qty: string; pricePerKg: string; amount: string }> {
  const groups = new Map<string, { weight: number; pieces: number; amount: number; pricePerKgSum: number; priceCount: number }>()
  for (const item of items) {
    const key = getColorLabel(item.color)
    const g = groups.get(key) ?? { weight: 0, pieces: 0, amount: 0, pricePerKgSum: 0, priceCount: 0 }
    g.weight += item.total_weight_kg ?? 0
    g.pieces += item.quantity_pieces ?? 0
    g.amount += item.subtotal ?? 0
    // Calculate price per kg for this item
    if (item.weight_per_piece > 0 && item.price_per_piece > 0) {
      g.pricePerKgSum += item.price_per_piece / item.weight_per_piece
      g.priceCount += 1
    }
    groups.set(key, g)
  }
  const result = Array.from(groups.entries()).map(([name, g]) => {
    const avgPricePerKg = g.priceCount > 0 ? g.pricePerKgSum / g.priceCount : 0
    return {
      name,
      qty: g.weight > 0 ? `${g.weight.toFixed(2)} ק"ג` : `${g.pieces} יח'`,
      pricePerKg: avgPricePerKg > 0 ? `${avgPricePerKg.toFixed(2)} ₪/ק"ג` : '',
      amount: formatCurrency(g.amount),
    }
  })
  // Pad to multiple of 3 for grid
  while (result.length % 3 !== 0) result.push({ name: '', qty: '', pricePerKg: '', amount: '' })
  return result
}

// imageMap: image_url → base64 data URI, prefetched by generate-order-pdf.tsx
export function renderOrderHtml(order: Order, imageMap: Record<string, string> = {}): string {
  const fonts = getHebrewFontsCss()
  const logoUri = getLogoDataUri()

  const dt = order.created_at ? new Date(order.created_at) : new Date()
  const date = dt.toLocaleDateString('he-IL')
  const time = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  const orderNumber = order.order_number || order.id?.slice(0, 8) || 'N/A'
  const quoteNumber = `Q-${orderNumber}`
  const items = order.order_items ?? []
  const colorGroups = groupByColor(items)

  const preVatAmount = order.final_amount || order.total_amount || 0
  const vatAmount = Math.round(preVatAmount * VAT_RATE * 100) / 100
  const totalWithVat = Math.round((preVatAmount + vatAmount) * 100) / 100
  const totalWeight = order.total_weight_kg || 0

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

  const header = `
    <div class="page-header">
      <div class="header-inner">
        <div class="header-right">
          <div class="ci-row"><span class="ci-label">שם הלקוח:</span><span class="ci-val">${order.customer_name}</span></div>
          <div class="ci-row"><span class="ci-label">כתובת:</span><span class="ci-val">${order.delivery_address || order.customer_city || '-'}</span></div>
          <div class="ci-row"><span class="ci-label">טלפון נייד:</span><span class="ci-val">${order.customer_phone || '-'}</span></div>
          ${order.customer_email ? `<div class="ci-row"><span class="ci-label">אימייל:</span><span class="ci-val">${order.customer_email}</span></div>` : ''}
        </div>
        <div class="header-left">
          ${logoUri ? `<img src="${logoUri}" class="logo" alt="לוגו">` : `<div class="company-name">פשקובסקי</div>`}
        </div>
      </div>
    </div>`

  const footer = `
    <div class="page-footer">
      <div class="footer-cols">
        <div class="footer-col"><span class="fl">מספר הצעת מחיר:</span><span class="fv">${quoteNumber}</span></div>
        <div class="footer-col"><span class="fl">תאריך עדכון אחרון:</span><span class="fv">${date} ${time}</span></div>
        ${order.notes ? `<div class="footer-col"><span class="fl">הערות:</span><span class="fv">${order.notes.substring(0, 60)}</span></div>` : '<div class="footer-col"></div>'}
      </div>
    </div>`

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>${quoteNumber}</title>
  <style>
    ${fonts}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'NotoSansHebrew', 'Arial Unicode MS', Arial, sans-serif;
      direction: rtl;
      color: #1a1a1a;
      background: #fff;
      font-size: 11px;
      line-height: 1.45;
    }

    /* ── Page layout ── */
    .page {
      padding: 12mm 14mm 8mm 14mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
    }
    .page-content { flex: 1; }
    .page-break { page-break-before: always; }

    /* ── Header ── */
    .page-header {
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left { text-align: left; }
    .logo { height: 48px; object-fit: contain; }
    .company-name { font-size: 22px; font-weight: bold; color: #1e3a5f; }
    .header-right { text-align: right; }
    .ci-row { margin-bottom: 2px; }
    .ci-label { font-weight: bold; color: #555; margin-left: 5px; }
    .ci-val { color: #222; }

    /* ── Quote title ── */
    .quote-title {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      color: #1e3a5f;
      padding: 7px 12px;
      background: #eef3fa;
      border-radius: 4px;
      margin-bottom: 14px;
    }
    .status-badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 3px;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fbbf24;
      font-weight: normal;
      vertical-align: middle;
    }

    /* ── Summary grid ── */
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #1e3a5f;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid #bbb;
      border-right: 1px solid #bbb;
      margin-bottom: 18px;
    }
    .sg-cell {
      border-left: 1px solid #bbb;
      border-bottom: 1px solid #bbb;
      padding: 7px 8px;
      text-align: center;
      min-height: 48px;
    }
    .sg-cell.empty { background: #f8f8f8; }
    .sg-name { font-weight: bold; font-size: 11px; color: #1e3a5f; display: block; margin-bottom: 2px; }
    .sg-qty  { font-size: 10px; color: #555; display: block; }
    .sg-pkg  { font-size: 10px; color: #1e3a5f; display: block; font-weight: bold; }
    .sg-amt  { font-size: 11px; font-weight: bold; color: #222; display: block; }

    /* ── Items table ── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 10px;
    }
    .items-table thead tr { background: #1e3a5f; color: #fff; }
    .items-table th {
      padding: 6px 4px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #2a4a70;
      white-space: nowrap;
    }
    .items-table td {
      padding: 5px 4px;
      text-align: center;
      border: 1px solid #ddd;
      vertical-align: middle;
    }
    .items-table tbody tr:nth-child(even) { background: #f5f8fc; }
    .td-code { font-weight: bold; font-size: 9px; }
    .td-name { text-align: right; font-size: 10px; }
    .td-amt  { font-weight: bold; color: #1e3a5f; }
    .td-img  { width: 44px; padding: 3px !important; }
    .td-img img { width: 40px; height: 40px; object-fit: contain; display: block; margin: 0 auto; border-radius: 2px; }
    .td-img .no-img { width: 40px; height: 40px; background: #f0f0f0; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #aaa; margin: 0 auto; }

    /* ── Totals ── */
    .totals-wrap {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .totals-table {
      border-collapse: collapse;
      min-width: 300px;
    }
    .totals-table td {
      padding: 7px 12px;
      font-size: 12px;
      border: 1px solid #ddd;
    }
    .tl { text-align: right; font-weight: bold; color: #444; }
    .tv { text-align: left; font-weight: bold; min-width: 110px; }
    .row-vat td  { background: #f0f4f8; }
    .row-grand td { background: #1e3a5f; color: #fff; font-size: 14px; }

    /* ── Delivery / notes ── */
    .delivery-box {
      flex: 1;
      min-width: 180px;
      padding: 10px;
      background: #f0f4f8;
      border-right: 3px solid #1e3a5f;
      border-radius: 2px;
      font-size: 11px;
    }
    .delivery-box h3 { font-size: 12px; color: #1e3a5f; margin-bottom: 6px; }
    .notes-box {
      margin-top: 12px;
      padding: 10px;
      background: #fffbeb;
      border: 1px solid #fbbf24;
      border-radius: 4px;
      font-size: 11px;
    }

    /* ── Terms ── */
    .terms-title {
      font-size: 14px;
      font-weight: bold;
      color: #1e3a5f;
      text-align: center;
      padding: 8px;
      background: #eef3fa;
      margin-bottom: 16px;
    }
    .terms-list { list-style: none; counter-reset: tc; }
    .terms-list li {
      counter-increment: tc;
      position: relative;
      padding-right: 22px;
      margin-bottom: 13px;
      font-size: 11px;
      line-height: 1.7;
      color: #333;
    }
    .terms-list li::before {
      content: counter(tc) ".";
      position: absolute;
      right: 0;
      font-weight: bold;
      color: #1e3a5f;
    }
    .terms-list li strong { color: #1e3a5f; display: block; margin-bottom: 2px; }

    /* ── Footer ── */
    .page-footer {
      margin-top: 16px;
      border-top: 1px solid #ccc;
      padding-top: 7px;
    }
    .footer-cols { display: flex; justify-content: space-between; font-size: 9px; color: #666; }
    .footer-col { display: flex; gap: 4px; }
    .fl { font-weight: bold; color: #444; }
    .page-num { text-align: center; font-size: 9px; color: #999; margin-top: 4px; }
  </style>
</head>
<body>

<!-- ════════════ PAGE 1 ════════════ -->
<div class="page">
  <div class="page-content">
    ${header}

    <div class="quote-title">
      הצעת מחיר ללקוח: ${order.customer_name}
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span class="status-badge">${statusLabel}</span>
    </div>

    ${colorGroups.length > 0 ? `
    <div class="section-title">סיכום לפי צביעה / סוג</div>
    <div class="summary-grid">
      ${colorGroups.map(g => `
        <div class="sg-cell${g.name ? '' : ' empty'}">
          ${g.name ? `
            <span class="sg-name">${g.name}</span>
            <span class="sg-qty">${g.qty}</span>
            ${g.pricePerKg ? `<span class="sg-pkg">${g.pricePerKg}</span>` : ''}
            <span class="sg-amt">${g.amount}</span>
          ` : '&nbsp;'}
        </div>`).join('')}
    </div>` : ''}

    <div class="section-title">פירוט ההזמנה</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th style="width:46px">תמונה</th>
          <th>מק"ט</th>
          <th>שם מוצר</th>
          <th>אורך</th>
          <th>כמות</th>
          <th>גוון</th>
          <th>משקל כולל</th>
          <th>מחיר יח'</th>
          <th>עלות שורה</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => {
          const imgUrl = item.aluminum_profiles?.image_url
          const imgSrc = imgUrl ? imageMap[imgUrl] : ''
          const imgCell = imgSrc
            ? `<img src="${imgSrc}" alt="תמונת מוצר">`
            : `<div class="no-img">—</div>`
          return `
        <tr>
          <td>${i + 1}</td>
          <td class="td-img">${imgCell}</td>
          <td class="td-code">${item.aluminum_profiles?.code || item.profile_id?.slice(0, 8) || '-'}</td>
          <td class="td-name">${item.aluminum_profiles?.name_he || '-'}</td>
          <td>${(item.length_meters ?? 0).toFixed(2)} מ'</td>
          <td>${item.quantity_pieces ?? 0} יח'</td>
          <td>${getColorLabel(item.color)}</td>
          <td>${(item.total_weight_kg ?? 0).toFixed(2)} ק"ג</td>
          <td>${(item.price_per_piece ?? 0).toFixed(2)} ₪</td>
          <td class="td-amt">${formatCurrency(item.subtotal ?? 0)}</td>
        </tr>`}).join('')}
      </tbody>
    </table>
  </div>
  ${footer}
  <div class="page-num">עמוד 1/3</div>
</div>

<!-- ════════════ PAGE 2: TOTALS ════════════ -->
<div class="page page-break">
  <div class="page-content">
    ${header}

    <div class="section-title" style="margin-bottom:16px;">סיכום הזמנה</div>

    <div class="totals-wrap">
      <table class="totals-table">
        <tr>
          <td class="tl">סה"כ משקל הזמנה:</td>
          <td class="tv">${totalWeight.toFixed(2)} ק"ג</td>
        </tr>
        ${(order.discount_percent ?? 0) > 0 ? `
        <tr>
          <td class="tl">סה"כ לפני הנחה:</td>
          <td class="tv">${formatCurrency(order.total_amount || 0)}</td>
        </tr>
        <tr>
          <td class="tl">הנחה ${order.discount_percent}%:</td>
          <td class="tv" style="color:#c53030;">-${formatCurrency((order.total_amount || 0) * (order.discount_percent! / 100))}</td>
        </tr>` : ''}
        ${(order.discount_amount ?? 0) > 0 ? `
        <tr>
          <td class="tl">הנחה:</td>
          <td class="tv" style="color:#c53030;">-${formatCurrency(order.discount_amount!)}</td>
        </tr>` : ''}
        <tr>
          <td class="tl">סה"כ עלות הזמנה:</td>
          <td class="tv">${formatCurrency(preVatAmount)}</td>
        </tr>
        <tr class="row-vat">
          <td class="tl">מע"מ ${(VAT_RATE * 100).toFixed(0)}%:</td>
          <td class="tv">${formatCurrency(vatAmount)}</td>
        </tr>
        <tr class="row-grand">
          <td class="tl">סה"כ לתשלום:</td>
          <td class="tv">${formatCurrency(totalWithVat)}</td>
        </tr>
      </table>

      <div style="flex:1; min-width:180px;">
        ${(order.delivery_address || order.delivery_date) ? `
        <div class="delivery-box">
          <h3>פרטי משלוח</h3>
          ${order.delivery_address ? `<p><strong>כתובת:</strong> ${order.delivery_address}</p>` : ''}
          ${order.delivery_date ? `<p><strong>תאריך:</strong> ${new Date(order.delivery_date).toLocaleDateString('he-IL')}</p>` : ''}
        </div>` : ''}

        ${(order.notes || order.customer_notes) ? `
        <div class="notes-box">
          <strong>הערות:</strong>
          ${order.notes ? `<p style="margin-top:4px;">${order.notes}</p>` : ''}
          ${order.customer_notes ? `<p style="margin-top:4px; color:#555;">${order.customer_notes}</p>` : ''}
        </div>` : ''}
      </div>
    </div>
  </div>
  ${footer}
  <div class="page-num">עמוד 2/3</div>
</div>

<!-- ════════════ PAGE 3: TERMS ════════════ -->
<div class="page page-break">
  <div class="page-content">
    ${header}

    <div class="terms-title">שימו לב — הערות חשובות!</div>

    <ol class="terms-list">
      <li>
        <strong>הערכת משקל והחיוב הסופי:</strong>
        המשקל המצויין בהצעת המחיר הינו הערכה בלבד, והחיוב הסופי יתבצע על פי המשקל בפועל של ההזמנה.
        לפיכך, יתכנה סטייה של עד 10% מהמשקל המצויין בהצעה, והחברה שומרת לעצמה את הזכות לחייב בהתאם למשקל בפועל.
      </li>
      <li>
        <strong>שירות הובלה ופריקה:</strong>
        במקרה של בחירה בשירות הובלה, יש לקחת בחשבון כי ההובלה לא כוללת את שירות הפריקה מהמשאית.
        יש לוודא כי הלקוח או נציג מטעמו יהיו נוכחים בשטח בעת קבלת הסחורה וידאגו לפרוק אותה מהמשאית במעמד קבלתה.
      </li>
      <li>
        <strong>החזרות ותקנות:</strong>
        החזרות יבוצעו בהתאם למשקל הסחורה שהוחזרה בפועל. במקרה של החזרה, על הלקוח להודיע לחברה מראש
        ולספק תיעוד וצלומים של הסחורה המוחזרת כפי שהיא במצב שלה בעת ההחזרה.
      </li>
      <li>
        <strong>אחריות על צבעים:</strong>
        האחריות על צבעי RAL, מגורען ומטאלי הינה למשך 7 שנים ממועד אספקת המוצר.
        האחריות על צבעי עץ מלאי או צביעה בישראל הינה למשך 3 שנים ממועד אספקת המוצר.
        האחריות מכסה פגמים בצבע בלבד, ואינה מכסה נזקים הנגרמים כתוצאה מהתקנה לא נכונה או שימוש לא תקני.
      </li>
      <li>
        <strong>מועדי אספקה:</strong>
        האספקה תתבצע תוך עד 14 ימי עסקים ממועד אישור ההזמנה.
        יתכנו עיכובים במקרים של כוח עליון או בעיות לוגיסטיות שאינן בשליטת החברה.
      </li>
      <li>
        <strong>תנאי תשלום:</strong>
        התשלום יבוצע בהתאם לתנאים שסוכמו בין הצדדים. כל שינוי בתנאי התשלום טעון אישור בכתב מהחברה.
      </li>
    </ol>
  </div>
  ${footer}
  <div class="page-num">עמוד 3/3</div>
</div>

</body>
</html>`
}
