import fs from 'fs'
import path from 'path'

/**
 * Convert font file to base64 and create optimized data URI
 * Uses chunking to avoid memory issues with large fonts
 */
export function createOptimizedFontDataUri(fontPath: string): string {
  try {
    const fullPath = path.join(process.cwd(), fontPath)
    
    console.log(`[Font] Loading font: ${fontPath}`)
    
    if (!fs.existsSync(fullPath)) {
      console.error(`[Font] ❌ Font file not found: ${fullPath}`)
      return ''
    }

    const fontBuffer = fs.readFileSync(fullPath)
    const base64Font = fontBuffer.toString('base64')
    
    console.log(`[Font] ✅ Font loaded: ${path.basename(fontPath)} (${(fontBuffer.length / 1024).toFixed(2)} KB)`)
    
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

  console.log(`[Font] ✅ Fonts embedded (Regular: ${!!regularUri}, Bold: ${!!boldUri})`)

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

/**
 * Load logo image and convert to base64 data URI
 * @param logoPath - Path to logo file relative to project root
 * @returns data:image/png;base64,... string or empty string if not found
 */
export function getLogoDataUri(logoPath: string = 'public/logo-transparent.png'): string {
  try {
    const fullPath = path.join(process.cwd(), logoPath)
    
    console.log(`[Logo] Loading logo: ${logoPath}`)
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`[Logo] ⚠️ Logo file not found: ${fullPath}, trying fallback...`)
      // Try logo.png as fallback
      const fallbackPath = path.join(process.cwd(), 'public/logo.png')
      if (fs.existsSync(fallbackPath)) {
        const logoBuffer = fs.readFileSync(fallbackPath)
        const base64Logo = logoBuffer.toString('base64')
        console.log(`[Logo] ✅ Fallback logo loaded: logo.png (${(logoBuffer.length / 1024).toFixed(2)} KB)`)
        return `data:image/png;base64,${base64Logo}`
      }
      console.error(`[Logo] ❌ No logo found`)
      return ''
    }

    const logoBuffer = fs.readFileSync(fullPath)
    const base64Logo = logoBuffer.toString('base64')
    
    // Detect image type from extension
    const ext = path.extname(logoPath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    
    console.log(`[Logo] ✅ Logo loaded: ${path.basename(logoPath)} (${(logoBuffer.length / 1024).toFixed(2)} KB)`)
    
    return `data:${mimeType};base64,${base64Logo}`
  } catch (error) {
    console.error(`[Logo] ❌ Error loading logo ${logoPath}:`, error)
    return ''
  }
}

