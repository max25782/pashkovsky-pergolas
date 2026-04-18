import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
import type { WorkerShift, WorkerShiftSummary } from '@/types/workers'
import { pdfT, resolvePdfLocale, pdfHtmlDir, pdfBcp47Locale, type PdfDict } from '@/lib/pdf/offer-pdf-i18n'

interface WorkerTimesheetData {
  worker: {
    id: string
    firstName: string
    lastName: string
    phone?: string | null
    role?: string | null
    dailyRate: number
    hourlyRate?: number | null
  }
  month: string // YYYY-MM
  shifts: WorkerShift[]
  summary: WorkerShiftSummary
}

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

function formatDate(dateStr: string, bcp47: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(bcp47, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMonthLabel(month: string, bcp47: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString(bcp47, { month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number, bcp47: string): string {
  return `₪${amount.toLocaleString(bcp47, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(t: string | null, dash: string): string {
  return t ?? dash
}

function formatHours(minutes: number | null, dash: string): string {
  if (minutes == null) return dash
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function shiftTypeLabel(type: string, t: PdfDict): { text: string; bg: string; color: string } {
  if (type === 'holiday') return { text: t.ts_type_holiday, bg: '#7c3aed22', color: '#7c3aed' }
  if (type === 'day_off') return { text: t.ts_type_dayoff, bg: '#d9770622', color: '#d97706' }
  return { text: t.ts_type_work, bg: '#16a34a22', color: '#16a34a' }
}

export function generateWorkerTimesheetHtml(data: WorkerTimesheetData, locale?: string): string {
  const resolved = resolvePdfLocale(locale)
  const t = pdfT[resolved]
  const dir = pdfHtmlDir(resolved)
  const bcp47 = pdfBcp47Locale(resolved)
  const dash = t.off_color_dash

  const { worker, month, shifts, summary } = data
  const fontsCss = getHebrewFontsCss()
  const logoUri = getLogoDataUri()
  const monthLabel = formatMonthLabel(month, bcp47)
  const workerName = `${worker.firstName} ${worker.lastName}`
  const docTitle = fillTpl(t.ts_doc_title, { name: workerName, month: monthLabel })

  const sortedShifts = [...shifts].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate))

  const shiftRows = sortedShifts
    .map((s) => {
      const type = shiftTypeLabel(s.shiftType ?? 'work', t)
      const isWork = (s.shiftType ?? 'work') === 'work'
      const isHoliday = s.shiftType === 'holiday'
      const isDayOff = s.shiftType === 'day_off'

      const costCell = isDayOff
        ? `<span style="color:#d97706;font-size:11px;">${escapeHtml(t.ts_no_pay)}</span>`
        : s.computedCost != null
          ? formatCurrency(s.computedCost, bcp47)
          : dash

      const projectCell = isWork
        ? escapeHtml(s.deal?.customerName ?? s.projectName ?? dash)
        : dash

      return `
      <tr style="border-bottom:1px solid #e5e7eb; background:${type.bg}08;">
        <td style="padding:7px 8px; text-align:start;">${formatDate(s.shiftDate, bcp47)}</td>
        <td style="padding:7px 8px; text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${type.bg};color:${type.color};">${escapeHtml(type.text)}</span>
        </td>
        <td style="padding:7px 8px; text-align:start; color:#374151;">
          ${projectCell}
        </td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatTime(s.startTime, dash) : dash}</td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatTime(s.endTime, dash) : dash}</td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatHours(s.minutesWorked, dash) : dash}</td>
        <td style="padding:7px 8px; text-align:end; font-weight:${isHoliday ? '600' : '400'}; color:${isHoliday ? '#7c3aed' : 'inherit'};">${costCell}</td>
        <td style="padding:7px 8px; text-align:start; color:#6b7280; font-size:11px;">${escapeHtml(s.note ?? '')}</td>
      </tr>
    `
    })
    .join('')

  const totalPayable = summary.totalPayable ?? (summary.totalCost + (summary.holidayPay ?? 0))

  const costBreak =
    `${escapeHtml(t.ts_work_prefix)}: ${formatCurrency(summary.totalCost, bcp47)}` +
    ((summary.holidayPay ?? 0) > 0
      ? ` + ${escapeHtml(t.ts_holidays_prefix)}: ${formatCurrency(summary.holidayPay ?? 0, bcp47)}`
      : '')

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${bcp47}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    ${fontsCss}

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      direction: ${dir};
      background: #fff;
      color: #111827;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      padding: 24px 28px;
      max-width: 900px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #1d4ed8;
    }
    .header-left { display: flex; flex-direction: column; gap: 4px; }
    .header-title { font-size: 20px; font-weight: 700; color: #1d4ed8; }
    .header-sub { font-size: 13px; color: #6b7280; }
    .logo { height: 44px; }

    .worker-card {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .worker-card-item label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 2px;
    }
    .worker-card-item .value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .summary-box {
      border-radius: 8px;
      padding: 12px 14px;
      text-align: center;
    }
    .summary-box label {
      font-size: 10px;
      color: #64748b;
      display: block;
      margin-bottom: 4px;
    }
    .summary-box .val {
      font-size: 18px;
      font-weight: 700;
    }
    .box-blue   { background: #eff6ff; border: 1px solid #bfdbfe; }
    .box-blue .val { color: #1d4ed8; }
    .box-purple { background: #f5f3ff; border: 1px solid #ddd6fe; }
    .box-purple .val { color: #7c3aed; }
    .box-amber  { background: #fffbeb; border: 1px solid #fde68a; }
    .box-amber .val { color: #d97706; }
    .box-green  { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .box-green .val { color: #16a34a; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead tr {
      background: #1d4ed8;
      color: #fff;
    }
    thead th {
      padding: 9px 8px;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.03em;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f1f5f9; }

    .total-row td {
      padding: 10px 8px;
      font-weight: 700;
      font-size: 13px;
      background: #1e293b;
      color: #fff;
      border-top: 2px solid #1d4ed8;
    }

    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }

    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 32px;
    }
    .sig-box {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <div class="header-title">${escapeHtml(t.ts_title)}</div>
      <div class="header-sub">${escapeHtml(monthLabel)}</div>
      <div class="header-sub" style="margin-top:4px; font-size:11px; color:#94a3b8;">
        ${escapeHtml(t.ts_generated)}: ${escapeHtml(new Date().toLocaleDateString(bcp47))}
      </div>
    </div>
    <img src="${logoUri}" class="logo" alt="" />
  </div>

  <div class="worker-card">
    <div class="worker-card-item">
      <label>${escapeHtml(t.ts_emp_name)}</label>
      <div class="value">${escapeHtml(workerName)}</div>
    </div>
    <div class="worker-card-item">
      <label>${escapeHtml(t.ts_role)}</label>
      <div class="value">${escapeHtml(worker.role ?? dash)}</div>
    </div>
    <div class="worker-card-item">
      <label>${escapeHtml(t.ts_phone)}</label>
      <div class="value">${escapeHtml(worker.phone ?? dash)}</div>
    </div>
    <div class="worker-card-item">
      <label>${escapeHtml(t.ts_daily_rate)}</label>
      <div class="value">${formatCurrency(worker.dailyRate, bcp47)}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-box box-blue">
      <label>${escapeHtml(t.ts_days_worked)}</label>
      <div class="val">${summary.daysWorked}</div>
    </div>
    <div class="summary-box box-purple">
      <label>${escapeHtml(t.ts_holidays_paid)}</label>
      <div class="val">${summary.holidayDays ?? 0}</div>
    </div>
    <div class="summary-box box-amber">
      <label>${escapeHtml(t.ts_dayoff_unpaid)}</label>
      <div class="val">${summary.dayOffDays ?? 0}</div>
    </div>
    <div class="summary-box box-green">
      <label>${escapeHtml(t.ts_total_pay)}</label>
      <div class="val">${formatCurrency(totalPayable, bcp47)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:start;">${escapeHtml(t.ts_col_date)}</th>
        <th style="text-align:center;">${escapeHtml(t.ts_col_type)}</th>
        <th style="text-align:start;">${escapeHtml(t.ts_col_project)}</th>
        <th style="text-align:center;">${escapeHtml(t.ts_col_in)}</th>
        <th style="text-align:center;">${escapeHtml(t.ts_col_out)}</th>
        <th style="text-align:center;">${escapeHtml(t.ts_col_hours)}</th>
        <th style="text-align:end;">${escapeHtml(t.ts_col_cost)}</th>
        <th style="text-align:start;">${escapeHtml(t.ts_col_note)}</th>
      </tr>
    </thead>
    <tbody>
      ${shiftRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" style="text-align:start;">${escapeHtml(t.ts_month_total)}</td>
        <td style="text-align:center;">${formatHours(summary.totalMinutes, dash)}</td>
        <td style="text-align:end; color:#86efac;">
          ${costBreak}
        </td>
        <td style="text-align:end; color:#4ade80; font-size:14px;">
          ${formatCurrency(totalPayable, bcp47)}
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sig-box">${escapeHtml(t.ts_sig_employer)}</div>
    <div class="sig-box">${escapeHtml(t.ts_sig_worker)}</div>
  </div>

  <div class="footer">
    <span>${escapeHtml(t.ts_footer_auto)}</span>
    <span>${escapeHtml(workerName)} | ${escapeHtml(monthLabel)}</span>
  </div>

</div>
</body>
</html>`
}
