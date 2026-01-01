/**
 * Quick test to verify Gemini API key is working
 * Run: node test-gemini.js
 */

require('dotenv').config({ path: '.env.local' })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

console.log('=== Gemini API Test ===\n')

// Check if key exists
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in .env.local')
  console.log('\nPlease add this line to apps/crm/.env.local:')
  console.log('GEMINI_API_KEY=your-api-key-here')
  process.exit(1)
}

console.log('✓ GEMINI_API_KEY found:', GEMINI_API_KEY.substring(0, 20) + '...')
console.log('\nTesting API...')

// Test API call
async function testGemini() {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: 'שלום! רק בודק שהחיבור עובד. תגיד "עובד!" בעברית.' }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API Error:', response.status, error)
      process.exit(1)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
    
    console.log('\n✅ SUCCESS! API is working!')
    console.log('Response from Gemini:', text)
    console.log('\n✓ You can now use AI text improvement in your CRM!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

testGemini()

