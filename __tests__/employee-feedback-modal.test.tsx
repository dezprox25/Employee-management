import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { DashboardHeader } from "@/components/employee/DashboardHeader"

const toastSpy = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

describe("Employee feedback modal", () => {
beforeEach(() => {
  vi.clearAllMocks()
  ;(global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
})

  it("submits feedback and shows success toast", async () => {
    render(<DashboardHeader onMenuClick={() => {}} />)

    const openBtn = await screen.findByLabelText(/Open feedback form/i)
    fireEvent.click(openBtn)

    const desc = await screen.findByPlaceholderText(/Describe the issue/i)
    fireEvent.change(desc, { target: { value: "Test issue details" } })

    const submit = await screen.findByRole('button', { name: /Submit/i })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled()
      const calls = toastSpy.mock.calls
      const success = calls.find(([arg]) => arg?.title?.toString().includes("Feedback submitted"))
      expect(success).toBeTruthy()
    })
  })
})
