import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, generateOfferEmailHTML } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { email, offerUrl, customerName } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Generate offer URL if not provided (use Hebrew as default locale for public links)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000'
    
    const defaultLocale = 'he' // Default locale for public offer links
    const finalOfferUrl = offerUrl || `${baseUrl}/${defaultLocale}/offers/${params.id}/approve`

    // Fetch offer to get AI text
    let aiText: string | null = null
    if (supabase) {
      const { data: offerData } = await supabase
        .from('offers')
        .select('options_notes, final_price')
        .eq('id', params.id)
        .single()
      
      if (offerData?.options_notes) {
        aiText = offerData.options_notes
      }
    }

    // Generate HTML email with AI text
    const html = generateOfferEmailHTML(finalOfferUrl, customerName || 'לקוח יקר', aiText)

    // Send email
    await sendEmail({
      to: email,
      subject: 'הצעת מחיר - Pashkovsky Group',
      html,
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    
    // Check if it's an email configuration error
    if (error.message.includes('Email configuration is missing')) {
      return NextResponse.json(
        { 
          error: 'Email not configured',
          details: 'Please configure EMAIL_USER and EMAIL_PASS in environment variables'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
