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

    const body = await req.json().catch(() => ({}))
    const Schema = z.object({ feedback_id: z.union([z.number().int().positive(), z.string()]) })
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", code: "VALIDATION_SCHEMA", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    const idNum = Number(parsed.data.feedback_id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ ok: false, error: "Invalid id", code: "VALIDATION_ID" }, { status: 400 })

    const svc = createServiceClient()
    const { data: row, error: readErr } = await svc.from("feedback").select("feedback_id, attachment_path").eq("feedback_id", idNum).single()
    if (readErr) return NextResponse.json({ ok: false, error: readErr.message, code: readErr.code || "READ_ERROR" }, { status: 500 })
    if (!row) return NextResponse.json({ ok: false, error: "Not found", code: "NOT_FOUND" }, { status: 404 })

    const { error: delErr } = await svc.from("feedback").delete().eq("feedback_id", idNum)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message, code: delErr.code || "DELETE_ERROR" }, { status: 500 })

    if (row.attachment_path) {
      try {
        await svc.storage.from("feedback_attachments").remove([row.attachment_path])
      } catch {}
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}

