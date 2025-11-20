import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))

import { POST } from "@/app/api/employee/auto-punch-out/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeRequest(body: any) {
  return new Request("http://localhost/api/employee/auto-punch-out", {
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
  from: vi.fn(),
}

beforeEach(() => {
  vi.resetAllMocks()
  ;(createServerClient as any).mockResolvedValue(serverMock)
  ;(createServiceClient as any).mockReturnValue(serviceMock)

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } })
  serviceMock.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) })
})

describe("auto-punch-out route", () => {
  it("returns 401 when not authenticated", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ trigger: "logout" }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe("AUTH_REQUIRED")
  })

  it("returns none when no attendance row", async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    serverMock.from.mockReturnValueOnce({ select: vi.fn().mockReturnValue(selectChain) })
    const res = await POST(makeRequest({ trigger: "logout" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe("none")
    expect(json.reason).toBe("no_attendance_row")
  })

  it("returns none when already logged out", async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: "att1", login_time: new Date().toISOString(), logout_time: new Date().toISOString(), status: "present" }], error: null }),
    }
    serverMock.from.mockReturnValueOnce({ select: vi.fn().mockReturnValue(selectChain) })
    const res = await POST(makeRequest({ trigger: "logout" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe("none")
    expect(json.reason).toBe("already_logged_out")
  })

  it("updates attendance when punched in", async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: "att1", login_time: new Date(Date.now() - 60_000).toISOString(), logout_time: null, status: "present" }], error: null }),
    }
    const updateChain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: null }),
    }
    serverMock.from
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue(selectChain) })
      .mockReturnValueOnce({ update: vi.fn().mockReturnValue(updateChain) })

    const res = await POST(makeRequest({ trigger: "logout" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.action).toBe("updated")
  })
})