/**
 * Generate .ics calendar invite and send it by email.
 * Works with both Apple Calendar (Mail → Add to Calendar)
 * and Google Calendar (Gmail auto-parses .ics attachments).
 */

import { emailClient } from '@/lib/email'
import type { AppointmentData } from './appointment-detector'

const OWNER_EMAIL = process.env.EMAIL_USER ?? 'office@pashkovsky-group.com'
const COMPANY_NAME = 'Pashkovsky Group'

/** Format date+time to iCal DTSTART/DTEND format: 20250608T120000 */
function toICalDate(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-')
  const [hour, minute] = timeStr.split(':')
  return `${year}${month}${day}T${hour}${minute}00`
}

/** Add 1 hour to a DTSTART string for DTEND */
function addOneHour(ical: string): string {
  // Parse hour from the Thhmmss portion
  const hour = parseInt(ical.slice(9, 11), 10)
  const newHour = String((hour + 1) % 24).padStart(2, '0')
  return ical.slice(0, 9) + newHour + ical.slice(11)
}

/** Generate .ics file content */
export function generateICS(appt: AppointmentData, uid: string): string {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const dateStr = appt.date ?? new Date().toISOString().slice(0, 10)
  const timeStr = appt.time ?? '09:00'
  const dtStart = toICalDate(dateStr, timeStr)
  const dtEnd = addOneHour(dtStart)

  const summary = `פגישת מדידה${appt.clientName ? ` - ${appt.clientName}` : ''}${appt.city ? ` (${appt.city})` : ''}`

  const descParts = [
    appt.clientName && `לקוח: ${appt.clientName}`,
    appt.clientPhone && `טלפון: ${appt.clientPhone}`,
    appt.city && `עיר: ${appt.city}`,
    appt.notes && `פרטים: ${appt.notes}`,
    `נוצר אוטומטית מ-AI Chat`,
  ].filter(Boolean)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${COMPANY_NAME}//AI Chat//HE`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@pashkovsky-group.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${descParts.join('\\n')}`,
    appt.city ? `LOCATION:${appt.city}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Reminder 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:תזכורת לפגישת מדידה',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/** Send calendar invite email with .ics attachment */
export async function sendCalendarInvite(appt: AppointmentData): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[CalendarInvite] Email not configured — skipping invite')
    return
  }

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ics = generateICS(appt, uid)

  const dateLabel = appt.date
    ? new Date(appt.date + 'T' + (appt.time ?? '09:00') + ':00')
        .toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'תאריך לא ידוע'

  const subject = `📅 פגישת מדידה${appt.clientName ? ` - ${appt.clientName}` : ''} | ${dateLabel}${appt.city ? ` | ${appt.city}` : ''}`

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px;">
      <h2 style="color: #1d4ed8;">📅 פגישת מדידה חדשה</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">לקוח</td><td style="padding: 8px;">${appt.clientName ?? '—'}</td></tr>
        <tr style="background:#f9fafb"><td style="padding: 8px; font-weight: bold; color: #374151;">טלפון</td><td style="padding: 8px;">${appt.clientPhone ? `<a href="tel:${appt.clientPhone}">${appt.clientPhone}</a>` : '—'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">עיר</td><td style="padding: 8px;">${appt.city ?? '—'}</td></tr>
        <tr style="background:#f9fafb"><td style="padding: 8px; font-weight: bold; color: #374151;">תאריך</td><td style="padding: 8px;">${dateLabel}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #374151;">שעה</td><td style="padding: 8px;">${appt.time ?? '—'}</td></tr>
        ${appt.notes ? `<tr style="background:#f9fafb"><td style="padding: 8px; font-weight: bold; color: #374151;">פרטים</td><td style="padding: 8px;">${appt.notes}</td></tr>` : ''}
      </table>
      <p style="margin-top: 16px; color: #6b7280; font-size: 13px;">
        הפגישה נקבעה דרך AI Chat. פתח את הקובץ המצורף (.ics) כדי להוסיף ליומן Apple/Google.
      </p>
    </div>
  `

  await emailClient.sendMail({
    from: process.env.EMAIL_FROM ?? `"${COMPANY_NAME}" <${OWNER_EMAIL}>`,
    to: OWNER_EMAIL,
    subject,
    html,
    text: `פגישת מדידה\nלקוח: ${appt.clientName}\nטלפון: ${appt.clientPhone}\nעיר: ${appt.city}\nתאריך: ${dateLabel}\nשעה: ${appt.time}`,
    attachments: [
      {
        filename: `meeting-${uid}.ics`,
        content: ics,
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
      },
    ],
  })

  console.log('[CalendarInvite] Sent to', OWNER_EMAIL, '— appointment:', appt)
}
