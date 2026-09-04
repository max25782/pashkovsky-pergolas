import { isAppointmentConfirmation, isCallbackConfirmation } from '../appointment-detector'

describe('isCallbackConfirmation', () => {
  it('matches the post-number callback confirmation from SYSTEM_PROMPT', () => {
    expect(
      isCallbackConfirmation('קיבלתי.\nנציג יחזור אליך טלפונית בהקדם.\nבאיזו עיר המדידה?'),
    ).toBe(true)
  })

  it('does not fire when the bot is only asking for a phone number', () => {
    expect(
      isCallbackConfirmation('מעולה.\nבאיזה מספר נוח לחזור אליך?\nנציג יתקשר בהקדם.'),
    ).toBe(false)
  })

  it('does not treat a measurement booking as a callback', () => {
    expect(isCallbackConfirmation('מעולה.\nנקבעה פגישה ביום ראשון ב-10:00.')).toBe(false)
    expect(isAppointmentConfirmation('מעולה.\nנקבעה פגישה ביום ראשון ב-10:00.')).toBe(true)
  })

  it('does not match the old broken reply that confessed chat-only limits', () => {
    expect(
      isCallbackConfirmation(
        'אוקיי, אני מבין שתרצה שאתקשר עכשיו. כנציג מכירות אני מוגבל לתקשורת בצ׳אט.',
      ),
    ).toBe(false)
  })
})
