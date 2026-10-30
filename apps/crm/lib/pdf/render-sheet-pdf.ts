import { createBrowser } from './create-browser'
import { inlineProfilePhotoDataUris } from './inline-profile-photos'

/**
 * Vector A4 PDF of already-laid-out sheet HTML.
 * Page size comes from the named @page rules in the HTML (`preferCSSPageSize`),
 * so a landscape plan page and a portrait cutting sheet can share one file.
 */
export async function renderSheetHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await createBrowser()
  const page = await browser.newPage()
  try {
    const withPhotos = inlineProfilePhotoDataUris(html)
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.evaluate((content: string) => {
      document.open()
      document.write(content)
      document.close()
    }, withPhotos)
    await page.evaluate(async () => {
      const fonts = document.fonts?.ready ?? Promise.resolve()
      const images = [...document.images].map((img) => img.decode().catch(() => undefined))
      await Promise.all([fonts, ...images])
    }).catch(() => undefined)
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close().catch(() => undefined)
  }
}
