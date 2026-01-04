/**
 * Company Logo Upload API
 * POST: Upload company logo to S3 and update database
 * Only accessible by company members with appropriate permissions
 */

import { NextRequest, NextResponse } from 'next/server'
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

    // Check if user has permission to edit company settings
    const canEdit = 
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.permissions?.settings === true

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

    // Upload to S3
    const s3 = new S3Client({
      region: process.env.AWS_S3_REGION || 'eu-north-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    const fileExtension = file.name.split('.').pop() || 'png'
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

    // Update logo_url in database
    const { data: company, error: updateError } = await supabase
      .from('companies')
      .update({ 
        logo_url: logoUrl
      })
      .eq('id', membership.company_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
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

