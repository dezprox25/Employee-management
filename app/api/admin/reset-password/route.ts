import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import crypto from "crypto"

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
    const body = (await request.json()) as ResetBody
    const userId = body.user_id?.trim()
    const newPassword = body.new_password ?? ""
    const resetToken = body.reset_token

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
        return NextResponse.json({ error: "Unauthorized", code: "NOT_AUTHENTICATED" }, { status: 401 })
      }
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
      }
    }

    // Optional reset token validation (if provided/configured)
    if (!verifyOptionalResetToken(userId, resetToken)) {
      return NextResponse.json({ error: "Invalid or missing reset token", code: "TOKEN_INVALID" }, { status: 401 })
    }

    const service = createServiceClient()
    const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) {
      console.error("[reset-password] updateUserById error:", error.message)
      return NextResponse.json({ error: error.message, code: "RESET_FAILED" }, { status: 400 })
    }
    // Security: do not store plaintext passwords in public.users
    // If auditing is required, prefer storing an immutable event log without the password value.

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[reset-password] Unexpected error:", err?.message || err)
    return NextResponse.json({ error: "Internal Server Error", code: "UNEXPECTED" }, { status: 500 })
  }
}