import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get("status")
    const category = url.searchParams.get("category")
    const duration = url.searchParams.get("duration")

    // Simple auth gate: allow when code-login cookie is present
    const cookie = req.headers.get("cookie") || ""
    const isCodeAdmin = cookie.split("; ").some((c) => c.trim() === "admin_code_login=true")
    if (!isCodeAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized", code: "UNAUTH" }, { status: 401 })
    }

    const supabase = createServiceClient()
    let query = supabase
      .from("leaves")
      .select(
        "id,user_id,from_date,to_date,category,duration,status,reason,applied_at,decision_at,admin_comment,document_url"
      )
      .order("applied_at", { ascending: false })

    if (status && status !== "all") query = query.eq("status", status)
    if (category && category !== "all") query = query.eq("category", category)
    if (duration && duration !== "all") query = query.eq("duration", duration)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 500 })
    }
    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}