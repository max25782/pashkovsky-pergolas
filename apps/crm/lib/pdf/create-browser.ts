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
        console.log('[Browser] Importing puppeteer module...')
        const puppeteer = await import('puppeteer')
        console.log('[Browser] Puppeteer imported, launching browser...')
        
        browserInstance = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
        console.log('[Browser] ✅ Puppeteer (with Chromium) launched successfully')
        return browserInstance
      } catch (localError: any) {
        console.error('[Browser] ❌ Puppeteer launch failed:')
        console.error('[Browser] Error type:', localError?.constructor?.name || typeof localError)
        console.error('[Browser] Error message:', localError?.message || String(localError))
        console.error('[Browser] Error stack:', localError?.stack || 'No stack trace')
        throw new Error(`Failed to launch Puppeteer: ${localError?.message || 'Unknown error'}`)
      }
    }

    // Use @sparticuz/chromium for Vercel production
    console.log('[Browser] Production mode: using @sparticuz/chromium...')
    try {
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
    } catch (chromiumError: any) {
      console.error('[Browser] ❌ Chromium launch failed:')
      console.error('[Browser] Error type:', chromiumError?.constructor?.name || typeof chromiumError)
      console.error('[Browser] Error message:', chromiumError?.message || String(chromiumError))
      console.error('[Browser] Error stack:', chromiumError?.stack || 'No stack trace')
      throw new Error(`Failed to launch Chromium: ${chromiumError?.message || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('[Browser] ❌ Failed to create browser instance:')
    console.error('[Browser] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[Browser] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[Browser] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    throw error instanceof Error ? error : new Error(`Failed to launch browser: ${String(error)}`)
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

