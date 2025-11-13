import { describe, it, expect } from 'vitest'
import { formatTime12hFromString } from '@/lib/utils'

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