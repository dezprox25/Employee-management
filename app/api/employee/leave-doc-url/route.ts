import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const path = url.searchParams.get("path") || ""
    if (!path) return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 })

    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const svc = createServiceClient()
    const { data, error } = await svc.storage.from("leave_docs").createSignedUrl(path, 300)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, url: data?.signedUrl || null })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}