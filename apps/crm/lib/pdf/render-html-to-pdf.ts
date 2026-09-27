import { createBrowser } from './create-browser'

export interface RenderHtmlToPdfOptions {
  /** Puppeteer footer: עמ׳ X מתוך Y on every page */
  numberedFooter?: boolean
  footerPageLabel?: string
}

/**
 * Render HTML to PDF Buffer using Puppeteer + Chromium
 * @param html - Self-contained HTML string with embedded base64 fonts
 * @returns PDF as Buffer
 */
export async function renderHtmlToPdfBuffer(
  html: string,
  options?: RenderHtmlToPdfOptions,
): Promise<Buffer> {
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
    const pageLabel = options?.footerPageLabel ?? 'עמ׳'
    const numberedFooter = options?.numberedFooter === true
    const emptyHeaderTemplate =
      '<div style="width:100%;height:0;margin:0;padding:0;font-size:0;line-height:0;"></div>'
    const footerTemplate = numberedFooter
      ? `<div style="width:100%;font-size:9px;color:#555;text-align:center;font-family:'Noto Sans Hebrew',Arial,sans-serif;padding:0 12mm;">
          ${pageLabel} <span class="pageNumber"></span> מתוך <span class="totalPages"></span>
        </div>`
      : undefined

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: numberedFooter ? '22mm' : '20mm',
        left: '15mm',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: numberedFooter,
      headerTemplate: numberedFooter ? emptyHeaderTemplate : undefined,
      footerTemplate: numberedFooter ? footerTemplate : undefined,
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

