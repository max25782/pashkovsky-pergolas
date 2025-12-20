/**
 * JWT Token Utilities
 * Handles creation and verification of JWT tokens
 */

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface JWTPayload {
  userId: string
  email: string
  companyId: string
  role: string
  iat?: number
  exp?: number
}

/**
 * Generate JWT token for authenticated user
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Verify and decode JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    console.error('[JWT] Verification failed:', error)
    return null
  }
}

/**
 * Extract token from Authorization header
 * Supports both "Bearer TOKEN" and plain "TOKEN" formats
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  
  // Remove "Bearer " prefix if present
  const token = authHeader.replace(/^Bearer\s+/i, '')
  return token || null
}

/**
 * Decode token without verification (use for debugging only)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch (error) {
    return null
  }
}

