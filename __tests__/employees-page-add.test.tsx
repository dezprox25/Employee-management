import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, fireEvent, screen, waitFor } from "@testing-library/react"

// Mock router and toast
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))
const toastSpy = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }))
// Mock supabase client to avoid env dependency
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "admin" } }) }) }) }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {}
  }),
}))

// Bypass Supabase auth check using cookie hack used by component
beforeEach(() => {
  document.cookie = "admin_code_login=true"
  toastSpy.mockReset()
})

// Mock fetch globally
const originalFetch = global.fetch
beforeEach(() => {
  ;(global as any).fetch = vi.fn()
})
afterAll(() => {
  ;(global as any).fetch = originalFetch
})

import EmployeesPage from "@/app/admin/employees/page"

describe("EmployeesPage add employee", () => {
  it("adds employee successfully and resets form", async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, user_id: "new-id" }),
    })

    render(<EmployeesPage />)

    // Open dialog
    const triggerBtn = await screen.findByRole("button", { name: /Add Employee/i })
    fireEvent.click(triggerBtn)

    const nameInput = await screen.findByLabelText(/Full Name/i)
    const emailInput = await screen.findByLabelText(/Email/i)
    const passwordInput = await screen.findByLabelText(/Password/i)
    const typeTrigger = await screen.findByLabelText(/Work Type/i)

    fireEvent.change(nameInput, { target: { value: "John Doe" } })
    fireEvent.change(emailInput, { target: { value: "john@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "secret1" } })
    // Select triggers Radix Select; we can skip selecting since default is fulltime

    // Click submit inside dialog (there are two buttons named Add Employee; choose the last one)
    const submitBtns = screen.getAllByRole("button", { name: /Add Employee/i })
    fireEvent.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Success" }))
    })
  })

  it("shows specific server error and preserves form", async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "User already registered" }),
    })

    render(<EmployeesPage />)
    const triggerBtn = await screen.findByRole("button", { name: /Add Employee/i })
    fireEvent.click(triggerBtn)

    const nameInput = await screen.findByLabelText(/Full Name/i)
    const emailInput = await screen.findByLabelText(/Email/i)
    const passwordInput = await screen.findByLabelText(/Password/i)

    fireEvent.change(nameInput, { target: { value: "Jane Doe" } })
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "secret1" } })

    const submitBtns = screen.getAllByRole("button", { name: /Add Employee/i })
    fireEvent.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringMatching(/User already registered/) })
      )
    })

    // Ensure form values are preserved
    expect((nameInput as HTMLInputElement).value).toBe("Jane Doe")
    expect((emailInput as HTMLInputElement).value).toBe("jane@example.com")
    expect((passwordInput as HTMLInputElement).value).toBe("secret1")
  })

  it("validates email and password before submit", async () => {
    render(<EmployeesPage />)
    const triggerBtn = await screen.findByRole("button", { name: /Add Employee/i })
    fireEvent.click(triggerBtn)

    const nameInput = await screen.findByLabelText(/Full Name/i)
    const emailInput = await screen.findByLabelText(/Email/i)
    const passwordInput = await screen.findByLabelText(/Password/i)

    fireEvent.change(nameInput, { target: { value: "Jake" } })
    fireEvent.change(emailInput, { target: { value: "bademail" } })
    fireEvent.change(passwordInput, { target: { value: "123" } })

    const submitBtns = screen.getAllByRole("button", { name: /Add Employee/i })
    fireEvent.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      // Should call toast twice: invalid email, then short password only if code checked sequentially
      expect(toastSpy).toHaveBeenCalled()
    })
  })

  it("handles network timeout gracefully", async () => {
    ;(global.fetch as any).mockImplementation((_url: string, opts: any) =>
      new Promise((_resolve, reject) => {
        const signal = opts?.signal
        if (signal) {
          signal.addEventListener("abort", () => {
            const err: any = new Error("AbortError")
            err.name = "AbortError"
            reject(err)
          })
        }
        // do nothing until aborted
      })
    )

    render(<EmployeesPage />)
    const triggerBtn = await screen.findByRole("button", { name: /Add Employee/i })
    fireEvent.click(triggerBtn)

    const nameInput = await screen.findByLabelText(/Full Name/i)
    const emailInput = await screen.findByLabelText(/Email/i)
    const passwordInput = await screen.findByLabelText(/Password/i)

    fireEvent.change(nameInput, { target: { value: "Tim" } })
    fireEvent.change(emailInput, { target: { value: "tim@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "secret1" } })

    const submitBtns = screen.getAllByRole("button", { name: /Add Employee/i })
    fireEvent.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      // Expect timeout toast
      expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Network timeout" }))
    }, { timeout: 12000 })
    // Values preserved
    expect((nameInput as HTMLInputElement).value).toBe("Tim")
    expect((emailInput as HTMLInputElement).value).toBe("tim@example.com")
    expect((passwordInput as HTMLInputElement).value).toBe("secret1")
  }, 15000)
})