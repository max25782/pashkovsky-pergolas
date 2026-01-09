import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface UpdateCompanyRequest {
  name?: string
  primary_email?: string
  status?: 'trial' | 'active' | 'suspended' | 'cancelled'
  plan?: string
}

/**
 * GET /api/superadmin/companies/[id]/settings
 * Get company settings
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request)
    const params = await context.params
    const companyId = params.id

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (error || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/companies/[id]/settings
 * Update company settings
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireSuperAdmin(request)
    const params = await context.params
    const companyId = params.id

    const body: UpdateCompanyRequest = await request.json()

    // Validate status if provided
    if (body.status && !['trial', 'active', 'suspended', 'cancelled'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: trial, active, suspended, or cancelled' },
        { status: 400 }
      )
    }

    // Validate email format if provided
    if (body.primary_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.primary_email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Update company
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.primary_email !== undefined) updateData.primary_email = body.primary_email
    if (body.status !== undefined) updateData.status = body.status
    if (body.plan !== undefined) updateData.plan = body.plan

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .update(updateData)
      .eq('id', companyId)
      .select()
      .single()

    if (error) {
      console.error('[Update Company Settings] Error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update company' },
        { status: 500 }
      )
    }

    console.log('[Update Company Settings] Updated by:', adminSession.email, 'Company:', companyId)

    return NextResponse.json({
      success: true,
      company,
    })
  } catch (error: any) {
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('[Update Company Settings] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

