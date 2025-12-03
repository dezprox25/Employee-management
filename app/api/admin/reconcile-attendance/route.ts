import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient as createServerClient } from "@/lib/supabase/server"

function toDateTime(dateStr: string, timeStr: string) {
  const base = new Date(`${dateStr}T${timeStr}`)
  return base
}

function addDays(d: Date, days: number) {
  const n = new Date(d.getTime())
  n.setDate(n.getDate() + days)
  return n
}

function diffHours(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 3600000)
}

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    let adminUserId: string | null = null
    if (!isCodeAdmin) {
      const server = await createServerClient()
      const { data: { user } } = await server.auth.getUser()
      if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
      adminUserId = user.id
    }

    const body = await req.json().catch(() => ({} as any))
    const dateInput: string | undefined = body?.date
    const now = new Date()
    now.setDate(now.getDate() - 1)
    const targetDate = dateInput || now.toISOString().split("T")[0]

    const svc = createServiceClient()

    const { data: rows, error } = await svc
      .from("attendance")
      .select("id,user_id,date,login_time,logout_time,total_hours")
      .eq("date", targetDate)
      .order("login_time", { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const list = Array.isArray(rows) ? rows as any[] : []
    const byUser: Record<string, any[]> = {}
    for (const r of list) {
      if (!byUser[r.user_id]) byUser[r.user_id] = []
      byUser[r.user_id].push(r)
    }

    const userIds = Object.keys(byUser)
    const { data: usersData } = await svc.from("users").select("id, work_time_start, work_time_end").in("id", userIds)
    const schedule: Record<string, { start: string, end: string }> = {}
    for (const u of usersData || []) schedule[u.id] = { start: u.work_time_start as any, end: u.work_time_end as any }

    let adjustedCount = 0
    for (const uid of userIds) {
      const records = byUser[uid]
      let finalLogout: Date | null = null
      let finalLogin: Date | null = null
      for (const r of records) {
        if (r.login_time) {
          const li = new Date(r.login_time as any)
          if (!finalLogin || li > finalLogin) finalLogin = li
        }
        if (r.logout_time) {
          const lo = new Date(r.logout_time as any)
          if (!finalLogout || lo > finalLogout) finalLogout = lo
        }
      }

      if (!finalLogout) {
        const sch = schedule[uid]
        if (sch?.end) {
          let candidate = toDateTime(targetDate, sch.end as any)
          const startT = sch?.start ? toDateTime(targetDate, sch.start as any) : null
          if (startT && sch && sch.end < sch.start) candidate = addDays(candidate, 1)
          finalLogout = candidate
        } else {
          continue
        }
      }

      if (!finalLogin) {
        // If no login recorded, skip adjustments for this user/date
        continue
      }

      const finalHours = diffHours(finalLogin, finalLogout)

      for (const r of records) {
        const shouldUpdate = !r.logout_time || new Date(r.logout_time as any).getTime() !== finalLogout.getTime() || Math.abs((r.total_hours || 0) - finalHours) > 1e-6
        if (!shouldUpdate) continue

        await svc.from("attendance_adjustments").insert({
          attendance_id: r.id,
          user_id: r.user_id,
          date: r.date,
          original_login_time: r.login_time,
          original_logout_time: r.logout_time,
          original_total_hours: r.total_hours,
          new_logout_time: finalLogout.toISOString(),
          new_total_hours: finalHours,
          reason: r.logout_time ? "FINAL_PAIR" : "FALLBACK_SCHEDULE",
          adjusted_by: adminUserId,
        })

        const { error: updErr } = await svc
          .from("attendance")
          .update({ logout_time: finalLogout.toISOString(), total_hours: finalHours, auto_adjusted: true })
          .eq("id", r.id)
        if (!updErr) adjustedCount++
      }
    }

    return NextResponse.json({ ok: true, date: targetDate, adjustedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}