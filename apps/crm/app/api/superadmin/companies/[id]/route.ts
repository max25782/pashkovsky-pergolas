/**
 * SuperAdmin API: Delete Company
 * Only accessible with valid SuperAdmin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 🔒 Require SuperAdmin authentication
    const adminSession = await requireSuperAdmin(request)

    const params = await context.params
    const companyId = params.id

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Use SERVICE_ROLE_KEY for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )


    // First, check if company exists (don't use .single() to avoid coercion error)
    const { data: companies, error: checkError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .limit(1)


    if (checkError) {
      console.error('[SuperAdmin] Error checking company:', checkError)
      return NextResponse.json(
        { error: 'Failed to check company', details: checkError.message },
        { status: 500 }
      )
    }

    if (!companies || companies.length === 0) {
      console.error('[SuperAdmin] Company not found:', companyId)
      
      // Try to list all companies to debug
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('id, name')
        .limit(10)
      
      
      return NextResponse.json(
        { error: 'Company not found', companyId, availableCompanies: allCompanies?.length || 0 },
        { status: 404 }
      )
    }

    const company = companies[0]

    // Delete related records first (if cascade doesn't work)
    // Order matters: delete child records before parent
    
    // 1. Delete subscription history
    await supabase
      .from('subscription_history')
      .delete()
      .eq('company_id', companyId)
    
    // 2. Delete company subscriptions
    await supabase
      .from('company_subscriptions')
      .delete()
      .eq('company_id', companyId)
    
    // 3. Delete company members (this will also remove user-company relationships)
    await supabase
      .from('company_members')
      .delete()
      .eq('company_id', companyId)
    
    // 4. Delete deals (if exists)
    await supabase
      .from('deals')
      .delete()
      .eq('company_id', companyId)
    
    // 5. Delete workers (if exists)
    await supabase
      .from('workers')
      .delete()
      .eq('company_id', companyId)
    
    // 6. Delete company integrations (if exists)
    await supabase
      .from('company_integrations')
      .delete()
      .eq('company_id', companyId)
    
    // 7. Finally, delete the company itself
    const { error: deleteError, data: deleteData } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)
      .select()

    if (deleteError) {
      console.error('[SuperAdmin] Delete error:', deleteError)
      console.error('[SuperAdmin] Delete error code:', deleteError.code)
      console.error('[SuperAdmin] Delete error details:', deleteError.details)
      
      // Check for foreign key constraint violations
      if (deleteError.code === '23503' || deleteError.message?.includes('foreign key')) {
        return NextResponse.json(
          { 
            error: 'Cannot delete company: Related records exist. Please delete related data first.',
            details: deleteError.message 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to delete company', details: deleteError.message },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
    })
  } catch (error: unknown) {
    console.error('[SuperAdmin] Delete company error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    // Check if it's an auth error
    if (msg?.includes('Unauthorized') || msg?.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Unauthorized: SuperAdmin access required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: msg || 'Internal server error' },
      { status: 500 }
    )
  }
}

