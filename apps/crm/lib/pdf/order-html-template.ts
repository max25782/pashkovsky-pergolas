import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
import {
  pdfT,
  resolvePdfLocale,
  pdfHtmlDir,
  pdfBcp47Locale,
  pdfCurrencySymbol,
  type PdfDict,
} from '@/lib/pdf/offer-pdf-i18n'

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

const VAT_RATE = 0.18

function fillTpl(s: string, vars: Record<string, string | number>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatCurrency(amount: number, bcp47: string, symbol: string): string {
  return `${symbol}${amount.toLocaleString(bcp47, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getColorLabel(color: string, t: PdfDict): string {
  if (!color || color === 'default') return t.off_color_dash
  const map: Record<string, string> = {
    bronze: t.ord_color_bronze,
    ברונזה: t.ord_color_bronze,
    white: t.ord_color_white,
    לבן: t.ord_color_white,
    black: t.ord_color_black,
    שחור: t.ord_color_black,
    silver: t.ord_color_silver,
    מטאלי: t.ord_color_silver,
    anodized: t.ord_color_anodized,
    מגורען: t.ord_color_anodized,
    ral: t.ord_color_ral,
    wood: t.ord_color_wood,
    'דמוי עץ': t.ord_color_wood,
    raw: t.ord_color_raw,
    גולמי: t.ord_color_raw,
    passivation: t.ord_color_passivation,
    פסיבציה: t.ord_color_passivation,
  }
  return map[color] ?? map[color.toLowerCase()] ?? color
}

function orderStatusLabel(status: string, t: PdfDict): string {
  const map: Record<string, string> = {
    pending_price: t.ord_st_pending_price,
    priced: t.ord_st_priced,
    confirmed: t.ord_st_confirmed,
    preparing: t.ord_st_preparing,
    ready: t.ord_st_ready,
    delivered: t.ord_st_delivered,
    cancelled: t.ord_st_cancelled,
  }
  return map[status] ?? status ?? t.ord_st_pending_price
}

function groupByColor(
  items: OrderItem[],
  t: PdfDict,
  bcp47: string,
  symbol: string,
): Array<{ name: string; qty: string; pricePerKg: string; amount: string }> {
  const groups = new Map<string, { weight: number; pieces: number; amount: number; pricePerKgSum: number; priceCount: number }>()
  for (const item of items) {
    const key = getColorLabel(item.color, t)
    const g = groups.get(key) ?? { weight: 0, pieces: 0, amount: 0, pricePerKgSum: 0, priceCount: 0 }
    g.weight += item.total_weight_kg ?? 0
    g.pieces += item.quantity_pieces ?? 0
    g.amount += item.subtotal ?? 0
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
      qty:
        g.weight > 0
          ? `${g.weight.toFixed(2)} ${t.ord_unit_kg}`
          : `${g.pieces} ${t.ord_unit_pc}`,
      pricePerKg: avgPricePerKg > 0 ? `${avgPricePerKg.toFixed(2)} ${t.ord_per_kg}` : '',
      amount: formatCurrency(g.amount, bcp47, symbol),
    }
  })
  while (result.length % 3 !== 0) result.push({ name: '', qty: '', pricePerKg: '', amount: '' })
  return result
}

export function renderOrderHtml(order: Order, imageMap: Record<string, string> = {}, locale?: string): string {
  const resolved = resolvePdfLocale(locale)
  const t = pdfT[resolved]
  const dir = pdfHtmlDir(resolved)
  const bcp47 = pdfBcp47Locale(resolved)
  const currencySymbol = pdfCurrencySymbol(resolved)
  const dash = t.off_color_dash

  const fonts = getHebrewFontsCss()
  const logoUri = getLogoDataUri()

  const dt = order.created_at ? new Date(order.created_at) : new Date()
  const date = dt.toLocaleDateString(bcp47)
  const time = dt.toLocaleTimeString(bcp47, { hour: '2-digit', minute: '2-digit' })

  const orderNumber = order.order_number || order.id?.slice(0, 8) || 'N/A'
  const quoteNumber = `Q-${orderNumber}`
  const items = order.order_items ?? []
  const colorGroups = groupByColor(items, t, bcp47, currencySymbol)

  const preVatAmount = order.final_amount || order.total_amount || 0
  const vatAmount = Math.round(preVatAmount * VAT_RATE * 100) / 100
  const totalWithVat = Math.round((preVatAmount + vatAmount) * 100) / 100
  const totalWeight = order.total_weight_kg || 0

  const statusLabel = orderStatusLabel(order.status, t)

  const header = `
    <div class="page-header">
      <div class="header-inner">
        <div class="header-right">
          <div class="ci-row"><span class="ci-label">${escapeHtml(t.ord_cust_name)}:</span><span class="ci-val">${escapeHtml(order.customer_name)}</span></div>
          <div class="ci-row"><span class="ci-label">${escapeHtml(t.ord_addr_lbl)}:</span><span class="ci-val">${escapeHtml(order.delivery_address || order.customer_city || dash)}</span></div>
          <div class="ci-row"><span class="ci-label">${escapeHtml(t.ord_mobile)}:</span><span class="ci-val">${escapeHtml(order.customer_phone || dash)}</span></div>
          ${order.customer_email ? `<div class="ci-row"><span class="ci-label">${escapeHtml(t.ord_email)}:</span><span class="ci-val">${escapeHtml(order.customer_email)}</span></div>` : ''}
        </div>
        <div class="header-left">
          ${logoUri ? `<img src="${logoUri}" class="logo" alt="${escapeHtml(t.ord_logo)}">` : `<div class="company-name">${escapeHtml(t.ord_company_fallback)}</div>`}
        </div>
      </div>
    </div>`

  const footer = `
    <div class="page-footer">
      <div class="footer-cols">
        <div class="footer-col"><span class="fl">${escapeHtml(t.ord_quote_num)}:</span><span class="fv">${escapeHtml(quoteNumber)}</span></div>
        <div class="footer-col"><span class="fl">${escapeHtml(t.ord_last_updated)}:</span><span class="fv">${escapeHtml(date)} ${escapeHtml(time)}</span></div>
        ${order.notes ? `<div class="footer-col"><span class="fl">${escapeHtml(t.ord_notes)}:</span><span class="fv">${escapeHtml(order.notes.substring(0, 60))}</span></div>` : '<div class="footer-col"></div>'}
      </div>
    </div>`

  const vatPctStr = (VAT_RATE * 100).toFixed(0)
  const vatRowLabel = fillTpl(t.ord_vat, { p: vatPctStr })

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${bcp47}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(quoteNumber)}</title>
  <style>
    ${fonts}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'NotoSansHebrew', 'Arial Unicode MS', Arial, sans-serif;
      direction: ${dir};
      color: #1a1a1a;
      background: #fff;
      font-size: 11px;
      line-height: 1.45;
    }

    .page {
      padding: 12mm 14mm 8mm 14mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
    }
    .page-content { flex: 1; }
    .page-break { page-break-before: always; }

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
    .header-left { text-align: end; }
    .logo { height: 48px; object-fit: contain; }
    .company-name { font-size: 22px; font-weight: bold; color: #1e3a5f; }
    .header-right { text-align: start; }
    .ci-row { margin-bottom: 2px; }
    .ci-label { font-weight: bold; color: #555; margin-inline-end: 5px; }
    .ci-val { color: #222; }

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
      border-inline-end: 1px solid #bbb;
      margin-bottom: 18px;
    }
    .sg-cell {
      border-inline-start: 1px solid #bbb;
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
    .td-name { text-align: start; font-size: 10px; }
    .td-amt  { font-weight: bold; color: #1e3a5f; }
    .td-img  { width: 44px; padding: 3px !important; }
    .td-img img { width: 40px; height: 40px; object-fit: contain; display: block; margin: 0 auto; border-radius: 2px; }
    .td-img .no-img { width: 40px; height: 40px; background: #f0f0f0; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #aaa; margin: 0 auto; }

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
    .tl { text-align: start; font-weight: bold; color: #444; }
    .tv { text-align: end; font-weight: bold; min-width: 110px; }
    .row-vat td  { background: #f0f4f8; }
    .row-grand td { background: #1e3a5f; color: #fff; font-size: 14px; }

    .delivery-box {
      flex: 1;
      min-width: 180px;
      padding: 10px;
      background: #f0f4f8;
      border-inline-end: 3px solid #1e3a5f;
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
      padding-inline-end: 22px;
      margin-bottom: 13px;
      font-size: 11px;
      line-height: 1.7;
      color: #333;
    }
    .terms-list li::before {
      content: counter(tc) ".";
      position: absolute;
      inset-inline-end: 0;
      font-weight: bold;
      color: #1e3a5f;
    }
    .terms-list li strong { color: #1e3a5f; display: block; margin-bottom: 2px; }

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

<div class="page">
  <div class="page-content">
    ${header}

    <div class="quote-title">
      ${escapeHtml(t.ord_quote_for)}: ${escapeHtml(order.customer_name)}
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span class="status-badge">${escapeHtml(statusLabel)}</span>
    </div>

    ${colorGroups.length > 0 ? `
    <div class="section-title">${escapeHtml(t.ord_summary_color)}</div>
    <div class="summary-grid">
      ${colorGroups.map(g => `
        <div class="sg-cell${g.name ? '' : ' empty'}">
          ${g.name ? `
            <span class="sg-name">${escapeHtml(g.name)}</span>
            <span class="sg-qty">${escapeHtml(g.qty)}</span>
            ${g.pricePerKg ? `<span class="sg-pkg">${escapeHtml(g.pricePerKg)}</span>` : ''}
            <span class="sg-amt">${g.amount}</span>
          ` : '&nbsp;'}
        </div>`).join('')}
    </div>` : ''}

    <div class="section-title">${escapeHtml(t.ord_details)}</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:22px">${escapeHtml(t.ord_th_idx)}</th>
          <th style="width:46px">${escapeHtml(t.ord_th_img)}</th>
          <th>${escapeHtml(t.ord_th_sku)}</th>
          <th>${escapeHtml(t.ord_th_name)}</th>
          <th>${escapeHtml(t.ord_th_len)}</th>
          <th>${escapeHtml(t.ord_th_qty)}</th>
          <th>${escapeHtml(t.ord_th_color)}</th>
          <th>${escapeHtml(t.ord_th_weight)}</th>
          <th>${escapeHtml(t.ord_th_price_pc)}</th>
          <th>${escapeHtml(t.ord_th_line)}</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => {
          const imgUrl = item.aluminum_profiles?.image_url
          const imgSrc = imgUrl ? imageMap[imgUrl] : ''
          const imgCell = imgSrc
            ? `<img src="${imgSrc}" alt="${escapeHtml(t.ord_img_alt)}">`
            : `<div class="no-img">${escapeHtml(dash)}</div>`
          return `
        <tr>
          <td>${i + 1}</td>
          <td class="td-img">${imgCell}</td>
          <td class="td-code">${escapeHtml(item.aluminum_profiles?.code || item.profile_id?.slice(0, 8) || dash)}</td>
          <td class="td-name">${escapeHtml(item.aluminum_profiles?.name_he || dash)}</td>
          <td>${(item.length_meters ?? 0).toFixed(2)} ${escapeHtml(t.ord_unit_m)}</td>
          <td>${item.quantity_pieces ?? 0} ${escapeHtml(t.ord_unit_pc)}</td>
          <td>${escapeHtml(getColorLabel(item.color, t))}</td>
          <td>${(item.total_weight_kg ?? 0).toFixed(2)} ${escapeHtml(t.ord_unit_kg)}</td>
          <td>${(item.price_per_piece ?? 0).toFixed(2)} ${currencySymbol}</td>
          <td class="td-amt">${formatCurrency(item.subtotal ?? 0, bcp47, currencySymbol)}</td>
        </tr>`}).join('')}
      </tbody>
    </table>
  </div>
  ${footer}
  <div class="page-num">${escapeHtml(fillTpl(t.ord_page, { n: 1, t: 3 }))}</div>
</div>

<div class="page page-break">
  <div class="page-content">
    ${header}

    <div class="section-title" style="margin-bottom:16px;">${escapeHtml(t.ord_sum_title)}</div>

    <div class="totals-wrap">
      <table class="totals-table">
        <tr>
          <td class="tl">${escapeHtml(t.ord_total_weight)}</td>
          <td class="tv">${totalWeight.toFixed(2)} ${escapeHtml(t.ord_unit_kg)}</td>
        </tr>
        ${(order.discount_percent ?? 0) > 0 ? `
        <tr>
          <td class="tl">${escapeHtml(t.ord_before_disc)}</td>
          <td class="tv">${formatCurrency(order.total_amount || 0, bcp47, currencySymbol)}</td>
        </tr>
        <tr>
          <td class="tl">${escapeHtml(fillTpl(t.ord_disc_pct, { p: String(order.discount_percent) }))}</td>
          <td class="tv" style="color:#c53030;">-${formatCurrency((order.total_amount || 0) * (order.discount_percent! / 100), bcp47, currencySymbol)}</td>
        </tr>` : ''}
        ${(order.discount_amount ?? 0) > 0 ? `
        <tr>
          <td class="tl">${escapeHtml(t.ord_disc)}</td>
          <td class="tv" style="color:#c53030;">-${formatCurrency(order.discount_amount!, bcp47, currencySymbol)}</td>
        </tr>` : ''}
        <tr>
          <td class="tl">${escapeHtml(t.ord_total_cost)}</td>
          <td class="tv">${formatCurrency(preVatAmount, bcp47, currencySymbol)}</td>
        </tr>
        <tr class="row-vat">
          <td class="tl">${escapeHtml(vatRowLabel)}</td>
          <td class="tv">${formatCurrency(vatAmount, bcp47, currencySymbol)}</td>
        </tr>
        <tr class="row-grand">
          <td class="tl">${escapeHtml(t.ord_grand_total)}</td>
          <td class="tv">${formatCurrency(totalWithVat, bcp47, currencySymbol)}</td>
        </tr>
      </table>

      <div style="flex:1; min-width:180px;">
        ${(order.delivery_address || order.delivery_date) ? `
        <div class="delivery-box">
          <h3>${escapeHtml(t.ord_delivery)}</h3>
          ${order.delivery_address ? `<p><strong>${escapeHtml(t.ord_address)}:</strong> ${escapeHtml(order.delivery_address)}</p>` : ''}
          ${order.delivery_date ? `<p><strong>${escapeHtml(t.ord_date_lbl)}:</strong> ${escapeHtml(new Date(order.delivery_date).toLocaleDateString(bcp47))}</p>` : ''}
        </div>` : ''}

        ${(order.notes || order.customer_notes) ? `
        <div class="notes-box">
          <strong>${escapeHtml(t.ord_notes_box)}:</strong>
          ${order.notes ? `<p style="margin-top:4px;">${escapeHtml(order.notes)}</p>` : ''}
          ${order.customer_notes ? `<p style="margin-top:4px; color:#555;">${escapeHtml(order.customer_notes)}</p>` : ''}
        </div>` : ''}
      </div>
    </div>
  </div>
  ${footer}
  <div class="page-num">${escapeHtml(fillTpl(t.ord_page, { n: 2, t: 3 }))}</div>
</div>

<div class="page page-break">
  <div class="page-content">
    ${header}

    <div class="terms-title">${escapeHtml(t.ord_terms_title)}</div>

    <ol class="terms-list">
      <li>
        <strong>${escapeHtml(t.ord_t1h)}</strong>
        ${escapeHtml(t.ord_t1b)}
      </li>
      <li>
        <strong>${escapeHtml(t.ord_t2h)}</strong>
        ${escapeHtml(t.ord_t2b)}
      </li>
      <li>
        <strong>${escapeHtml(t.ord_t3h)}</strong>
        ${escapeHtml(t.ord_t3b)}
      </li>
      <li>
        <strong>${escapeHtml(t.ord_t4h)}</strong>
        ${escapeHtml(t.ord_t4b)}
      </li>
      <li>
        <strong>${escapeHtml(t.ord_t5h)}</strong>
        ${escapeHtml(t.ord_t5b)}
      </li>
      <li>
        <strong>${escapeHtml(t.ord_t6h)}</strong>
        ${escapeHtml(t.ord_t6b)}
      </li>
    </ol>
  </div>
  ${footer}
  <div class="page-num">${escapeHtml(fillTpl(t.ord_page, { n: 3, t: 3 }))}</div>
</div>

</body>
</html>`
}
