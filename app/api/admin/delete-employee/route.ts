import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

interface DeleteBody {
  user_id?: string
}

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    let adminUserId: string | null = null
    if (!isCodeAdmin) {
      const server = await createServerClient()
      const {
        data: { user },
      } = await server.auth.getUser()
      if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
      }

      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        return NextResponse.json({ ok: false, error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
      }
      adminUserId = user.id
    }

    const body = (await req.json().catch(() => ({}))) as DeleteBody
    const userId = body.user_id?.trim()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing required field 'user_id'", code: "VALIDATION_MISSING" }, { status: 400 })
    }

    const svc = createServiceClient()

    // Prevent deleting admins and self-deletion when authenticated
    const { data: targetProfile, error: readErr } = await svc.from("users").select("id, role").eq("id", userId).single()
    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message, code: (readErr as any)?.code || "READ_ERROR" }, { status: 500 })
    }
    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: "User not found", code: "NOT_FOUND" }, { status: 404 })
    }
    if (targetProfile.role !== "employee") {
      return NextResponse.json({ ok: false, error: "Only employee accounts can be deleted", code: "FORBIDDEN_TARGET" }, { status: 403 })
    }
    if (adminUserId && adminUserId === userId) {
      return NextResponse.json({ ok: false, error: "You cannot delete your own admin account", code: "FORBIDDEN_SELF" }, { status: 403 })
    }

    // Delete from Supabase Auth; public.users has FK to auth.users(id) ON DELETE CASCADE
    const { error: delErr } = await svc.auth.admin.deleteUser(userId)
    if (delErr) {
      console.error("[delete-employee] deleteUser error:", delErr.message)
      return NextResponse.json({ ok: false, error: delErr.message, code: "DELETE_FAILED" }, { status: 400 })
    }

    // Verify cascade deletion in public.users
    const { data: verifyRow } = await svc.from("users").select("id").eq("id", userId).maybeSingle?.() ?? { data: null }
    if (verifyRow) {
      // Fallback: attempt explicit deletion (should be redundant)
      const { error: usersDelErr } = await svc.from("users").delete().eq("id", userId)
      if (usersDelErr) {
        console.warn("[delete-employee] Cascade verification: failed to remove public.users row:", usersDelErr.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[delete-employee] unexpected:", err?.message || err)
    return NextResponse.json({ ok: false, error: err?.message || "Server error", code: "UNEXPECTED" }, { status: 500 })
  }
}