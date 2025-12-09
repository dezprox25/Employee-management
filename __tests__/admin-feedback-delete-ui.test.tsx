import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { DashboardHeader } from "@/components/DashboardHeader"

vi.mock("@/lib/supabase/client", () => {
  const selectFeedback = {
    data: [
      {
        feedback_id: 1,
        user_id: "u1",
        feedback_text: "Issue with punch in",
        submission_date: new Date().toISOString(),
        status: "pending",
        attachment_path: null,
        contact_email: null,
      },
      {
        feedback_id: 2,
        user_id: "u2",
        feedback_text: "Resolved: UI glitch",
        submission_date: new Date().toISOString(),
        status: "resolved",
        attachment_path: null,
        contact_email: null,
      },
      {
        feedback_id: 3,
        user_id: "u3",
        feedback_text: "Reviewed: wording fix",
        submission_date: new Date().toISOString(),
        status: "reviewed",
        attachment_path: null,
        contact_email: null,
      },
    ],
  }
  const from = (table: string) => {
    if (table === "feedback") {
      return {
        select: () => ({ order: () => ({ limit: () => selectFeedback }) }),
      }
    }
    if (table === "users") {
      return { select: () => ({ in: () => ({ data: [] }), eq: () => ({ single: () => ({ data: { name: "User" } }) }) }) }
    }
    return { select: () => ({}) }
  }
  const channel = () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })
  const storage = { from: vi.fn().mockReturnValue({ getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/file" } }) }) }
  const removeChannel = vi.fn()
  return { createClient: () => ({ from, channel, storage, removeChannel }) }
})

const props = {
  lastUpdated: null,
  setLastUpdated: () => {},
  timeRange: "weekly" as const,
  setTimeRange: () => {},
  refreshInterval: 60,
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

describe.skip("Admin feedback deletion UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: any) => {
      if (url.includes("/api/admin/delete-feedback")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url.includes("/api/admin/clear-feedback")) {
        return new Response(JSON.stringify({ ok: true, deleted: 2 }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))
  })

  it("deletes a single feedback item after confirmation", async () => {
    render(<DashboardHeader {...props} />)
    const trigger = await screen.findByRole("button", { name: /Open feedback/i })
    fireEvent.click(trigger)
    await waitFor(() => expect(screen.getByText(/Issue with punch in/i)).toBeDefined())

    const deleteBtn = await screen.findByTitle(/Delete feedback/i)
    fireEvent.click(deleteBtn)
    const confirm = await screen.findByText(/Delete/i)
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(screen.queryByText(/Issue with punch in/i)).toBeNull()
    })
  })

  it("clears resolved/reviewed feedback in bulk", async () => {
    render(<DashboardHeader {...props} />)
    const trigger = await screen.findByRole("button", { name: /Open feedback/i })
    fireEvent.click(trigger)
    await waitFor(() => expect(screen.getByText(/Resolved: UI glitch/i)).toBeDefined())

    const clearBtn = await screen.findByRole("button", { name: /Clear all feedback/i })
    fireEvent.click(clearBtn)
    await waitFor(() => expect(screen.getByText(/resolved or reviewed/i)).toBeDefined())
    const proceed = await screen.findByText(/Proceed/i)
    fireEvent.click(proceed)

    await waitFor(() => {
      expect(screen.queryByText(/Resolved: UI glitch/i)).toBeNull()
      expect(screen.queryByText(/Reviewed: wording fix/i)).toBeNull()
    })
  })
})
