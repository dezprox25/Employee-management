export function inclusiveDaysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (isNaN(startMs) || isNaN(endMs)) return 0
  if (endMs < startMs) return 0
  // Normalize to midnight to avoid DST/timezone offsets affecting diff
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  const diffDays = Math.floor((endUTC - startUTC) / (1000 * 60 * 60 * 24))
  return diffDays + 1
}