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
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // Restrict access: only allow owner path
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
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