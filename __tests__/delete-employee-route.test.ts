import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/admin/delete-employee/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeRequest(body: any, cookie?: string) {
  return new Request("http://localhost/api/admin/delete-employee", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

const serverMock: any = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}
const serviceMock: any = {
  auth: { admin: { deleteUser: vi.fn() } },
  from: vi.fn(),
}

beforeEach(() => {
  vi.resetAllMocks()
  ;(createServerClient as any).mockResolvedValue(serverMock)
  ;(createServiceClient as any).mockReturnValue(serviceMock)

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } })
  const serverFromSelectSingle = vi.fn().mockResolvedValue({ data: { role: "admin" } })
  serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: serverFromSelectSingle }) }) })

  const svcSelectSingle = vi.fn().mockResolvedValue({ data: { id: "u1", role: "employee" } })
  serviceMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: svcSelectSingle }) }) })
})

describe("delete-employee route", () => {
  it("returns 400 for missing user_id", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("VALIDATION_MISSING")
  })

  it("returns 401 when not authenticated", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ user_id: "u1" }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe("AUTH_UNAUTHORIZED")
  })

  it("returns 403 when current user is not admin", async () => {
    const single = vi.fn().mockResolvedValue({ data: { role: "employee" } })
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) })
    const res = await POST(makeRequest({ user_id: "u1" }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("NOT_ADMIN")
  })

  it("returns 403 when target is admin", async () => {
    const svcSingle = vi.fn().mockResolvedValue({ data: { id: "u2", role: "admin" } })
    serviceMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: svcSingle }) }) })
    const res = await POST(makeRequest({ user_id: "u2" }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("FORBIDDEN_TARGET")
  })

  it("returns 403 when deleting self", async () => {
    const svcSingle = vi.fn().mockResolvedValue({ data: { id: "admin-id", role: "employee" } })
    serviceMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: svcSingle }) }) })
    const res = await POST(makeRequest({ user_id: "admin-id" }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("FORBIDDEN_SELF")
  })

  it("deletes employee successfully", async () => {
    serviceMock.auth.admin.deleteUser.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ user_id: "u1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it("allows code-admin bypass via cookie", async () => {
    // Not logged in but has code-admin cookie
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    serviceMock.auth.admin.deleteUser.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ user_id: "u1" }, "admin_code_login=true"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})