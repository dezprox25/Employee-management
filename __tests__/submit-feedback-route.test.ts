import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/employee/submit-feedback/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeJsonRequest(body: any) {
  return new Request("http://localhost/api/employee/submit-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeFormRequest(fd: FormData) {
  return new Request("http://localhost/api/employee/submit-feedback", {
    method: "POST",
    body: fd as any,
  })
}

const serverMock: any = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}
const serviceMock: any = {
  storage: { from: vi.fn() },
}

beforeEach(() => {
  vi.resetAllMocks()
  ;(createServerClient as any).mockResolvedValue(serverMock)
  ;(createServiceClient as any).mockReturnValue(serviceMock)

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "u-1" } } })
  const insert = vi.fn().mockResolvedValue({ error: null })
  serverMock.from.mockReturnValue({ insert })
  const upload = vi.fn().mockResolvedValue({ data: { path: "u-1/fb-123-file.png" }, error: null })
  serviceMock.storage.from.mockReturnValue({ upload, getPublicUrl: vi.fn() })
})

describe("submit-feedback route", () => {
  it("rejects unauthenticated requests", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeJsonRequest({ feedback_text: "hello world" }))
    expect(res.status).toBe(401)
  })

  it("validates feedback length", async () => {
    const res = await POST(makeJsonRequest({ feedback_text: "short" }))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.code).toBe("VALIDATION_LENGTH")
  })

  it("validates email", async () => {
    const res = await POST(makeJsonRequest({ feedback_text: "This is valid feedback description.", contact_email: "bad@" }))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.code).toBe("VALIDATION_EMAIL")
  })

  it("inserts feedback without attachment", async () => {
    const res = await POST(makeJsonRequest({ feedback_text: "This is valid feedback description.", contact_email: "user@example.com" }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
  })

  it("uploads attachment and inserts record", async () => {
    const res = await POST(makeJsonRequest({ feedback_text: "This is valid feedback description.", attachment_url: "u-1/fb-123-file.png" }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
  })
})
