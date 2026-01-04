/**
 * Debug endpoint to test companies table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const tests = []

  // Test 1: Get schema
  const { data: sample, error: sampleError } = await supabaseAdmin
    .from('companies')
    .select('*')
    .limit(1)

  tests.push({
    name: 'Get sample company',
    success: !sampleError,
    error: sampleError?.message,
    columns: sample?.[0] ? Object.keys(sample[0]) : [],
  })

  // Test 2: Try insert with all fields
  const testSlug = `test-${Date.now()}`
  const { data: fullInsert, error: fullError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: 'TestCompany',
      slug: testSlug,
      status: 'active',
      plan: 'enterprise',
      primary_email: 'test@example.com',
    })
    .select()

  tests.push({
    name: 'Insert with all fields',
    success: !fullError,
    error: fullError?.message,
    errorCode: fullError?.code,
    errorDetails: fullError?.details,
    errorHint: fullError?.hint,
    data: fullInsert,
  })

  // Clean up test data
  if (fullInsert?.[0]?.id) {
    await supabaseAdmin.from('companies').delete().eq('id', fullInsert[0].id)
  }

  // Test 3: Try minimal insert
  const testSlug2 = `test-minimal-${Date.now()}`
  const { data: minInsert, error: minError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: 'TestMinimal',
      slug: testSlug2,
    })
    .select()

  tests.push({
    name: 'Insert minimal (name + slug)',
    success: !minError,
    error: minError?.message,
    data: minInsert,
  })

  // Clean up
  if (minInsert?.[0]?.id) {
    await supabaseAdmin.from('companies').delete().eq('id', minInsert[0].id)
  }

  return NextResponse.json({
    tests,
    supabase_url: SUPABASE_URL,
    has_service_key: !!SERVICE_KEY,
  })
}

