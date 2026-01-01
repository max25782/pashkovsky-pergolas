/**
 * PDF Template Generator
 * Generate HTML template for PDF with company branding
 */

interface Company {
  name: string
  logo_url: string | null
  brand_color: string | null
  pdf_footer: string | null
  primary_email: string | null
  phone: string | null
  address: string | null
}

interface Offer {
  customerName: string
  customerPhone?: string
  customerCity?: string
  finalPrice: number
  area: number
  // Add other offer fields as needed
}

export function generateOfferPDFTemplate(offer: Offer, company: Company): string {
  const brandColor = company.brand_color || '#2563EB'
  
  const logoSection = company.logo_url
    ? `<img src="${company.logo_url}" alt="${company.name}" style="max-height: 80px; max-width: 250px; object-fit: contain; margin: 0 auto; display: block;" />`
    : `<h1 style="color: ${brandColor}; text-align: center; margin: 0; font-size: 32px;">${company.name}</h1>`

  const footerText = company.pdf_footer || `${company.name} | ${company.phone || ''} | ${company.address || ''}`

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Heebo', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      font-size: 14px;
    }
    
    .header {
      text-align: center;
      padding: 30px 20px;
      border-bottom: 4px solid ${brandColor};
      margin-bottom: 30px;
    }
    
    .company-info {
      text-align: center;
      margin-top: 10px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .content {
      padding: 0 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .section {
      margin-bottom: 25px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      border-right: 4px solid ${brandColor};
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: ${brandColor};
      margin-bottom: 15px;
    }
    
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .row:last-child {
      border-bottom: none;
    }
    
    .label {
      font-weight: 600;
      color: #4b5563;
    }
    
    .value {
      color: #1f2937;
    }
    
    .total-row {
      background: ${brandColor};
      color: white;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 20px;
      font-weight: 700;
    }
    
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 20px;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      background: white;
    }
    
    @media print {
      .footer {
        position: fixed;
        bottom: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoSection}
    ${company.phone || company.primary_email ? `
      <div class="company-info">
        ${company.phone ? `טלפון: ${company.phone}` : ''}
        ${company.phone && company.primary_email ? ' | ' : ''}
        ${company.primary_email ? `${company.primary_email}` : ''}
      </div>
    ` : ''}
  </div>

  <div class="content">
    <div class="section">
      <div class="section-title">פרטי לקוח</div>
      <div class="row">
        <span class="label">שם:</span>
        <span class="value">${offer.customerName}</span>
      </div>
      ${offer.customerPhone ? `
        <div class="row">
          <span class="label">טלפון:</span>
          <span class="value">${offer.customerPhone}</span>
        </div>
      ` : ''}
      ${offer.customerCity ? `
        <div class="row">
          <span class="label">עיר:</span>
          <span class="value">${offer.customerCity}</span>
        </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">פרטי הצעה</div>
      <div class="row">
        <span class="label">שטח (מ"ר):</span>
        <span class="value">${offer.area}</span>
      </div>
      <!-- Add more offer details here -->
    </div>

    <div class="total-row">
      <span>סה"כ לתשלום:</span>
      <span>₪${offer.finalPrice.toLocaleString()}</span>
    </div>
  </div>

  <div class="footer">
    ${footerText.replace(/\n/g, '<br>')}
  </div>
</body>
</html>
  `
}

