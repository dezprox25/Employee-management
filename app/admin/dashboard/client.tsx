"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Users, Clock, AlertCircle, CheckCircle, RefreshCw } from "lucide-react"
import { CardEntrance } from "@/components/animations/card-entrance"
import { StatCounter } from "@/components/animations/stat-counter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

type LatePatternPoint = { date: string; late: number }

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

export default function AdminDashboardClient() {
  const supabase = useMemo(() => createClient(), [])
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    lateArrivals: 0,
    pendingLeaves: 0,
  })
  const [attendanceTrends, setAttendanceTrends] = useState<AttendancePoint[]>([])
  const [latePatterns, setLatePatterns] = useState<LatePatternPoint[]>([])
  const [leaveBreakdown, setLeaveBreakdown] = useState<LeaveBreakdown>({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  })
  const [typeDistribution, setTypeDistribution] = useState<TypeDistributionPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"weekly" | "monthly">("weekly")
  const [refreshInterval, setRefreshInterval] = useState<number>(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pane = searchParams.get("pane") || null

  // Dynamically loaded nested admin views
  const AdminEmployeesView = useMemo(() => dynamic(() => import("../employees/page"), { ssr: false }), [])
  const AdminLeavesView = useMemo(() => dynamic(() => import("../leaves/page"), { ssr: false }), [])
  const AdminAttendanceView = useMemo(() => dynamic(() => import("../attendance/page"), { ssr: false }), [])
  // const AdminReportsView = useMemo(() => dynamic(() => import("../reports/page"), { ssr: false }), [])

  useEffect(() => {
    const isCodeAdmin =
      typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("admin_code_login=true"))

    const fetchFromApi = async () => {
      setError(null)
      try {
        const res = await fetch(`/api/admin/dashboard?range=${timeRange}`)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data: AdminDashboardResponse = await res.json()
        setStats(data.stats)
        setAttendanceTrends(data.attendanceTrends)
        setLatePatterns(data.latePatterns)
        setLeaveBreakdown(data.leaveBreakdown)
        setTypeDistribution(data.typeDistribution)
        setLastUpdated(new Date())
      } catch (err: any) {
        console.error("Failed to load dashboard:", err)
        setError(err?.message || "Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    const checkRoleAndLoad = async () => {
      if (isCodeAdmin) {
        await fetchFromApi()
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login")
        return
      }
      const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (profile?.role !== "admin") {
        router.replace("/employee/dashboard")
        return
      }
      await fetchFromApi()
    }

    checkRoleAndLoad()

    // Realtime trigger to refresh on attendance/leaves changes (quick API refetch)
    const supabaseRt = createClient()
    const channel = supabaseRt
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance" }, fetchFromApi)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "attendance" }, fetchFromApi)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leaves" }, fetchFromApi)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leaves" }, fetchFromApi)
      .subscribe()

    return () => {
      supabaseRt.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange])

  // Auto-refresh handler
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        setLoading(true)
        fetch(`/api/admin/dashboard?range=${timeRange}`)
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`API error: ${res.status}`))))
          .then((data: AdminDashboardResponse) => {
            setStats(data.stats)
            setAttendanceTrends(data.attendanceTrends)
            setLatePatterns(data.latePatterns)
            setLeaveBreakdown(data.leaveBreakdown)
            setTypeDistribution(data.typeDistribution)
            setLastUpdated(new Date())
            setError(null)
          })
          .catch((err) => setError(err?.message || "Failed to auto-refresh"))
          .finally(() => setLoading(false))
      }, refreshInterval * 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [refreshInterval, timeRange])

  // If a nested pane is requested, render that view within the dashboard route
  if (pane === "employees") {
    return (
      <div className="min-h-screen w-full bg-background">
        <div className="px-6 pt-6 text-sm text-muted-foreground">Admin / Dashboard / Employees</div>
        <AdminEmployeesView />
      </div>
    )
  }
  if (pane === "leaves") {
    return (
      <div className="min-h-screen w-full bg-background">
        <div className="px-6 pt-6 text-sm text-muted-foreground">Admin / Dashboard / Leaves</div>
        <AdminLeavesView />
      </div>
    )
  }
  if (pane === "attendance") {
    return (
      <div className="min-h-screen w-full bg-background">
        <div className="px-6 pt-6 text-sm text-muted-foreground">Admin / Dashboard / Attendance</div>
        <AdminAttendanceView />
      </div>
    )
  }
  // if (pane === "reports") {
  //   return (
  //     <div className="min-h-screen w-full bg-background">
  //       <div className="px-6 pt-6 text-sm text-muted-foreground">Admin / Dashboard / Reports</div>
  //       <AdminReportsView />
  //     </div>
  //   )
  // }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background p-6 md:p-8 grid place-items-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner />
          <span>Loading dashboard…</span>
        </div>
      </div>
    )
  }

  const pieData = [
    { name: "Pending", value: leaveBreakdown.pending, color: "var(--chart-2)" },
    { name: "Approved", value: leaveBreakdown.approved, color: "var(--chart-1)" },
    { name: "Rejected", value: leaveBreakdown.rejected, color: "var(--chart-5)" },
    { name: "Cancelled", value: leaveBreakdown.cancelled, color: "var(--chart-3)" },
  ]

  return (
    <div className="min-h-screen w-full bg-background p-6 md:p-4 ">
      <div className="flex w-full flex-1 flex-col gap-8  border rounded-xl p-5">
        {/* Breadcrumb for overview */}
        <div className="text-sm text-muted-foreground">Admin / Dashboard</div>
        {/* Top Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Live updates</Badge>
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Range</span>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "weekly" | "monthly")}>
                <SelectTrigger size="sm" className="min-w-32">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Auto-refresh</span>
              <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
                <SelectTrigger size="sm" className="min-w-36">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Off</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              setLoading(true)
              fetch(`/api/admin/dashboard?range=${timeRange}`)
                .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`API error: ${res.status}`))))
                .then((data: AdminDashboardResponse) => {
                  setStats(data.stats)
                  setAttendanceTrends(data.attendanceTrends)
                  setLatePatterns(data.latePatterns)
                  setLeaveBreakdown(data.leaveBreakdown)
                  setTypeDistribution(data.typeDistribution)
                  setLastUpdated(new Date())
                  setError(null)
                })
                .catch((err) => setError(err?.message || "Refresh failed"))
                .finally(() => setLoading(false))
            }}>
              <RefreshCw className="size-4" /> Refresh now
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Failed to load data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardEntrance delay={0}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <StatCounter from={0} to={stats.totalEmployees} />
                </div>
              </CardContent>
            </Card>
          </CardEntrance>

          <CardEntrance delay={0.1}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <StatCounter from={0} to={stats.presentToday} />
                </div>
              </CardContent>
            </Card>
          </CardEntrance>

          <CardEntrance delay={0.2}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
                <Clock className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <StatCounter from={0} to={stats.lateArrivals} />
                </div>
              </CardContent>
            </Card>
          </CardEntrance>

          <CardEntrance delay={0.3}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
                <AlertCircle className="w-4 h-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <StatCounter from={0} to={stats.pendingLeaves} />
                </div>
              </CardContent>
            </Card>
          </CardEntrance>
        </div>

        {/* Attendance Trends */}
        <CardEntrance delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends ({timeRange === "weekly" ? "Last 7 Days" : "Last 30 Days"})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={attendanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" stackId="a" fill="var(--chart-1)" name="Present" />
                  <Bar dataKey="late" stackId="a" fill="var(--chart-2)" name="Late" />
                  <Bar dataKey="absent" stackId="a" fill="var(--chart-5)" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </CardEntrance>

        {/* Late Arrival Patterns */}
        <CardEntrance delay={0.5}>
          <Card>
            <CardHeader>
              <CardTitle>Late Arrival Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={latePatterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="late" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} name="Late" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </CardEntrance>

        {/* Leave Status Breakdown */}
        <CardEntrance delay={0.6}>
          <Card>
            <CardHeader>
              <CardTitle>Leave Request Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {pieData.map((p) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: p.color }} />
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="ml-auto font-medium">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </CardEntrance>

        {/* Attendance by Employee Type (proxy for department) */}
        <CardEntrance delay={0.7}>
          <Card>
            <CardHeader>
              <CardTitle>Attendance by Employee Type (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="var(--chart-1)" name="Present" />
                  <Bar dataKey="absent" fill="var(--chart-5)" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </CardEntrance>
      </div>
    </div>
  )
}