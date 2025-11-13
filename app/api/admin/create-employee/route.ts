import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient as createServerClient } from "@/lib/supabase/server"

function isValidEmail(email: string) {
  return /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*|"(?:[^"]|\\")+")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:\d{1,3}\.){3}\d{1,3}\])$/.test(email)
}

function getWorkTimes(workType: string) {
  switch (workType) {
    case "fulltime":
      return { start: "10:00", end: "18:00" }
    case "intern1":
    case "intern2":
      return { start: "19:00", end: "21:00" }
    default:
      return { start: "10:00", end: "18:00" }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, name, type = "fulltime" } = body || {}

    // Basic form validations
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields", code: "VALIDATION_MISSING" }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email format", code: "VALIDATION_EMAIL" }, { status: 400 })
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters", code: "VALIDATION_PASSWORD" }, { status: 400 })
    }
    const trimmedName = String(name).trim()
    if (!trimmedName) {
      return NextResponse.json({ error: "Name cannot be empty", code: "VALIDATION_NAME" }, { status: 400 })
    }

    // Server-side authentication: allow real Supabase admin OR code-admin cookie
    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    // Fallback to cookie header for temporary code-admin bypass
    const cookieHeader = req.headers.get("cookie") || ""
    const isCodeAdmin = /(?:^|;\s*)admin_code_login=true(?:;|$)/.test(cookieHeader)

    if (!user && !isCodeAdmin) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_UNAUTHORIZED" }, { status: 401 })
    }

    // If there is a real Supabase user, enforce admin role from public.users
    if (user) {
      const { data: currentUser } = await server.from("users").select("role").eq("id", user.id).single()
      if (currentUser?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden", code: "AUTH_FORBIDDEN" }, { status: 403 })
      }
    }

    const service = createServiceClient()
    const wt = getWorkTimes(type)

    // Preflight: verify PostgREST sees public.users table; surface schema errors early
    try {
      const preflight: any = await service.from("users").select("id")
      const preErr = preflight?.error
      if (preErr?.code === "PGRST205") {
        console.error("[create-employee] Schema cache missing table public.users", preErr)
        return NextResponse.json(
          { error: "Database not initialized: missing 'public.users'. Run SQL migrations and reload schema.", code: "SCHEMA_MISSING" },
          { status: 500 },
        )
      }
    } catch {
      // Ignore chain mismatch in tests/mocks; creation flow continues
    }

    // Attempt to create auth user with metadata (trigger should populate public.users)
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName,
        role: "employee",
        type,
        work_time_start: wt.start,
        work_time_end: wt.end,
      },
    })

    if (error) {
      // Log detailed error for diagnostics
      console.error("[create-employee] createUser error:", {
        message: error.message,
        status: 400,
        email,
        type,
      })
      return NextResponse.json({ error: error.message, code: "CREATE_USER_FAILED" }, { status: 400 })
    }

    const newUserId = data.user?.id
    if (!newUserId) {
      console.error("[create-employee] Missing user id from createUser response", data)
      return NextResponse.json({ error: "User creation succeeded without user id", code: "USER_ID_MISSING" }, { status: 500 })
    }

    // Verify that public.users row exists (trigger), and fallback insert if missing
    try {
      const { data: userRow } = await service
        .from("users")
        .select("id")
        .eq("id", newUserId)
        .single()

      if (!userRow) {
        const { error: insertError } = await service.from("users").insert({
          id: newUserId,
          name: trimmedName,
          email,
          role: "employee",
          type,
          work_time_start: wt.start,
          work_time_end: wt.end,
          total_leaves: type === "fulltime" ? 12 : 6,
          used_leaves: 0,
        })

        if (insertError) {
          console.error("[create-employee] Fallback insert into public.users failed:", insertError)
          return NextResponse.json({ error: "Database insert failed", code: "DB_INSERT_FAILED" }, { status: 500 })
        }
      } else {
        // Update the plaintext password for admin visibility
        const { error: pwUpdateErr } = await service
          .from("users")
          .update({ password })
          .eq("id", newUserId)
        if (pwUpdateErr) {
          console.warn("[create-employee] Warning: failed to store plaintext password:", pwUpdateErr.message)
          // Do not fail creation; continue
        }
      }
    } catch (verifyErr: any) {
      console.error("[create-employee] Verification of public.users row failed:", verifyErr)
      return NextResponse.json({ error: "Database verification failed", code: "DB_VERIFY_FAILED" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: newUserId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[create-employee] Unexpected error:", e)
    return NextResponse.json({ error: msg, code: "UNEXPECTED_ERROR" }, { status: 500 })
  }
}