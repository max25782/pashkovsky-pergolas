import chromium from '@sparticuz/chromium'
import puppeteerCore, { type Browser } from 'puppeteer-core'

// In Vercel monorepo deployments the local bin/ directory inside
// @sparticuz/chromium is not included in the build output, so we
// download the Chromium binary at runtime from GitHub Releases.
// Starting from v143, releases are split by arch: use .x64.tar for Vercel (x64 Linux).
// The file is cached in /tmp between warm invocations.
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar'

let browserInstance: Browser | null = null

/**
 * Create a Chromium browser instance compatible with Vercel serverless.
 * Reuses existing instance if available (same warm function invocation).
 */
export async function createBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }


  // Local development: use full puppeteer (bundles its own Chromium)
  if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
    const puppeteer = await import('puppeteer')
    browserInstance = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    return browserInstance
  }

  // Production / Vercel: download Chromium binary at runtime to /tmp.
  // setGraphicsMode=false disables WebGL/SwiftShader (not needed for PDF).
  // v143 has no setHeadlessMode — headless is always on.
  chromium.setGraphicsMode = false

  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)

  // headless: 'shell' tells Puppeteer v21+ to use chrome-headless-shell mode.
  // Passing headless: true would inject --headless=new which conflicts with
  // --headless='shell' already present in chromium.args.
  browserInstance = await puppeteerCore.launch({
    args: chromium.args,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath,
    headless: 'shell',
  })

  return browserInstance
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close()
    browserInstance = null
  }
}

