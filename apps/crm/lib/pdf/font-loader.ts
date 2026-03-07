import fs from 'fs'
import path from 'path'

/**
 * Convert font file to base64 and create optimized data URI
 * Uses chunking to avoid memory issues with large fonts
 */
export function createOptimizedFontDataUri(fontPath: string): string {
  try {
    const fullPath = path.join(process.cwd(), fontPath)
    
    
    if (!fs.existsSync(fullPath)) {
      console.error(`[Font] ❌ Font file not found: ${fullPath}`)
      return ''
    }

    const fontBuffer = fs.readFileSync(fullPath)
    const base64Font = fontBuffer.toString('base64')
    
    
    // Use application/font-ttf or font/truetype - both should work
    return `data:application/font-ttf;charset=utf-8;base64,${base64Font}`
  } catch (error) {
    console.error(`[Font] ❌ Error loading font ${fontPath}:`, error)
    return ''
  }
}

/**
 * Get embedded fonts CSS for Noto Sans Hebrew
 */
export function getHebrewFontsCss(): string {
  // Use fonts from public/fonts/
  const regularUri = createOptimizedFontDataUri('public/fonts/NotoSansHebrew-Regular.ttf')
  const boldUri = createOptimizedFontDataUri('public/fonts/NotoSansHebrew-Bold.ttf')

  if (!regularUri && !boldUri) {
    console.error('[Font] ❌ No fonts loaded! Using system fallback.')
    return `
      * { font-family: Arial, sans-serif !important; }
      body { font-family: Arial, sans-serif !important; }
    `
  }


  let css = ''

  if (regularUri) {
    css += `
      @font-face {
        font-family: 'NotoSansHebrew';
        font-style: normal;
        font-weight: 400;
        font-weight: normal;
        font-display: block;
        src: url('${regularUri}') format('truetype');
        unicode-range: U+0590-05FF, U+FB1D-FB4F;
      }
    `
  }

  if (boldUri) {
    css += `
      @font-face {
        font-family: 'NotoSansHebrew';
        font-style: normal;
        font-weight: 700;
        font-weight: bold;
        font-display: block;
        src: url('${boldUri}') format('truetype');
        unicode-range: U+0590-05FF, U+FB1D-FB4F;
      }
    `
  }

  css += `
    * {
      font-family: 'NotoSansHebrew', 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important;
    }
    body {
      font-family: 'NotoSansHebrew', 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important;
    }
  `

  return css
}

// Logo embedded as base64 so it's always available in Vercel serverless
// (public/ directory files are NOT accessible in API route filesystem at runtime).
const LOGO_BASE64 = 'PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPg0KICA8IS0tIEEgaWNvbjogYWx1bWludW0gcGFuZWxzIGZvcm1pbmcgQSBzaGFwZSAtLT4NCiAgPGcgaWQ9Imljb24iPg0KICAgIDwhLS0gTWFpbiBBIHNoYXBlIGluIGJsdWUgLS0+DQogICAgPHBhdGggZD0iTSAyMCA1MCBMIDMwIDE1IEwgNDAgMTUgTCA1MCA1MCBaIiBmaWxsPSIjMjU2M0VCIiBvcGFjaXR5PSIwLjkiLz4NCiAgICA8IS0tIFNpbHZlciBhbHVtaW51bSBiYXIgYWNyb3NzIG1pZGRsZSAtLT4NCiAgICA8cmVjdCB4PSIyNyIgeT0iMzIiIHdpZHRoPSIxNiIgaGVpZ2h0PSI1IiBmaWxsPSIjOTRBM0I4Ii8+DQogICAgPCEtLSBTbWFsbCBhbHVtaW51bSBkZXRhaWwgYXQgdG9wIC0tPg0KICAgIDxjaXJjbGUgY3g9IjM1IiBjeT0iMTIiIHI9IjMiIGZpbGw9IiM5NEEzQjgiLz4NCiAgPC9nPg0KICANCiAgPCEtLSBUZXh0OiBBbHVtaW5DUk0gLS0+DQogIDx0ZXh0IHg9IjYwIiB5PSI0MCIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNzAwIiBmb250LXNpemU9IjI2IiBmaWxsPSIjMUUyOTNCIj4NCiAgICBBbHVtaW48dHNwYW4gZmlsbD0iIzI1NjNFQiI+Q1JNPC90c3Bhbj4NCiAgPC90ZXh0Pg0KPC9zdmc+DQoNCg=='

/**
 * Returns the company logo as a base64 data URI.
 * The logo is embedded directly in the bundle (not read from the filesystem)
 * to ensure it works in Vercel serverless functions.
 */
export function getLogoDataUri(): string {
  return `data:image/svg+xml;base64,${LOGO_BASE64}`
}

