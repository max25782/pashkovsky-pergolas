/**
 * Public Payment Instructions API
 * GET /api/public/payment-instructions
 */

import { NextRequest, NextResponse } from 'next/server'
import type { PaymentInstructions } from '@/types/integration'

export const dynamic = 'force-dynamic'

/**
 * GET - Fetch payment instructions for integrations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    // Currently only 'integration' type supported
    if (type !== 'integration') {
      return NextResponse.json(
        { error: 'Invalid type parameter. Use type=integration' },
        { status: 400 }
      )
    }

    const instructions: PaymentInstructions = {
      bit_phone: process.env.PAYMENT_BIT_PHONE || '',
      paybox_link: process.env.PAYMENT_PAYBOX_LINK || '',
      paypal_link: process.env.PAYMENT_PAYPAL_LINK || '',
      bank_details: {
        bank_name: process.env.PAYMENT_BANK_NAME || '',
        account_number: process.env.PAYMENT_BANK_ACCOUNT || '',
        branch: process.env.PAYMENT_BANK_BRANCH || '',
      },
      payment_note_template:
        process.env.PAYMENT_NOTE_TEMPLATE ||
        'Write your company name in the transfer note',
    }

    return NextResponse.json(instructions)
  } catch (error) {
    console.error('[Payment Instructions] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




