/**
 * AI Offer Text Improvement API
 * Улучшает текстовые описания в офферах, сохраняя все цифры
 * 
 * POST /api/ai/improve-offer-text
 * Body: { text: string, context?: { customerName?: string, pergolaType?: string, price?: number } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

const OFFER_IMPROVEMENT_PROMPT = `אתה עוזר לשיפור טקסטים בהצעות מחיר לפרגולות אלומיניום.

חוקים חשובים:
1. **אסור לחלוטין לשנות מספרים, מחירים, מידות או כמויות**
2. שפר רק את הסגנון, הבהירות והמקצועיות של הטקסט
3. שמור על השפה העברית וצורת הפנייה המקורית
4. הוסף פרטים טכניים רלוונטיים אם חסרים
5. שפר את המבנה והקריאות
6. הדגש יתרונות ואיכות המוצר
7. אם הטקסט קצר מדי, הרחב אותו בצורה מקצועית
8. אם הטקסט כבר טוב, החזר אותו כמעט ללא שינוי

דוגמאות:

לפני: "פרגולה בצבע שחור"
אחרי: "פרגולה מאלומיניום איכותית בצבע שחור (RAL 9005), עמידה בפני קורוזיה ותנאי מזג אוויר קשים"

לפני: "זכוכית בצד"
אחרי: "סגירת זכוכית מחוסמת בצד הדרומי, מבטיחה הגנה מירבית מפני רוח וגשם תוך שמירה על שקיפות ותאורה טבעית"

לפני: "התקנה כוללת"
אחרי: "ההצעה כוללת התקנה מקצועית על ידי צוות מנוסה, כולל כל החומרים והאביזרים הנדרשים"

החזר רק את הטקסט המשופר, ללא הסברים או הערות.`

interface ImproveTextRequest {
  text: string
  context?: {
    customerName?: string
    pergolaType?: string
    price?: number
  }
}

async function improveTextWithGemini(text: string, context?: ImproveTextRequest['context']): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured')
  }
  
  // Build context string
  let contextStr = ''
  if (context) {
    if (context.customerName) contextStr += `לקוח: ${context.customerName}\n`
    if (context.pergolaType) contextStr += `סוג פרגולה: ${context.pergolaType}\n`
    if (context.price) contextStr += `מחיר: ${context.price} ₪\n`
  }
  
  const userMessage = contextStr 
    ? `${contextStr}\n\nטקסט לשיפור:\n${text}`
    : `טקסט לשיפור:\n${text}`
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: OFFER_IMPROVEMENT_PROMPT }],
        },
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Offer AI] Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const data = await response.json()
  const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text || text
  
  return improvedText.trim()
}

// Authentication helper
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get('authorization')
  const adminToken = request.headers.get('x-admin-token')
  
  
  // If JWT token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    if (!supabase) {
      console.error('[AI Auth] Supabase client not available')
      return null
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error) {
      console.error('[AI Auth] getUser error:', error.message)
      return null
    }
    if (!user) {
      console.error('[AI Auth] No user found')
      return null
    }
    
    
    // Get company from company_members
    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    
    if (memberError) {
      console.error('[AI Auth] company_members query error:', memberError.message)
    }
    
    if (!member) {
      console.error('[AI Auth] User not in any company')
      return null
    }
    
    return { userId: user.id, companyId: member.company_id }
  }
  
  // If admin token (legacy, but accepted)
  if (adminToken) {
    // For admin tokens, use default company
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
    if (!defaultCompanyId) return null
    
    return { userId: 'admin', companyId: defaultCompanyId }
  }
  
  console.error('[AI Auth] No auth method found')
  return null
}

export async function POST(request: NextRequest) {
  try {
    
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 2. Parse request
    const body: ImproveTextRequest = await request.json()
    const { text, context } = body
    
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Text too long (max 2000 characters)' }, { status: 400 })
    }
    
    // 3. Check API key
    if (!GEMINI_API_KEY) {
      console.error('[AI Improve] GEMINI_API_KEY not configured!')
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
    }
    
    
    // 4. Improve text with AI
    const improvedText = await improveTextWithGemini(text, context)
    
    // 5. Log the improvement (optional, for analytics)
    if (supabase) {
      try {
        await supabase.from('ai_text_improvements').insert({
          company_id: auth.companyId,
          user_id: auth.userId,
          original_text: text,
          improved_text: improvedText,
          context,
        })
      } catch (err: unknown) {
        // Ignore if table doesn't exist
        console.warn('[Offer AI] Failed to log improvement:', err instanceof Error ? err.message : String(err))
      }
    }
    
    return NextResponse.json({
      originalText: text,
      improvedText,
      improvements: {
        lengthBefore: text.length,
        lengthAfter: improvedText.length,
        improved: text !== improvedText,
      },
    })
  } catch (error: unknown) {
    console.error('[Offer AI] Error:', error)
    return NextResponse.json(
      { error: 'Failed to improve text', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check service status
export async function GET() {
  return NextResponse.json({
    service: 'AI Offer Text Improvement',
    status: GEMINI_API_KEY ? 'available' : 'unavailable',
    model: 'gemini-2.0-flash',
  })
}

