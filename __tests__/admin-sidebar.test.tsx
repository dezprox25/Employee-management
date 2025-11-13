import { render, screen } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin-sidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/dashboard" }))
// Mock Supabase client to avoid env requirements in tests
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}))

describe("AdminSidebar", () => {
  it("renders key admin links", () => {
    render(<AdminSidebar />)
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Employees/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Leaves/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Attendance/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Reports/i })).toBeInTheDocument()
  })
})