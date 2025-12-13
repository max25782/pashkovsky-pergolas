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
    console.log('[PDF Render] Starting HTML to PDF conversion...')
    console.log('[PDF Render] HTML length:', html.length, 'characters')

    // Launch browser
    browser = await createBrowser()

    // Create new page
    page = await browser.newPage()
    
    // Set extra HTTP headers to ensure UTF-8
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9',
      'Accept-Charset': 'utf-8',
    })

    console.log('[PDF Render] Loading HTML content with embedded fonts...')

    // Set content - fonts are embedded as base64, no external requests needed
    await page.setContent(html, {
      waitUntil: 'load', // Just wait for DOM, no network requests
      timeout: 30000, // 30 seconds
    })

    // Wait for fonts to be loaded and ready
    try {
      await page.evaluate(() => {
        return document.fonts.ready
      })
      console.log('[PDF Render] Fonts ready')
      
      // Additional wait to ensure fonts are rendered (using setTimeout instead of waitForTimeout)
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (fontError) {
      console.warn('[PDF Render] Font loading check failed, continuing anyway:', fontError)
      // Still wait a bit even if font check fails
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('[PDF Render] HTML loaded, fonts ready, generating PDF...')

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

    console.log('[PDF Render] ✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes')

    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('[PDF Render] ❌ Error rendering HTML to PDF:', error)
    throw new Error(`Failed to render PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Always close page
    if (page) {
      try {
        await page.close()
        console.log('[PDF Render] Page closed')
      } catch (err) {
        console.error('[PDF Render] Error closing page:', err)
      }
    }
  }
}

