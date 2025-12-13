import nodemailer from 'nodemailer'

// Create email transporter for Zoho Mail
export const emailClient = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.com',
  port: Number(process.env.EMAIL_PORT || 465),
  secure: true, // Use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password from Zoho
  },
})

// Verify connection on startup (optional, for debugging)
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailClient.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error)
    } else {
      console.log('✅ Email transporter is ready to send messages')
    }
  })
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_PASS in .env')
  }

  try {
    const info = await emailClient.sendMail({
      from: process.env.EMAIL_FROM || `"Pashkovsky Group" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text fallback
    })

    console.log('✅ Email sent:', info.messageId)
    return { ok: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('❌ Failed to send email:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// Template for offer email
export function generateOfferEmailHTML(offerUrl: string, customerName: string) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pashkovsky Group</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">פרגולות | גדרות | חלונות</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">שלום ${customerName},</h2>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    הכנו עבורך הצעת מחיר מותאמת אישית עבור הפרגולה שלך.
                  </p>
                  
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    לצפייה בהצעה ולאישור, לחץ על הכפתור למטה:
                  </p>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${offerUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                          צפה בהצעת המחיר
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                    או העתק את הקישור הבא לדפדפן שלך:
                  </p>
                  <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin: 10px 0 0 0;">
                    ${offerUrl}
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                    יש לך שאלות? פשוט השב למייל הזה.
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Pashkovsky Group. כל הזכויות שמורות.
                  </p>
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


