"use client"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Filter, TrendingUp, Users, Calendar, AlertCircle, FileText, Download, Check,X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { inclusiveDaysBetween } from "@/lib/date"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardHeader } from "@/components/DashboardHeader"
import { MetricCard } from "@/components/ui/MetricCard"
type LeaveRow = {
  id: string
  user_id: string
  user_name: string | null
  from_date: string
  to_date: string
  category: "sick" | "vacation" | "personal" | "other"
  duration: "full-day" | "half-day"
  status: "pending" | "approved" | "rejected" | "cancelled"
  reason: string | null
  applied_at: string
  decision_at: string | null
  admin_comment: string | null
  document_url: string | null
}

export default function AdminLeavesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterDuration, setFilterDuration] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [balances, setBalances] = useState<
    Array<{ id: string; name: string | null; email: string | null; total_leaves: number; used_leaves: number }>
  >([])
  const [commentOpen, setCommentOpen] = useState(false)
  const [actionComment, setActionComment] = useState("")
  const [actionTarget, setActionTarget] = useState<{ id: string; type: "approve" | "reject"; leave?: LeaveRow } | null>(
    null,
  )
  const [actionLoading, setActionLoading] = useState(false)
  const [sortLeavesBy, setSortLeavesBy] = useState<string>("applied_desc")
  const [sortSummaryBy, setSortSummaryBy] = useState<string>("days_desc")
  const [preferRpc, setPreferRpc] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<"weekly" | "monthly">("weekly")
  const [refreshInterval, setRefreshInterval] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [dashStats, setDashStats] = useState<any>({})
  const [attendanceTrends, setAttendanceTrends] = useState<any>([])
  const [latePatterns, setLatePatterns] = useState<any>([])
  const [leaveBreakdown, setLeaveBreakdown] = useState<any>({})
  const [typeDistribution, setTypeDistribution] = useState<any>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)



  const computeLeaveDays = (l: LeaveRow) => {
    try {
      // Half-day always counts as 1 day
      if (l.duration === "half-day") return 1
      return inclusiveDaysBetween(l.from_date, l.to_date)
    } catch {
      return 0
    }
  }

  type EmployeeSummary = {
    id: string
    name: string | null
    email: string | null
    totalDays: number
    requestCount: number
    earliestFrom: string | null
    latestTo: string | null
    maxDays: number
  }

  const summaryRows: EmployeeSummary[] = useMemo(() => {
    const map = new Map<string, EmployeeSummary>()
    const byId = new Map<string, { name: string | null; email: string | null; total_leaves: number; used_leaves: number }>()
    balances.forEach((b) => byId.set(b.id, { name: b.name ?? null, email: b.email ?? null, total_leaves: b.total_leaves ?? 0, used_leaves: b.used_leaves ?? 0 }))

    for (const l of leaves) {
      // Include all requests (pending, approved, rejected, cancelled)
      const days = computeLeaveDays(l)
      const identity = byId.get(l.user_id)
      const existing = map.get(l.user_id)
      if (!existing) {
        map.set(l.user_id, {
          id: l.user_id,
          name: identity?.name ?? null,
          email: identity?.email ?? null,
          totalDays: days,
          requestCount: 1,
          earliestFrom: l.from_date,
          latestTo: l.to_date,
          maxDays: identity?.total_leaves ?? 0,
        })
      } else {
        existing.totalDays += days
        existing.requestCount += 1
        if (new Date(l.from_date).getTime() < new Date(existing.earliestFrom ?? l.from_date).getTime()) {
          existing.earliestFrom = l.from_date
        }
        if (new Date(l.to_date).getTime() > new Date(existing.latestTo ?? l.to_date).getTime()) {
          existing.latestTo = l.to_date
        }
      }
    }

    let rows = Array.from(map.values())
    switch (sortSummaryBy) {
      case "days_asc":
        rows = rows.sort((a, b) => a.totalDays - b.totalDays)
        break
      case "days_desc":
        rows = rows.sort((a, b) => b.totalDays - a.totalDays)
        break
      case "name_asc":
        rows = rows.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
        break
      case "name_desc":
        rows = rows.sort((a, b) => (b.name ?? b.id).localeCompare(a.name ?? a.id))
        break
      default:
        break
    }
    return rows
  }, [leaves, balances, sortSummaryBy])

  useEffect(() => {
    const init = async () => {
      const isCodeAdmin =
        typeof document !== "undefined" &&
        document.cookie.split("; ").some((c) => c.startsWith("admin_code_login=true"))
      if (isCodeAdmin) {
        setIsAdmin(true)
        setPreferRpc(false)
        await loadLeavesViaApi()
        await loadBalancesViaApi()
        setLoading(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: roleRow } = await supabase.from("users").select("role").eq("id", user.id).single()
        const admin = roleRow?.role === "admin"
        setIsAdmin(!!admin)
        setPreferRpc(!!admin)
        if (!admin) {
          setLoading(false)
          return
        }
        await loadLeaves()
        await loadBalances()
        supabase
          .channel("realtime-leaves-admin")
          .on("postgres_changes", { event: "*", schema: "public", table: "leaves" }, () => {
            loadLeaves()
          })
          .subscribe()
        setLoading(false)
        return
      }

      setIsAdmin(false)
      setLoading(false)
    }
    init()
  }, [])

  const loadLeaves = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("leaves").select("*").order("applied_at", { ascending: false })

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load leaves" })
      setLoading(false)
      return
    }
    setLeaves(data || [])
    setLoading(false)
  }

  const loadLeavesViaApi = async () => {
    try {
      const res = await fetch("/api/admin/leaves")
      const json = await res.json().catch(() => null)
      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load leaves")
      }
      setLeaves(json.data || [])
    } catch (e) {
      console.error("[AdminLeaves] API load error", e)
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load leaves",
      })
    }
  }

  const loadBalances = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, total_leaves, used_leaves")
      .eq("role", "employee")
    setBalances(data || [])
  }

  const loadBalancesViaApi = async () => {
    try {
      const res = await fetch("/api/admin/leave-balances")
      const json = await res.json().catch(() => null)
      if (!json?.ok) throw new Error(json?.error || "Failed to load balances")
      setBalances(json.data || [])
    } catch (e) {
      console.error("[AdminLeaves] API balances error", e)
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load balances",
      })
    }
  }

  const isImagePath = (path: string) => /\.(png|jpg|jpeg|webp|gif)$/i.test(path)
  const deriveStoragePath = (l: LeaveRow) => {
    const raw = (l.document_url || "").trim()
    if (!raw) return null
    if (/^https?:\/\//i.test(raw)) {
      const m = raw.match(/leave_docs\/(.+)$/)
      return m ? m[1] : null
    }
    if (raw.includes("/")) return raw
    return `${l.user_id}/${raw}`
  }
  const fetchSignedUrl = async (path: string) => {
    try {
      const res = await fetch(`/api/admin/leave-doc-url?path=${encodeURIComponent(path)}`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) return null
      return json?.url || null
    } catch {
      return null
    }
  }

  const runAction = async () => {
    if (!actionTarget) return
    const { id, type } = actionTarget
    setActionLoading(true)
    try {
      const targetLeave = actionTarget.leave ?? leaves.find((l) => l.id === id)
      if (!targetLeave) {
        throw new Error("Leave not found for action")
      }
      const from = new Date(targetLeave.from_date)
      const to = new Date(targetLeave.to_date)
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error("Invalid leave dates")
      }
      if (from > to) {
        throw new Error("From-date must be before or equal to to-date")
      }
      if (!["full-day", "half-day"].includes(targetLeave.duration)) {
        throw new Error("Invalid leave duration")
      }
      if (type === "approve" && targetLeave.status !== "pending") {
        throw new Error("Only pending leaves can be approved")
      }
      if (type === "reject" && !["pending", "approved"].includes(targetLeave.status)) {
        throw new Error("Only pending or approved leaves can be rejected")
      }

      // Validation: ensure requested days do not exceed remaining balance
      if (type === "approve") {
        const requestedDays = computeLeaveDays(targetLeave)
        const bal = balances.find((b) => b.id === targetLeave.user_id)
        const remaining = (bal?.total_leaves ?? 0) - (bal?.used_leaves ?? 0)
        if (requestedDays > remaining) {
          throw new Error(
            `Requested days (${requestedDays}) exceed remaining balance (${remaining}).`
          )
        }
      }

      if (!preferRpc) {
        const endpoint = type === "approve" ? "/api/admin/approve-leave" : "/api/admin/reject-leave"
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, comment: actionComment }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed to ${type} leave: ${res.status}`)
      } else {
        if (type === "approve") {
          const { error } = await supabase.rpc("approve_leave", { leave_id_input: id, comment_input: actionComment })
          if (error) throw error
        } else {
          const { error } = await supabase.rpc("reject_leave", { leave_id_input: id, comment_input: actionComment })
          if (error) throw error
        }
      }
      setCommentOpen(false)
      setActionComment("")
      setActionTarget(null)
      toast({ title: "Updated", description: `Leave ${type}d` })
      if (!preferRpc) {
        await loadLeavesViaApi()
        await loadBalancesViaApi()
      } else {
        await loadLeaves()
        await loadBalances()
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : `Failed to ${type} leave`
      const message =
        /not allowed: admin only/i.test(String(raw)) || /unauthorized/i.test(String(raw))
          ? "Admin session required. Please log in or use admin code."
          : raw
      console.warn(`[AdminLeaves] ${type} warning`, message)
      toast({ variant: "destructive", title: "Error", description: message })
    } finally {
      setActionLoading(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen dark:bg-[#1C1C1E] bg-[#F3F3F3] transition-smooth">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-6 py-4 bg-white/70 dark:bg-[#3E3E40] backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <DashboardHeader
            lastUpdated={lastUpdated}
            setLastUpdated={setLastUpdated}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            refreshInterval={refreshInterval}
            setRefreshInterval={setRefreshInterval}
            setLoading={setLoading}
            setStats={setDashStats}
            setAttendanceTrends={setAttendanceTrends}
            setLatePatterns={setLatePatterns}
            setLeaveBreakdown={setLeaveBreakdown}
            setTypeDistribution={setTypeDistribution}
            setError={setError}
            error={error}
          />
        </div>
      </div>

      <div className="mx-auto w-2/3 px-10 py-8 ">
        {/* Stats Grid */}
          <h1 className="text-3xl font-semibold pb-5">Leave Management</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 fade-in">
          <Card className="hover-lift dark:bg-[#333335] bg-[#F3F3F3] border-gray-400 border-[#fff] rounded-[30px]">
            <MetricCard
              title="Total Employees"
              value={balances.length}
              icon={Users}
              iconColor="text-blue-600 dark:text-blue-400"
              iconBgColor="bg-blue-100 dark:bg-blue-950"
            />
            {/*             
            <MetricCard className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total Employees</p>
                  <p className="text-3xl font-bold text-foreground">{balances.length}</p>
                </div>
                <Users className="w-10 h-10 text-primary/40" />
              </div>
            </MetricCard> */}
          </Card>

          <Card className="hover-lift dark:bg-[#333335] bg-[#F3F3F3] border-gray-400 border-[#fff] rounded-[30px]">

            <MetricCard
              title="Pending Requests"
              value={leaves.filter((l) => l.status === "pending").length}
              icon={AlertCircle}
              iconColor="text-[#FF9900]"
              iconBgColor="bg-[#FFE6CC]"
            />
            {/* <MetricCard className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Pending Requests</p>
                  <p className="text-3xl font-bold text-foreground">
                    {leaves.filter((l) => l.status === "pending").length}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-[#FF9900]" />
              </div>
            </MetricCard> */}
          </Card>

          <Card className="hover-lift dark:bg-[#333335] bg-[#F3F3F3] border-gray-400 border-[#fff] rounded-[30px]">
            <MetricCard
              title="Approved This Period"
              value={leaves.filter((l) => l.status === "approved").length}
              icon={TrendingUp}
              iconColor="text-[#009933]"
              iconBgColor="bg-[#CCFFE6]"
            />
            {/* <MetricCard className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Approved This Period</p>
                  <p className="text-3xl font-bold text-foreground">
                    {leaves.filter((l) => l.status === "approved").length}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-[#009933]" />
              </div>
            </MetricCard>  */}
          </Card>
        </div>

        {/* Leave Summary Section */}
        {/* Employee Leave Summary */}
        <Card className="p-6 mb-8 fade-in border-border/40 shadow-md overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Employee Leave Summary</h2>
            </div>
            <div>
              <Select value={sortSummaryBy} onValueChange={setSortSummaryBy}>
                <SelectTrigger className="w-[200px] rounded-[12px] border border-white/60 dark:border-white/20 bg-white/40 dark:bg-white/5 px-3 py-2 text-sm transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <SelectValue placeholder="Sort by Days Used" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_desc">Sort by Days Used</SelectItem>
                  <SelectItem value="days_asc">Sort by Days (asc)</SelectItem>
                  <SelectItem value="name_asc">Sort by Name (A→Z)</SelectItem>
                  <SelectItem value="name_desc">Sort by Name (Z→A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/30 dark:border-white/10">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Employees</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Total Days</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Date Range</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      No approved leaves yet.
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/20 dark:border-white/5 last:border-0 hover:bg-muted/50 transition-smooth">
                      <td className="py-4 px-4 font-medium">{row.name ?? row.id}</td>
                      <td className="py-4 px-4 font-semibold text-primary">{row.totalDays}/{row.maxDays}</td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {row.earliestFrom && row.latestTo
                          ? `${new Date(row.earliestFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(row.latestTo).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>



        {/* Manage Leave Requests Section */}
        <Card className="fade-in border-border/40 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-accent/5 to-secondary/5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-accent" />
              <CardTitle>Manage Leave Requests</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading requests...</p>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      aria-label="Search"
                      placeholder="Search by reason or ID..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-[300px] transition-smooth focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger
                      aria-label="Filter Status"
                      className="rounded-lg border border-border/40 w-full px-3 py-2 text-sm bg-card transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border/40">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDuration} onValueChange={setFilterDuration}>
                    <SelectTrigger
                      aria-label="Filter Duration"
                      className="rounded-lg border border-border/40 w-full px-3 py-2 text-sm bg-card transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <SelectValue placeholder="Filter by Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Durations</SelectItem>
                      <SelectItem value="full-day">Full-day</SelectItem>
                      <SelectItem value="half-day">Half-day</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger
                      aria-label="Filter Category"
                      className="rounded-lg border border-border/40 w-full px-3 py-2 text-sm bg-card transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <SelectValue placeholder="Filter by Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                   </Select> 
                  <Select value={sortLeavesBy} onValueChange={setSortLeavesBy}>
                    <SelectTrigger
                      aria-label="Sort Requests"
                      className="rounded-lg border border-border/40 w-full px-3 py-2 text-sm bg-card transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <SelectValue placeholder="Sort by Applied (newest)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="applied_desc">Sort by Applied (newest)</SelectItem>
                      <SelectItem value="applied_asc">Sort by Applied (oldest)</SelectItem>
                      <SelectItem value="from_desc">Sort by From Date (newest)</SelectItem>
                      <SelectItem value="from_asc">Sort by From Date (oldest)</SelectItem>
                      <SelectItem value="user_asc">Sort by Employee (A→Z)</SelectItem>
                      <SelectItem value="user_desc">Sort by Employee (Z→A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Requests Table */}
                <div className="overflow-x-auto border border-border/40 rounded-lg">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="font-semibold text-foreground">Employee</TableHead>
                        <TableHead className="font-semibold text-foreground">Date Range</TableHead>
                        <TableHead className="font-semibold text-foreground">Type</TableHead>
                        <TableHead className="font-semibold text-foreground">Requested</TableHead>
                        <TableHead className="font-semibold text-foreground">Approved</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="font-semibold text-foreground">Reason</TableHead>
                        <TableHead className="font-semibold text-foreground">Document</TableHead>
                        <TableHead className="font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves
                        .filter((l) => (filterStatus === "all" ? true : (l.status ?? "pending") === filterStatus))
                        .filter((l) =>
                          filterDuration === "all" ? true : (l.duration ?? "full-day") === filterDuration,
                        )
                        .filter((l) =>
                          filterCategory === "all" ? true : (l.category ?? "vacation") === filterCategory,
                        )
                        .filter((l) =>
                          search
                            ? l.reason?.toLowerCase().includes(search.toLowerCase()) ||
                            l.user_id?.toLowerCase().includes(search.toLowerCase())
                            : true,
                        )
                        .sort((a, b) => {
                          switch (sortLeavesBy) {
                            case "applied_asc":
                              return new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
                            case "applied_desc":
                              return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
                            case "from_asc":
                              return new Date(a.from_date).getTime() - new Date(b.from_date).getTime()
                            case "from_desc":
                              return new Date(b.from_date).getTime() - new Date(a.from_date).getTime()
                            case "user_asc":
                              return (a.user_id ?? "").localeCompare(b.user_id ?? "")
                            case "user_desc":
                              return (b.user_id ?? "").localeCompare(a.user_id ?? "")
                            default:
                              return 0
                          }
                        })
                        .map((l) => (
                          <TableRow
                            key={l.id}
                            className={`hover:bg-muted/50 transition-smooth border-border/30 ${l.status === "pending" ? "bg-accent/5" : ""}`}
                          >
                            <TableCell className="font-medium text-sm">{l.user_name ?? (balances.find((b) => b.id === l.user_id)?.name ?? l.user_id)}</TableCell>
                            <TableCell className="text-sm">
                              <span className="text-muted-foreground">
                                {new Date(l.from_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                                – {new Date(l.to_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              {inclusiveDaysBetween(l.from_date, l.to_date) === 0 &&
                                new Date(l.to_date).getTime() < new Date(l.from_date).getTime() && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-destructive/15 text-destructive">
                                    invalid range
                                  </span>
                                )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {l.category} • {l.duration === "full-day" ? "Full" : "Half"}
                              </span>
                            </TableCell>
                            {/* Requested Days */}
                            <TableCell className="font-semibold text-sm">{computeLeaveDays(l)}</TableCell>
                            {/* Approved Days */}
                            <TableCell className="text-sm">
                              {l.status === "approved" ? (
                                <span className="font-semibold text-green-600 dark:text-green-300">
                                  {computeLeaveDays(l)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${l.status === "pending"
                                    ? "bg-orange-500 text-white"
                                    : l.status === "approved"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                      : l.status === "rejected"
                                        ? "bg-destructive/20 dark:bg-red-500 dark:text-white text-destructive"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                              >
                                {l.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {l.reason ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {l.document_url ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 hover:underline"
                                  onClick={() => {
                                    const p = deriveStoragePath(l)
                                    if (!p) return
                                    if (isImagePath(p)) {
                                      setPreviewPath(p)
                                      setPreviewName(p.split("/").pop() || "Document")
                                      setPreviewSrc(`/api/admin/leave-doc?path=${encodeURIComponent(p)}`)
                                      setPreviewOpen(true)
                                    } else {
                                      fetchSignedUrl(p).then((u) => {
                                        if (u) window.open(u, "_blank", "noopener")
                                      })
                                    }
                                  }}
                                >
                                  <FileText className="w-4 h-4" />
                                  Document
                                </button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="space-x-2 flex">
                              <Button
                                disabled={actionLoading}
                                onClick={() => {
                                  setActionTarget({ id: l.id, type: "approve", leave: l })
                                  setCommentOpen(true)
                                }}
                                className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center transition-all duration-200 backdrop-blur-xl bg-green-500/20 dark:bg-green-500/30 border border-green-500/30 hover:bg-green-500/30 dark:hover:bg-green-500/40 active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(34,197,94,0.25)]`}
                              >
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </Button>
                              <Button
                                disabled={actionLoading}
                                onClick={() => {
                                  setActionTarget({ id: l.id, type: "reject", leave: l })
                                  setCommentOpen(true)
                                }}
                                className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center transition-all duration-200 backdrop-blur-xl bg-red-500/20 dark:bg-red-500/30 border border-red-500/30 hover:bg-red-500/30 dark:hover:bg-red-500/40 active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(239,68,68,0.25)]`}
                              >
                                <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={actionTarget?.type === "approve" ? "text-green-600" : "text-destructive"}>
                {actionTarget?.type === "approve" ? "✓" : "✕"}
              </span>
              {actionTarget?.type === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Add an optional admin comment</p>
              <Textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="Your feedback here..."
                className="transition-smooth focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCommentOpen(false)
                  setActionComment("")
                  setActionTarget(null)
                }}
                className="transition-smooth"
              >
                Cancel
              </Button>
              <Button
                onClick={runAction}
                disabled={actionLoading}
                className={actionTarget?.type === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : actionTarget?.type === "approve" ? (
                  "Approve Request"
                ) : (
                  "Reject Request"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-medium">{previewName || "Document"}</DialogTitle>
            <Button variant="ghost" size="icon" asChild>
              <a href={previewSrc || "#"} download={previewName || "document"} target="_blank" rel="noopener noreferrer">
                <Download className="h-5 w-5" />
              </a>
            </Button>
          </DialogHeader>
          {previewSrc && (
            <div className="w-full max-h-[75vh] overflow-auto">
              <img src={previewSrc} alt={previewName || "Document"} className="w-full h-auto rounded-md" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
