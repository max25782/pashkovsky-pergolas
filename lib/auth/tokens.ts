/**
 * Token Generation Utilities
 * For email verification and password reset
 */

import crypto from 'crypto'

/**
 * Generate a secure random token
 * @param length - Token length in bytes (default: 32)
 * @returns Hex-encoded token string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate a URL-safe token (base64url encoded)
 * @param length - Token length in bytes (default: 32)
 * @returns Base64url-encoded token string
 */
export function generateUrlSafeToken(length: number = 32): string {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Hash a token for storage (using SHA-256)
 * @param token - Plain text token
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify token matches hash
 * @param token - Plain text token
 * @param hash - Stored hash
 * @returns True if token matches hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  const tokenHash = hashToken(token)
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  )
}

/**
 * Calculate expiration time
 * @param hours - Hours until expiration (default: 24)
 * @returns ISO timestamp string
 */
export function getExpirationTime(hours: number = 24): string {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + hours)
  return expiresAt.toISOString()
}

/**
 * Check if token is expired
 * @param expiresAt - Expiration timestamp
 * @returns True if expired
 */
export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}


