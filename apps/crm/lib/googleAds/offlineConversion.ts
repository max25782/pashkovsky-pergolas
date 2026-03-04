/**
 * Google Ads offline conversion upload via gclid.
 * Uses REST API with OAuth2 (client credentials + refresh token).
 *
 * Env: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
 *      GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_CONVERSION_ACTION_ID
 */

import { OAuth2Client } from 'google-auth-library'

const API_VERSION = 'v17'

function getConversionAction(): string {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
  const actionId = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID
  if (!customerId || !actionId) {
    throw new Error('GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_CONVERSION_ACTION_ID are required')
  }
  // customer_id must be without hyphens
  const cleanId = customerId.replace(/-/g, '')
  return `customers/${cleanId}/conversionActions/${actionId}`
}

function formatConversionDateTime(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const h = String(now.getUTCHours()).padStart(2, '0')
  const min = String(now.getUTCMinutes()).padStart(2, '0')
  const s = String(now.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}+00:00`
}

export async function uploadLeadConversion(
  gclid: string,
  value: number = 1
): Promise<void> {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.warn('[GoogleAds] GOOGLE_ADS_DEVELOPER_TOKEN missing — skipping conversion upload')
    return
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
  if (!customerId) {
    console.warn('[GoogleAds] GOOGLE_ADS_CUSTOMER_ID missing — skipping conversion upload')
    return
  }

  const cleanCustomerId = customerId.replace(/-/g, '')
  const conversionAction = getConversionAction()

  console.log('[GoogleAds] Sending conversion', { gclid: gclid.substring(0, 20) + '...', value })

  const oauth2 = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  )
  oauth2.setCredentials({
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  })
  const { token: accessToken } = await oauth2.getAccessToken()
  if (!accessToken) {
    throw new Error('Failed to obtain Google Ads access token (check refresh token)')
  }

  const body = {
    conversionUploads: [
      {
        gclid,
        conversionAction,
        conversionDateTime: formatConversionDateTime(),
        conversionValue: value,
      },
    ],
    partialFailure: true,
  }

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cleanCustomerId}:uploadClickConversions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    }
  )

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errMsg = (data as { error?: { message?: string } })?.error?.message ?? res.statusText
    console.error('[GoogleAds] Conversion failed', res.status, errMsg)
    throw new Error(`Google Ads conversion upload failed: ${errMsg}`)
  }

  const partialFailure = (data as { partialFailureError?: { details?: unknown[] } })?.partialFailureError
  if (partialFailure?.details?.length) {
    console.error('[GoogleAds] Conversion partial failure', partialFailure.details)
    throw new Error('Google Ads conversion partial failure')
  }

  console.log('[GoogleAds] Conversion success')
}

/**
 * Upload conversion for a won deal (higher value).
 * To be triggered when deal status becomes WON.
 * Not automated here — just the utility.
 */
export async function uploadWonDealConversion(
  gclid: string,
  value: number
): Promise<void> {
  return uploadLeadConversion(gclid, value)
}
