"use client"

import { createClient } from "@/lib/supabase/client"
import { formatTime12hCompactFromString, formatLeaveUsage } from "@/lib/utils"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2, Mail, Search, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DashboardHeader } from "@/components/DashboardHeader"

interface Employee {
  id: string
  name: string
  password: string
  email: string
  position?: string | null
  type: string
  work_time_start: string
  work_time_end: string
  total_leaves: number
  used_leaves: number
  created_at?: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    position: "",
    type: "fulltime",
    password: "",
  })
  // const [formData, setFormData] = useState({ fullName: "", email: "", password: "", workType: "Full-time" })
  const [showPassword, setShowPassword] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(12)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [editOpen, setEditOpen] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Partial<Employee> | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetNewPassword, setResetNewPassword] = useState<string>("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  // DashboardHeader integration state
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [timeRange, setTimeRange] = useState<"weekly" | "monthly">("weekly")
  const [refreshInterval, setRefreshInterval] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [dashStats, setDashStats] = useState<any>({})
  const [attendanceTrends, setAttendanceTrends] = useState<any>([])
  const [latePatterns, setLatePatterns] = useState<any>([])
  const [leaveBreakdown, setLeaveBreakdown] = useState<any>({})
  const [typeDistribution, setTypeDistribution] = useState<any>([])

  // Removed view mode toggle and initialization to simplify UI

  useEffect(() => {
    // Allow admin area when code-login cookie is present (temporary bypass)
    const isCodeAdmin = typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("admin_code_login=true"))
    if (isCodeAdmin) {
      setIsAdmin(true)
      // Immediately load employees when code-admin cookie is present
      fetchEmployeesPage(1, pageSize)
      return
    }
    const checkRoleAndLoad = async () => {
      // Pre-flight: DB health check to surface schema issues early
      try {
        const healthRes = await fetch("/api/admin/db-health")
        const health = await healthRes.json().catch(() => null)
        if (health?.tableMissing) {
          console.error("[EmployeesPage] DB health check failed:", health)
          toast({
            variant: "destructive",
            title: "Database not initialized",
            description: "Missing table 'public.users' in schema cache. Run SQL scripts and reload schema.",
          })
          setLoading(false)
          return
        }
      } catch (e) {
        // Non-blocking: continue but log the health-check failure
        console.warn("[EmployeesPage] DB health check error", e)
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
      await fetchEmployeesPage(1, pageSize)
    }
    checkRoleAndLoad()
  }, [])

  // Server-side pagination and search only
  const fetchEmployeesPage = useCallback(async (newPage: number, newPageSize: number, searchOverride?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", String(newPage))
      params.set("pageSize", String(newPageSize))
      params.set("search", typeof searchOverride === "string" ? searchOverride : searchQuery)
      params.set("includeCount", "true")

      const res = await fetch(`/api/admin/list-employees?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const code = json?.code
        const message = json?.error || "Failed to fetch employees"
        const isSchema = json?.schemaIssue || code === "PGRST205" || /schema cache/i.test(String(message))
        const isRecursion = json?.recursionIssue || code === "42P17" || /infinite recursion/i.test(String(message))
        // Tailored messages for auth failures
        if (res.status === 401) {
          toast({ variant: "destructive", title: "Unauthorized", description: "Please log in as admin or use code login." })
        } else if (res.status === 403) {
          toast({ variant: "destructive", title: "Forbidden", description: `${message}${code ? ` (${code})` : ""}` })
        } else {
          toast({
            variant: "destructive",
            title: isSchema ? "Database not initialized" : "Error",
            description: isSchema
              ? "Missing table 'public.users' in schema cache. Run SQL migrations and reload schema."
              : `${message}${code ? ` (${code})` : ""}`,
          })
        }
        if (isRecursion) {
          console.error("RLS recursion detected on public.users (42P17). Apply scripts/005_fix_rls.sql and reload schema.")
        }
        return
      }
      setEmployees(json.data || [])
      setTotalCount(json.count || 0)
      setPage(newPage)
      setPageSize(newPageSize)
    } catch (error: any) {
      console.error("Error fetching employees:", error)
      const message = error?.message || "Failed to fetch employees"
      toast({ variant: "destructive", title: "Error", description: message })
    } finally {
      setLoading(false)
    }
  }, [searchQuery, toast])

  // Real-time updates: refresh current page on any change to users
  useEffect(() => {
    if (!isAdmin) return
    const channel = supabase
      .channel("users-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, async () => {
        await fetchEmployeesPage(page, pageSize)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdmin, supabase, page, pageSize, fetchEmployeesPage])

  // Removed legacy fetchEmployees helper (filter/sort no longer supported)

  const visibleEmployees = useMemo(() => employees, [employees])

  const filteredEmployees = useMemo(() => {
    const q = (searchTerm || "").trim().toLowerCase()
    if (!q) return visibleEmployees
    return visibleEmployees.filter((e) => (e.name || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q))
  }, [visibleEmployees, searchTerm])

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp)
    setEditOpen(true)
  }

  const handleUpdateEmployee = async () => {
    if (!editEmployee?.id) return
    try {
      if (editEmployee.position !== undefined && String(editEmployee.position).trim() === "") {
        toast({ variant: "destructive", title: "Invalid input", description: "Position cannot be empty" })
        return
      }
      const payload: any = {}
        ;["name", "email", "position", "type", "work_time_start", "work_time_end", "total_leaves", "used_leaves"].forEach((k) => {
          if ((editEmployee as any)[k] !== undefined) payload[k] = (editEmployee as any)[k]
        })
      await supabase.from("users").update(payload).eq("id", editEmployee.id)
      toast({ title: "Success", description: "Employee updated" })
      setEditOpen(false)
      setEditEmployee(null)
      fetchEmployeesPage(page, pageSize)
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update employee" })
    }
  }

  
  const handleAddEmployee = async () => {
    try {
      const name = newEmployee.name.trim()
      const email = newEmployee.email.trim()
      const position = (newEmployee.position || "").trim()
      const password = newEmployee.password

      const emailRegex = /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*|"(?:[^"]|\\")+")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:\d{1,3}\.){3}\d{1,3}\])$/
      if (!name || !email || !password || !position) {
        toast({ variant: "destructive", title: "Missing fields", description: "Please provide name, email, password, and position" })
        return
      }
      if (!emailRegex.test(email)) {
        toast({ variant: "destructive", title: "Invalid email", description: "Please enter a valid email address" })
        return
      }
      if (password.length < 6) {
        toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 6 characters" })
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch("/api/admin/create-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          position,
          type: newEmployee.type,
        }),
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      let data: any = { error: undefined }
      try {
        data = await res.json()
      } catch { }

      if (!res.ok) {
        console.error("[EmployeesPage] add employee failed", { status: res.status, body: data })
        const code = data?.code
        const message =
          code === "AUTH_UNAUTHORIZED"
            ? "You are not authenticated. Please log in again."
            : code === "AUTH_FORBIDDEN"
              ? "You must be an admin to add employees."
              : code === "VALIDATION_EMAIL"
                ? "Invalid email address."
                : code === "VALIDATION_PASSWORD"
                  ? "Weak password: use at least 8 characters with letters and numbers."
                  : code === "VALIDATION_NAME"
                    ? "Name is required."
                    : code === "VALIDATION_POSITION"
                      ? "Position is required."
                    : code === "VALIDATION_TYPE"
                      ? "Invalid employee type."
                      : data?.error || `Server returned ${res.status}`
        toast({ variant: "destructive", title: "Failed to add employee", description: message })
        return
      }

      toast({ title: "Success", description: "Employee account created" })
      setIsAddDialogOpen(false)
      setNewEmployee({ name: "", email: "", position: "", type: "fulltime", password: "" })
      fetchEmployeesPage(page, pageSize)
    } catch (error: any) {
      const isAbort = error?.name === "AbortError"
      console.error("[EmployeesPage] network error during add", error)
      toast({
        variant: "destructive",
        title: isAbort ? "Network timeout" : "Network error",
        description: isAbort ? "Request timed out. Please try again." : (error?.message || "Unexpected error occurred"),
      })
    }
  }

  const confirmDelete = (id: string) => {
    setDeleteUserId(id)
    setDeleteOpen(true)
  }

  const handleDeleteEmployee = async () => {
    if (!deleteUserId) return
    try {
      const res = await fetch("/api/admin/delete-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: deleteUserId }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        console.error("[EmployeesPage] delete failed", { status: res.status, body: data })
        toast({
          variant: "destructive",
          title: "Failed to delete employee",
          description: data?.error || `Server returned ${res.status}`,
        })
        return
      }
      toast({ title: "Success", description: "Employee deleted" })
      setDeleteOpen(false)
      setDeleteUserId(null)
      // Refresh current page
      await fetchEmployeesPage(page, pageSize)
    } catch (error: any) {
      console.error("[EmployeesPage] delete error", error)
      toast({ variant: "destructive", title: "Network error", description: error?.message || "Failed to delete employee" })
    }
  }

  const openResetDialog = (id: string) => {
    setResetUserId(id)
    setResetNewPassword("")
    setResetOpen(true)
  }

  const handleResetPassword = async () => {
    if (!resetUserId) return
    const pwd = resetNewPassword
    if (!pwd || pwd.length < 8) {
      toast({ variant: "destructive", title: "Invalid password", description: "Password must be at least 8 characters" })
      return
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetUserId, new_password: pwd }),
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = (data as any)?.code
        const description =
          code === "NOT_AUTHENTICATED"
            ? "Unauthorized: please log in as an admin or enable code admin mode."
            : code === "NOT_ADMIN"
              ? "Forbidden: only admins can reset passwords."
              : code === "VALIDATION_PASSWORD"
                ? data?.error || "Password must be at least 8 characters with letters and numbers."
                : data?.error || `Server returned ${res.status}`
        toast({ variant: "destructive", title: "Reset failed", description })
        return
      }
      toast({ title: "Password updated", description: "Employee password has been reset" })
      setResetOpen(false)
      setResetUserId(null)
      setResetNewPassword("")
    } catch (error: any) {
      const isAbort = error?.name === "AbortError"
      toast({
        variant: "destructive",
        title: isAbort ? "Network timeout" : "Network error",
        description: isAbort ? "Request timed out. Please try again." : error?.message || "Failed to reset password",
      })
    }
  }

  if (!isAdmin) return null
  if (loading) return <div>Loading...</div>

  return (
    <div className="min-h-screen dark:bg-[#1C1C1E] bg-[#F3F3F3] transition-smooth">
      {/* Top Header */}
      <div className="border-b border-white/50 dark:border-white/20 bg-white/70 dark:bg-[#3E3E40] backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="px-6 py-4">
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

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">Employees</h2>
          {/* Removed view toggle and page size select to simplify UI */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="rounded-2xl shadow-lg text-white border-0 transition-all duration-200 active:scale-95 hover:shadow-xl"
                style={{ background: 'linear-gradient(180deg, #227631 0%, #3FA740 100%)' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>

            {/* Add Employee Dialog */}
            <DialogContent className="sm:max-w-[440px] backdrop-blur-[80px] bg-white/80 dark:bg-black/60 border border-white/40 dark:border-white/[0.15] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_1px_rgba(255,255,255,0.5)_inset] p-0 overflow-hidden">
              <div className="p-8">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-[26px] text-black dark:text-white tracking-tight">Add New Employee</DialogTitle>
                  <DialogDescription className="text-[15px] text-black/60 dark:text-white/60">Enter the details of the new employee.</DialogDescription>
                </DialogHeader>
               
                <form className="space-y-4 mt-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="fullName" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="position" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Position</Label>
                    <Input
                      id="position"
                      placeholder="Enter employee position"
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Set an initial password"
                        value={newEmployee.password}
                        onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                        className="h-[50px] pr-12 backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70 transition-all duration-200 active:scale-90"
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="workType" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Work Type</Label>
                    <Select
                      value={newEmployee.type}
                      onValueChange={(value) => setNewEmployee({ ...newEmployee, type: value })}
                    >
                      <SelectTrigger className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white shadow-sm">
                        <SelectValue placeholder="Select work type" />
                      </SelectTrigger>
                      <SelectContent className="backdrop-blur-[80px] bg-white/90 dark:bg-black/90 border border-white/40 dark:border-white/[0.15] rounded-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-1.5">
                        <SelectItem value="fulltime" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Full-time</SelectItem>
                        <SelectItem value="intern1" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Intern (Working)</SelectItem>
                        <SelectItem value="intern2" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Intern (Learning)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-[52px] rounded-[16px] text-white text-[16px] font-medium border-0 transition-all duration-300 active:scale-[0.97] hover:scale-[1.01] mt-6 shadow-[0_8px_24px_rgba(34,118,49,0.4)] hover:shadow-[0_12px_32px_rgba(34,118,49,0.5)]"
                    style={{
                      background: 'linear-gradient(180deg, #227631 0%, #3FA740 100%)',
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleAddEmployee();
                    }}
                  >
                    Add Employee
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />

            <Input
              placeholder="Search name or email"
              className="pl-10 bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/20 rounded-2xl backdrop-blur-sm "
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={() => {
                if (searchTerm.trim() === "") return;

                setSearchQuery(searchTerm);
                fetchEmployeesPage(1, pageSize, searchTerm);
              }}
            />
          </div>

        </Card>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} ({totalCount} employees)</div>
          {/* <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(1, pageSize)} disabled={page === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.max(1, page - 1), pageSize)} disabled={page === 1}>Prev</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), page + 1), pageSize)} disabled={page >= Math.max(1, Math.ceil(totalCount / pageSize))}>Next</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.max(1, Math.ceil(totalCount / pageSize)), pageSize)} disabled={page >= Math.max(1, Math.ceil(totalCount / pageSize))}>Last</Button>
          </div> */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <Card
              key={employee.id}
              className="p-6 space-y-4 bg-white dark:bg-[#333335] rounded-3xl shadow-sm"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold">{employee.name}</CardTitle>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{employee.email}</span>
                </div>
              </CardHeader>
              <hr className="" />
              <CardContent className="text-sm py-2 my-2">
                <div className="" />
                <div className="space-y-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">
                      {employee.type === "fulltime"
                        ? "Full time"
                        : employee.type === "intern1"
                          ? "Working"
                          : "Learning"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Position:</span>
                    <span className="font-medium">{employee.position || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Work Hours:</span>
                    <span className="font-medium">
                      {formatTime12hCompactFromString(employee.work_time_start)} - {formatTime12hCompactFromString(employee.work_time_end)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Leaves:</span>
                    <span className="font-medium">{formatLeaveUsage(employee.used_leaves, employee.total_leaves)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{employee.created_at ? new Date(employee.created_at).toLocaleString() : "-"}</span>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      size="sm"
                      className="w-full rounded-[12px] bg-blue-600 hover:bg-blue-700 text-white border-0 transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg"
                      onClick={() => openEdit(employee)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full  rounded-[12px] border-white/60 dark:border-white/20 hover:bg-white/40 dark:hover:bg-white/10 transition-all duration-200 active:scale-95"
                      onClick={() => openResetDialog(employee.id)}
                    >
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      className="w-full rounded-[12px] bg-red-600 hover:bg-red-700 text-white border-0 transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg"
                      onClick={() => confirmDelete(employee.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Removed alternative list view; grid card view remains */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="p-8 sm:max-w-[440px] backdrop-blur-[80px] bg-white/80 dark:bg-black/60 border border-white/40 dark:border-white/[0.15] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_1px_rgba(255,255,255,0.5)_inset] p-0 overflow-hidden">
            <div className="p-8">
              <DialogHeader className='space-y-2'>

                <DialogTitle className="text-[26px] text-black dark:text-white tracking-tight">Reset Password</DialogTitle>
                <DialogDescription className="text-[15px] text-black/60 dark:text-white/60">
                  Set a new password for <span className="font-semibold text-black dark:text-white">{employees.find(e => e.id === resetUserId)?.name}</span>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-6">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="p-5 text-center"
                />

              </div>
              <DialogFooter>
                {/* <Button   variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button> */}
                <Button
                  className="w-full h-[52px] rounded-[16px] text-white text-[16px] font-medium border-0 transition-all duration-300 active:scale-[0.97] hover:scale-[1.01] mt-6 shadow-[0_8px_24px_rgba(34,118,49,0.4)] hover:shadow-[0_12px_32px_rgba(34,118,49,0.5)]"
                  style={{
                    background: 'linear-gradient(180deg, #227631 0%, #3FA740 100%)',
                  }}
                  onClick={handleResetPassword}>Reset Password</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-[440px] backdrop-blur-[80px] bg-white/80 dark:bg-black/60 border border-white/40 dark:border-white/[0.15] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_1px_rgba(255,255,255,0.5)_inset] p-0 overflow-hidden">
            <div className="p-8">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-[26px] text-black dark:text-white tracking-tight">Delete Employee</DialogTitle>
                <DialogDescription className="text-[15px] text-black/60 dark:text-white/60">
                  Are you sure you want to delete <span className="font-medium text-black dark:text-white">{employees.find(e => e.id === deleteUserId)?.name}</span>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 mt-8">
                <Button
                  className="flex-1 h-[52px] rounded-[16px] text-white text-[16px] font-medium border-0 transition-all duration-300 active:scale-[0.97] hover:scale-[1.01] shadow-[0_8px_24px_rgba(220,38,38,0.4)] hover:shadow-[0_12px_32px_rgba(220,38,38,0.5)] bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteEmployee}
                >
                  Delete
                </Button>
                <Button
                  className="flex-1 h-[52px] rounded-[16px] text-black dark:text-white text-[16px] font-medium backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] transition-all duration-300 active:scale-[0.97] hover:scale-[1.01] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] shadow-sm"
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[440px] backdrop-blur-[80px] bg-white/80 dark:bg-black/60 border border-white/40 dark:border-white/[0.15] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35),0_0_1px_rgba(255,255,255,0.5)_inset] p-0 overflow-hidden">
            {editEmployee && (
              <div className="p-8">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-[26px] text-black dark:text-white tracking-tight">Edit Employee</DialogTitle>
                  <DialogDescription className="text-[15px] text-black/60 dark:text-white/60">Update the details of the employee.</DialogDescription>
                </DialogHeader>
                <form className="space-y-4 mt-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="ename" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Full Name</Label>
                    <Input
                      id="ename"
                      value={editEmployee.name ?? ""}
                      onChange={(e) => setEditEmployee({ ...editEmployee, name: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="eemail" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Email</Label>
                    <Input
                      id="eemail"
                      type="email"
                      value={editEmployee.email ?? ""}
                      onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="eposition" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Position</Label>
                    <Input
                      id="eposition"
                      value={editEmployee.position ?? ""}
                      onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
                      className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label className="text-[13px] text-black/70 dark:text-white/70 pl-1">Work Type</Label>
                    <Select value={editEmployee.type ?? "fulltime"} onValueChange={(v) => setEditEmployee({ ...editEmployee, type: v })}>
                      <SelectTrigger className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white shadow-sm">
                        <SelectValue placeholder="Select work type" />
                      </SelectTrigger>
                      <SelectContent className="backdrop-blur-[80px] bg-white/90 dark:bg-black/90 border border-white/40 dark:border-white/[0.15] rounded-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-1.5">
                        <SelectItem value="fulltime" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Full-time</SelectItem>
                        <SelectItem value="intern1" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Intern (Working)</SelectItem>
                        <SelectItem value="intern2" className="text-[15px] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] my-0.5 px-3 py-2.5 cursor-pointer transition-all duration-150">Intern (Learning)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="estart" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Work Start</Label>
                      <Input
                        id="estart"
                        value={editEmployee.work_time_start ?? ""}
                        onChange={(e) => setEditEmployee({ ...editEmployee, work_time_start: e.target.value })}
                        className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="eend" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Work End</Label>
                      <Input
                        id="eend"
                        value={editEmployee.work_time_end ?? ""}
                        onChange={(e) => setEditEmployee({ ...editEmployee, work_time_end: e.target.value })}
                        className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="etotal" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Total Leaves</Label>
                      <Input
                        id="etotal"
                        type="number"
                        value={editEmployee.total_leaves ?? 0}
                        onChange={(e) => setEditEmployee({ ...editEmployee, total_leaves: Number(e.target.value) })}
                        className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="eused" className="text-[13px] text-black/70 dark:text-white/70 pl-1">Used Leaves</Label>
                      <Input
                        id="eused"
                        type="number"
                        value={editEmployee.used_leaves ?? 0}
                        onChange={(e) => setEditEmployee({ ...editEmployee, used_leaves: Number(e.target.value) })}
                        className="h-[50px] backdrop-blur-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.15] rounded-[14px] px-4 transition-all duration-200 focus:bg-black/[0.06] dark:focus:bg-white/[0.12] focus:border-black/[0.15] dark:focus:border-white/[0.25] text-[15px] text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 shadow-sm"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleUpdateEmployee}
                    className="w-full h-[52px] rounded-[16px] text-white text-[16px] font-medium border-0 transition-all duration-300 active:scale-[0.97] hover:scale-[1.01] mt-6 shadow-[0_8px_24px_rgba(34,118,49,0.4)] hover:shadow-[0_12px_32px_rgba(34,118,49,0.5)]"
                    style={{ background: 'linear-gradient(180deg, #227631 0%, #3FA740 100%)' }}
                  >
                    Save Changes
                  </Button>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
