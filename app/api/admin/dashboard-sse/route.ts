import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

interface DashboardStats {
  totalEmployees: number
  presentToday: number
  lateArrivals: number
  pendingLeaves: number
}

interface AttendanceData {
  date: string
  present: number
  absent: number
  late: number
}

async function fetchDashboardSnapshot() {
  const supabase = createServiceClient()

  // Total employees
  const { data: employees } = await supabase.from("users").select("id").eq("role", "employee")

  // Today's attendance
  const today = new Date().toISOString().split("T")[0]
  const { data: todayAttendance } = await supabase.from("attendance").select("status").eq("date", today)

  // Pending leaves
  const { data: pendingLeaves } = await supabase.from("leaves").select("id").eq("status", "pending")

  // Last 7 days chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split("T")[0]
  })

  const { data: attendanceData } = await supabase.from("attendance").select("date, status").in("date", last7Days)

  const chartAgg: Record<string, AttendanceData> = {}
  last7Days.forEach((date) => {
    chartAgg[date] = { date, present: 0, absent: 0, late: 0 }
  })

  attendanceData?.forEach((record) => {
    const row = chartAgg[record.date]
    if (!row) return
    if (record.status === "present") row.present++
    else if (record.status === "absent") row.absent++
    else if (record.status === "late") row.late++
  })

  const stats: DashboardStats = {
    totalEmployees: employees?.length || 0,
    presentToday: todayAttendance?.filter((a) => a.status === "present").length || 0,
    lateArrivals: todayAttendance?.filter((a) => a.status === "late").length || 0,
    pendingLeaves: pendingLeaves?.length || 0,
  }

  return { stats, chartData: Object.values(chartAgg), lastUpdated: new Date().toISOString() }
}

export async function GET(req: NextRequest) {
  // Server-Sent Events stream
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const url = new URL(req.url)
  const intervalParam = url.searchParams.get("interval")
  const intervalSec = Math.max(5, Math.min(300, parseInt(intervalParam || "30", 10) || 30))
  const intervalMs = intervalSec * 1000

  async function pushUpdate() {
    try {
      const snapshot = await fetchDashboardSnapshot()
      // Default SSE message event
      const payload = `data: ${JSON.stringify(snapshot)}\n\n`
      await writer.write(encoder.encode(payload))
    } catch (e) {
      const errPayload = `event: error\ndata: ${JSON.stringify({ message: "snapshot_failed" })}\n\n`
      await writer.write(encoder.encode(errPayload))
    }
  }

  // Immediately send a snapshot
  await pushUpdate()

  const timer = setInterval(pushUpdate, intervalMs)

  // Handle client disconnect
  req.signal.addEventListener("abort", () => {
    clearInterval(timer)
    writer.close()
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}