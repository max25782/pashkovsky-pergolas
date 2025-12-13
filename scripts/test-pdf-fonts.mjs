/**
 * Test script to verify font loading and HTML generation
 * Run: node --loader ts-node/esm scripts/test-pdf-fonts.mjs
 */

import { getFontDataUri, getEmbeddedFontsCss } from '../lib/pdf/font-utils.js'

console.log('🔍 Testing PDF Font Loading...\n')

// Test font loading
console.log('1️⃣ Testing Regular font:')
const regularUri = getFontDataUri('app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Regular.ttf')
console.log('   Result:', regularUri ? `✅ Loaded (${regularUri.length} chars)` : '❌ Failed\n')

console.log('\n2️⃣ Testing Bold font:')
const boldUri = getFontDataUri('app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Bold.ttf')
console.log('   Result:', boldUri ? `✅ Loaded (${boldUri.length} chars)` : '❌ Failed\n')

console.log('\n3️⃣ Testing CSS generation:')
const css = getEmbeddedFontsCss()
console.log('   CSS length:', css.length, 'chars')
console.log('   Contains @font-face:', css.includes('@font-face') ? '✅ Yes' : '❌ No')
console.log('   Contains HebrewFont:', css.includes('HebrewFont') ? '✅ Yes' : '❌ No')

console.log('\n✨ Font loading test complete!')

if (regularUri && boldUri) {
  console.log('\n✅ All fonts loaded successfully! PDF generation should work.')
} else {
  console.log('\n❌ Font loading failed. Check paths:')
  console.log('   - app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Regular.ttf')
  console.log('   - app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Bold.ttf')
}


