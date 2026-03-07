import { createBrowser } from './create-browser'

/**
 * Render HTML to PDF Buffer using Puppeteer + Chromium
 * @param html - Self-contained HTML string with embedded base64 fonts
 * @returns PDF as Buffer
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  let browser = null
  let page = null

  try {

    // Launch browser
    browser = await createBrowser()

    // Create new page
    page = await browser.newPage()
    
    // Set extra HTTP headers to ensure UTF-8
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9',
      'Accept-Charset': 'utf-8',
    })


    // Use document.write instead of setContent: chrome-headless-shell throws
    // "Unexpected status code: 404" for setContent (even with domcontentloaded),
    // likely due to data-URL or navigation handling. document.write bypasses
    // navigation entirely and has no URL length limits for large base64 fonts.
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.evaluate((content: string) => {
      document.open()
      document.write(content)
      document.close()
    }, html)

    // Wait for fonts to be loaded and ready
    try {
      await page.evaluate(() => {
        return document.fonts.ready
      })
      
      // Additional wait to ensure fonts are rendered
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (fontError) {
      console.warn('[PDF Render] ⚠️ Font loading check failed, continuing anyway:', fontError)
      // Still wait a bit even if font check fails
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      preferCSSPageSize: false,
    })


    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('[PDF Render] ❌ Error rendering HTML to PDF:')
    console.error('[PDF Render] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[PDF Render] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[PDF Render] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    throw new Error(`Failed to render PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Always close page
    if (page) {
      try {
        await page.close()
      } catch (err) {
        console.error('[PDF Render] ⚠️ Error closing page:', err)
      }
    }
    // Note: Browser is reused, so we don't close it here
  }
}

