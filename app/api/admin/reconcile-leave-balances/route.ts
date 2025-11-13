import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback
  const v = value.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

async function runReconcile(includePending: boolean, countOther: boolean) {
  const service = createServiceClient()
  const { data, error } = await service.rpc("reconcile_leave_balances", { include_pending: includePending, count_other: countOther })
  if (error) {
    console.error("[reconcile-leave-balances] rpc error:", error.message)
    return NextResponse.json({ error: error.message, code: "RECONCILE_FAILED" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updated: data ?? 0, include_pending: includePending, count_other: countOther })
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const includePending = parseBool(url.searchParams.get("include_pending"), true)
    const countOther = parseBool(url.searchParams.get("count_other"), true)

    // Allow real admin OR code-admin cookie bypass for GET
    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    if (!user && !isCodeAdmin) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
    }
    if (user) {
      const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
      }
    }

    return await runReconcile(includePending, countOther)
  } catch (err: any) {
    console.error("[reconcile-leave-balances] unexpected:", err?.message || err)
    return NextResponse.json({ error: "Internal Server Error", code: "UNEXPECTED" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { include_pending?: boolean; count_other?: boolean }
    const includePending = body.include_pending ?? true
    const countOther = body.count_other ?? true

    // Enforce real admin for POST (no bypass)
    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
    }
    const { data: profile } = await server.from("users").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden", code: "NOT_ADMIN" }, { status: 403 })
    }

    return await runReconcile(includePending, countOther)
  } catch (err: any) {
    console.error("[reconcile-leave-balances] unexpected:", err?.message || err)
    return NextResponse.json({ error: "Internal Server Error", code: "UNEXPECTED" }, { status: 500 })
  }
}