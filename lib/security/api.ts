import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

type RateLimitOptions = {
  windowMs: number
  max: number
  idHeader?: string
}

// Simple in-memory rate-limit store. For serverless, this resets per instance.
// Good enough to deter bursts; for production use a shared store (Redis).
const globalStore = (globalThis as any).__rateLimitStore ?? new Map<string, { count: number; resetAt: number }>()
;(globalThis as any).__rateLimitStore = globalStore

export function getClientIp(req: Request, fallback = "127.0.0.1") {
  const xf = req.headers.get("x-forwarded-for") || ""
  const xr = req.headers.get("x-real-ip") || ""
  const ip = xf.split(",")[0].trim() || xr.trim() || fallback
  return ip
}

export function rateLimitCheck(req: Request, opts: RateLimitOptions) {
  const keyHeader = opts.idHeader ? req.headers.get(opts.idHeader) || "" : ""
  const key = `${getClientIp(req)}:${keyHeader}`
  const now = Date.now()
  const entry = globalStore.get(key) || { count: 0, resetAt: now + opts.windowMs }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + opts.windowMs
  }
  if (entry.count >= opts.max) {
    const retryMs = Math.max(0, entry.resetAt - now)
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryMs / 1000)) } },
    )
  }
  entry.count += 1
  globalStore.set(key, entry)
  return null
}

export async function requireAdminAuth(req: Request): Promise<{ ok: true; userId: string | null } | { ok: false; response: NextResponse }> {
  const server = await createServerClient()
  const {
    data: { user },
  } = await server.auth.getUser()

  const cookieHeader = req.headers.get("cookie") || ""
  const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)
  const codeAdminEnabled =
    process.env.ADMIN_CODE_LOGIN_ENABLED === "true" || process.env.NEXT_PUBLIC_ALLOW_CODE_ADMIN === "true"

  if (!user) {
    if (!(isCodeAdmin && codeAdminEnabled)) {
      return { ok: false, response: NextResponse.json({ ok: false, error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 }) }
    }
    return { ok: true, userId: null }
  }

  const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Forbidden", code: "AUTH_FORBIDDEN" }, { status: 403 }) }
  }
  return { ok: true, userId: user.id }
}