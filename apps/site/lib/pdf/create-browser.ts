import chromium from '@sparticuz/chromium'
import puppeteerCore, { type Browser } from 'puppeteer-core'

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar'

let browserInstance: Browser | null = null

export async function createBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }

  if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
    const puppeteer = await import('puppeteer')
    browserInstance = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    return browserInstance
  }

  chromium.setGraphicsMode = false
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)
  browserInstance = await puppeteerCore.launch({
    args: chromium.args,
    defaultViewport: { width: 1200, height: 1600 },
    executablePath,
    headless: 'shell',
  })
  return browserInstance
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close()
    browserInstance = null
  }
}
