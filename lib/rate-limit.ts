type Bucket = { count: number; resetAt: number }

const buckets: Map<string, Bucket> = new Map()

function nowMs() {
  return Date.now()
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for") || headers.get("X-Forwarded-For")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  const realIp = headers.get("x-real-ip") || headers.get("X-Real-IP")
  if (realIp) return realIp
  const cfIp = headers.get("cf-connecting-ip") || headers.get("CF-Connecting-IP")
  if (cfIp) return cfIp
  const forwarded = headers.get("forwarded") || headers.get("Forwarded")
  if (forwarded) {
    const match = forwarded.match(/for=([^;]+)/i)
    if (match) return match[1].replace(/\[|\]/g, "").trim()
  }
  return "anonymous"
}

export function consumeRateLimit(key: string, windowMs: number, max: number) {
  const t = nowMs()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= t) {
    buckets.set(key, { count: 1, resetAt: t + windowMs })
    return { allowed: true, remaining: max - 1, resetMs: windowMs }
  }
  if (bucket.count < max) {
    bucket.count += 1
    return { allowed: true, remaining: max - bucket.count, resetMs: bucket.resetAt - t }
  }
  return { allowed: false, remaining: 0, resetMs: bucket.resetAt - t }
}

export function rateLimitResponse(remaining: number, resetMs: number) {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
  }
}