import { describe, it, expect } from "vitest"
import { inclusiveDaysBetween } from "../lib/date"

describe("inclusiveDaysBetween", () => {
  it("counts 1 day when start equals end", () => {
    expect(inclusiveDaysBetween("2025-01-10", "2025-01-10")).toBe(1)
  })

  it("counts inclusive days for simple range (10 to 12)", () => {
    expect(inclusiveDaysBetween("2025-01-10", "2025-01-12")).toBe(3)
  })

  it("handles ranges across months", () => {
    // Jan 30, Jan 31, Feb 1, Feb 2 -> 4 days
    expect(inclusiveDaysBetween("2025-01-30", "2025-02-02")).toBe(4)
  })

  it("handles ranges across years", () => {
    // Dec 31, Jan 1, Jan 2 -> 3 days
    expect(inclusiveDaysBetween("2024-12-31", "2025-01-02")).toBe(3)
  })

  it("returns 0 when end date is before start date", () => {
    expect(inclusiveDaysBetween("2025-01-12", "2025-01-10")).toBe(0)
  })

  it("returns 0 for invalid dates", () => {
    expect(inclusiveDaysBetween("invalid", "2025-01-10")).toBe(0)
    expect(inclusiveDaysBetween("2025-01-10", "invalid")).toBe(0)
  })
})