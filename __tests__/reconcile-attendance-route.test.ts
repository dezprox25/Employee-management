import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))

import { POST } from "@/app/api/admin/reconcile-attendance/route"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

function makeRequest(body: any = {}) {
  return new Request("http://localhost/api/admin/reconcile-attendance", {
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

  serverMock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } })
  const serverFromSelectSingle = vi.fn().mockResolvedValue({ data: { role: "admin" } })
  serverMock.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: serverFromSelectSingle }) }) })
})

describe("reconcile-attendance route", () => {
  it("adjusts records to use final pair and flags auto_adjusted", async () => {
    const date = "2025-11-20"
    const rows = [
      { id: "a1", user_id: "u1", date, login_time: `${date}T10:00:00.000Z`, logout_time: `${date}T12:00:00.000Z`, total_hours: 2 },
      { id: "a2", user_id: "u1", date, login_time: `${date}T16:00:00.000Z`, logout_time: `${date}T18:00:00.000Z`, total_hours: 2 },
    ]

    const selectAttendance = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: rows }) }) })
    const selectUsers = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: "u1", work_time_start: "10:00:00", work_time_end: "18:00:00" }] }) })
    const updateAttendance = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const insertAdjust = vi.fn().mockResolvedValue({ error: null })

    serviceMock.from.mockImplementation((table: string) => {
      if (table === "attendance") return { select: selectAttendance, update: updateAttendance }
      if (table === "users") return { select: selectUsers }
      if (table === "attendance_adjustments") return { insert: insertAdjust }
      return { select: vi.fn() }
    })

    const res = await POST(makeRequest({ date }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(updateAttendance).toHaveBeenCalledTimes(1)
    const calls = updateAttendance.mock.calls.map((c) => c[0])
    // Both updates should set logout_time to the latest (18:00) and identical hours from last pair (16:00 -> 18:00 = 2h)
    calls.forEach((payload: any) => {
      expect(payload.auto_adjusted).toBe(true)
      expect(payload.logout_time).toContain("18:00:00")
      expect(payload.total_hours).toBeCloseTo(2, 5)
    })
    expect(insertAdjust).toHaveBeenCalledTimes(1)
  })

  it("falls back to schedule end when no logout recorded and handles overnight", async () => {
    const date = "2025-11-20"
    const rows = [
      { id: "a1", user_id: "u1", date, login_time: `${date}T22:00:00.000Z`, logout_time: null, total_hours: null },
    ]
    const selectAttendance = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: rows }) }) })
    const selectUsers = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: "u1", work_time_start: "22:00:00", work_time_end: "06:00:00" }] }) })
    const updateAttendance = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const insertAdjust = vi.fn().mockResolvedValue({ error: null })

    serviceMock.from.mockImplementation((table: string) => {
      if (table === "attendance") return { select: selectAttendance, update: updateAttendance }
      if (table === "users") return { select: selectUsers }
      if (table === "attendance_adjustments") return { insert: insertAdjust }
      return { select: vi.fn() }
    })

    const res = await POST(makeRequest({ date }))
    expect(res.status).toBe(200)
    expect(updateAttendance).toHaveBeenCalledTimes(1)
    const payload = updateAttendance.mock.calls[0][0]
    // Expect logout time to be next day 06:00
    const lo = new Date(String(payload.logout_time))
    const li = new Date(rows[0].login_time)
    expect(lo.getTime()).toBeGreaterThan(li.getTime())
    // should be next day given overnight schedule
    const loginDay = new Date(date + 'T00:00:00Z')
    const nextDay = new Date(loginDay.getTime() + 24 * 3600 * 1000)
    expect(lo.getUTCDate()).toBe(nextDay.getUTCDate())
    expect(payload.auto_adjusted).toBe(true)
  })
})