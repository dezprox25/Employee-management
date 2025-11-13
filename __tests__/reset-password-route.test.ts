import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/admin/reset-password/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeRequest(body: any) {
  return new Request("http://localhost/api/admin/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const serverMock: any = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}
const serviceMock: any = {
  auth: { admin: { updateUserById: vi.fn() } },
}

beforeEach(() => {
  vi.resetAllMocks()
  ;(createServerClient as any).mockResolvedValue(serverMock)
  ;(createServiceClient as any).mockReturnValue(serviceMock)

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } })
  const serverFromSelectSingle = vi.fn().mockResolvedValue({ data: { role: "admin" } })
  serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: serverFromSelectSingle }) }) })
})

describe("reset-password route", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("VALIDATION_MISSING")
  })

  it("returns 400 for weak password", async () => {
    const res = await POST(makeRequest({ user_id: "u1", new_password: "123" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("VALIDATION_PASSWORD")
  })

  it("returns 401 when not logged in", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ user_id: "u1", new_password: "strongpass" }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe("NOT_AUTHENTICATED")
  })

  it("returns 403 when current user is not admin", async () => {
    const single = vi.fn().mockResolvedValue({ data: { role: "employee" } })
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) })
    const res = await POST(makeRequest({ user_id: "u1", new_password: "strongpass" }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("NOT_ADMIN")
  })

  it("updates password successfully", async () => {
    serviceMock.auth.admin.updateUserById.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ user_id: "u1", new_password: "strongpass" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})