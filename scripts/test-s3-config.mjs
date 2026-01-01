/**
 * Test script to check S3 configuration
 * Run: node -r dotenv/config scripts/test-s3-config.mjs
 */

console.log('🔍 Checking S3 configuration...\n')

// Check server-side variables
const serverBucket = process.env.AWS_S3_BUCKET_NAME
const serverRegion = process.env.AWS_S3_REGION
const serverAccessKey = process.env.AWS_ACCESS_KEY_ID

console.log('Server-side variables:')
console.log(`  AWS_S3_BUCKET_NAME: ${serverBucket ? '✅ ' + serverBucket : '❌ not set'}`)
console.log(`  AWS_S3_REGION: ${serverRegion ? '✅ ' + serverRegion : '❌ not set'}`)
console.log(`  AWS_ACCESS_KEY_ID: ${serverAccessKey ? '✅ set' : '❌ not set'}`)

// Check client-side variables
const clientBucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const clientRegion = process.env.NEXT_PUBLIC_AWS_S3_REGION

console.log('\nClient-side variables (NEXT_PUBLIC_):')
console.log(`  NEXT_PUBLIC_AWS_S3_BUCKET_NAME: ${clientBucket ? '✅ ' + clientBucket : '❌ not set'}`)
console.log(`  NEXT_PUBLIC_AWS_S3_REGION: ${clientRegion ? '✅ ' + clientRegion : '❌ not set'}`)

console.log('\n' + '='.repeat(50))
if (clientBucket && clientRegion) {
  console.log('✅ Client-side S3 is configured!')
  console.log(`   Base URL: https://${clientBucket}.s3.${clientRegion}.amazonaws.com`)
  console.log('\n   Example image URL:')
  console.log(`   https://${clientBucket}.s3.${clientRegion}.amazonaws.com/images/pergulot/ashdod/IMG_20230824_155546.webp`)
} else {
  console.log('❌ Client-side S3 is NOT configured!')
  console.log('   Add to .env.local:')
  console.log('   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery')
  console.log('   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1')
}
console.log('='.repeat(50))





