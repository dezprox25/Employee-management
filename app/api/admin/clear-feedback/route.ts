import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    if (!isCodeAdmin) {
      const server = await createServerClient()
      const { data: { user } } = await server.auth.getUser()
      if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
    }

    const raw = await req.json().catch(() => ({}))
    const Schema = z.object({ statuses: z.array(z.string()).default(["resolved", "reviewed"]) })
    const parsed = Schema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", code: "VALIDATION_SCHEMA", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    const statuses = parsed.data.statuses.filter((s) => ["resolved", "reviewed"].includes(s))
    if (statuses.length === 0) return NextResponse.json({ ok: false, error: "No valid statuses provided", code: "VALIDATION_STATUS" }, { status: 400 })

    const svc = createServiceClient()
    const { data: rows, error: listErr } = await svc
      .from("feedback")
      .select("feedback_id, attachment_path, status")
      .in("status", statuses)
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message, code: listErr.code || "READ_ERROR" }, { status: 500 })

    if (!rows || rows.length === 0) return NextResponse.json({ ok: true, deleted: 0 })

    const ids = rows.map((r: any) => r.feedback_id)
    const paths = rows.map((r: any) => r.attachment_path).filter(Boolean)

    const { error: delErr } = await svc.from("feedback").delete().in("feedback_id", ids)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message, code: delErr.code || "DELETE_ERROR" }, { status: 500 })

    if (paths.length > 0) {
      try {
        await svc.storage.from("feedback_attachments").remove(paths)
      } catch {}
    }

    return NextResponse.json({ ok: true, deleted: ids.length })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}

