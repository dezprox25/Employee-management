import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  try {
    const service = createServiceClient()
    // Probe the public.users table; capture PostgREST errors
    const { data, error } = await service.from("users").select("id").limit(1)

    if (error) {
      const anyErr: any = error
      const code = anyErr?.code
      const message = anyErr?.message || String(error)
      const tableMissing = code === "PGRST205" || /schema cache/i.test(message)
      return NextResponse.json(
        { ok: false, table: "public.users", tableMissing, code, message },
        { status: 200 },
      )
    }

    return NextResponse.json({ ok: true, table: "public.users", count: (data?.length ?? 0) })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error", table: "public.users" },
      { status: 200 },
    )
  }
}