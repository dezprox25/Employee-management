import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// Mock router, toast, and supabase client
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "admin" } }) }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {}
  }),
}))

import EmployeesPage from "@/app/admin/employees/page"

beforeEach(() => {
  document.cookie = "admin_code_login=true"
})

describe("EmployeesPage view mode toggle", () => {
  it("shows list view with password column when toggled", async () => {
    // Initialize URL with view=list to render list view without interacting with Select
    window.history.pushState({}, "", "/admin/employees?view=list")
    render(<EmployeesPage />)
    const passwordHeader = await screen.findByText(/Password/i)
    expect(passwordHeader).toBeInTheDocument()
  })
})