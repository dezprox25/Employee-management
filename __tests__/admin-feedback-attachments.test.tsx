import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { DashboardHeader } from "@/components/DashboardHeader"

vi.mock("@/lib/supabase/client", () => {
  const selectLeaves = { data: [] }
  const selectAttendance = { data: [] }
  const selectUsers = { data: [] }
  const selectFeedback = {
    data: [
      {
        feedback_id: 1,
        user_id: "u1",
        feedback_text: "Issue with punch in",
        submission_date: new Date().toISOString(),
        status: "pending",
        attachment_path: "u1/fb-1-image.png",
        contact_email: "user@example.com",
      },
      {
        feedback_id: 2,
        user_id: "u2",
        feedback_text: "Document attached",
        submission_date: new Date().toISOString(),
        status: "reviewed",
        attachment_path: "u2/fb-2-report.pdf",
        contact_email: "invalid@",
      },
    ],
  }
  const from = (table: string) => {
    if (table === "feedback") {
      return {
        select: () => ({ order: () => ({ limit: () => selectFeedback }) }),
      }
    }
    if (table === "leaves") {
      return { select: () => ({ order: () => ({ limit: () => selectLeaves }) }) }
    }
    if (table === "attendance") {
      return { select: () => ({ order: () => ({ limit: () => selectAttendance }) }) }
    }
    if (table === "users") {
      return { select: () => ({ in: () => selectUsers, eq: () => ({ single: () => ({ data: { name: "User" } }) }) }) }
    }
    return { select: () => ({}) }
  }
  const channel = () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })
  const storage = { from: vi.fn().mockReturnValue({ getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/file" } }) }) }
  const removeChannel = vi.fn()
  return { createClient: () => ({ from, channel, storage, removeChannel }) }
})

describe("Admin feedback attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).open = vi.fn()
  })

  function mount() {
    const props: any = {
      lastUpdated: null,
      setLastUpdated: () => {},
      timeRange: "weekly",
      setTimeRange: () => {},
      refreshInterval: 0,
      setRefreshInterval: () => {},
      setLoading: () => {},
      setStats: () => {},
      setAttendanceTrends: () => {},
      setLatePatterns: () => {},
      setLeaveBreakdown: () => {},
      setTypeDistribution: () => {},
      error: null,
      setError: () => {},
    }
    render(<DashboardHeader {...props} />)
  }

  it("shows email mailto link when valid", async () => {
    mount()
    const trigger = await screen.findByRole("button", { name: /Open feedback/i })
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByText("Issue with punch in")).toBeDefined()
    })
    const link = await screen.findByRole("link", { name: /user@example.com/i })
    expect(link).toHaveAttribute("href", "mailto:user@example.com")
  })

  it("opens image preview dialog", async () => {
    mount()
    const trigger = await screen.findByRole("button", { name: /Open feedback/i })
    fireEvent.click(trigger)
    const btn = await screen.findByText(/fb-1-image\.png/i)
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByAltText(/fb-1-image\.png/i)).toBeDefined()
    })
  })

  it("opens document in new tab", async () => {
    mount()
    const trigger = await screen.findByRole("button", { name: /Open feedback/i })
    fireEvent.click(trigger)
    const btn = await screen.findByText(/fb-2-report\.pdf/i)
    fireEvent.click(btn)
    await waitFor(() => {
      expect((window as any).open).toHaveBeenCalled()
    })
  })
})
