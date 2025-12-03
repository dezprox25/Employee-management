

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useTheme } from "next-themes"
import { Loader2, Search, Download, TrendingUp, Users, Clock, AlertCircle } from "lucide-react"
import { DashboardHeader } from "@/components/DashboardHeader"
import { motion } from "framer-motion"
type AttendanceRow = {
  id: number
  user_id: string
  date: string
  login_time: string | null
  logout_time: string | null
  total_hours: number | null
  status: string | null
  reason: string | null
}

type EnrichedAttendance = AttendanceRow & { name: string; email: string; position: string | null; auto_adjusted?: boolean }

type AttendanceAPIResponse = {
  ok: boolean
  totalEmployees: number
  todayCounts: { present: number; late: number; absent: number }
  todayRecords: EnrichedAttendance[]
  recentRecords: EnrichedAttendance[]
  rangeDays: number
  limit: number
  generatedAt: string
  error?: string
  code?: string
}

export default function AttendanceReportsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [todayRecords, setTodayRecords] = useState<EnrichedAttendance[]>([])
  const [recentRecords, setRecentRecords] = useState<EnrichedAttendance[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")
  const [filterDept, setFilterDept] = useState<string>("all")
  const [todayCounts, setTodayCounts] = useState<{ present: number; late: number; absent: number }>({
    present: 0,
    late: 0,
    absent: 0,
  })
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview")
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const stored = window.localStorage.getItem("admin_attendance_auto_refresh")
    return stored === "true"
  })
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(() => {
    if (typeof window === "undefined") return 60
    const urlParams = new URLSearchParams(window.location.search)
    const fromUrl = Number(urlParams.get("refresh"))
    if (!Number.isNaN(fromUrl) && fromUrl > 0) return Math.max(10, Math.min(600, fromUrl))
    const stored = Number(window.localStorage.getItem("admin_attendance_refresh_sec") || "60")
    return Number.isNaN(stored) ? 60 : Math.max(10, Math.min(600, stored))
  })
  const refreshThrottleRef = useRef<number>(0)

  const [headerLastUpdated, setHeaderLastUpdated] = useState<Date | null>(null)
  const [headerTimeRange, setHeaderTimeRange] = useState<"weekly" | "monthly">("weekly")
  const [headerRefreshInterval, setHeaderRefreshInterval] = useState<number>(0)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [headerStats, setHeaderStats] = useState<any>({})
  const [headerAttendanceTrends, setHeaderAttendanceTrends] = useState<any>([])
  const [headerLatePatterns, setHeaderLatePatterns] = useState<any>([])
  const [headerLeaveBreakdown, setHeaderLeaveBreakdown] = useState<any>({})
  const [headerTypeDistribution, setHeaderTypeDistribution] = useState<any>([])

  const todayStats = todayCounts

  const chartData = [
    { label: "Present", value: todayStats.present, fill: "hsl(var(--chart-1))" },
    { label: "Late", value: todayStats.late, fill: "hsl(var(--chart-3))" },
    { label: "Absent", value: todayStats.absent, fill: "hsl(var(--chart-5))" },
  ]

  function MetricCard({
    title,
    value,
    icon,
    subtitle,
  }: {
    title: string
    value: number
    icon?: React.ReactNode
    subtitle?: string
  }) {
    return (
      <div className="group relative overflow-hidden dark:bg-[#333335] bg-[#F3F3F3] dark:border-none rounded-3xl bg-card shadow-sm border-4 border-[#fff] p-6 transition-all duration-300 ease-out hover:scale-105">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0  transition-smooth" />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {icon}
          </div>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    )
  }

  useEffect(() => {
    const isCodeAdmin =
      typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("admin_code_login=true"))
    const checkRoleAndLoad = async () => {
      if (isCodeAdmin) {
        setIsAdmin(true)
        await loadAttendanceData()
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
      setIsAdmin(true)
      await loadAttendanceData()
    }
    checkRoleAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAdmin || !autoRefreshEnabled) return
    const ms = refreshIntervalSec * 1000
    const id = setInterval(() => {
      loadAttendanceData(true)
    }, ms)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, autoRefreshEnabled, refreshIntervalSec])

  // Realtime subscription to attendance changes: auto-refresh with light throttle
  useEffect(() => {
    if (!isAdmin) return
    const channel = supabase
      .channel("realtime-admin-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, async () => {
        const now = Date.now()
        if (now - refreshThrottleRef.current < 2000) return
        refreshThrottleRef.current = now
        setLastUpdated(new Date().toISOString())
        await loadAttendanceData(true)
      })
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (_) {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const loadAttendanceData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setIsRefreshing(true)
      const params = new URLSearchParams()
      params.set("days", "30")
      params.set("limit", "200")
      const res = await fetch(`/api/admin/attendance?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const json: AttendanceAPIResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "Invalid response" }) as AttendanceAPIResponse)
      if (!res.ok || !json.ok) {
        const isSchema = json?.code === "SCHEMA_MISSING" || /schema cache/i.test(String(json.error))
        toast({
          variant: "destructive",
          title: isSchema ? "Database not initialized" : "Error",
          description: json.error || "Failed to load attendance data",
        })
        return
      }
      setTotalEmployees(json.totalEmployees)
      setTodayRecords(json.todayRecords)
      setRecentRecords(json.recentRecords)
      setTodayCounts(json.todayCounts)
      setLastUpdated(json.generatedAt)
    } catch (error: any) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load attendance data" })
    } finally {
      setIsRefreshing(false)
      setLoading(false)
    }
  }

  // derive optional department options if server provides them
  const deptOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of recentRecords) {
      const dept = (r as any).department as string | undefined
      if (dept) set.add(dept)
    }
    return Array.from(set).sort()
  }, [recentRecords])

  const filteredRecent = recentRecords
    .filter((r) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    })
    .filter((r) => {
      if (filterDept !== "all") {
        const dept = (r as any).department as string | undefined
        if (!dept || dept !== filterDept) return false
      }
      if (fromDate) {
        try {
          if (new Date(r.date) < new Date(fromDate)) return false
        } catch (_) { }
      }
      if (toDate) {
        try {
          if (new Date(r.date) > new Date(toDate)) return false
        } catch (_) { }
      }
      return true
    })

  const fmtTime = (ts: string | null) => {
    if (!ts) return "-"
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
  }

  /**
   * Format numeric hours into H:MM:SS (e.g. 4:30:20).
   * Accepts a numeric hour value (e.g. 4.5055) and converts it to
   * hours, minutes, seconds. Returns '-' for invalid inputs.
   */
  const formatHours = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined) return "-"
    const n = Number(hours)
    if (Number.isNaN(n) || !isFinite(n)) return "-"

    const totalSeconds = Math.max(0, Math.round(n * 3600))
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60

    const mm = String(m).padStart(2, "0")
    const ss = String(s).padStart(2, "0")
    return `${h}:${mm}:${ss}`
  }

  const exportToCSV = () => {
    const headers = ["Date", "Employee", "Position", "Login Time", "Logout Time", "Total Hours", "Status", "Reason"]
    const rows = filteredRecent.map((record) => [
      record.date,
      record.name,
      record.position || "-",
      record.login_time || "N/A",
      record.logout_time || "N/A",
      record.total_hours?.toFixed(2) || "N/A",
      record.status || "N/A",
      record.reason || "N/A",
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()

    toast({
      title: "Success",
      description: "Report exported as CSV",
    })
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen dark:bg-[#1C1C1E] bg-[#E8E8ED]">
      <div className="border-b border-white/50 dark:border-white/20 bg-white/70 dark:bg-[#3E3E40] backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] sticky top-0 z-50">
        <div className="px-6 py-4">
          <DashboardHeader
            lastUpdated={headerLastUpdated}
            setLastUpdated={setHeaderLastUpdated}
            timeRange={headerTimeRange}
            setTimeRange={setHeaderTimeRange}
            refreshInterval={headerRefreshInterval}
            setRefreshInterval={setHeaderRefreshInterval}
            setLoading={setLoading}
            setStats={setHeaderStats}
            setAttendanceTrends={setHeaderAttendanceTrends}
            setLatePatterns={setHeaderLatePatterns}
            setLeaveBreakdown={setHeaderLeaveBreakdown}
            setTypeDistribution={setHeaderTypeDistribution}
            setError={setHeaderError}
            error={headerError}
          />
        </div>
      </div>
      <div className="p-6 md:p-8 lg:p-10 space-y-8  mx-auto">
        {/* Header Section */}
        <div className="space-y-2 fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Attendance & Reports</h1>
          <p className="text-muted-foreground text-lg">
            Monitor workforce attendance in real-time and access historical reports
          </p>
        </div>

        {/* Tab Navigation */}
        <motion.div
          layout
          className="flex gap-2 border dark:border-white/50 border-white p-2 w-52 shadow-md bg-[#F0F0F3] dark:bg-[#1C1C1E] rounded-full"
        >
          <motion.button
            layout
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1 font-medium relative ${activeTab === "overview" ? "text-primary bg-[#fff] shadow-sm  dark:bg-[#484849] rounded-lg" : "text-muted-foreground hover:text-foreground"
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Overview
            {activeTab === "overview" && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-white dark:bg-[#484849] rounded-lg -z-10"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </motion.button>
          <motion.button
            layout
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-1 font-medium relative ${activeTab === "reports" ? "text-primary bg-[#fff] shadow-lg dark:bg-[#484849] rounded-lg" : "text-muted-foreground hover:text-foreground"
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Reports
            {activeTab === "reports" && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-white dark:bg-[#484849] rounded-lg -z-10"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </motion.button>
        </motion.div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="space-y-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading attendance data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-8 fade-in">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard title="Total Employees" value={totalEmployees} icon={<Users className="h-5 w-5 text-primary" />} />
                  <MetricCard
                    title="Present Today"
                    value={todayStats.present}
                    icon={<TrendingUp className="h-5 w-5 text-accent" />}
                    subtitle={`${((todayStats.present / Math.max(1, totalEmployees)) * 100).toFixed(1)}% attendance`}
                  />
                  <MetricCard title="Late Arrivals" value={todayStats.late} icon={<Clock className="h-5 w-5 text-chart-3" />} />
                  <MetricCard title="Absent" value={todayStats.absent} icon={<AlertCircle className="h-5 w-5 text-destructive" />} />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-border bg-card/50 backdrop-blur-sm transition-all duration-300 ease-out hover:shadow-lg hover:scale-105">
                    <CardHeader>
                      <CardTitle>Today's Attendance Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                            <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "0.5rem",
                              }}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={isDark ? "#ffffff" : "hsl(var(--primary))"} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card/50 backdrop-blur-sm transition-all duration-300 ease-out hover:shadow-lg hover:scale-105">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Today's Punch In</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}</span>
                        {isRefreshing && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead>Employee</TableHead>
                            <TableHead>Login Time</TableHead>
                            <TableHead>Logout Time</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todayRecords.length === 0 ? (
                            <TableRow className="border-border hover:bg-transparent">
                              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                No punch-ins recorded yet today
                              </TableCell>
                            </TableRow>
                          ) : (
                            todayRecords.slice(0, 5).map((r) => (
                              <TableRow key={r.id} className="border-border hover:bg-muted/50 transition-smooth">
                                <TableCell className="font-medium">{r.name}</TableCell>
                                <TableCell>{fmtTime(r.login_time)}</TableCell>
                                <TableCell>{fmtTime(r.logout_time)}</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-smooth ${r.status === "present"
                                      ? "bg-green-500/20 text-green-500"
                                      : r.status === "late"
                                        ? "bg-chart-3/20 text-chart-3"
                                        : "bg-destructive/20 text-destructive"
                                      }`}
                                  >
                                    {r.status}
                                  </span>
                                  {r.auto_adjusted && (
                                    <span className="inline-flex items-center ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                      Adjusted
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && (
              <div className="space-y-6 fade-in">
                <Card className="border-border bg-card/50 backdrop-blur-sm">
                  <CardHeader className="border-b border-border">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <CardTitle>Attendance Records</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => loadAttendanceData()} variant="outline" className="gap-2">
                          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                        </Button>
                        <Button onClick={exportToCSV} className="gap-2 bg-primary hover:bg-primary/90">
                          <Download className="w-4 h-4" />
                          Export CSV
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="mb-6 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by employee name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 border-border focus:ring-primary"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">From date</label>
                          {/* <Input type="date" className=" " value={fromDate} onChange={(e) => setFromDate(e.target.value)} /> */}
                          <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="[color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">To date</label>
                          {/* <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /> */}
                          <Input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="[color-scheme:light] dark:[color-scheme:dark]"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button variant="outline" onClick={() => { setFromDate(""); setToDate("") }}>Clear</Button>
                        </div>
                        <div className="flex items-end justify-end md:justify-start">
                          <div className="text-xs text-muted-foreground">Last update: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "-"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/30 dark:border-white/10">
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Employee</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Login</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Logout</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Hours</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                            <th className="text-left py-3 px-4 text-sm text-muted-foreground">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecent.length === 0 ? (
                            <tr className="border-b border-white/20 dark:border-white/5 last:border-0">
                              <td colSpan={7} className="py-6 px-4 text-center text-sm text-muted-foreground">No records found</td>
                            </tr>
                          ) : (
                            filteredRecent.map((r) => (
                              <tr key={r.id} className="border-b border-white/20 dark:border-white/5 last:border-0">
                                <td className="py-3 px-4 text-sm font-mono">{r.date}</td>
                                <td className="py-3 px-4 text-sm font-medium">{r.name}</td>
                                <td className="py-3 px-4 text-sm">{fmtTime(r.login_time)}</td>
                                <td className="py-3 px-4 text-sm">{fmtTime(r.logout_time)}</td>
                                <td className="py-3 px-4 text-sm">
                                  {formatHours(r.total_hours)}
                                  {r.auto_adjusted && (
                                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">Adjusted</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge
                                    className={`${r.status === "present"
                                      ? "rounded-[8px] bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30"
                                      : r.status === "late"
                                      ? "rounded-[8px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                                      : "rounded-[8px] bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30"}`}
                                  >
                                    {r.status ?? "-"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">{r.reason ?? "-"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
