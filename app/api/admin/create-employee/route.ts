import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { rateLimitCheck, requireAdminAuth } from "@/lib/security/api"
import { logSecurityEvent } from "@/lib/log"
export const runtime = "nodejs"
import nodemailer from "nodemailer"

const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include letters and numbers"),
  name: z.string().trim().min(1),
  position: z.string().trim().min(1),
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
        position: "VALIDATION_POSITION",
        type: "VALIDATION_TYPE",
      }
      return NextResponse.json(
        { error: firstErr.message || "Invalid request body", code: codeMap[firstErr.path[0]?.toString?.() || "body"] || "VALIDATION_BODY" },
        { status: 400 },
      )
    }
    const { email, password, name, position, type } = parsed.data
    const trimmedName = name.trim()
    const trimmedPosition = position.trim()

    const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    const emailDomain = (email.split("@")[1] || "").toLowerCase()
    if (domains.length > 0 && (!emailDomain || !domains.includes(emailDomain))) {
      return NextResponse.json({ error: "Email domain not allowed", code: "VALIDATION_DOMAIN" }, { status: 400 })
    }

    const csrfEnforce = process.env.CSRF_ENFORCE === "true"
    if (csrfEnforce) {
      const tokenHdr = req.headers.get("x-csrf-token") || ""
      const cookieHeader = req.headers.get("cookie") || ""
      const m = cookieHeader.match(/(?:^|;\s*)csrf_token=([^;]+)/)
      const cookieToken = m?.[1] || ""
      if (!tokenHdr || !cookieToken || tokenHdr !== cookieToken) {
        return NextResponse.json({ error: "Invalid CSRF token", code: "CSRF_INVALID" }, { status: 403 })
      }
    }

    const auth = await requireAdminAuth(req)
    if (!auth.ok) return auth.response
    logSecurityEvent("employee_create_attempt", { email, type, adminId: auth.userId })

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
        position: trimmedPosition,
        type,
        work_time_start: wt.start,
        work_time_end: wt.end,
      },
    })

    if (error) {
      // Log detailed error for diagnostics
      console.error("[create-employee] createUser error:", { message: error.message, status: 400, email, type })
      logSecurityEvent("employee_create_failed", { email, type, adminId: auth.userId, error: error.message }, "error")
      return NextResponse.json({ error: error.message, code: "CREATE_USER_FAILED" }, { status: 400 })
    }

    const newUserId = data.user?.id
    if (!newUserId) {
      console.error("[create-employee] Missing user id from createUser response", data)
      logSecurityEvent("employee_create_failed", { email, type, adminId: auth.userId, error: "missing_user_id" }, "error")
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
          position: trimmedPosition,
          type,
          work_time_start: wt.start,
          work_time_end: wt.end,
          total_leaves: type === "fulltime" ? 12 : 6,
          used_leaves: 0,
        })

        if (insertError) {
          console.error("[create-employee] Fallback insert into public.users failed:", insertError)
          logSecurityEvent("employee_insert_failed", { email, userId: newUserId, error: insertError.message }, "error")
          return NextResponse.json({ error: "Database insert failed", code: "DB_INSERT_FAILED" }, { status: 500 })
        }
      } else {
        // Do NOT store plaintext passwords; credentials are managed by Supabase Auth only.
      }
    } catch (verifyErr: any) {
      console.error("[create-employee] Verification of public.users row failed:", verifyErr)
      logSecurityEvent("employee_verify_failed", { email, userId: newUserId, error: verifyErr?.message || String(verifyErr) }, "error")
      return NextResponse.json({ error: "Database verification failed", code: "DB_VERIFY_FAILED" }, { status: 500 })
    }

    setTimeout(() => {
      sendWelcomeEmail(email, trimmedName, password, newUserId)
        .then((r) => {
          const ts = new Date().toISOString()
          if (r.ok) {
            console.log(`[${ts}] Email successfully sent to ${email}`)
            logSecurityEvent("welcome_email_sent", { to: email, userId: newUserId })
          } else {
            console.error(`[${ts}] Failed to send email to ${email}: ${r.reason || "unknown"}`)
            logSecurityEvent("welcome_email_skipped", { to: email, userId: newUserId, reason: r.reason || "unknown" }, "warn")
          }
        })
        .catch((err) => {
          const ts = new Date().toISOString()
          console.error(`[${ts}] Failed to send email to ${email}: ${err?.message || String(err)}`)
          logSecurityEvent("welcome_email_error", { to: email, userId: newUserId, error: err?.message || String(err) }, "error")
        })
    }, 0)

    logSecurityEvent("employee_create_success", { email, userId: newUserId, type })
    return NextResponse.json({ ok: true, user_id: newUserId, email_scheduled: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[create-employee] Unexpected error:", e)
    return NextResponse.json({ error: msg, code: "UNEXPECTED_ERROR" }, { status: 500 })
  }
}

async function sendWelcomeEmail(to: string, name: string, password: string, userId: string) {
  const host = process.env.SMTP_HOST || ""
  let port = Number((process.env.SMTP_PORT || "").trim())
  const user = (process.env.SMTP_USER || "").trim()
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "")
  const from = process.env.SMTP_FROM || user || ""
  if (!host || !user || !pass || !from) {
    console.error(`[${new Date().toISOString()}] Failed to send email: missing SMTP config host/user/pass/from`)
    return { ok: false, reason: "missing_config" }
  }
  const secureEnv = (process.env.SMTP_SECURE || "").toLowerCase()
  const secureFlag = secureEnv === "true" || secureEnv === "1"
  if (!port || Number.isNaN(port) || port <= 0) port = secureFlag ? 465 : 587
  const secure = secureFlag || port === 465
  const brand = process.env.BRAND_NAME || "Dezprox"
  const support = process.env.COMPANY_SUPPORT_EMAIL || ""
  const subject = `${brand} Employee Account Created`
  const html = buildWelcomeEmailHTML({ brand, name, email: to, password, support })

  const commonOpts: any = {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    socketTimeout: 10000,
    greetingTimeout: 7000,
    tls: { minVersion: "TLSv1.2" },
    pool: false,
  }

  console.log(`[${new Date().toISOString()}] Attempting to send employee welcome email to ${to} via ${host}:${port} secure=${secure}`)

  let transport = nodemailer.createTransport(commonOpts)
  try {
    await transport.verify()
  } catch (e: any) {
    console.warn(`[${new Date().toISOString()}] SMTP verify failed on ${host}:${port} secure=${secure}: ${e?.message || e}`)
    const fallbackOpts = { ...commonOpts, port: 587, secure: false }
    transport = nodemailer.createTransport(fallbackOpts)
    try {
      await transport.verify()
    } catch (e2: any) {
      const reason = classifySmtpError(e2)
      console.error(`[${new Date().toISOString()}] SMTP fallback verify failed: ${e2?.message || e2}`)
      return { ok: false, reason }
    }
  }

  const fromHeader = /<.+>/.test(from) ? from : `${brand} <${from}>`
  try {
    const info = await transport.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
      replyTo: support || undefined,
      headers: {
        "X-App": brand,
        "X-User-Id": userId,
      },
    })
    const response = String((info as any)?.response || "")
    const code = parseInt(response, 10)
    console.log(`[${new Date().toISOString()}] Email successfully sent to ${to} response=${response || ""}`)
    logSecurityEvent("welcome_email_smtp_response", { to, code: Number.isFinite(code) ? code : null, response })
    return { ok: true }
  } catch (err: any) {
    const reason = classifySmtpError(err)
    console.error(`[${new Date().toISOString()}] Failed to send email: ${err?.message || err}`)
    return { ok: false, reason }
  }
}

function classifySmtpError(err: any) {
  const code = err?.code || ""
  if (code === "EAUTH") return "auth_failed"
  if (code === "ECONNECTION") return "connection_failed"
  if (code === "ETIMEDOUT" || code === "ESOCKET") return "timeout"
  return String(err?.message || err || "smtp_error")
}

function buildWelcomeEmailHTML({ brand, name, email, password, support }: { brand: string; name: string; email: string; password: string; support: string }) {
  const loginUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "") + "/auth/login"
  const contactLine = support ? `Contact us at <a href="mailto:${support}">${support}</a>.` : ""
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${brand} Welcome</title>
    <style>
      * { box-sizing: border-box; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      body { margin:0; padding:0; background:#f7f7f7; font-family: Arial, sans-serif; }
      .wrapper { padding:20px; }
      .container { width:100%; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #eee; padding:28px; }
      .h2 { margin:0 0 8px; color:#1a1a1a; font-size:22px; line-height:1.3; }
      .p { margin:0 0 16px; color:#333; font-size:15px; line-height:1.6; }
      .muted { color:#666; font-size:16px; margin:0 0 24px; }
      .credentials { border:1px solid #e5e5e5; border-radius:8px; padding:16px; margin:0 0 20px; background:#f9fafb; }
      .cta { display:inline-block; margin:12px 0 0; background:#2563eb; color:#fff; text-decoration:none; font-weight:600; font-size:15px; padding:12px 18px; border-radius:8px; }
      .list { margin:0; padding-left:20px; color:#555; line-height:1.8; }
      .note { background:#fef2f2; border-left:3px solid #dc2626; padding:14px; margin:0 0 20px; border-radius:4px; font-size:13px; color:#991b1b; }
      .footer { margin:16px 0 0; color:#666; font-size:14px; }
      .small { color:#999; font-size:12px; }
      @media only screen and (max-width: 480px) {
        .wrapper { padding:12px !important; }
        .container { padding:16px !important; border-radius:10px !important; }
        .h2 { font-size:20px !important; }
        .muted, .p, .list, .credentials p { font-size:14px !important; }
        .cta { display:block !important; width:100% !important; text-align:center !important; padding:12px !important; font-size:16px !important; }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <h2 class="h2">${brand}</h2>
        <p class="muted">Welcome to the team, ${name}!</p>
        <p class="p">We're excited to have you with us. Your account on the Dezprox Employee Management System (EMS) is now active.</p>
        <div class="credentials">
          <p class="p" style="margin:0 0 8px;font-weight:600;color:#333">Your Login Credentials</p>
          <p style="margin:8px 0;color:#555"><strong>Portal:</strong> <a href="https://ems.dezprox.com" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;word-break:break-word">ems.dezprox.com</a></p>
          <p style="margin:8px 0;color:#555"><strong>Username:</strong> ${email}</p>
          <p style="margin:8px 0;color:#555"><strong>Password:</strong> ${password}</p>
        </div>
        <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:14px;margin-bottom:20px;border-radius:4px">
          <p style="margin:0 0 8px;color:#1e40af;font-weight:600;font-size:14px">Getting Started</p>
          <p style="margin:0;color:#1e3a8a;font-size:14px;line-height:1.6">Simply log in with your credentials and you're ready to go. The EMS dashboard gives you everything you need to manage your workday.</p>
        </div>
        <div>
          <p style="margin:0 0 12px;color:#333;font-weight:600">What You Can Do:</p>
          <ul class="list">
            <li><strong>Punch In/Out</strong> — Track your work hours accurately</li>
            <li><strong>Attendance Records</strong> — View your attendance history anytime</li>
            <li><strong>Leave Management</strong> — Submit and track your leave requests</li>
          </ul>
        </div>
        <div class="note">
          <p style="margin:0"><strong>Security Note:</strong> Please keep your login credentials secure and do not share them with anyone.</p>
        </div>
        <p class="p" style="margin:0 0 12px">${contactLine}</p>
        <p class="p">If you experience any login issues or have questions, reach out to our IT support team: <a href="mailto:info@dezprox.com" style="color:#2563eb;text-decoration:none">info@dezprox.com</a></p>
        <p class="p" style="margin:20px 0 0">We're excited to have you on the team. Let's make great things happen together!</p>
        <p class="footer">Best regards,<br/><strong> ${brand} Administration</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p class="small">© ${new Date().getFullYear()} <a href="https://dezprox.com" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none"> ${brand} </a>. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`
}
