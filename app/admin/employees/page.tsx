"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Employee {
  id: string
  name: string
  password:string
  email: string
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
  const [open, setOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    type: "fulltime",
    password: "",
  })
  const [searchQuery, setSearchQuery] = useState("")
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
  const fetchEmployeesPage = useCallback(async (newPage: number, newPageSize: number) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", String(newPage))
      params.set("pageSize", String(newPageSize))
      params.set("search", searchQuery)
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

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp)
    setEditOpen(true)
  }

  const handleUpdateEmployee = async () => {
    if (!editEmployee?.id) return
    try {
      const payload: any = {}
      ;["name", "email", "type", "work_time_start", "work_time_end", "total_leaves", "used_leaves"].forEach((k) => {
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
      const password = newEmployee.password

      const emailRegex = /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*|"(?:[^"]|\\")+")@(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|\[(?:\d{1,3}\.){3}\d{1,3}\])$/
      if (!name || !email || !password) {
        toast({ variant: "destructive", title: "Missing fields", description: "Please provide name, email, and password" })
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
          type: newEmployee.type,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      let data: any = { error: undefined }
      try {
        data = await res.json()
      } catch {}

      if (!res.ok) {
        console.error("[EmployeesPage] add employee failed", { status: res.status, body: data })
        toast({
          variant: "destructive",
          title: "Failed to add employee",
          description: data?.error || `Server returned ${res.status}`,
        })
        return
      }

      toast({ title: "Success", description: "Employee account created" })
      setOpen(false)
      setNewEmployee({ name: "", email: "", type: "fulltime", password: "" })
      fetchEmployeesPage(page, pageSize)
    } catch (error: any) {
      const isAbort = error?.name === "AbortError"
      console.error("[EmployeesPage] network error during add", error)
      toast({
        variant: "destructive",
        title: isAbort ? "Network timeout" : "Network error",
        description: isAbort ? "Request timed out. Please try again." : (error?.message || "Unexpected error occurred"),
      })
      // Form data is preserved by not clearing state here
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
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetUserId, new_password: pwd }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: "destructive", title: "Reset failed", description: data?.error || `Server returned ${res.status}` })
        return
      }
      toast({ title: "Password updated", description: "Employee password has been reset" })
      setResetOpen(false)
      setResetUserId(null)
      setResetNewPassword("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Network error", description: error?.message || "Failed to reset password" })
    }
  }

  if (!isAdmin) return null
  if (loading) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">Employees</h2>
          {/* Removed view toggle and page size select to simplify UI */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    placeholder="Set an initial password"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Work Type</Label>
                  <Select value={newEmployee.type} onValueChange={(type) => setNewEmployee({ ...newEmployee, type })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fulltime">Full-time</SelectItem>
                      <SelectItem value="intern1">Intern (Working)</SelectItem>
                      <SelectItem value="intern2">Intern (Learning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddEmployee} className="w-full">
                  Add Employee
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-3">
            <Label htmlFor="search">Search</Label>
            <Input id="search" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onBlur={() => fetchEmployeesPage(1, pageSize)} 
            placeholder="Search name or email"
            className="w-1/3" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} ({totalCount} employees)</div>
          {/* <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(1, pageSize)} disabled={page === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.max(1, page - 1), pageSize)} disabled={page === 1}>Prev</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), page + 1), pageSize)} disabled={page >= Math.max(1, Math.ceil(totalCount / pageSize))}>Next</Button>
            <Button variant="outline" size="sm" onClick={() => fetchEmployeesPage(Math.max(1, Math.ceil(totalCount / pageSize)), pageSize)} disabled={page >= Math.max(1, Math.ceil(totalCount / pageSize))}>Last</Button>
          </div> */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleEmployees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader>
                <CardTitle className="text-lg">{employee.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Email:</span> {employee.email}
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  {employee.type === "fulltime"
                    ? "Full-time"
                    : employee.type === "intern1"
                      ? "Intern (Working)"
                      : "Intern (Learning)"}
                </div>
                <div>
                  <span className="text-muted-foreground">Work Hours:</span> {employee.work_time_start} -{" "}
                  {employee.work_time_end}
                </div>
                <div>
                  <span className="text-muted-foreground">Leaves:</span> {employee.used_leaves}/{employee.total_leaves}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span> {employee.created_at ? new Date(employee.created_at).toLocaleString() : "-"}
                </div>
                <div>
                  {/* <span className="text-muted-foreground">Password:</span> {employee.password} */}
                </div>
                <div className="pt-4">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => openEdit(employee)}
                    >
                      Edit
                    </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => openResetDialog(employee.id)}
                  >
                    Reset Password
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Enter a new strong password for this employee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button onClick={handleResetPassword}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Employee</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this employee? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteEmployee}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>
            {editEmployee && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ename">Full Name</Label>
                  <Input id="ename" value={editEmployee.name ?? ""} onChange={(e) => setEditEmployee({ ...editEmployee, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="eemail">Email</Label>
                  <Input id="eemail" type="email" value={editEmployee.email ?? ""} onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })} />
                </div>
                <div>
                  <Label>Work Type</Label>
                  <Select value={editEmployee.type ?? "fulltime"} onValueChange={(v) => setEditEmployee({ ...editEmployee, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fulltime">Full-time</SelectItem>
                      <SelectItem value="intern1">Intern (Working)</SelectItem>
                      <SelectItem value="intern2">Intern (Learning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="estart">Work Start</Label>
                    <Input id="estart" value={editEmployee.work_time_start ?? ""} onChange={(e) => setEditEmployee({ ...editEmployee, work_time_start: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="eend">Work End</Label>
                    <Input id="eend" value={editEmployee.work_time_end ?? ""} onChange={(e) => setEditEmployee({ ...editEmployee, work_time_end: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="etotal">Total Leaves</Label>
                    <Input id="etotal" type="number" value={editEmployee.total_leaves ?? 0} onChange={(e) => setEditEmployee({ ...editEmployee, total_leaves: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label htmlFor="eused">Used Leaves</Label>
                    <Input id="eused" type="number" value={editEmployee.used_leaves ?? 0} onChange={(e) => setEditEmployee({ ...editEmployee, used_leaves: Number(e.target.value) })} />
                  </div>
                </div>
                <Button onClick={handleUpdateEmployee} className="w-full">Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}


