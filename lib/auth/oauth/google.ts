/**
 * Google OAuth Utilities
 * Handles Google OAuth authentication flow
 */

import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback`

export const googleOAuthClient = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
  ? new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )
  : null

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state?: string): string {
  if (!googleOAuthClient) {
    throw new Error('Google OAuth not configured')
  }

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]

  return googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: state || 'default',
  })
}

/**
 * Verify Google OAuth token and get user info
 */
export async function verifyGoogleToken(code: string): Promise<{
  email: string
  name: string
  picture?: string
  googleId: string
}> {
  if (!googleOAuthClient) {
    throw new Error('Google OAuth not configured')
  }

  // Exchange code for tokens
  const { tokens } = await googleOAuthClient.getToken(code)
  googleOAuthClient.setCredentials(tokens)

  // Get user info
  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: GOOGLE_CLIENT_ID!,
  })

  const payload = ticket.getPayload()
  if (!payload) {
    throw new Error('Failed to get user info from Google')
  }

  return {
    email: payload.email!,
    name: payload.name || payload.email!.split('@')[0],
    picture: payload.picture,
    googleId: payload.sub,
  }
}

/**
 * Check if Google OAuth is configured
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!googleOAuthClient && !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET
}


