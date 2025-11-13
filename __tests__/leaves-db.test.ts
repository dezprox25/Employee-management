import { describe, it, expect } from "vitest"
import { createServiceClient } from "@/lib/supabase/service"

// This test validates that RPC functions exist and return controlled errors
// Skips if service role env is not configured

const hasServiceEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

describe.skipIf(!hasServiceEnv)("Leaves RPC functions", () => {
  const svc = createServiceClient()

  it("approve_leave returns error for non-existent leave", async () => {
    const { error } = await svc.rpc("approve_leave", { leave_id_input: "00000000-0000-0000-0000-000000000000", comment_input: "test" })
    expect(error).toBeTruthy()
  })

  it("reject_leave returns error for non-existent leave", async () => {
    const { error } = await svc.rpc("reject_leave", { leave_id_input: "00000000-0000-0000-0000-000000000000", comment_input: "test" })
    expect(error).toBeTruthy()
  })
})