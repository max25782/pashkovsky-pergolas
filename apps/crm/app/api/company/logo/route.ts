/**
 * Company Logo Upload API
 * POST: Upload company logo to S3 and update database
 * Only accessible by company members with appropriate permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { CompanyMember } from '@/types/membership'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company membership and check permissions
    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id, role, permissions')
      .eq('user_id', user.id)
      .single<Pick<CompanyMember, 'company_id' | 'role' | 'permissions'>>()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    // Only owner/admin of the session user's own company may change the logo.
    // company_id comes from the verified session membership, never from the request.
    const canEdit = membership.role === 'owner' || membership.role === 'admin'

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      )
    }

    // Get file from FormData
    const formData = await request.formData()
    const file = formData.get('logo') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    // Check if S3 is configured
    if (!process.env.AWS_S3_BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID) {
      return NextResponse.json(
        { error: 'S3 not configured' },
        { status: 500 }
      )
    }

    // Service-role client for the DB write; fail before uploading anything.
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[Company Logo Upload] Service role not configured')
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Upload to S3
    const s3 = new S3Client({
      region: process.env.AWS_S3_REGION || 'eu-north-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    // The extension is client-controlled: accept only a short alphanumeric one so the
    // S3 key can never contain path separators or traversal segments.
    const rawExtension = (file.name.split('.').pop() ?? '').toLowerCase()
    const fileExtension = /^[a-z0-9]{1,5}$/.test(rawExtension) ? rawExtension : 'png'
    const key = `companies/${membership.company_id}/logo.${fileExtension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000', // 1 year
    }))

    const logoUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || 'eu-north-1'}.amazonaws.com/${key}`

    // Update logo_url with the service role: `companies` has no UPDATE policy for
    // the user-scoped client. Authorization was established above (owner/admin of
    // this exact company), so the write is pinned to membership.company_id.
    const { data: company, error: updateError } = await adminClient
      .from('companies')
      .update({ logo_url: logoUrl })
      .eq('id', membership.company_id)
      .select()
      .single()

    if (updateError) {
      console.error('[Company Logo Upload] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to save logo' }, { status: 500 })
    }

    return NextResponse.json({ 
      logo_url: logoUrl,
      company
    })
  } catch (error) {
    console.error('[Company Logo Upload] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

