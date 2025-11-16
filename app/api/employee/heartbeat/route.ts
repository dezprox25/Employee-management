import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { employeeId } = await req.json()

    const server = await createServerClient()
    const { data: { user } } = await server.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    // Allow caller to omit employeeId (we can derive from auth), but if provided verify it matches
    if (employeeId && user.id !== employeeId) {
      console.warn("[heartbeat] Mismatched employeeId", { expected: user.id, provided: employeeId })
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    }

    const resolvedEmployeeId = employeeId || user.id

    const now = new Date().toISOString()

    // Update employee_status with latest lastSeen timestamp and status
    const { error: upsertErr } = await server
      .from("employee_status")
      .upsert(
        {
          employee_id: resolvedEmployeeId,
          last_seen: now,
          updated_at: now,
          status: "IN", // Heartbeat means employee is IN
        },
        { onConflict: "employee_id" }
      )

    if (upsertErr) {
      console.error("[heartbeat] Failed to upsert employee_status", upsertErr)
      // Don't fail the heartbeat on DB error; just log it
    }

    console.debug(`[heartbeat] ${employeeId} @ ${now}`)

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: any) {
    console.error("[heartbeat] unexpected error", err)
    return NextResponse.json({ ok: false, error: err?.message || "server error" }, { status: 500 })
  }
}
