import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import crypto from "crypto"
import { z } from "zod"
import { consumeRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { logSecurityEvent } from "@/lib/log"

interface ResetBody {
  user_id?: string
  new_password?: string
  reset_token?: string
}

function isStrongPassword(pwd: string) {
  // Minimum security: 8+ chars, at least one letter and one number
  if (typeof pwd !== "string") return false
  const okLen = pwd.length >= 8
  const hasLetter = /[A-Za-z]/.test(pwd)
  const hasNumber = /\d/.test(pwd)
  return okLen && hasLetter && hasNumber
}

function verifyOptionalResetToken(userId: string, token?: string) {
  // Optional token validation: if env and token are present, verify HMAC
  // This does NOT replace Supabase authentication; it adds an extra check when used.
  const secret = process.env.RESET_TOKEN_SECRET
  if (!secret) return true
  if (!token) return false
  const expected = crypto.createHmac("sha256", secret).update(userId).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}

export async function POST(request: Request) {
  try {
    // Basic IP-based rate limiting to mitigate brute-force/reset abuse
    const ip = getClientIp(request.headers)
    const rl = consumeRateLimit(`reset-password:${ip}`, 15 * 60 * 1000, 20)
    if (!rl.allowed) {
      logSecurityEvent("rate_limit_exceeded", { path: "/api/admin/reset-password", ip }, "warn")
      const headers = rateLimitResponse(rl.remaining, rl.resetMs)
      return NextResponse.json({ error: "Too many requests", code: "RATE_LIMIT" }, { status: 429, headers })
    }

    const ResetSchema = z.object({
      user_id: z.string().min(1),
      new_password: z.string().min(8),
      reset_token: z.string().optional(),
    })
    const raw = await request.json().catch(() => null)
    if (!raw) {
      logSecurityEvent("invalid_json", { path: "/api/admin/reset-password", ip }, "warn")
      return NextResponse.json({ error: "Invalid JSON body", code: "VALIDATION_JSON" }, { status: 400 })
    }
    const parsed = ResetSchema.safeParse(raw)
    if (!parsed.success) {
      logSecurityEvent("schema_validation_error", { path: "/api/admin/reset-password", ip, errors: parsed.error.flatten().fieldErrors }, "warn")
      return NextResponse.json({ error: "Validation failed", code: "VALIDATION_SCHEMA", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { user_id, new_password, reset_token } = parsed.data
    const userId = user_id.trim()
    const newPassword = new_password
    const resetToken = reset_token

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "Missing required fields", code: "VALIDATION_MISSING" }, { status: 400 })
    }
    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        { error: "Weak password: min 8 chars with letters and numbers", code: "VALIDATION_PASSWORD" },
        { status: 400 },
      )
    }

    // Allow authenticated admin OR code-admin cookie bypass (used in local/dev)
    const cookieHeader = request.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    if (!isCodeAdmin) {
      const server = await createServerClient()
      const {
        data: { user },
      } = await server.auth.getUser()
      if (!user) {
        logSecurityEvent("unauthenticated_access", { path: "/api/admin/reset-password", ip }, "warn")
        return NextResponse.json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" }, { status: 401 })
      }
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        logSecurityEvent("forbidden_non_admin", { path: "/api/admin/reset-password", ip, userId: user.id }, "warn")
        return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
      }
    }

    // Optional reset token validation (if provided/configured)
    if (!verifyOptionalResetToken(userId, resetToken)) {
      logSecurityEvent("invalid_reset_token", { path: "/api/admin/reset-password", ip, userId }, "warn")
      return NextResponse.json({ error: "Invalid or missing reset token", code: "TOKEN_INVALID" }, { status: 401 })
    }

    const service = createServiceClient()
    const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) {
      logSecurityEvent("reset_failed", { path: "/api/admin/reset-password", ip, userId, error: error.message }, "error")
      return NextResponse.json({ error: error.message, code: "RESET_FAILED" }, { status: 400 })
    }
    // Security: do not store plaintext passwords in public.users
    // If auditing is required, prefer storing an immutable event log without the password value.

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    logSecurityEvent("unexpected_error", { path: "/api/admin/reset-password", error: err?.message || String(err) }, "error")
    return NextResponse.json({ error: "Internal Server Error", code: "UNEXPECTED" }, { status: 500 })
  }
}