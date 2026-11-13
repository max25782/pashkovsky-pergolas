/**
 * The weekly owner report as an e-mail: subject and HTML, in the firm's language.
 * Pure: it only formats a WeeklyReport.
 */

import { escapeHtml } from '@/lib/company-notify'
import type { CountAmount, DateKey, WeeklyReport } from '@/lib/reports/weekly-report'
import type { ReportLanguage } from '@/lib/reports/weekly-report-settings'

interface ReportStrings {
  subject: string
  title: string
  lastWeek: string
  nextWeek: string
  deals: string
  plannedDeals: string
  closedDeals: string
  notClosedDeals: string
  payments: string
  plannedPayments: string
  receivedPayments: string
  forecastDeals: string
  forecastPayments: string
  openByStage: string
  topProject: string
  topProjectProfit: string
  noDueDate: string
  noDueDateDeals: string
  noDueDatePayments: string
  amountsNote: string
  footer: string
}

const STRINGS: Record<ReportLanguage, ReportStrings> = {
  en: {
    subject: 'Weekly report',
    title: 'Weekly report',
    lastWeek: 'Last week',
    nextWeek: 'Next week forecast',
    deals: 'Deals',
    plannedDeals: 'Planned',
    closedDeals: 'Closed',
    notClosedDeals: 'Not closed',
    payments: 'Payments',
    plannedPayments: 'Planned payments',
    receivedPayments: 'Received',
    forecastDeals: 'Deals due',
    forecastPayments: 'Planned payments',
    openByStage: 'Open deals by stage',
    topProject: 'Most profitable project of the week',
    topProjectProfit: 'net profit',
    noDueDate: 'No due date',
    noDueDateDeals: 'Deals with no due date',
    noDueDatePayments: 'Planned payments with no date',
    amountsNote: 'Deal amounts are the client price after discount, VAT included.',
    footer: 'Sent automatically from your CRM. Change or switch it off in Settings.',
  },
  ru: {
    subject: 'Недельный отчёт',
    title: 'Недельный отчёт',
    lastWeek: 'Прошлая неделя',
    nextWeek: 'Прогноз на следующую неделю',
    deals: 'Сделки',
    plannedDeals: 'Запланировано',
    closedDeals: 'Закрыто',
    notClosedDeals: 'Не закрыто',
    payments: 'Платежи',
    plannedPayments: 'Запланированные платежи',
    receivedPayments: 'Получено',
    forecastDeals: 'Сделки по сроку',
    forecastPayments: 'Запланированные платежи',
    openByStage: 'Открытые сделки по этапам',
    topProject: 'Самый прибыльный проект недели',
    topProjectProfit: 'чистая прибыль',
    noDueDate: 'Срок не указан',
    noDueDateDeals: 'Сделки без срока',
    noDueDatePayments: 'Запланированные платежи без даты',
    amountsNote: 'Суммы сделок: цена для клиента после скидки, с НДС.',
    footer: 'Отправлено автоматически из вашей CRM. Изменить или отключить можно в настройках.',
  },
  he: {
    subject: 'דוח שבועי',
    title: 'דוח שבועי',
    lastWeek: 'שבוע שעבר',
    nextWeek: 'תחזית לשבוע הבא',
    deals: 'עסקאות',
    plannedDeals: 'תוכננו',
    closedDeals: 'נסגרו',
    notClosedDeals: 'לא נסגרו',
    payments: 'תשלומים',
    plannedPayments: 'תשלומים מתוכננים',
    receivedPayments: 'התקבלו',
    forecastDeals: 'עסקאות לפי מועד',
    forecastPayments: 'תשלומים מתוכננים',
    openByStage: 'עסקאות פתוחות לפי שלב',
    topProject: 'הפרויקט הרווחי ביותר של השבוע',
    topProjectProfit: 'רווח נקי',
    noDueDate: 'ללא מועד',
    noDueDateDeals: 'עסקאות ללא מועד',
    noDueDatePayments: 'תשלומים מתוכננים ללא תאריך',
    amountsNote: 'סכומי העסקאות: מחיר ללקוח אחרי הנחה, כולל מע״מ.',
    footer: 'נשלח אוטומטית מה-CRM שלך. אפשר לשנות או לכבות בהגדרות.',
  },
  sr: {
    subject: 'Nedeljni izveštaj',
    title: 'Nedeljni izveštaj',
    lastWeek: 'Prošla nedelja',
    nextWeek: 'Prognoza za sledeću nedelju',
    deals: 'Poslovi',
    plannedDeals: 'Planirano',
    closedDeals: 'Zatvoreno',
    notClosedDeals: 'Nije zatvoreno',
    payments: 'Plaćanja',
    plannedPayments: 'Planirana plaćanja',
    receivedPayments: 'Primljeno',
    forecastDeals: 'Poslovi po roku',
    forecastPayments: 'Planirana plaćanja',
    openByStage: 'Otvoreni poslovi po fazama',
    topProject: 'Najprofitabilniji projekat nedelje',
    topProjectProfit: 'neto dobit',
    noDueDate: 'Bez roka',
    noDueDateDeals: 'Poslovi bez roka',
    noDueDatePayments: 'Planirana plaćanja bez datuma',
    amountsNote: 'Iznosi poslova: cena za klijenta posle popusta, sa PDV-om.',
    footer: 'Poslato automatski iz vašeg CRM-a. Promenite ili isključite u podešavanjima.',
  },
}

const INTL_LOCALE: Record<ReportLanguage, string> = { he: 'he-IL', ru: 'ru-RU', en: 'en-US', sr: 'sr-Latn-RS' }

export function formatReportMoney(amount: number, currency: string, language: ReportLanguage): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[language], {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString(INTL_LOCALE[language])} ${currency}`
  }
}

function formatDay(key: DateKey, language: ReportLanguage): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(INTL_LOCALE[language], { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

export function formatPeriod(from: DateKey, to: DateKey, language: ReportLanguage): string {
  return `${formatDay(from, language)} - ${formatDay(to, language)}`
}

export interface WeeklyReportEmailOptions {
  firmName: string
  language: ReportLanguage
  currency: string
}

export interface WeeklyReportEmail {
  subject: string
  html: string
}

export function renderWeeklyReportEmail(report: WeeklyReport, options: WeeklyReportEmailOptions): WeeklyReportEmail {
  const { language, currency } = options
  const t = STRINGS[language]
  const dir = language === 'he' ? 'rtl' : 'ltr'
  const money = (amount: number) => escapeHtml(formatReportMoney(amount, currency, language))
  const lastPeriod = formatPeriod(report.period.lastStart, report.period.lastEnd, language)
  const nextPeriod = formatPeriod(report.period.nextStart, report.period.nextEnd, language)

  const row = (label: string, value: CountAmount, showWhenEmpty = true) =>
    value.count === 0 && !showWhenEmpty
      ? ''
      : `<tr><td style="padding:6px 0;color:#374151;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 8px;text-align:center;font-weight:600;color:#111827;">${value.count}</td>` +
        `<td style="padding:6px 0;text-align:end;color:#111827;">${money(value.amount)}</td></tr>`

  const section = (title: string, body: string) =>
    body.trim() === ''
      ? ''
      : `<h2 style="font-size:16px;color:#1f2937;margin:24px 0 8px 0;">${escapeHtml(title)}</h2>` +
        `<table style="width:100%;border-collapse:collapse;">${body}</table>`

  const last = report.lastWeek
  const dealsLast =
    last.plannedDeals.count + last.closedDeals.count > 0
      ? row(t.plannedDeals, last.plannedDeals) + row(t.closedDeals, last.closedDeals) + row(t.notClosedDeals, last.openDeals)
      : ''
  const paymentsLast =
    last.plannedPayments.count + last.receivedPayments.count > 0
      ? row(t.plannedPayments, last.plannedPayments) + row(t.receivedPayments, last.receivedPayments)
      : ''

  const next = report.nextWeek
  const forecast =
    row(t.forecastDeals, next.deals, false) + row(t.forecastPayments, next.plannedPayments, false)

  const stages = report.openByStage.map((line) => row(line.label, line)).join('')

  const noDue =
    row(t.noDueDateDeals, report.noDueDate.deals, false) +
    row(t.noDueDatePayments, report.noDueDate.payments, false)

  const top = report.topProject
    ? `<p style="margin:0;font-size:15px;color:#111827;"><strong>${escapeHtml(report.topProject.name)}</strong> - ` +
      `${money(report.topProject.netProfit)} ${escapeHtml(t.topProjectProfit)} (${money(report.topProject.price)})</p>`
    : ''

  const body = [
    section(`${t.lastWeek}: ${t.deals} (${lastPeriod})`, dealsLast),
    section(`${t.lastWeek}: ${t.payments} (${lastPeriod})`, paymentsLast),
    section(`${t.nextWeek} (${nextPeriod})`, forecast),
    section(t.openByStage, stages),
    top === ''
      ? ''
      : `<h2 style="font-size:16px;color:#1f2937;margin:24px 0 8px 0;">${escapeHtml(t.topProject)}</h2>${top}`,
    section(t.noDueDate, noDue),
  ].join('')

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${language}">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 4px 0;color:#111827;">${escapeHtml(options.firmName)}</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(t.title)}: ${lastPeriod}</p>
    ${body}
    <p style="margin:24px 0 0 0;font-size:12px;color:#6b7280;">${escapeHtml(t.amountsNote)}</p>
    <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">${escapeHtml(t.footer)}</p>
  </div>
</body>
</html>`

  const name = options.firmName.trim()
  return {
    subject: `${name !== '' ? `${name}: ` : ''}${t.subject} ${lastPeriod}`,
    html,
  }
}
