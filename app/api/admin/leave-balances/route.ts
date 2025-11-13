import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || ""
    const isCodeAdmin = cookie.split("; ").some((c) => c.trim() === "admin_code_login=true")
    if (!isCodeAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized", code: "UNAUTH" }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("users")
      .select("id,name,email,total_leaves,used_leaves")
      .eq("role", "employee")

    if (error) return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}