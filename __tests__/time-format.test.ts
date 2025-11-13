import { describe, it, expect } from 'vitest'
import { formatTime12hFromString, formatTime12hCompactFromString, formatTime12hFromDate } from '@/lib/utils'

describe('formatTime12hFromString', () => {
  it('formats morning times with AM', () => {
    expect(formatTime12hFromString('00:00')).toBe('12:00 AM')
    expect(formatTime12hFromString('01:05')).toBe('1:05 AM')
    expect(formatTime12hFromString('07:30')).toBe('7:30 AM')
    expect(formatTime12hFromString('09:03:32')).toBe('9:03 AM')
    expect(formatTime12hFromString('09:03:32.123456')).toBe('9:03 AM')
  })

  it('formats noon and afternoon with PM', () => {
    expect(formatTime12hFromString('12:00')).toBe('12:00 PM')
    expect(formatTime12hFromString('12:15')).toBe('12:15 PM')
    expect(formatTime12hFromString('13:05')).toBe('1:05 PM')
    expect(formatTime12hFromString('23:59')).toBe('11:59 PM')
  })

  it('returns dash for invalid inputs', () => {
    expect(formatTime12hFromString('')).toBe('-')
    expect(formatTime12hFromString('24:00')).toBe('-')
    expect(formatTime12hFromString('12:60')).toBe('-')
    expect(formatTime12hFromString('abc')).toBe('-')
    expect(formatTime12hFromString(null)).toBe('-')
    expect(formatTime12hFromString(undefined)).toBe('-')
  })
})

describe('formatTime12hCompactFromString', () => {
  it('omits minutes for :00 and keeps AM/PM', () => {
    expect(formatTime12hCompactFromString('00:00')).toBe('12 AM')
    expect(formatTime12hCompactFromString('12:00')).toBe('12 PM')
    expect(formatTime12hCompactFromString('13:00')).toBe('1 PM')
    expect(formatTime12hCompactFromString('23:00')).toBe('11 PM')
  })

  it('includes minutes when non-zero', () => {
    expect(formatTime12hCompactFromString('01:05')).toBe('1:05 AM')
    expect(formatTime12hCompactFromString('14:30')).toBe('2:30 PM')
  })

  it('handles invalids gracefully', () => {
    expect(formatTime12hCompactFromString('')).toBe('-')
    expect(formatTime12hCompactFromString('24:00')).toBe('-')
  })
})

describe('formatTime12hFromDate', () => {
  it('formats Date instances to 12-hour with minutes', () => {
    const d1 = new Date('2024-01-01T00:00:00Z')
    const d2 = new Date('2024-01-01T13:45:00Z')
    // Note: using UTC; hours will depend on environment timezone during tests
    // To make assertion stable, adjust to a known local time mapping
    const fixed = new Date(0)
    fixed.setHours(13)
    fixed.setMinutes(45)
    expect(formatTime12hFromDate(fixed)).toBe('1:45 PM')
  })

  it('omits :00 minutes when requested', () => {
    const noon = new Date(0)
    noon.setHours(12)
    noon.setMinutes(0)
    expect(formatTime12hFromDate(noon, { omitZeroMinutes: true })).toBe('12 PM')
    const mid = new Date(0)
    mid.setHours(0)
    mid.setMinutes(0)
    expect(formatTime12hFromDate(mid, { omitZeroMinutes: true })).toBe('12 AM')
  })
})