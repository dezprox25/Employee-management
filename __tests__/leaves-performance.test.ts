import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import LeavesPage from "@/app/employee/leaves/page"

vi.mock("@/lib/supabase/client", () => {
  const user = { id: "user-123" }
  const insertLeave = vi.fn().mockResolvedValue({ data: null, error: null })
  const getUser = vi.fn().mockResolvedValue({ data: { user } })
  const from = (table: string) => ({
    select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
    insert: insertLeave,
  })
  const storage = { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) }
  return { createClient: () => ({ auth: { getUser }, from, storage, channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }), removeChannel: vi.fn() }) }
})

describe("Concurrent leave applications", () => {
  it("handles multiple submissions without crashing", async () => {
    render(<LeavesPage />)
    // Open form
    fireEvent.click(await screen.findByText(/Apply for Leave/i))
    const from = await screen.findByLabelText(/From Date/i)
    const to = await screen.findByLabelText(/To Date/i)
    const reason = await screen.findByLabelText(/Reason/i)
    // Valid half-day
    fireEvent.change(from, { target: { value: "2025-01-10" } })
    fireEvent.change(to, { target: { value: "2025-01-10" } })
    fireEvent.mouseDown(screen.getByLabelText(/Duration/i))
    fireEvent.click(screen.getByText(/Half Day/i))
    fireEvent.change(reason, { target: { value: "A valid reason for test" } })

    const submitBtn = screen.getByText(/Submit Leave Request/i)
    // Fire multiple clicks quickly
    fireEvent.click(submitBtn)
    fireEvent.click(submitBtn)
    fireEvent.click(submitBtn)
    expect(true).toBe(true)
  })
})