import chromium from '@sparticuz/chromium'
import puppeteerCore, { type Browser } from 'puppeteer-core'

// In Vercel monorepo deployments the local bin/ directory inside
// @sparticuz/chromium is not included in the build output, so we
// download the Chromium binary at runtime from GitHub Releases.
// The file is cached in /tmp between warm invocations.
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar'

let browserInstance: Browser | null = null

/**
 * Create a Chromium browser instance compatible with Vercel serverless.
 * Reuses existing instance if available (same warm function invocation).
 */
export async function createBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    console.log('[Browser] Reusing existing browser instance')
    return browserInstance
  }

  console.log('[Browser] Creating new Chromium instance, env:', process.env.NODE_ENV, 'vercel:', !!process.env.VERCEL)

  // Local development: use full puppeteer (bundles its own Chromium)
  if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
    console.log('[Browser] Dev mode: launching puppeteer...')
    const puppeteer = await import('puppeteer')
    browserInstance = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    console.log('[Browser] ✅ Puppeteer launched')
    return browserInstance
  }

  // Production / Vercel: download Chromium binary at runtime to /tmp.
  // setGraphicsMode=false disables WebGL/SwiftShader (not needed for PDF).
  // v143 has no setHeadlessMode — headless is always on.
  console.log('[Browser] Production mode: downloading Chromium from:', CHROMIUM_PACK_URL)
  chromium.setGraphicsMode = false

  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)
  console.log('[Browser] Chromium executable:', executablePath)

  browserInstance = await puppeteerCore.launch({
    args: chromium.args,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath,
    headless: true,
  })

  console.log('[Browser] ✅ Chromium launched successfully')
  return browserInstance
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

