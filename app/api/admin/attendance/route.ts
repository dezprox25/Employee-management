import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

type AttendanceRow = {
  id: number
  user_id: string
  date: string
  login_time: string | null
  logout_time: string | null
  total_hours: number | null
  status: string | null
  reason: string | null
}

type UserRow = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  position: string | null
}

export async function GET(req: Request) {
  try {
    // Read cookie header from incoming Request for compatibility in all runtimes
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    // Gate: require admin either via session or code-login cookie
    if (!isCodeAdmin) {
      const server = await createServerClient()
      const { data: userRes, error: userErr } = await server.auth.getUser()
      if (userErr) {
        return NextResponse.json({ ok: false, error: userErr.message }, { status: 500 })
      }
      const user = userRes?.user
      if (!user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
      }
      const { data: currentUser, error: roleErr } = await server.from("users").select("role").eq("id", user.id).single()
      if (roleErr) {
        // If schema cache is missing, surface a clear message
        const schemaIssue = roleErr?.code === "PGRST205"
        return NextResponse.json(
          { ok: false, error: roleErr.message, code: roleErr.code, schemaIssue },
          { status: 500 },
        )
      }
      if (currentUser?.role !== "admin") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
      }
    }

    const url = new URL(req.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || 30)))
    const limit = Math.max(10, Math.min(1000, Number(url.searchParams.get("limit") || 200)))

    const service = createServiceClient()

    // Preflight: verify PostgREST sees public.users table; surface schema errors early
    try {
      const preflight: any = await service.from("users").select("id").limit(1)
      const preErr = preflight?.error
      if (preErr?.code === "PGRST205") {
        return NextResponse.json(
          { ok: false, error: "Database not initialized: missing 'public.users'. Run SQL migrations and reload schema.", code: "SCHEMA_MISSING", schemaIssue: true },
          { status: 500 },
        )
      }
    } catch {
      // Ignore chain mismatch in tests/mocks
    }

    // Fetch employees for enrichment and totals
    const { data: users, error: usersErr } = await service
      .from("users")
      .select("id, name, email, role, position")
      .in("role", ["employee"])

    if (usersErr) {
      return NextResponse.json({ ok: false, error: usersErr.message, code: usersErr.code }, { status: 500 })
    }
    const byId: Record<string, { name: string; email: string; position: string | null }> = {}
    const userList: UserRow[] = Array.isArray(users) ? (users as UserRow[]) : []
    for (const u of userList) {
      byId[u.id] = { name: u.name ?? "", email: u.email ?? "", position: u.position ?? null }
    }
    const totalEmployees = userList.length

    // Today records
    const today = new Date().toISOString().split("T")[0]
    const { data: todayData, error: todayErr } = await service
      .from("attendance")
      .select("*")
      .eq("date", today)
      .order("login_time", { ascending: true })

    if (todayErr) {
      return NextResponse.json({ ok: false, error: todayErr.message, code: todayErr.code }, { status: 500 })
    }

    const todayEnriched = (Array.isArray(todayData) ? (todayData as AttendanceRow[]) : [])?.map((r) => ({
      ...r,
      name: byId[r.user_id]?.name ?? "Unknown",
      email: byId[r.user_id]?.email ?? "",
      position: byId[r.user_id]?.position ?? null,
    })) || []

    const present = todayEnriched.filter((r) => r.status === "present").length
    const late = todayEnriched.filter((r) => r.status === "late").length
    const absent = Math.max(totalEmployees - (present + late), 0)

    // Recent logs (last N days)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split("T")[0]
    const { data: recent, error: recentErr } = await service
      .from("attendance")
      .select("*")
      .gte("date", sinceStr)
      .order("date", { ascending: false })
      .limit(limit)

    if (recentErr) {
      return NextResponse.json({ ok: false, error: recentErr.message, code: recentErr.code }, { status: 500 })
    }

    const recentEnriched = (Array.isArray(recent) ? (recent as AttendanceRow[]) : [])?.map((r) => ({
      ...r,
      name: byId[r.user_id]?.name ?? "Unknown",
      email: byId[r.user_id]?.email ?? "",
      position: byId[r.user_id]?.position ?? null,
    })) || []

    return NextResponse.json({
      ok: true,
      totalEmployees,
      todayCounts: { present, late, absent },
      todayRecords: todayEnriched,
      recentRecords: recentEnriched,
      rangeDays: days,
      limit,
      generatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error("[admin/attendance] GET error", e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}