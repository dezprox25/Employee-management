import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import LeavesPage from "@/app/employee/leaves/page"
import { Toaster } from "@/components/ui/toaster"

// Mock supabase browser client
vi.mock("@/lib/supabase/client", () => {
  const user = { id: "user-123" }
  const selectLeaves = vi.fn().mockResolvedValue({ data: [], error: null })
  const insertLeave = vi.fn().mockResolvedValue({ data: null, error: null })
  const getUser = vi.fn().mockResolvedValue({ data: { user } })
  const storage = {
    from: () => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "user-123/leave-1.pdf" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/file.pdf" } }),
    }),
  }
  const channel = () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() })
  const removeChannel = vi.fn()
  const from = (table: string) => ({
    select: (s: string) => ({ eq: (col: string, val: string) => ({ order: () => ({ data: [], error: null }) }) }),
    insert: insertLeave,
  })
  return {
    createClient: () => ({ auth: { getUser }, from, storage, channel, removeChannel }),
  }
})

describe("Employee Leaves Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders and shows empty state", async () => {
    render(
      <>
        <LeavesPage />
        <Toaster />
      </>,
    )
    expect(await screen.findByText(/My Leaves/i)).toBeInTheDocument()
    expect(await screen.findByText(/No leave requests yet/i)).toBeInTheDocument()
  })

  it("validates half-day date range", async () => {
    render(
      <>
        <LeavesPage />
        <Toaster />
      </>,
    )
    fireEvent.click(await screen.findByText(/Apply for Leave/i))
    // fill form
    const from = await screen.findByLabelText(/From Date/i)
    const to = await screen.findByLabelText(/To Date/i)
    fireEvent.change(from, { target: { value: "2025-01-10" } })
    fireEvent.change(to, { target: { value: "2025-01-11" } })
    // duration = half-day
    fireEvent.mouseDown(screen.getByLabelText(/Duration/i))
    fireEvent.click(screen.getByText(/Half Day/i))
    const reason = await screen.findByLabelText(/Reason/i)
    fireEvent.change(reason, { target: { value: "short reason" } })

    fireEvent.click(screen.getByText(/Submit Leave Request/i))
    await waitFor(() => {
      expect(screen.getByText(/Half-day leave must have the same start and end date/i)).toBeInTheDocument()
    })
  })
})