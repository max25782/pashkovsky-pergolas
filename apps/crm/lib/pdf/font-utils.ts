import fs from 'fs'
import path from 'path'

/**
 * Convert a font file to base64 data URI for embedding in HTML
 * @param fontPath - Path to the font file relative to project root
 * @returns data:font/ttf;base64,... string
 */
export function getFontDataUri(fontPath: string): string {
  try {
    const fullPath = path.join(process.cwd(), fontPath)
    
    console.log(`[Font] Attempting to load font: ${fullPath}`)
    
    if (!fs.existsSync(fullPath)) {
      console.error(`[Font] ❌ Font file not found: ${fullPath}`)
      return ''
    }

    const fontBuffer = fs.readFileSync(fullPath)
    const base64Font = fontBuffer.toString('base64')
    const base64Length = base64Font.length
    
    console.log(`[Font] ✅ Font loaded successfully: ${fontPath} (${base64Length} chars base64)`)
    
    return `data:font/ttf;charset=utf-8;base64,${base64Font}`
  } catch (error) {
    console.error(`[Font] ❌ Error reading font ${fontPath}:`, error)
    return ''
  }
}

/**
 * Get CSS @font-face declarations with embedded fonts
 * @returns CSS string with @font-face rules
 */
export function getEmbeddedFontsCss(): string {
  // Use existing Noto Sans Hebrew fonts from app/fronts/
  const regularFontUri = getFontDataUri('app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Regular.ttf')
  const boldFontUri = getFontDataUri('app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Bold.ttf')

  if (!regularFontUri && !boldFontUri) {
    console.error('[Font] ❌ No fonts loaded! PDF will use fallback fonts.')
    return `
      * {
        font-family: 'Arial', 'Helvetica', sans-serif !important;
      }
      body {
        font-family: 'Arial', 'Helvetica', sans-serif !important;
      }
    `
  }

  console.log(`[Font] ✅ Fonts embedded successfully (Regular: ${!!regularFontUri}, Bold: ${!!boldFontUri})`)

  let css = ''

  if (regularFontUri) {
    css += `
      @font-face {
        font-family: 'HebrewFont';
        font-style: normal;
        font-weight: 400;
        font-weight: normal;
        src: url('${regularFontUri}') format('truetype');
        unicode-range: U+0590-05FF, U+FB1D-FB4F;
      }
    `
  }

  if (boldFontUri) {
    css += `
      @font-face {
        font-family: 'HebrewFont';
        font-style: normal;
        font-weight: 700;
        font-weight: bold;
        src: url('${boldFontUri}') format('truetype');
        unicode-range: U+0590-05FF, U+FB1D-FB4F;
      }
    `
  }

  css += `
    * {
      font-family: 'HebrewFont', 'Noto Sans Hebrew', 'Arial', sans-serif !important;
    }
    body {
      font-family: 'HebrewFont', 'Noto Sans Hebrew', 'Arial', sans-serif !important;
    }
  `

  return css
}

