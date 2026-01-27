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
    console.log('[PDF Render] Step 1: Creating browser instance...')
    browser = await createBrowser()
    console.log('[PDF Render] ✅ Browser created successfully')

    // Create new page
    console.log('[PDF Render] Step 2: Creating new page...')
    page = await browser.newPage()
    console.log('[PDF Render] ✅ Page created')
    
    // Set extra HTTP headers to ensure UTF-8
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9',
      'Accept-Charset': 'utf-8',
    })

    console.log('[PDF Render] Step 3: Loading HTML content with embedded fonts...')

    // Set content - fonts are embedded as base64, no external requests needed
    await page.setContent(html, {
      waitUntil: 'load', // Just wait for DOM, no network requests
      timeout: 30000, // 30 seconds
    })
    console.log('[PDF Render] ✅ HTML content loaded')

    // Wait for fonts to be loaded and ready
    try {
      console.log('[PDF Render] Step 4: Waiting for fonts to load...')
      await page.evaluate(() => {
        return document.fonts.ready
      })
      console.log('[PDF Render] ✅ Fonts ready')
      
      // Additional wait to ensure fonts are rendered
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (fontError) {
      console.warn('[PDF Render] ⚠️ Font loading check failed, continuing anyway:', fontError)
      // Still wait a bit even if font check fails
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('[PDF Render] Step 5: Generating PDF...')

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
        console.log('[PDF Render] ✅ Page closed')
      } catch (err) {
        console.error('[PDF Render] ⚠️ Error closing page:', err)
      }
    }
    // Note: Browser is reused, so we don't close it here
  }
}

