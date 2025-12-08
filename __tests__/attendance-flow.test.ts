import { describe, it, expect } from "vitest"
import { isFutureTimestamp, computeTotalHours, closeLatestOpenSession } from "@/app/employee/dashboard/client"

describe("attendance flow helpers", () => {
  it("multiple punch-outs create separate records", () => {
    const now1 = new Date("2025-01-01T09:00:00Z").toISOString()
    const now2 = new Date("2025-01-01T13:00:00Z").toISOString()
    const rows = [
      { id: 1, login_time: now1, logout_time: undefined },
    ]
    const afterFirstOut = closeLatestOpenSession(rows, new Date("2025-01-01T12:00:00Z").toISOString())
    expect(afterFirstOut[0].logout_time).toBe("2025-01-01T12:00:00.000Z")

    const withSecondIn = [...afterFirstOut, { id: 2, login_time: now2, logout_time: undefined }]
    const afterSecondOut = closeLatestOpenSession(withSecondIn, new Date("2025-01-01T18:00:00Z").toISOString())
    expect(afterSecondOut[0].logout_time).toBe("2025-01-01T12:00:00.000Z")
    expect(afterSecondOut[1].logout_time).toBe("2025-01-01T18:00:00.000Z")
  })

  it("time sequence validation returns non-negative total hours", () => {
    const login = new Date("2025-01-01T10:00:00Z").toISOString()
    const earlier = new Date("2025-01-01T09:00:00Z").toISOString()
    expect(computeTotalHours(login, earlier)).toBe(0)
    const later = new Date("2025-01-01T11:00:00Z").toISOString()
    expect(computeTotalHours(login, later)).toBeCloseTo(1, 5)
  })

  it("future timestamp detection works", () => {
    const future = new Date(Date.now() + 120000).toISOString()
    const past = new Date(Date.now() - 120000).toISOString()
    expect(isFutureTimestamp(future)).toBe(true)
    expect(isFutureTimestamp(past)).toBe(false)
  })
})
