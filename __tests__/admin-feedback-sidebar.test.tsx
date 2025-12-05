import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { DashboardHeader } from "@/components/DashboardHeader"

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const mockFeedbackData = [
  { id: "f1", user_id: "u1", category: "punch", description: "Could not punch in", created_at: new Date().toISOString() },
]
const mockUsersData = [{ id: "u1", name: "Alice" }]

const mockChannel = () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() })

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === "feedback") {
          return {
            order: () => ({
              limit: () => Promise.resolve({ data: mockFeedbackData, error: null }),
            }),
          }
        }
        if (table === "users") {
          return {
            in: () => Promise.resolve({ data: mockUsersData, error: null }),
          }
        }
        return { order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }
      },
      eq: () => ({ single: async () => ({ data: { name: "Alice", role: "employee" } }) }),
    }),
    channel: mockChannel,
    removeChannel: vi.fn(),
  }),
}))

describe("Admin feedback sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("opens and shows feedback items", async () => {
    render(
      <DashboardHeader
        lastUpdated={null}
        setLastUpdated={() => {}}
        timeRange="weekly"
        setTimeRange={() => {}}
        refreshInterval={60}
        setRefreshInterval={() => {}}
        setLoading={() => {}}
        setStats={() => {}}
        setAttendanceTrends={() => {}}
        setLatePatterns={() => {}}
        setLeaveBreakdown={() => {}}
        setTypeDistribution={() => {}}
        error={null}
        setError={() => {}}
      />
    )

    const btn = await screen.findByLabelText(/Open feedback/i)
    fireEvent.click(btn)

    const title = await screen.findByText(/Employee Feedback/i)
    expect(title).toBeInTheDocument()

    await waitFor(async () => {
      const item = await screen.findByText(/Alice/i)
      expect(item).toBeInTheDocument()
    })
  })
})
