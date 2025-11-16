import { createServiceClient } from "@/lib/supabase/service"

/**
 * Worker that detects stale heartbeats and auto-punches out employees.
 * Run this periodically (e.g., every 15 seconds via cron or persistent setInterval).
 */

const STALE_MS = 30_000 // 30 seconds — if no heartbeat in this time, mark as offline
const supabase = createServiceClient()

async function findStaleEmployees() {
  try {
    // Get all employees with status = IN
    const { data: activeEmployees, error: fetchErr } = await supabase
      .from("employee_status")
      .select("employee_id, last_seen, status")
      .eq("status", "IN")

    if (fetchErr) {
      console.error("[worker] Failed to fetch active employees", fetchErr)
      return
    }

    if (!activeEmployees || activeEmployees.length === 0) {
      console.debug("[worker] No active employees found")
      return
    }

    const now = new Date()
    const nowIso = now.toISOString()

    for (const employee of activeEmployees) {
      const lastSeenTime = new Date(employee.last_seen || 0).getTime()
      const nowTime = now.getTime()
      const staleDuration = nowTime - lastSeenTime

      if (staleDuration > STALE_MS) {
        console.info(`[worker] Detected stale heartbeat: ${employee.employee_id} (${staleDuration}ms)`)

        // Double-check that the employee is still IN (avoid race conditions)
        const { data: currentStatus, error: checkErr } = await supabase
          .from("employee_status")
          .select("status")
          .eq("employee_id", employee.employee_id)
          .single()

        if (checkErr || !currentStatus) {
          console.warn("[worker] Failed to fetch current status", checkErr)
          continue
        }

        if (currentStatus.status !== "IN") {
          console.debug("[worker] Employee already out, skipping")
          continue
        }

        // Check if there's already a recent AUTO_OUT punch for this employee (idempotency)
        const fiveSecondsAgo = new Date(nowTime - 5000).toISOString()
        const { data: recentPunches, error: recentErr } = await supabase
          .from("punches")
          .select("id, type, at")
          .eq("employee_id", employee.employee_id)
          .eq("type", "AUTO_OUT")
          .gte("at", fiveSecondsAgo)
          .order("at", { ascending: false })
          .limit(1)

        if (recentErr) {
          console.warn("[worker] Failed to check recent punches", recentErr)
          continue
        }

        if (recentPunches && recentPunches.length > 0) {
          console.debug("[worker] AUTO_OUT already recorded recently, skipping")
          continue
        }

        // Insert AUTO_OUT punch record
        const { error: insertErr } = await supabase
          .from("punches")
          .insert({
            employee_id: employee.employee_id,
            type: "AUTO_OUT",
            at: nowIso,
            meta: {
              reason: "heartbeat_stale",
              stale_duration_ms: staleDuration,
            },
          })

        if (insertErr) {
          console.error(`[worker] Failed to insert AUTO_OUT punch for ${employee.employee_id}`, insertErr)
          continue
        }

        // Update employee_status to OUT
        const { error: updateErr } = await supabase
          .from("employee_status")
          .update({
            status: "OUT",
            updated_at: nowIso,
          })
          .eq("employee_id", employee.employee_id)

        if (updateErr) {
          console.error(`[worker] Failed to update status to OUT for ${employee.employee_id}`, updateErr)
          continue
        }

        console.info(`[worker] Auto-punched out ${employee.employee_id} at ${nowIso}`)
      }
    }
  } catch (err: any) {
    console.error("[worker] Unexpected error in stale detection", err)
  }
}

// If running as a persistent server process:
// setInterval(findStaleEmployees, 15000);

// Export as a function for serverless cron or direct invocation
export async function checkStaleHeartbeats() {
  await findStaleEmployees()
}

// Uncomment below if running this file directly as a Node script
// findStaleEmployees().then(() => process.exit(0));
