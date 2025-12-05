import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

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

    const body = await req.json().catch(() => ({} as any))
    const rawPath = String(body?.path || "")
    if (!rawPath) return NextResponse.json({ ok: false, error: "Missing path", code: "VALIDATION_PATH" }, { status: 400 })
    if (/\.\./.test(rawPath)) return NextResponse.json({ ok: false, error: "Invalid path", code: "VALIDATION_PATH" }, { status: 400 })
    if (/[^A-Za-z0-9_./-]/.test(rawPath)) return NextResponse.json({ ok: false, error: "Invalid path characters", code: "VALIDATION_PATH" }, { status: 400 })

    const svc = createServiceClient()
    const { data, error } = await svc.storage.from("feedback_attachments").createSignedUrl(rawPath, 600)
    if (error) return NextResponse.json({ ok: false, error: error.message, code: error.name || "SIGNED_URL_ERROR" }, { status: 500 })
    const url = (data as any)?.signedUrl || ""
    if (!url) return NextResponse.json({ ok: false, error: "Signed URL unavailable", code: "SIGNED_URL_EMPTY" }, { status: 500 })
    return NextResponse.json({ ok: true, url })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}

