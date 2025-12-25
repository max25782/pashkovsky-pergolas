import chromium from '@sparticuz/chromium'
import puppeteerCore, { type Browser } from 'puppeteer-core'

let browserInstance: Browser | null = null

/**
 * Create a Chromium browser instance compatible with Vercel serverless
 * Reuses existing instance if available
 */
export async function createBrowser(): Promise<Browser> {
  // Reuse existing browser if available
  if (browserInstance && browserInstance.isConnected()) {
    console.log('[Browser] Reusing existing browser instance')
    return browserInstance
  }

  console.log('[Browser] Creating new Chromium instance...')
  console.log('[Browser] Environment:', process.env.NODE_ENV)
  console.log('[Browser] Vercel:', !!process.env.VERCEL)

  try {
    // On localhost, use full puppeteer (includes Chromium)
    if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
      console.log('[Browser] Development mode: using full puppeteer...')
      try {
        // Dynamic import to avoid bundling puppeteer in production
        const puppeteer = await import('puppeteer')
        browserInstance = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
        console.log('[Browser] ✅ Puppeteer (with Chromium) launched successfully')
        return browserInstance
      } catch (localError) {
        console.error('[Browser] ❌ Puppeteer launch failed:', localError)
        throw localError
      }
    }

    // Use @sparticuz/chromium for Vercel production
    console.log('[Browser] Production mode: using @sparticuz/chromium...')
    const executablePath = await chromium.executablePath()
    console.log('[Browser] Chromium executable path:', executablePath)
    
    browserInstance = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      executablePath,
      headless: true, // Always headless for serverless PDF generation
    })

    console.log('[Browser] ✅ Chromium instance created successfully')
    return browserInstance
  } catch (error) {
    console.error('[Browser] ❌ Failed to create Chromium instance:', error)
    console.error('[Browser] Error details:', error instanceof Error ? error.stack : error)
    throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close()
    browserInstance = null
    console.log('[Browser] Browser closed')
  }
}

