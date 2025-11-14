import { describe, it, expect } from "vitest"
import { formatLeaveUsage } from "@/lib/utils"

describe("formatLeaveUsage", () => {
  it("formats basic numbers", () => {
    expect(formatLeaveUsage(0, 12)).toBe("0/12")
    expect(formatLeaveUsage(5, 12)).toBe("5/12")
    expect(formatLeaveUsage(12, 12)).toBe("12/12")
  })

  it("accepts numeric strings", () => {
    expect(formatLeaveUsage("3", "12")).toBe("3/12")
    expect(formatLeaveUsage("0", "6")).toBe("0/6")
  })

  it("clamps negatives and overflows", () => {
    expect(formatLeaveUsage(-1, 12)).toBe("0/12")
    expect(formatLeaveUsage(20, 12)).toBe("12/12")
  })

  it("floors decimals", () => {
    expect(formatLeaveUsage(2.9, 11.7)).toBe("2/11")
  })

  it("handles invalids gracefully", () => {
    expect(formatLeaveUsage(undefined, 12)).toBe("-")
    expect(formatLeaveUsage(3, undefined)).toBe("-")
    expect(formatLeaveUsage(null, null)).toBe("-")
    expect(formatLeaveUsage("abc", 10)).toBe("-")
  })
})