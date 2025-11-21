import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock server and service clients
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
  }
})

vi.mock("@/lib/supabase/service", () => {
  return {
    createServiceClient: vi.fn(),
  }
})

import { POST } from "@/app/api/admin/create-employee/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeRequest(body: any) {
  return new Request("http://localhost/api/admin/create-employee", {
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
  auth: { admin: { createUser: vi.fn() } },
  from: vi.fn(),
}

beforeEach(() => {
  vi.resetAllMocks()
  ;(createServerClient as any).mockResolvedValue(serverMock)
  ;(createServiceClient as any).mockReturnValue(serviceMock)

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } })
  const serverFromSelectSingle = vi.fn().mockResolvedValue({ data: { role: "admin" } })
  serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: serverFromSelectSingle }) }) })
})

describe("create-employee route", () => {
  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ email: "bad", password: "secret1", name: "John", position: "Developer" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("VALIDATION_EMAIL")
  })

  it("returns 400 for missing position", async () => {
    const res = await POST(makeRequest({ email: "john@example.com", password: "StrongPass1", name: "John", position: "" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("VALIDATION_POSITION")
  })

  it("returns 401 when not logged in", async () => {
    serverMock.auth.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ email: "john@example.com", password: "StrongPass1", name: "John", position: "Developer" }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe("AUTH_UNAUTHORIZED")
  })

  it("returns 403 when current user is not admin", async () => {
    const serverFromSelectSingle = vi.fn().mockResolvedValue({ data: { role: "employee" } })
    serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: serverFromSelectSingle }) }) })
    const res = await POST(makeRequest({ email: "john@example.com", password: "StrongPass1", name: "John", position: "Developer" }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe("AUTH_FORBIDDEN")
  })

  it("creates user successfully and returns ok", async () => {
    // createUser succeeds
    serviceMock.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-user-id" } }, error: null })
    // Trigger has created public.users row
    const singleSelect = vi.fn().mockResolvedValue({ data: { id: "new-user-id" } })
    const eq = vi.fn().mockReturnValue({ single: singleSelect })
    const select = vi.fn().mockReturnValue({ eq })
    serviceMock.from.mockReturnValue({ select })

    const res = await POST(makeRequest({ email: "john@example.com", password: "secret12", name: "John", position: "Engineer", type: "fulltime" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.user_id).toBe("new-user-id")
  })

  it("falls back to insert into public.users when trigger did not run", async () => {
    // createUser succeeds
    serviceMock.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-user-id" } }, error: null })
    // No user row yet
    const singleSelect = vi.fn().mockResolvedValue({ data: null })
    const eq = vi.fn().mockReturnValue({ single: singleSelect })
    const select = vi.fn().mockReturnValue({ eq })
    const insert = vi.fn().mockResolvedValue({ error: null })
    serviceMock.from.mockImplementation((table: string) => {
      if (table === "users") {
        return { select, insert }
      }
      return { select }
    })

    const res = await POST(makeRequest({ email: "john@example.com", password: "secret12", name: "John", position: "Intern", type: "intern1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.user_id).toBe("new-user-id")
    expect(insert).toHaveBeenCalled()
  })

  it("returns 400 when createUser fails (duplicate email)", async () => {
    serviceMock.auth.admin.createUser.mockResolvedValue({ data: {}, error: { message: "User already registered" } })
    const res = await POST(makeRequest({ email: "john@example.com", password: "secret12", name: "John", position: "Developer" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/User already registered/)
    expect(json.code).toBe("CREATE_USER_FAILED")
  })

  it("returns 500 when fallback insert fails", async () => {
    serviceMock.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-user-id" } }, error: null })
    const singleSelect = vi.fn().mockResolvedValue({ data: null })
    const eq = vi.fn().mockReturnValue({ single: singleSelect })
    const select = vi.fn().mockReturnValue({ eq })
    const insert = vi.fn().mockResolvedValue({ error: { message: "insert failed" } })
    serviceMock.from.mockImplementation((table: string) => {
      if (table === "users") {
        return { select, insert }
      }
      return { select }
    })

    const res = await POST(makeRequest({ email: "john@example.com", password: "StrongPass1", name: "John", position: "Developer" }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.code).toBe("DB_INSERT_FAILED")
  })
})