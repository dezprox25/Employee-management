import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

interface ResetBody {
  user_id?: string
  new_password?: string
}

function isStrongPassword(pwd: string) {
  return typeof pwd === "string" && pwd.length >= 8
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResetBody
    const userId = body.user_id?.trim()
    const newPassword = body.new_password ?? ""

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "Missing required fields", code: "VALIDATION_MISSING" }, { status: 400 })
    }
    if (!isStrongPassword(newPassword)) {
      return NextResponse.json({ error: "Password must be at least 8 characters", code: "VALIDATION_PASSWORD" }, { status: 400 })
    }

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

    const service = createServiceClient()
    const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) {
      console.error("[reset-password] updateUserById error:", error.message)
      return NextResponse.json({ error: error.message, code: "RESET_FAILED" }, { status: 400 })
    }
    // Also store plaintext password in public.users for admin visibility
    const { error: pwStoreError } = await service
      .from("users")
      .update({ password: newPassword })
      .eq("id", userId)
    if (pwStoreError) {
      // Non-blocking: still return success for auth change, but log for diagnostics
      console.warn("[reset-password] Warning: failed to save plaintext password:", pwStoreError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[reset-password] Unexpected error:", err?.message || err)
    return NextResponse.json({ error: "Internal Server Error", code: "UNEXPECTED" }, { status: 500 })
  }
}