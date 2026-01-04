import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify AI Director API token
 * Used by Data API endpoints to authenticate Bedrock Agent requests
 */
export function verifyAIDirectorToken(req: NextRequest): boolean {
  const expectedToken = process.env.AI_DIRECTOR_API_TOKEN
  
  if (!expectedToken) {
    console.error('[AI Director] AI_DIRECTOR_API_TOKEN not configured')
    return false
  }
  
  const headerToken =
    // Preferred (matches our OpenAPI + Lambda proxy docs)
    req.headers.get('x-api-token') ||
    // Backward-compat: older header name
    req.headers.get('x-ai-director-token') ||
    // Optional: allow standard Authorization header for proxies
    (() => {
      const auth = req.headers.get('authorization')
      if (!auth) return null
      const match = auth.match(/^Bearer\s+(.+)$/i)
      return match?.[1] || null
    })()

  const isValid = !!headerToken && headerToken === expectedToken

  if (!isValid) {
    const tokenPreview = headerToken ? `***${headerToken.slice(-4)}` : 'MISSING'
    const expectedPreview = `***${expectedToken.slice(-4)}`
    console.warn('[AI Director] Invalid token for AI Director request:', {
      hasXApiToken: !!req.headers.get('x-api-token'),
      hasXAIDirectorToken: !!req.headers.get('x-ai-director-token'),
      hasAuthorization: !!req.headers.get('authorization'),
      token: tokenPreview,
      expected: expectedPreview,
    })
  }

  return isValid
}

/**
 * Require AI Director authentication
 * Returns error response if authentication fails, null otherwise
 */
export function requireAIDirectorAuth(req: NextRequest): NextResponse | null {
  if (!verifyAIDirectorToken(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid AI Director token' },
      { status: 401 }
    )
  }
  return null
}

