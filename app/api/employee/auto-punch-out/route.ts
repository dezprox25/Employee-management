import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function safeParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const receivedAt = new Date().toISOString()

  // Accept JSON from sendBeacon or fetch keepalive
  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    const text = await req.text().catch(() => "")
    payload = safeParse(text) || {}
  }

  const trigger: string = payload?.trigger || "unknown"
  const source: string = payload?.source || ""

  const server = await createServerClient()
  const {
    data: { user },
  } = await server.auth.getUser()

  if (!user) {
    console.warn("[auto-punch-out] No authenticated user; ignoring")
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split("T")[0]
    const { data: attendances, error: selErr } = await server
      .from("attendance")
      .select("id, login_time, logout_time, status")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("login_time", { ascending: false })

    if (selErr) {
      console.error("[auto-punch-out] select error", selErr)
      return NextResponse.json({ ok: false, error: selErr.message, code: selErr.code || "SELECT_ERROR" }, { status: 500 })
    }

    if (!attendances || attendances.length === 0) {
      return NextResponse.json({ ok: true, action: "none", reason: "no_attendance_row" })
    }

    // Pick the latest attendance row
    const attendance = attendances[0]

    if (attendance.logout_time) {
      return NextResponse.json({ ok: true, action: "none", reason: "already_logged_out" })
    }

    const nowIso = receivedAt
    const loginMs = new Date(attendance.login_time as string).getTime()
    const logoutMs = new Date(nowIso).getTime()
    const totalHours = Math.max(0, (logoutMs - loginMs) / (1000 * 60 * 60))

    const { error: updErr } = await server
      .from("attendance")
      .update({ logout_time: nowIso, total_hours: totalHours })
      .eq("id", attendance.id)

    if (updErr) {
      console.error("[auto-punch-out] update error", updErr)
      return NextResponse.json({ ok: false, error: updErr.message, code: updErr.code || "UPDATE_ERROR" }, { status: 500 })
    }

    // Best-effort event log (subject to RLS insert policy)
    try {
      await server.from("attendance_events").insert({
        user_id: user.id,
        punch_type: "out",
        ts: nowIso,
        status: attendance.status === "late" ? "late" : "present",
      })
    } catch (evErr: any) {
      console.warn("[auto-punch-out] attendance_events insert warning", evErr?.message || evErr)
    }

    // Best-effort audit log using service role (optional)
    try {
      const svc = createServiceClient()
      await svc.from("attendance_audit").insert({
        user_id: user.id,
        punch_type: "out",
        ts: nowIso,
        success: true,
        error_code: null,
        error_message: null,
        correction_applied: false,
      })
    } catch (auditErr: any) {
      console.warn("[auto-punch-out] audit insert skipped", auditErr?.message || auditErr)
    }

    return NextResponse.json(
      { ok: true, action: "updated", total_hours: Number(totalHours.toFixed(4)), trigger, source },
      { status: 200 },
    )
  } catch (err: any) {
    console.error("[auto-punch-out] unexpected error", err)
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
