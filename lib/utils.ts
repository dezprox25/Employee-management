import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a 24-hour time string to 12-hour format with AM/PM.
 *
 * Accepts common DB time strings like "HH:mm", "HH:mm:ss", or
 * "HH:mm:ss.SSSSSS" and ignores seconds/subseconds when present.
 *
 * Rules:
 * - Midnight -> 12:00 AM
 * - Noon -> 12:00 PM
 * - 1–11 -> AM, 12–23 -> PM
 * - Returns '-' when input is null/undefined/invalid
 */
export function formatTime12hFromString(time: string | null | undefined): string {
  if (time === null || time === undefined) return '-'
  const raw = String(time).trim()
  // Match HH:mm, optional :ss, optional .subseconds
  const m = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?:\.\d+)?$/)
  if (!m) return '-'

  let hour = Number(m[1])
  const minute = m[2]
  if (Number.isNaN(hour)) return '-'

  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${hour}:${minute} ${suffix}`
}
