import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/admin/delete-feedback/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeReq(body: any, cookie?: string) {
  return new Request("http://localhost/api/admin/delete-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe("delete-feedback route", () => {
  const serverMock: any = { auth: { getUser: vi.fn() }, from: vi.fn() }
  const serviceMock: any = { from: vi.fn(), storage: { from: vi.fn() } }

  beforeEach(() => {
    vi.resetAllMocks()
    ;(createServerClient as any).mockResolvedValue(serverMock)
    ;(createServiceClient as any).mockReturnValue(serviceMock)
    serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
    const sel = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { feedback_id: 1, attachment_path: "u1/fb-1.png" }, error: null }) }) })
    const del = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) })
    serviceMock.from.mockImplementation((table: string) => {
      if (table === "feedback") return { select: sel, delete: del }
      return { select: sel, delete: del }
    })
    serviceMock.storage.from.mockReturnValue({ remove: vi.fn().mockResolvedValue({ data: null, error: null }) })
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "admin" } }) }) }) })
  })

  it("rejects non-admin", async () => {
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "employee" } }) }) }) })
    const res = await POST(makeReq({ feedback_id: 1 }))
    expect(res.status).toBe(403)
  })

  it("deletes feedback and attachment", async () => {
    const res = await POST(makeReq({ feedback_id: 1 }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
  })

  it("accepts code-admin bypass", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ feedback_id: 1 }, "admin_code_login=true"))
    expect(res.status).toBe(200)
  })
})

