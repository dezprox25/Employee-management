import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/admin/clear-feedback/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeReq(body: any, cookie?: string) {
  return new Request("http://localhost/api/admin/clear-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe("clear-feedback route", () => {
  const serverMock: any = { auth: { getUser: vi.fn() }, from: vi.fn() }
  const serviceMock: any = { from: vi.fn(), storage: { from: vi.fn() } }

  beforeEach(() => {
    vi.resetAllMocks()
    ;(createServerClient as any).mockResolvedValue(serverMock)
    ;(createServiceClient as any).mockReturnValue(serviceMock)
    serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "admin" } }) }) }) })
    const select = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [ { feedback_id: 1, attachment_path: "u1/a.png" }, { feedback_id: 2, attachment_path: null } ], error: null }) })
    const del = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) })
    serviceMock.from.mockImplementation((table: string) => ({ select, delete: del }))
    serviceMock.storage.from.mockReturnValue({ remove: vi.fn().mockResolvedValue({ data: null, error: null }) })
  })

  it("clears resolved/reviewed feedback", async () => {
    const res = await POST(makeReq({ statuses: ["resolved", "reviewed"] }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
    expect(j.deleted).toBe(2)
  })

  it("rejects non-admin", async () => {
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "employee" } }) }) }) })
    const res = await POST(makeReq({ statuses: ["resolved"] }))
    expect(res.status).toBe(403)
  })
})

