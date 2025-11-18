import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function guessContentType(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase()
  switch (ext) {
    case "pdf":
      return "application/pdf"
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    default:
      return "application/octet-stream"
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const path = url.searchParams.get("path") || ""
    if (!path) return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 })

    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()

    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    let isAdmin = false
    if (user) {
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      isAdmin = profile?.role === "admin"
    }

    if (!isAdmin && !isCodeAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const svc = createServiceClient()
    const { data, error } = await svc.storage.from("leave_docs").download(path)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 })

    const buf = await data.arrayBuffer()
    const contentType = guessContentType(path)
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.split('/').pop() || 'file')}`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}