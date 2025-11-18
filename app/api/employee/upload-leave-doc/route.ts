import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(req: Request) {
  try {
    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 })

    const svc = createServiceClient()
    const ext = (file.name.split(".").pop() || "bin").toLowerCase()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${user.id}/leave-${Date.now()}-${safeName}`

    const { data, error } = await svc.storage.from("leave_docs").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `application/octet-stream`,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const { data: urlData } = await svc.storage.from("leave_docs").getPublicUrl(data.path)
    return NextResponse.json({ ok: true, url: urlData?.publicUrl || null, path: data.path })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}