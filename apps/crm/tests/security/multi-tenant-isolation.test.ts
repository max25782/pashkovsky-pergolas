/**
 * Multi-Tenant Security Isolation Tests
 * 
 * Tests that users from Company A cannot access Company B's data
 * 
 * Usage:
 * 1. Set environment variables (see .env.test.example)
 * 2. Run: npm test -- multi-tenant-isolation.test.ts
 */

import { describe, test, expect, beforeAll } from '@jest/globals'

// Configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

// Test users (you need to create these in your test database)
const USER_A = {
  email: process.env.TEST_USER_A_EMAIL || 'userA@companyA.com',
  password: process.env.TEST_USER_A_PASSWORD || 'testpass123',
  companyId: process.env.TEST_COMPANY_A_ID || 'company-a-uuid',
}

const USER_B = {
  email: process.env.TEST_USER_B_EMAIL || 'userB@companyB.com',
  password: process.env.TEST_USER_B_PASSWORD || 'testpass123',
  companyId: process.env.TEST_COMPANY_B_ID || 'company-b-uuid',
}

// Test data IDs (you need to seed these)
const COMPANY_B_LEAD_ID = process.env.TEST_COMPANY_B_LEAD_ID || 'lead-b-uuid'
const COMPANY_B_DEAL_ID = process.env.TEST_COMPANY_B_DEAL_ID || 'deal-b-uuid'
const COMPANY_B_OFFER_ID = process.env.TEST_COMPANY_B_OFFER_ID || 'offer-b-uuid'
const COMPANY_B_WORKER_ID = process.env.TEST_COMPANY_B_WORKER_ID || 'worker-b-uuid'

interface AuthTokens {
  token: string
  companyId: string
}

/**
 * Login helper
 */
async function login(email: string, password: string): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Login failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  return {
    token: data.token,
    companyId: data.user?.companyId || USER_A.companyId,
  }
}

/**
 * Make authenticated request
 */
async function authenticatedRequest(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

describe('Multi-Tenant Security Isolation', () => {
  let userATokens: AuthTokens
  let userBTokens: AuthTokens

  beforeAll(async () => {
    
    try {
      userATokens = await login(USER_A.email, USER_A.password)
    } catch (error) {
      console.error('❌ User A login failed:', error)
      throw error
    }

    try {
      userBTokens = await login(USER_B.email, USER_B.password)
    } catch (error) {
      console.error('❌ User B login failed:', error)
      throw error
    }
  })

  describe('🔒 Cross-Company Data Access Prevention', () => {
    test('User A cannot GET lead from Company B', async () => {
      const response = await authenticatedRequest(
        `/admin-api/leads?limit=1000`,
        userATokens.token
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Check that Company B's lead is NOT in the results
      const hasCompanyBLead = data.data?.some((lead: any) => 
        lead.id === COMPANY_B_LEAD_ID
      )
      
      expect(hasCompanyBLead).toBe(false)
    })

    test('User A cannot GET deal from Company B', async () => {
      const response = await authenticatedRequest(
        `/admin-api/deals?limit=1000`,
        userATokens.token
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Check that Company B's deal is NOT in the results
      const hasCompanyBDeal = data.data?.some((deal: any) => 
        deal.id === COMPANY_B_DEAL_ID
      )
      
      expect(hasCompanyBDeal).toBe(false)
    })

    test('User A cannot GET offer from Company B by ID', async () => {
      const response = await authenticatedRequest(
        `/api/offers/${COMPANY_B_OFFER_ID}`,
        userATokens.token
      )

      // Should return 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status)
    })

    test('User A cannot GET worker from Company B', async () => {
      const response = await authenticatedRequest(
        `/api/workers?includeInactive=true`,
        userATokens.token
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // Check that Company B's worker is NOT in the results
      const hasCompanyBWorker = data.workers?.some((worker: any) => 
        worker.id === COMPANY_B_WORKER_ID
      )
      
      expect(hasCompanyBWorker).toBe(false)
    })
  })

  describe('🚫 Cross-Company Modifications Prevention', () => {
    test('User A cannot UPDATE deal from Company B', async () => {
      const response = await authenticatedRequest(
        `/admin-api/deals`,
        userATokens.token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            id: COMPANY_B_DEAL_ID,
            stage: 'won',
            notes: 'Malicious update attempt',
          }),
        }
      )

      // Should return 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status)
    })

    test('User A cannot DELETE offer from Company B', async () => {
      const response = await authenticatedRequest(
        `/api/offers/${COMPANY_B_OFFER_ID}`,
        userATokens.token,
        { method: 'DELETE' }
      )

      // Should return 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status)
    })

    test('User A cannot UPDATE worker from Company B', async () => {
      const response = await authenticatedRequest(
        `/api/workers/${COMPANY_B_WORKER_ID}`,
        userATokens.token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: 'Hacked',
            lastName: 'User',
          }),
        }
      )

      // Should return 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status)
    })

    test('User A cannot DELETE worker from Company B', async () => {
      const response = await authenticatedRequest(
        `/api/workers/${COMPANY_B_WORKER_ID}`,
        userATokens.token,
        { method: 'DELETE' }
      )

      // Should return 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status)
    })
  })

  describe('✅ Positive Tests (Own Company Access)', () => {
    test('User A CAN access their own company data', async () => {
      const response = await authenticatedRequest(
        `/admin-api/leads?limit=10`,
        userATokens.token
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // All returned leads should belong to Company A
      const allBelongToCompanyA = data.data?.every((lead: any) => 
        !lead.company_id || lead.company_id === userATokens.companyId
      )
      
      expect(allBelongToCompanyA).toBe(true)
    })

    test('User B CAN access their own company data', async () => {
      const response = await authenticatedRequest(
        `/admin-api/deals?limit=10`,
        userBTokens.token
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      
      // All returned deals should belong to Company B
      const allBelongToCompanyB = data.data?.every((deal: any) => 
        !deal.company_id || deal.company_id === userBTokens.companyId
      )
      
      expect(allBelongToCompanyB).toBe(true)
    })
  })

  describe('🔐 Authentication Tests', () => {
    test('Unauthenticated request should fail', async () => {
      const response = await fetch(`${API_BASE_URL}/admin-api/leads`)
      
      expect(response.status).toBe(401)
    })

    test('Invalid token should fail', async () => {
      const response = await authenticatedRequest(
        `/admin-api/leads`,
        'invalid-token-12345'
      )
      
      expect(response.status).toBe(401)
    })
  })
})

/**
 * Test runner (if not using Jest)
 */
if (require.main === module) {
  
  // Simple test runner
  ;(async () => {
    try {
      const userATokens = await login(USER_A.email, USER_A.password)

      // Test 1: Try to get Company B lead
      const response = await authenticatedRequest(
        `/admin-api/leads?limit=1000`,
        userATokens.token
      )
      const data = await response.json()
      const hasCompanyBLead = data.data?.some((l: any) => l.id === COMPANY_B_LEAD_ID)
      
      if (hasCompanyBLead) {
        console.error('❌ SECURITY VIOLATION: User A can see Company B lead!')
        process.exit(1)
      } else {
      }

      // Test 2: Try to delete Company B offer
      const deleteResponse = await authenticatedRequest(
        `/api/offers/${COMPANY_B_OFFER_ID}`,
        userATokens.token,
        { method: 'DELETE' }
      )

      if (deleteResponse.status === 200) {
        console.error('❌ SECURITY VIOLATION: User A can delete Company B offer!')
        process.exit(1)
      } else {
      }

      process.exit(0)
    } catch (error) {
      console.error('❌ Test failed:', error)
      process.exit(1)
    }
  })()
}

