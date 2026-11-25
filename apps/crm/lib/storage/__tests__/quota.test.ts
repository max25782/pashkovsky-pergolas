import { bytesToMb, parseQuotaPayload, STORAGE_QUOTA_EXCEEDED } from '../quota'

describe('storage quota payload', () => {
  it('blocks when the database reports the limit is exceeded', () => {
    const result = parseQuotaPayload({
      ok: false,
      error: 'storage_quota_exceeded',
      used_mb: 100,
      limit_mb: 100,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe(STORAGE_QUOTA_EXCEEDED)
    expect(result.usedMb).toBe(100)
    expect(result.limitMb).toBe(100)
  })

  it('allows an upload under the limit', () => {
    const result = parseQuotaPayload({ ok: true, used_mb: 1.5, limit_mb: 100 })
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('converts bytes to megabytes', () => {
    expect(bytesToMb(1024 * 1024)).toBe(1)
  })
})
