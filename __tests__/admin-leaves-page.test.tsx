import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import AdminLeavesPage from "@/app/admin/leaves/page"
import { Toaster } from "@/components/ui/toaster"

// Mock supabase browser client for admin
vi.mock("@/lib/supabase/client", () => {
  const user = { id: "admin-1" }
  const getUser = vi.fn().mockResolvedValue({ data: { user } })
  const selectLeaves = vi.fn().mockResolvedValue({
    data: [
      {
        id: "leave-1",
        user_id: "user-123",
        from_date: "2025-01-10",
        to_date: "2025-01-11",
        category: "vacation",
        duration: "full-day",
        status: "pending",
        reason: "trip",
        applied_at: new Date().toISOString(),
        decision_at: null,
        admin_comment: null,
        document_url: null,
      },
    ],
    error: null,
  })
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = (table: string) => ({
    select: (s: string) => ({ order: () => selectLeaves, eq: () => ({ single: () => ({ data: { role: "admin" } }) }) }),
  })
  const channel = () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })
  return { createClient: () => ({ auth: { getUser }, from, rpc, channel }) }
})

describe("Admin Leaves Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists leaves and triggers approve flow", async () => {
    render(
      <>
        <AdminLeavesPage />
        <Toaster />
      </>,
    )
    expect(await screen.findByText(/Manage Leave Requests/i)).toBeInTheDocument()
    expect(await screen.findByText(/user-123/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Approve/i))
    // Modal opens
    expect(await screen.findByText(/Approve Leave/i)).toBeInTheDocument()
  })
})