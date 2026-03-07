/**
 * Appointment detection for AI chat.
 * When the sales bot confirms a meeting, we extract structured data
 * and send a calendar invite (.ics) to the business owner.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Hebrew phrases that indicate the bot has confirmed/finalised a meeting
const CONFIRMATION_PHRASES = [
  'אושרה',
  'נתראה ביום',
  'נתראה ב',
  'הפגישה שלך',
  'נחזור אליך עם אישור',
  'הפגישה אושרה',
  'נקבעה פגישה',
  'קבענו פגישה',
]

export interface AppointmentData {
  clientName: string | null
  clientPhone: string | null
  city: string | null
  /** ISO date string (date portion only), e.g. "2025-06-08" */
  date: string | null
  /** HH:MM */
  time: string | null
  notes: string | null
}

/** Returns true when the AI response looks like a confirmed appointment */
export function isAppointmentConfirmation(responseText: string): boolean {
  const lower = responseText.toLowerCase()
  return CONFIRMATION_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()))
}

/**
 * Call Gemini to extract structured appointment info from the full conversation.
 * Returns null if extraction fails or data is too incomplete to be useful.
 */
export async function extractAppointment(
  messages: Array<{ role: string; content: string }>,
): Promise<AppointmentData | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[Appointment] GEMINI_API_KEY not set — skipping extraction')
    return null
  }

  const conversation = messages
    .map((m) => `${m.role === 'assistant' ? 'נציג' : 'לקוח'}: ${m.content}`)
    .join('\n')

  const prompt = `להלן שיחת מכירות בעברית עם לקוח. חלץ מידע על פגישה שנקבעה.

שיחה:
${conversation}

החזר JSON בדיוק בפורמט הזה (אל תוסיף שום טקסט מחוץ ל-JSON):
{
  "clientName": "שם הלקוח או null",
  "clientPhone": "מספר טלפון ללא רווחים או null",
  "city": "עיר הפגישה או null",
  "date": "תאריך ISO YYYY-MM-DD מהשבוע הקרוב מתאריך היום ${new Date().toISOString().slice(0, 10)} או null",
  "time": "שעה בפורמט HH:MM או null",
  "notes": "פרטים נוספים (סוג פרגולה, קומה וכו') או null"
}

אם אין מספיק מידע לתאריך מדויק, שים null בשדה date.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 300 },
        }),
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!res.ok) {
      console.error('[Appointment] Gemini extraction error:', res.status)
      return null
    }

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Strip markdown code fences if present
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[Appointment] No JSON found in extraction response')
      return null
    }

    const parsed: AppointmentData = JSON.parse(jsonMatch[0])
    return parsed
  } catch (e) {
    console.error('[Appointment] Extraction failed:', e)
    return null
  }
}
