import { NextResponse } from "next/server"
import { checkStaleHeartbeats } from "@/lib/workers/stale-heartbeat-worker"

/**
 * Serverless endpoint for triggering the stale heartbeat check.
 * Can be called by an external cron service (Vercel Cron, GitHub Actions, etc.)
 * Requires CRON_SECRET header to prevent abuse.
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    console.warn("[worker-cron] Unauthorized cron attempt")
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    console.info("[worker-cron] Starting stale heartbeat check...")
    await checkStaleHeartbeats()
    console.info("[worker-cron] Completed stale heartbeat check")
    return NextResponse.json({ ok: true, message: "stale check completed" }, { status: 200 })
  } catch (err: any) {
    console.error("[worker-cron] Error during check", err)
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
