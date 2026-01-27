import type { Offer } from '@/types/offer'
import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'

/**
 * Render HTML template for offer (הצעת מחיר) with RTL Hebrew support
 * Uses embedded Noto Sans Hebrew fonts from public/fonts/
 * @param offer - The offer object
 * @returns Self-contained HTML string with embedded fonts
 */
export function renderOfferHtml(offer: Offer): string {
  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  const formatPrice = (price: number) => {
    return `₪${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
  }

  // Helper to format pergola shape dimensions
  const formatPergolaDimensions = () => {
    if (!offer.pergola) {
      return `<div class="info-row"><span class="label">פרגולה:</span><span class="value">ללא פרגולה</span></div>`
    }

    const shape = offer.pergola.shape
    if (!shape) {
      // Fallback to legacy format
      return `
        <div class="info-row">
          <span class="label">רוחב:</span>
          <span class="value">${offer.pergola.width || 0} מטר</span>
        </div>
        <div class="info-row">
          <span class="label">אורך:</span>
          <span class="value">${offer.pergola.length || 0} מטר</span>
        </div>
      `
    }

    switch (shape.type) {
      case 'rectangle':
        return `
          <div class="info-row">
            <span class="label">רוחב:</span>
            <span class="value">${shape.width} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">אורך:</span>
            <span class="value">${shape.length} מטר</span>
          </div>
        `
      case 'L':
        return `
          <div class="info-row">
            <span class="label">צורה:</span>
            <span class="value">L</span>
          </div>
          <div class="info-row">
            <span class="label">רוחב רגל 1:</span>
            <span class="value">${shape.leg1.width} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">אורך רגל 1:</span>
            <span class="value">${shape.leg1.length} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">רוחב רגל 2:</span>
            <span class="value">${shape.leg2.width} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">אורך רגל 2:</span>
            <span class="value">${shape.leg2.length} מטר</span>
          </div>
        `
      case 'X':
        return `
          <div class="info-row">
            <span class="label">צורה:</span>
            <span class="value">X</span>
          </div>
          <div class="info-row">
            <span class="label">רוחב מרכז:</span>
            <span class="value">${shape.center.width} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">אורך מרכז:</span>
            <span class="value">${shape.center.length} מטר</span>
          </div>
          ${shape.arms.map((arm, i) => `
            <div class="info-row">
              <span class="label">זרוע ${i + 1} (${arm.direction}):</span>
              <span class="value">${arm.width} × ${arm.length} מטר</span>
            </div>
          `).join('')}
        `
      case 'U':
        return `
          <div class="info-row">
            <span class="label">צורה:</span>
            <span class="value">U</span>
          </div>
          <div class="info-row">
            <span class="label">רוחב בסיס:</span>
            <span class="value">${shape.base.width} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">אורך בסיס:</span>
            <span class="value">${shape.base.length} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">רגל שמאל:</span>
            <span class="value">${shape.leftLeg.width} × ${shape.leftLeg.length} מטר</span>
          </div>
          <div class="info-row">
            <span class="label">רגל ימין:</span>
            <span class="value">${shape.rightLeg.width} × ${shape.rightLeg.length} מטר</span>
          </div>
        `
      default:
        return ''
    }
  }

  // Get embedded fonts CSS
  const fontsCss = getHebrewFontsCss()
  
  // Get logo as base64 data URI
  const logoDataUri = getLogoDataUri('public/logo-transparent.png')
  const notesText = offer.options?.notes?.trim() || ''
  const safeNotes = notesText ? escapeHtml(notesText) : ''

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הצעת מחיר - ${offer.customerName}</title>
  
  <style>
    ${fontsCss}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      direction: rtl;
      text-align: right;
      padding: 40px;
      line-height: 1.6;
      color: #1e293b;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .logo-container {
      flex-shrink: 0;
    }
    
    .logo {
      max-width: 120px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .header-content {
      flex: 1;
    }
    
    .company-name {
      font-size: 28px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 5px;
    }
    
    .company-info {
      font-size: 12px;
      color: #666;
      margin-bottom: 3px;
    }
    
    .title {
      font-size: 24px;
      font-weight: 700;
      text-align: center;
      margin: 30px 0;
      color: #1e293b;
    }
    
    .section {
      margin-bottom: 25px;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #1e293b;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }
    
    .info-row {
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .label {
      font-weight: 700;
      color: #475569;
      display: inline-block;
      min-width: 120px;
    }
    
    .value {
      color: #1e293b;
    }
    
    .pricing-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .pricing-table th,
    .pricing-table td {
      padding: 12px;
      text-align: right;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .pricing-table th {
      background: #eff6ff;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 2px solid #2563eb;
    }
    
    .pricing-table tr:last-child td {
      border-bottom: none;
    }
    
    .price-label {
      font-weight: 600;
    }
    
    .price-value {
      font-weight: 700;
      color: #1e293b;
    }
    
    .subtotal-row {
      background: #f1f5f9;
    }
    
    .total-row {
      background: #dbeafe;
      font-size: 16px;
    }
    
    .final-price-row {
      background: #dcfce7;
      font-size: 18px;
    }
    
    .final-price-row td {
      font-weight: 700;
      color: #16a34a;
      padding: 16px 12px;
    }
    
    .terms-section {
      background: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .terms-title {
      font-size: 14px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 8px;
    }
    
    .terms-text {
      font-size: 13px;
      color: #78350f;
      margin-bottom: 5px;
    }
    
    .warranty-section {
      background: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }

    .notes {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUri ? `
    <div class="logo-container">
      <img src="${logoDataUri}" alt="Pashkovsky Group Logo" class="logo" />
    </div>
    ` : ''}
    <div class="header-content">
      <div class="company-name">Pashkovsky Group</div>
      <div class="company-info">פתרונות אלומיניום מתקדמים</div>
      <div class="company-info">טלפון: 0524494848 | אימייל: office@pashkovsky-group.com</div>
      <div class="company-info">כתובת: אזור תעשיה עמנואל</div>
    </div>
  </div>

  <h1 class="title">הצעת מחיר</h1>

  <div class="section">
    <div class="section-title">פרטי לקוח</div>
    <div class="info-row">
      <span class="label">שם:</span>
      <span class="value">${offer.customerName}</span>
    </div>
    ${offer.customerPhone ? `
    <div class="info-row">
      <span class="label">טלפון:</span>
      <span class="value">${offer.customerPhone}</span>
    </div>
    ` : ''}
    ${offer.customerCity ? `
    <div class="info-row">
      <span class="label">עיר:</span>
      <span class="value">${offer.customerCity}</span>
    </div>
    ` : ''}
    <div class="info-row">
      <span class="label">תאריך הצעה:</span>
      <span class="value">${formatDate(offer.createdAt)}</span>
    </div>
  </div>

  ${offer.pergola ? `
  <div class="section">
    <div class="section-title">פרטי פרגולה</div>
    ${formatPergolaDimensions()}
    ${offer.pergola.height ? `
    <div class="info-row">
      <span class="label">גובה:</span>
      <span class="value">${offer.pergola.height} מטר</span>
    </div>
    ` : ''}
    ${offer.pergola.location ? `
    <div class="info-row">
      <span class="label">מקום:</span>
      <span class="value">${offer.pergola.location}</span>
    </div>
    ` : ''}` : ''}
    ${offer.pergola ? `
    <div class="info-row">
      <span class="label">שטח כולל:</span>
      <span class="value">${offer.area.toFixed(2)} מ״ר</span>
    </div>
    <div class="info-row">
      <span class="label">חומר:</span>
      <span class="value">אלומיניום פרימיום</span>
    </div>
  </div>` : ''}

  ${safeNotes ? `
  <div class="section">
    <div class="section-title">הערות / תיאור</div>
    <div class="notes">${safeNotes}</div>
  </div>
  ` : ''}

  ${offer.santaf?.enabled ? `
  <div class="section">
    <div class="section-title">סנטף BH</div>
    <div class="info-row">
      <span class="label">סוג:</span>
      <span class="value">${offer.santaf.withStructure ? 'סנטף BH + קונסטרוקציה' : 'סנטף BH בסיסי'}</span>
    </div>
  </div>
  ` : ''}

  ${offer.winterClosure?.enabled && offer.winterClosure.items && offer.winterClosure.items.length > 0 ? `
  <div class="section">
    <div class="section-title">סגירת חורף (זכוכית)</div>
    ${offer.winterClosure.glassType ? `
    <div class="info-row">
      <span class="label">סוג זכוכית:</span>
      <span class="value">${offer.winterClosure.glassType === 'tempered' ? 'מחוסם' : offer.winterClosure.glassType === 'triplex' ? 'טריפלקס' : offer.winterClosure.glassType === 'insulated' ? 'בידודית' : offer.winterClosure.glassType}</span>
    </div>
    ` : ''}
    ${offer.winterClosure.items.map((item, index) => {
      const typeNames: Record<string, string> = {
        fixedGlass: 'זכוכית קבועה',
        windows7000: 'חלונות 7000',
        windows9000: 'חלונות 9000',
        slidingShowcase7000: 'ויטרינה הזזה דגם 7000',
        slidingShowcase9000: 'ויטרינה הזזה דגם 9000',
        foldingGlass: 'זכוכית מתקפלת'
      };
      const typeName = typeNames[item.type] || item.type;
      return `
    <div class="info-row">
      <span class="label">${typeName}${item.notes ? ` (${item.notes})` : ''}:</span>
      <span class="value">${item.area.toFixed(2)} מ״ר × ${item.pricePerSqm.toLocaleString('he-IL')} ₪</span>
    </div>`;
    }).join('')}
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">פירוט מחירים</div>
    <table class="pricing-table">
      <thead>
        <tr>
          <th>פריט</th>
          <th>מחיר</th>
        </tr>
      </thead>
      <tbody>
        ${offer.pergolaTotal ? `
        <tr>
          <td class="price-label">פרגולה (${offer.area.toFixed(2)} מ״ר)</td>
          <td class="price-value">${formatPrice(offer.pergolaTotal)}</td>
        </tr>` : ''}
        ${offer.santaf?.enabled ? `
        <tr>
          <td class="price-label">סנטף BH</td>
          <td class="price-value">${formatPrice(offer.santafTotal)}</td>
        </tr>
        ` : ''}
        ${offer.zipScreenTotal > 0 ? `
        <tr>
          <td class="price-label">ZIP Screen</td>
          <td class="price-value">${formatPrice(offer.zipScreenTotal)}</td>
        </tr>
        ` : ''}
        ${offer.lightingTotal > 0 ? `
        <tr>
          <td class="price-label">תאורה</td>
          <td class="price-value">${formatPrice(offer.lightingTotal)}</td>
        </tr>
        ` : ''}
        ${offer.drainageTotal > 0 ? `
        <tr>
          <td class="price-label">ניקוז</td>
          <td class="price-value">${formatPrice(offer.drainageTotal)}</td>
        </tr>
        ` : ''}
        ${offer.winterClosure?.enabled && offer.winterClosure.items && offer.winterClosure.items.length > 0 ? `
        ${offer.winterClosure.items.map((item, index) => {
          const typeNames: Record<string, string> = {
            fixedGlass: 'זכוכית קבועה',
            windows7000: 'חלונות 7000',
            windows9000: 'חלונות 9000',
            slidingShowcase7000: 'ויטרינה הזזה 7000',
            slidingShowcase9000: 'ויטרינה הזזה 9000',
            foldingGlass: 'זכוכית מתקפלת'
          };
          const typeName = typeNames[item.type] || item.type;
          const itemTotal = item.area * item.pricePerSqm;
          const notes = item.notes ? ` - ${item.notes}` : '';
          return `
        <tr>
          <td class="price-label">${typeName} (${item.area.toFixed(2)} מ״ר × ${item.pricePerSqm} ₪)${notes}</td>
          <td class="price-value">${formatPrice(itemTotal)}</td>
        </tr>`;
        }).join('')}
        ${offer.winterClosure.items.length > 1 ? `
        <tr>
          <td class="price-label" style="padding-right: 20px; font-weight: 600;">סה״כ סגירת חורף (זכוכית)</td>
          <td class="price-value" style="font-weight: 600;">${formatPrice(offer.winterClosureTotal)}</td>
        </tr>
        ` : ''}
        ` : ''}
        <tr class="subtotal-row">
          <td class="price-label">לפני מע״מ</td>
          <td class="price-value">${formatPrice(offer.totalBeforeVat)}</td>
        </tr>
        <tr>
          <td class="price-label">מע״מ (18%)</td>
          <td class="price-value">+${formatPrice(offer.vatAmount)}</td>
        </tr>
        <tr class="total-row">
          <td class="price-label">אחרי מע״מ</td>
          <td class="price-value">${formatPrice(offer.priceWithVat)}</td>
        </tr>
        ${offer.discountPercent > 0 ? `
        <tr>
          <td class="price-label">הנחה (${offer.discountPercent}%)</td>
          <td class="price-value">-${formatPrice(offer.discountAmount)}</td>
        </tr>
        ` : ''}
        <tr class="final-price-row">
          <td>מחיר סופי לתשלום</td>
          <td>${formatPrice(offer.finalPrice)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="terms-section">
    <div class="terms-title">תנאי תשלום</div>
    <div class="terms-text">• 10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית</div>
    <div class="terms-text">• תוקף ההצעה: 30 יום מתאריך ההצעה</div>
  </div>

  <div class="warranty-section">
    <div class="terms-title">אחריות</div>
    <div class="terms-text">• 7 שנים על צבע, קונסטרוקציה וסנטף</div>
    <div class="terms-text">• שירות לקוחות זמין 24/7</div>
  </div>

  <div class="footer">
      <p>Pashkovsky Group | אזור תעשיה עמנואל | טלפון: 0524494848 | www.pashkovsky-group.com</p>
      <p>ח.פ: 320807068 | אישור עוסק מורשה</p>
  </div>
</body>
</html>
  `.trim()
}

