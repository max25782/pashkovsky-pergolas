export interface WarrantyPdfSection {
  title: string
  lines: string[]
}

export interface WarrantyTemplateProps {
  companyName: string
  logoUrl?: string | null
  clientName: string
  address: string
  projectDescription: string
  priceFormatted?: string | null
  installationDateLabelHe: string
  /** Detailed warranty blocks per product line (pergola / fence / railings). */
  warrantySections: WarrantyPdfSection[]
  footerLines: string[]
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Minimal RTL Hebrew warranty PDF shell — inline CSS only for Puppeteer. */
export function buildWarrantyPdfHtml(props: WarrantyTemplateProps): string {
  const {
    companyName,
    logoUrl,
    clientName,
    address,
    projectDescription,
    priceFormatted,
    installationDateLabelHe,
    warrantySections,
    footerLines,
  } = props

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="max-height:56px;max-width:220px;object-fit:contain;" />`
    : `<div style="font-size:11px;color:#64748b;">שורת לוגו</div>`

  const priceRow =
    priceFormatted !== undefined && priceFormatted !== null && String(priceFormatted).trim() !== ''
      ? `<tr><td style="padding:6px 0;color:#475569;width:42%;vertical-align:top;"><strong>מחיר</strong></td><td style="padding:6px 0;color:#0f172a;">${escapeHtml(String(priceFormatted))}</td></tr>`
      : ''

  const footerHtml = footerLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')

  const warrantySectionsHtml =
    warrantySections.length > 0
      ? warrantySections
          .map(
            (sec) => `
    <div style="margin-bottom:14px;padding:10px 12px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">${escapeHtml(sec.title)}</div>
      ${sec.lines
        .map(
          (line) =>
            `<div style="font-size:12.5px;color:#334155;line-height:1.55;margin-bottom:6px;">${escapeHtml(line)}</div>`,
        )
        .join('')}
    </div>`,
          )
          .join('')
      : `<div style="font-size:13px;color:#0f172a;line-height:1.55;">תקופת אחריות כללית: 12 חודשים מיום ההתקנה.</div>`

  return `<!DOCTYPE html><html lang="he" dir="rtl"><head>
<meta charset="utf-8" />
<title>תעודת אחריות</title>
</head><body style="margin:0;padding:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
<div style="max-width:800px;margin:0 auto;padding:28px 24px 40px;background:#fff;color:#0f172a;">
  <!-- Header -->
  <div style="display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:22px;">
    <div style="text-align:right;">
      ${logoBlock}
    </div>
    <div style="text-align:left;flex:1;padding-right:16px;">
      <div style="font-size:17px;font-weight:700;color:#0f172a;letter-spacing:.02em;">${escapeHtml(companyName)}</div>
    </div>
  </div>
  <h1 style="text-align:center;font-size:24px;font-weight:800;margin:6px 0 22px;color:#0f172a;letter-spacing:.04em;">תעודת אחריות</h1>

  <!-- Client -->
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:14px;background:#f8fafc;">
    <div style="font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:10px;">פרטי לקוח</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">
      <tr>
        <td style="padding:6px 0;color:#475569;width:42%;vertical-align:top;"><strong>שם לקוח</strong></td>
        <td style="padding:6px 0;color:#0f172a;">${escapeHtml(clientName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#475569;vertical-align:top;"><strong>כתובת</strong></td>
        <td style="padding:6px 0;color:#0f172a;white-space:pre-wrap;">${escapeHtml(address)}</td>
      </tr>
    </table>
  </div>

  <!-- Work -->
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:24px;background:#fff;">
    <div style="font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:10px;">פרטי עבודה</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.55;">
      <tr>
        <td style="padding:6px 0;color:#475569;width:42%;vertical-align:top;"><strong>תיאור הפרויקט</strong></td>
        <td style="padding:6px 0;color:#0f172a;white-space:pre-wrap;">${escapeHtml(projectDescription)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#475569;vertical-align:top;"><strong>תאריך התקנה</strong></td>
        <td style="padding:6px 0;color:#0f172a;">${escapeHtml(installationDateLabelHe)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0 6px;color:#475569;vertical-align:top;"><strong>היקף האחריות</strong></td>
        <td style="padding:10px 0 6px;color:#0f172a;">
          ${warrantySectionsHtml}
        </td>
      </tr>
      ${priceRow}
    </table>
  </div>

  <!-- Signature -->
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;">
    <div style="font-size:13px;color:#64748b;margin-bottom:36px;">חתימת הלקוח: ______________________________</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:8px;">חתימת נציג החברה וחותמת: ______________________________</div>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px dashed #cbd5e1;font-size:11px;line-height:1.6;color:#64748b;text-align:center;">
    ${footerHtml}
  </div>
</div></body></html>`
}
