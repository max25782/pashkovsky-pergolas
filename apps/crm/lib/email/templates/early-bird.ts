/**
 * Email templates for the Early Bird program.
 *
 * - generateWelcomeEmailHTML: branches on whether the user got a cohort spot
 * - generateTrialEndingHTML: 3-days-left reminder
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.alumincrm.com'

interface WelcomeOptions {
  fullName: string
  companyName: string
  isEarlyBird: boolean
  earlyBirdPosition: number | null
  trialDays: number
}

export function generateWelcomeEmailSubject({ isEarlyBird, earlyBirdPosition }: WelcomeOptions): string {
  if (isEarlyBird && earlyBirdPosition) {
    return `You got Early Bird spot #${earlyBirdPosition} — 14 days, full access`
  }
  return 'Welcome to AluminCRM — your trial is active'
}

export function generateWelcomeEmailHTML(opts: WelcomeOptions): string {
  const { fullName, companyName, isEarlyBird, earlyBirdPosition, trialDays } = opts

  const headerGradient = isEarlyBird
    ? 'background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);'
    : 'background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);'

  const headline = isEarlyBird
    ? `Welcome aboard, ${fullName}! You got Early Bird spot #${earlyBirdPosition}.`
    : `Welcome to AluminCRM, ${fullName}.`

  const body = isEarlyBird
    ? `
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 16px 0;">
          You're one of the first <strong>20 companies</strong> to join. For the next <strong>${trialDays} days</strong>,
          you have <strong>full access to every feature</strong>: AI proposals, deal pipeline, WhatsApp, analytics, multi-language — everything.
        </p>
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 16px 0;">
          When the trial ends, you'll keep your data and we'll offer you a special long-term price reserved for Early Bird customers only.
        </p>
      `
    : `
        <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 16px 0;">
          Your <strong>${trialDays}-day trial</strong> for <strong>${companyName}</strong> is active. Take the time to set up your team, import your leads, and try the AI proposal generator.
        </p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
          The Early Bird cohort (14 days, full access) is currently full. You can upgrade any time to unlock all features.
        </p>
      `

  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <tr>
                <td style="${headerGradient} padding:40px 20px;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:28px;">AluminCRM</h1>
                  ${isEarlyBird ? `<p style="color:#fef3c7;margin:10px 0 0 0;font-size:14px;font-weight:bold;letter-spacing:1px;">⚡ EARLY BIRD #${earlyBirdPosition} OF 20</p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:36px 30px;">
                  <h2 style="color:#1f2937;margin:0 0 16px 0;font-size:22px;">${headline}</h2>
                  ${body}
                  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                    <tr>
                      <td style="background:${isEarlyBird ? '#f59e0b' : '#2563eb'};border-radius:8px;">
                        <a href="${APP_URL}/app/admin" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">
                          Open my CRM →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:24px 0 0 0;">
                    Need help? Just reply to this email — we read every message.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="color:#9ca3af;font-size:12px;margin:0;">© AluminCRM · Pashkovsky Group</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

interface TrialEndingOptions {
  fullName: string
  daysLeft: number
  isEarlyBird: boolean
  earlyBirdPosition: number | null
}

export function generateTrialEndingSubject({ daysLeft, isEarlyBird }: TrialEndingOptions): string {
  if (isEarlyBird) return `Your Early Bird trial ends in ${daysLeft} days`
  return `${daysLeft} days left on your AluminCRM trial`
}

export function generateTrialEndingHTML(opts: TrialEndingOptions): string {
  const { fullName, daysLeft, isEarlyBird, earlyBirdPosition } = opts

  const intro = isEarlyBird
    ? `Your <strong>Early Bird trial</strong> (spot #${earlyBirdPosition}) ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. Lock in your discounted long-term price now and keep full access without interruption.`
    : `Your <strong>${daysLeft}-day trial</strong> ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. Upgrade now to keep your data and unlock all features.`

  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <tr>
                <td style="background:linear-gradient(135deg,#dc2626 0%,#ea580c 100%);padding:32px 20px;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:24px;">⏰ ${daysLeft} day${daysLeft === 1 ? '' : 's'} left</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 30px;">
                  <h2 style="color:#1f2937;margin:0 0 16px 0;font-size:20px;">Hi ${fullName},</h2>
                  <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px 0;">${intro}</p>
                  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                    <tr>
                      <td style="background:#dc2626;border-radius:8px;">
                        <a href="${APP_URL}/app/settings/subscription" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">
                          Upgrade now →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="color:#9ca3af;font-size:12px;margin:0;">© AluminCRM · Pashkovsky Group</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
