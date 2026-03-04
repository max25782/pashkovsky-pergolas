import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
import type { WorkerShift, WorkerShiftSummary } from '@/types/workers'

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMonthHebrew(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(t: string | null): string {
  return t ?? '—'
}

function formatHours(minutes: number | null): string {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function shiftTypeLabel(type: string): { text: string; bg: string; color: string } {
  if (type === 'holiday') return { text: 'חג', bg: '#7c3aed22', color: '#7c3aed' }
  if (type === 'day_off') return { text: 'יום חופש', bg: '#d9770622', color: '#d97706' }
  return { text: 'עבודה', bg: '#16a34a22', color: '#16a34a' }
}

export function generateWorkerTimesheetHtml(data: WorkerTimesheetData): string {
  const { worker, month, shifts, summary } = data
  const fontsCss = getHebrewFontsCss()
  const logoUri = getLogoDataUri()
  const monthLabel = formatMonthHebrew(month)
  const workerName = `${worker.firstName} ${worker.lastName}`

  // Sort shifts by date ascending for the PDF
  const sortedShifts = [...shifts].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate))

  const shiftRows = sortedShifts.map((s) => {
    const type = shiftTypeLabel(s.shiftType ?? 'work')
    const isWork = (s.shiftType ?? 'work') === 'work'
    const isHoliday = s.shiftType === 'holiday'
    const isDayOff = s.shiftType === 'day_off'

    const costCell = isDayOff
      ? `<span style="color:#d97706;font-size:11px;">ללא תשלום</span>`
      : s.computedCost != null
        ? formatCurrency(s.computedCost)
        : '—'

    return `
      <tr style="border-bottom:1px solid #e5e7eb; background:${type.bg}08;">
        <td style="padding:7px 8px; text-align:right;">${formatDate(s.shiftDate)}</td>
        <td style="padding:7px 8px; text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${type.bg};color:${type.color};">${type.text}</span>
        </td>
        <td style="padding:7px 8px; text-align:right; color:#374151;">
          ${isWork ? (s.deal?.customerName ?? s.projectName ?? '—') : '—'}
        </td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatTime(s.startTime) : '—'}</td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatTime(s.endTime) : '—'}</td>
        <td style="padding:7px 8px; text-align:center;">${isWork ? formatHours(s.minutesWorked) : '—'}</td>
        <td style="padding:7px 8px; text-align:left; font-weight:${isHoliday ? '600' : '400'}; color:${isHoliday ? '#7c3aed' : 'inherit'};">${costCell}</td>
        <td style="padding:7px 8px; text-align:right; color:#6b7280; font-size:11px;">${s.note ?? ''}</td>
      </tr>
    `
  }).join('')

  const totalPayable = summary.totalPayable ?? (summary.totalCost + (summary.holidayPay ?? 0))

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>דוח נוכחות — ${workerName} — ${monthLabel}</title>
  <style>
    ${fontsCss}

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      direction: rtl;
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

    /* Header */
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

    /* Worker info card */
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

    /* Summary boxes */
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

    /* Table */
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

    /* Total row */
    .total-row td {
      padding: 10px 8px;
      font-weight: 700;
      font-size: 13px;
      background: #1e293b;
      color: #fff;
      border-top: 2px solid #1d4ed8;
    }

    /* Footer */
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }

    /* Signature */
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

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="header-title">דוח נוכחות חודשי</div>
      <div class="header-sub">${monthLabel}</div>
      <div class="header-sub" style="margin-top:4px; font-size:11px; color:#94a3b8;">
        הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}
      </div>
    </div>
    <img src="${logoUri}" class="logo" alt="logo" />
  </div>

  <!-- Worker info -->
  <div class="worker-card">
    <div class="worker-card-item">
      <label>שם עובד</label>
      <div class="value">${workerName}</div>
    </div>
    <div class="worker-card-item">
      <label>תפקיד</label>
      <div class="value">${worker.role ?? '—'}</div>
    </div>
    <div class="worker-card-item">
      <label>טלפון</label>
      <div class="value">${worker.phone ?? '—'}</div>
    </div>
    <div class="worker-card-item">
      <label>תעריף יומי</label>
      <div class="value">${formatCurrency(worker.dailyRate)}</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary-grid">
    <div class="summary-box box-blue">
      <label>ימי עבודה</label>
      <div class="val">${summary.daysWorked}</div>
    </div>
    <div class="summary-box box-purple">
      <label>חגים (בתשלום)</label>
      <div class="val">${summary.holidayDays ?? 0}</div>
    </div>
    <div class="summary-box box-amber">
      <label>ימי חופש (ללא תשלום)</label>
      <div class="val">${summary.dayOffDays ?? 0}</div>
    </div>
    <div class="summary-box box-green">
      <label>סה"כ לתשלום</label>
      <div class="val">${formatCurrency(totalPayable)}</div>
    </div>
  </div>

  <!-- Shifts table -->
  <table>
    <thead>
      <tr>
        <th style="text-align:right;">תאריך</th>
        <th style="text-align:center;">סוג</th>
        <th style="text-align:right;">עסקה / פרויקט</th>
        <th style="text-align:center;">כניסה</th>
        <th style="text-align:center;">יציאה</th>
        <th style="text-align:center;">שעות</th>
        <th style="text-align:left;">עלות</th>
        <th style="text-align:right;">הערה</th>
      </tr>
    </thead>
    <tbody>
      ${shiftRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" style="text-align:right;">סיכום חודשי</td>
        <td style="text-align:center;">${formatHours(summary.totalMinutes)}</td>
        <td style="text-align:left; color:#86efac;">
          עבודה: ${formatCurrency(summary.totalCost)}
          ${(summary.holidayPay ?? 0) > 0 ? ` + חגים: ${formatCurrency(summary.holidayPay ?? 0)}` : ''}
        </td>
        <td style="text-align:left; color:#4ade80; font-size:14px;">
          ${formatCurrency(totalPayable)}
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box">חתימת מעסיק</div>
    <div class="sig-box">חתימת עובד</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>דוח זה הופק אוטומטית ממערכת AluminCRM</span>
    <span>${workerName} | ${monthLabel}</span>
  </div>

</div>
</body>
</html>`
}
