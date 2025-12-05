import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { rateLimitCheck } from "@/lib/security/api"
import crypto from "crypto"

const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]) 
const MAX_FILE_BYTES = 5 * 1024 * 1024

function validEmail(email: string) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}

function encryptEmail(email: string): string | null {
  try {
    const secret = process.env.FEEDBACK_ENCRYPTION_SECRET || ""
    if (!secret) return null
    const key = crypto.createHash("sha256").update(secret).digest() // 32 bytes
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const ciphertext = Buffer.concat([cipher.update(email, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, ciphertext]).toString("base64")
  } catch {
    return null
  }
}

async function parseBody(req: Request): Promise<{
  feedback_text: string
  contact_email?: string | null
  file?: File | null
  attachment_url?: string | null
}> {
  const ct = req.headers.get("content-type") || ""
  if (ct.includes("application/json")) {
    const json = await req.json().catch(() => ({}))
    return {
      feedback_text: String(json.feedback_text || ""),
      contact_email: json.contact_email ? String(json.contact_email) : null,
      file: null,
      attachment_url: json.attachment_url ? String(json.attachment_url) : null,
    }
  }
  const fd = await req.formData()
  const file = (fd.get("file") as File) || null
  return {
    feedback_text: String(fd.get("feedback_text") || ""),
    contact_email: (fd.get("contact_email") ? String(fd.get("contact_email")) : null),
    file,
    attachment_url: null,
  }
}

export async function POST(req: Request) {
  const rl = rateLimitCheck(req, { windowMs: 60_000, max: 5 })
  if (rl) return rl

  try {
    const server = await createServerClient()
    const {
      data: { user },
    } = await server.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await parseBody(req)
    const text = body.feedback_text?.trim() || ""
    const email = body.contact_email?.trim() || null
    const attachmentUrlFromJson = body.attachment_url || null
    const file = body.file || null

    if (!text) {
      return NextResponse.json({ ok: false, error: "Feedback text is required", code: "VALIDATION_TEXT" }, { status: 400 })
    }
    if (text.length < 10 || text.length > 5000) {
      return NextResponse.json({ ok: false, error: "Feedback length must be 10-5000 chars", code: "VALIDATION_LENGTH" }, { status: 400 })
    }
    if (email && !validEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email format", code: "VALIDATION_EMAIL" }, { status: 400 })
    }

    const svc = createServiceClient()

    let storedPath: string | null = null
    if (file) {
      const contentType = file.type || "application/octet-stream"
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return NextResponse.json({ ok: false, error: "Unsupported file type", code: "VALIDATION_FILE_TYPE" }, { status: 400 })
      }
      const size = (file as any).size ?? 0
      if (size > MAX_FILE_BYTES) {
        return NextResponse.json({ ok: false, error: "File too large", code: "VALIDATION_FILE_SIZE" }, { status: 400 })
      }
      const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `${user.id}/fb-${Date.now()}-${safeName}`
      const { data, error } = await svc.storage.from("feedback_attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType,
      })
      if (error) {
        return NextResponse.json({ ok: false, error: error.message, code: "UPLOAD_FAILED" }, { status: 500 })
      }
      storedPath = data.path
    } else if (attachmentUrlFromJson) {
      storedPath = attachmentUrlFromJson
    }

    const enc = email ? encryptEmail(email) : null

    const { error: insertErr } = await server.from("feedback").insert({
      user_id: user.id,
      feedback_text: text,
      contact_email: email || null,
      contact_email_enc: enc,
      attachment_path: storedPath,
    })
    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message, code: "INSERT_FAILED" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 })
  }
}
