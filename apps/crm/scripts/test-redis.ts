/**
 * Test Redis Connection
 * Run: npx tsx scripts/test-redis.ts
 */

import { config } from 'dotenv'
import { Redis } from '@upstash/redis'

// Load .env.local
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n')

  try {
    // Check credentials
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('❌ Missing Redis credentials in .env.local')
      console.error('\nAdd these to apps/crm/.env.local:')
      console.error('  UPSTASH_REDIS_REST_URL=https://...')
      console.error('  UPSTASH_REDIS_REST_TOKEN=...\n')
      process.exit(1)
    }

    // Test write
    console.log('1. Testing WRITE...')
    await redis.set('test:connection', 'Hello from CRM!', { ex: 10 })
    console.log('   ✅ Write successful')

    // Test read
    console.log('2. Testing READ...')
    const value = await redis.get('test:connection')
    console.log('   ✅ Read successful:', value)

    // Test delete
    console.log('3. Testing DELETE...')
    await redis.del('test:connection')
    console.log('   ✅ Delete successful')

    // Test TTL
    console.log('4. Testing TTL (expiration)...')
    await redis.set('test:ttl', 'expires soon', { ex: 5 })
    const ttl = await redis.ttl('test:ttl')
    console.log('   ✅ TTL set:', ttl, 'seconds')
    await redis.del('test:ttl')

    console.log('\n🎉 All tests passed! Redis is working correctly.\n')
  } catch (error) {
    console.error('\n❌ Redis test failed:', error)
    console.error('\nTroubleshooting:')
    console.error('1. Check credentials in .env.local')
    console.error('2. Verify URL starts with https://')
    console.error('3. Ensure token is correct (no default: prefix)')
    console.error('4. Check Upstash dashboard for database status\n')
    process.exit(1)
  }
}

testRedis()

