import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { rateLimitCheck, requireAdminAuth } from "@/lib/security/api"

const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include letters and numbers"),
  name: z.string().trim().min(1),
  type: z.enum(["fulltime", "intern1", "intern2"]).default("fulltime"),
})

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
    const limited = rateLimitCheck(req, { windowMs: 15 * 60 * 1000, max: 100 })
    if (limited) return limited

    const parsed = CreateEmployeeSchema.safeParse(await req.json())
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]
      const codeMap: Record<string, string> = {
        email: "VALIDATION_EMAIL",
        password: "VALIDATION_PASSWORD",
        name: "VALIDATION_NAME",
        type: "VALIDATION_TYPE",
      }
      return NextResponse.json(
        { error: firstErr.message || "Invalid request body", code: codeMap[firstErr.path[0]?.toString?.() || "body"] || "VALIDATION_BODY" },
        { status: 400 },
      )
    }
    const { email, password, name, type } = parsed.data
    const trimmedName = name.trim()

    const auth = await requireAdminAuth(req)
    if (!auth.ok) return auth.response

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
        // Do NOT store plaintext passwords; credentials are managed by Supabase Auth only.
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