import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    // Allow authenticated admin OR code-admin cookie bypass
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    // Only enforce Supabase role checks when not using code-admin bypass
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

    const { id, comment } = await req.json().catch(() => ({}))
    if (!id) return NextResponse.json({ ok: false, error: "Missing leave id" }, { status: 400 })

    const svc = createServiceClient()
    const { data: leave, error: fetchErr } = await svc
      .from("leaves")
      .select("id, status, user_id, from_date, to_date, duration")
      .eq("id", id)
      .single()
    if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
    if (!leave) return NextResponse.json({ ok: false, error: "Leave not found" }, { status: 404 })

    // Compute integer days (half-day counts as 1 to match DB balance behavior)
    const from = new Date(leave.from_date as any)
    const to = new Date(leave.to_date as any)
    const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const leaveDays = leave.duration === "half-day" ? 1 : Math.max(0, diffDays)

    // Update leave status and admin info
    const { error: updErr } = await svc
      .from("leaves")
      .update({ status: "approved", decision_at: new Date().toISOString(), admin_id: adminUserId, admin_comment: comment ?? null })
      .eq("id", id)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    // Adjust used_leaves only when transitioning from non-approved
    if (leave.status !== "approved") {
      // Do arithmetic safely via read-then-update (service role bypasses RLS)
      const { data: currentUser, error: readErr } = await svc.from("users").select("used_leaves").eq("id", leave.user_id).single()
      if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 })
      const newUsed = (currentUser?.used_leaves ?? 0) + leaveDays
      const { error: setErr } = await svc.from("users").update({ used_leaves: newUsed }).eq("id", leave.user_id)
      if (setErr) return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 })
    }

    // Log change
    const { error: logErr } = await svc
      .from("leave_logs")
      .insert({ leave_id: id, changed_by: adminUserId, from_status: leave.status, to_status: "approved", comment: comment ?? null })
    if (logErr) {
      // Non-blocking: approval succeeded; report warning
      console.warn("[approve-leave] log insert warning:", logErr.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[approve-leave] unexpected:", err?.message || err)
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}