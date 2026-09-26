import {
  followUpFromDateInput,
  followUpInDays,
  followUpTiming,
  followUpToDateInput,
  isFollowUpDue,
} from '../follow-up'

const now = new Date(2026, 8, 26, 15, 30, 0)

describe('lead follow-up date', () => {
  it('treats today and earlier dates as due, and a later date as upcoming', () => {
    expect(followUpTiming(followUpInDays(0, now), now)).toBe('today')
    expect(followUpTiming(followUpInDays(1, now), now)).toBe('upcoming')
    expect(followUpTiming(followUpInDays(-1, now), now)).toBe('overdue')
    expect(isFollowUpDue(followUpInDays(0, now), now)).toBe(true)
    expect(isFollowUpDue(followUpInDays(2, now), now)).toBe(false)
    expect(followUpTiming(null, now)).toBe('none')
  })

  it('round-trips a calendar date through the date input', () => {
    const iso = followUpFromDateInput('2026-09-28')
    expect(iso).toBeTruthy()
    expect(followUpToDateInput(iso)).toBe('2026-09-28')
    expect(followUpFromDateInput('')).toBeNull()
  })
})
