import { NextResponse } from 'next/server'

/**
 * Debug endpoint to check S3 configuration
 * GET /api/debug/s3-config
 */
export async function GET() {
  const config = {
    // Environment variables check
    env: {
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || null,
      AWS_S3_REGION: process.env.AWS_S3_REGION || null,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID 
        ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...${process.env.AWS_ACCESS_KEY_ID.substring(process.env.AWS_ACCESS_KEY_ID.length - 4)}`
        : null,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '***SET***' : null,
      // Also check NEXT_PUBLIC variants
      NEXT_PUBLIC_AWS_S3_BUCKET_NAME: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || null,
      NEXT_PUBLIC_AWS_S3_REGION: process.env.NEXT_PUBLIC_AWS_S3_REGION || null,
    },
    // Computed values
    computed: {
      bucket: process.env.AWS_S3_BUCKET_NAME || 'NOT SET',
      region: process.env.AWS_S3_REGION || 'us-east-1 (default)',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      isConfigured: !!(
        process.env.AWS_S3_BUCKET_NAME &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY
      ),
    },
    // Expected values (from AWS IAM screenshot)
    expected: {
      accessKeyId: 'AKIA4PFZSZFMCYNRASVZ',
      region: 'us-east-1', // From IAM console screenshot
      bucket: 'pashkovsky-gallery', // Common bucket name
    },
    // Recommendations
    recommendations: [] as string[],
  }

  // Add recommendations
  if (!config.computed.hasAccessKey) {
    config.recommendations.push('Set AWS_ACCESS_KEY_ID in environment variables')
  }
  if (!config.computed.hasSecretKey) {
    config.recommendations.push('Set AWS_SECRET_ACCESS_KEY in environment variables')
  }
  if (!config.env.AWS_S3_BUCKET_NAME) {
    config.recommendations.push('Set AWS_S3_BUCKET_NAME in environment variables')
  }
  if (!config.env.AWS_S3_REGION) {
    config.recommendations.push('Set AWS_S3_REGION (defaults to us-east-1)')
  }

  // Check if Access Key matches expected
  if (config.env.AWS_ACCESS_KEY_ID && config.env.AWS_ACCESS_KEY_ID.includes('AAKIA')) {
    config.recommendations.push(
      '⚠️ Access Key ID starts with "AAKIA" - should start with "AKIA" (single A). Check for typo.'
    )
  }

  // Check region mismatch
  if (config.env.AWS_S3_REGION && config.env.AWS_S3_REGION !== config.expected.region) {
    config.recommendations.push(
      `Region mismatch: Using "${config.env.AWS_S3_REGION}" but IAM user is in "${config.expected.region}". ` +
      'Ensure bucket exists in the same region as configured.'
    )
  }

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

