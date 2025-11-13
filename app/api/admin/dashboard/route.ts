import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

type DashboardStats = {
  totalEmployees: number
  presentToday: number
  lateArrivals: number
  pendingLeaves: number
}

type AttendancePoint = {
  date: string
  present: number
  absent: number
  late: number
}

type LatePatternPoint = {
  date: string
  late: number
}

type LeaveBreakdown = {
  pending: number
  approved: number
  rejected: number
  cancelled: number
}

type TypeDistributionPoint = {
  type: string
  present: number
  absent: number
}

type AdminDashboardResponse = {
  stats: DashboardStats
  attendanceTrends: AttendancePoint[]
  latePatterns: LatePatternPoint[]
  leaveBreakdown: LeaveBreakdown
  typeDistribution: TypeDistributionPoint[]
  timeRange: "weekly" | "monthly"
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const rangeParam = (searchParams.get("range") as "weekly" | "monthly") || "weekly"
    const days = rangeParam === "monthly" ? 30 : 7

    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (days - 1))
    const startStr = start.toISOString().split("T")[0]
    const todayStr = now.toISOString().split("T")[0]

    // Total employees
    const employeesRes = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "employee")
    const totalEmployees = employeesRes.count ?? 0

    // Today's attendance and late arrivals
    const todayAttendanceRes = await supabase
      .from("attendance")
      .select("status")
      .eq("date", todayStr)
    const presentToday = todayAttendanceRes.data?.filter((a) => a.status === "present").length ?? 0
    const lateArrivals = todayAttendanceRes.data?.filter((a) => a.status === "late").length ?? 0

    // Pending leaves count
    const pendingLeavesRes = await supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
    const pendingLeaves = pendingLeavesRes.count ?? 0

    // Attendance in range
    const attendanceRangeRes = await supabase
      .from("attendance")
      .select("user_id,date,status")
      .gte("date", startStr)
      .lte("date", todayStr)

    // Leave breakdown (overall)
    const leavesRes = await supabase
      .from("leaves")
      .select("status")
    const leaveBreakdown: LeaveBreakdown = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    leavesRes.data?.forEach((l) => {
      const key = l.status as keyof LeaveBreakdown
      if (leaveBreakdown[key] !== undefined) {
        leaveBreakdown[key] += 1
      }
    })

    // Build attendance trends
    const dates: string[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(d.toISOString().split("T")[0])
    }
    const trendsMap: Record<string, AttendancePoint> = Object.fromEntries(
      dates.map((d) => [d, { date: d, present: 0, absent: 0, late: 0 }]),
    )

    attendanceRangeRes.data?.forEach((rec) => {
      const bucket = trendsMap[rec.date]
      if (!bucket) return
      if (rec.status === "present") bucket.present += 1
      else if (rec.status === "absent") bucket.absent += 1
      else if (rec.status === "late") bucket.late += 1
    })

    const attendanceTrends = Object.values(trendsMap)
    const latePatterns: LatePatternPoint[] = attendanceTrends.map((d) => ({ date: d.date, late: d.late }))

    // Type distribution for today (present vs absent by users.type)
    const todayFullRes = await supabase
      .from("attendance")
      .select("user_id,status")
      .eq("date", todayStr)

    const userIds = Array.from(new Set(todayFullRes.data?.map((r) => r.user_id) || []))
    let typeDistribution: TypeDistributionPoint[] = []
    if (userIds.length > 0) {
      const usersRes = await supabase.from("users").select("id,type").in("id", userIds)
      const typeMap = new Map<string, { present: number; absent: number }>()
      todayFullRes.data?.forEach((rec) => {
        const u = usersRes.data?.find((x) => x.id === rec.user_id)
        const type = u?.type || "unknown"
        const counts = typeMap.get(type) || { present: 0, absent: 0 }
        if (rec.status === "absent") counts.absent += 1
        else counts.present += 1 // treat present/late/half-day as present side
        typeMap.set(type, counts)
      })
      typeDistribution = Array.from(typeMap.entries()).map(([type, c]) => ({ type, ...c }))
    }

    const stats: DashboardStats = {
      totalEmployees,
      presentToday,
      lateArrivals,
      pendingLeaves,
    }

    const payload: AdminDashboardResponse = {
      stats,
      attendanceTrends,
      latePatterns,
      leaveBreakdown,
      typeDistribution,
      timeRange: rangeParam,
    }

    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    console.error("Error in admin dashboard API:", err)
    return new Response(JSON.stringify({ error: "Failed to load dashboard data" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
}