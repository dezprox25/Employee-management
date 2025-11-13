import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient as createServerClient } from "@/lib/supabase/server"

function parseBool(v: string | null, def = false) {
  if (v === null || v === undefined) return def
  return v === "true" || v === "1"
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || 1))
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 12)))
    const filterType = url.searchParams.get("filterType") || "all"
    const searchQuery = url.searchParams.get("search") || ""
    const sortKey = url.searchParams.get("sortKey") || "name"
    const sortDir = (url.searchParams.get("sortDir") || "asc").toLowerCase() === "desc" ? "desc" : "asc"
    const includeCount = parseBool(url.searchParams.get("includeCount"), true)
    // Accept code-admin cookie as temporary bypass for admin-only listing
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    // If not in code-admin mode, require a real admin user
    if (!isCodeAdmin) {
      const server = await createServerClient()
      const {
        data: { user },
      } = await server.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
      }

      const { data: profile, error: roleError } = await server.from("users").select("role").eq("id", user.id).single()
      if (roleError) {
        const code = (roleError as any)?.code
        const message = (roleError as any)?.message || String(roleError)
        return NextResponse.json({ error: message, code: code || "ROLE_LOOKUP_FAILED" }, { status: 500 })
      }
      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden", code: "AUTH_FORBIDDEN" }, { status: 403 })
      }
    }

    const service = createServiceClient()
    const offset = (page - 1) * pageSize

    let query = service
      .from("users")
      .select("*", { count: includeCount ? "exact" : undefined })
      .eq("role", "employee")

    if (filterType && filterType !== "all") {
      query = query.eq("type", filterType)
    }

    if (searchQuery) {
      const q = `%${searchQuery}%`
      query = query.or(`name.ilike.${q},email.ilike.${q}`)
    }

    const sortable = new Set([
      "name",
      "email",
      "type",
      "created_at",
      "work_time_start",
      "work_time_end",
      "total_leaves",
      "used_leaves",
    ])
    const key = sortable.has(sortKey) ? sortKey : "name"
    query = query.order(key, { ascending: sortDir === "asc" })

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)

    if (error) {
      const anyErr: any = error
      const code = anyErr?.code
      const message = anyErr?.message || String(error)
      // Surface schema cache or RLS recursion clearly
      const isSchema = code === "PGRST205" || /schema cache/i.test(message)
      const isRecursion = code === "42P17" || /infinite recursion/i.test(message)
      return NextResponse.json(
        {
          error: message,
          code: code || "EMPLOYEES_FETCH_ERROR",
          schemaIssue: isSchema,
          recursionIssue: isRecursion,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, data: data ?? [], count: count ?? null })
  } catch (e: any) {
    const msg = e?.message || "Unknown error"
    return NextResponse.json({ error: msg, code: "UNEXPECTED_ERROR" }, { status: 500 })
  }
}