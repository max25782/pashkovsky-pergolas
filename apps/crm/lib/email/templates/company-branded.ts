/**
 * Company-Branded Email Template
 * Email template with company logo, colors, and signature
 */

interface Company {
  name: string
  logo_url: string | null
  brand_color: string | null
  email_signature: string | null
  primary_email: string | null
}

export function companyBrandedEmail(
  content: string,
  title: string,
  company: Company
) {
  const brandColor = company.brand_color || '#2563EB'
  const logoSection = company.logo_url
    ? `<img src="${company.logo_url}" alt="${company.name}" style="max-height: 70px; max-width: 250px; object-fit: contain;" />`
    : `<h2 style="color: ${brandColor}; margin: 0; font-size: 28px; font-weight: 700;">${company.name}</h2>`

  const signature = company.email_signature 
    ? `<div style="white-space: pre-wrap; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px;">${company.email_signature}</div>`
    : ''

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: white;
          padding: 30px;
          text-align: center;
          border-bottom: 4px solid ${brandColor};
        }
        .content {
          padding: 40px 30px;
          color: #374151;
          line-height: 1.6;
        }
        .content h1 {
          color: ${brandColor};
          font-size: 24px;
          margin-bottom: 20px;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
        .powered-by {
          margin-top: 10px;
          color: #d1d5db;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoSection}
        </div>
        <div class="content">
          <h1>${title}</h1>
          ${content}
          ${signature}
        </div>
        <div class="footer">
          <div>${company.name}</div>
          ${company.primary_email ? `<div>${company.primary_email}</div>` : ''}
          <div class="powered-by">Powered by AluminCRM</div>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * System Email Template (AluminCRM branding)
 * For registration, password reset, etc.
 */
export function systemEmailTemplate(content: string, title: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .logo {
          color: white;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .logo-accent {
          color: #94A3B8;
        }
        .tagline {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
        }
        .content {
          padding: 40px 30px;
          color: #374151;
          line-height: 1.6;
        }
        .content h1 {
          color: #1E293B;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .footer {
          background: #f9fafb;
          padding: 25px;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Alumin<span class="logo-accent">CRM</span></div>
          <div class="tagline">Construction CRM Platform</div>
        </div>
        <div class="content">
          <h1>${title}</h1>
          ${content}
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} AluminCRM. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Offer Sent Email Template
 */
export function offerSentEmail(
  customerName: string,
  offerUrl: string,
  company: Company
) {
  const content = `
    <p style="font-size: 16px; margin-bottom: 15px;">שלום ${customerName},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">
      נשמח להציג לך את ההצעה שלנו עבור הפרויקט שלך.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; padding: 14px 40px; background-color: ${company.brand_color || '#2563EB'}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        צפייה בהצעה ואישור
      </a>
    </div>
    <p style="font-size: 16px; margin-bottom: 15px;">
      אנא עיין בפרטים ואשר את ההצעה דרך הקישור.
    </p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
      ההצעה תקפה למשך 30 יום.
    </p>
  `

  return companyBrandedEmail(content, 'הצעת מחיר חדשה', company)
}

