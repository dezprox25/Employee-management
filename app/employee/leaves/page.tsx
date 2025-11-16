"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useState } from "react"
import { NavigationHeader } from "@/components/navigation-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, FileDown, X, CalendarDays, CheckCircle2, Clock, XCircle, Calendar, FileText, ChevronDown, CheckCircle, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageTransition } from "@/components/animations/page-transition"
import { CardEntrance } from "@/components/animations/card-entrance"
import { StatsGrid } from "@/components/animations/stats-grid"
import { StatCounter } from "@/components/animations/stat-counter"
import { PulseButton } from "@/components/animations/pulse-button"
import { motion } from "motion/react"

interface Leave {
  id: string
  user_id: string
  from_date: string
  to_date: string
  category: "sick" | "vacation" | "personal" | "other"
  duration: "full-day" | "half-day"
  reason: string
  document_url?: string | null
  status: "pending" | "approved" | "rejected" | "cancelled"
  applied_at: string
  decision_at?: string | null
  admin_comment?: string | null
}

// LeavesPage: enhanced scroll behavior and minor typing improvements
export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [totalLeaves, setTotalLeaves] = useState<number | null>(null)
  const [usedLeaves, setUsedLeaves] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "cancelled">("all")
  const [newLeave, setNewLeave] = useState({
    from_date: "",
    to_date: "",
    category: "vacation" as Leave["category"],
    duration: "full-day" as Leave["duration"],
    reason: "",
    document: null as File | null,
  })
  const { toast } = useToast()

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchLeaves()
      // Subscribe to realtime updates for this user's leaves
      ; (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const channel = supabase
          .channel("realtime-leaves")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "leaves", filter: `user_id=eq.${user.id}` },
            (payload: { eventType?: string; new?: Partial<Leave> }) => {
              // Re-fetch or apply incremental update
              fetchLeaves()
              const action = payload.eventType?.toLowerCase()
              if (action === "update") {
                const next = payload.new as Partial<Leave>
                if (next.status && ["approved", "rejected", "cancelled"].includes(next.status)) {
                  toast({ title: "Leave status updated", description: `Your leave is ${next.status}.` })
                }
              }
            },
          )
          .subscribe()
        return () => {
          supabase.removeChannel(channel)
        }
      })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchLeaves = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from("leaves")
          .select("*")
          .eq("user_id", user.id)
          .order("applied_at", { ascending: false })
        if (error) throw error
        const rows = (data as any[]) || []
        const normalized: Leave[] = rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          from_date: r.from_date,
          to_date: r.to_date,
          category: (r.category ?? "other") as Leave["category"],
          duration: (r.duration ?? r.leave_type ?? "full-day") as Leave["duration"],
          reason: r.reason ?? "",
          document_url: r.document_url ?? null,
          status: (r.status ?? "pending") as Leave["status"],
          applied_at: r.applied_at,
          decision_at: r.decision_at ?? r.updated_at ?? null,
          admin_comment: r.admin_comment ?? null,
        }))
        setLeaves(normalized)
        // compute used leave days from approved leave rows
        try {
          let used = 0
            ; (normalized || []).forEach((r) => {
              if (r.status !== "approved") return
              try {
                const from = new Date(r.from_date)
                const to = r.to_date ? new Date(r.to_date) : from
                const dayMs = 1000 * 60 * 60 * 24
                const diff = Math.round((to.getTime() - from.getTime()) / dayMs)
                const days = Math.max(0, diff) + 1
                if ((r.duration || "full-day") === "half-day") used += 0.5
                else used += days
              } catch { }
            })
          const rounded = Math.round(used * 2) / 2
          setUsedLeaves(rounded)
        } catch (err) {
          setUsedLeaves(null)
        }

        // fetch user's total_leaves for display
        try {
          const { data: profile } = await supabase.from("users").select("total_leaves").eq("id", user.id).single()
          setTotalLeaves(profile?.total_leaves ?? null)
        } catch { setTotalLeaves(null) }
      }
    } catch (error) {
      console.error("Error fetching leaves:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch leaves",
      })
    } finally {
      setLoading(false)
    }
  }

  const leaveSchema = z
    .object({
      from_date: z.string().min(1, "Start date is required"),
      to_date: z.string().min(1, "End date is required"),
      category: z.enum(["sick", "vacation", "personal", "other"]),
      duration: z.enum(["full-day", "half-day"]),
      reason: z.string().trim().min(5, "Please provide a more detailed reason").max(1000, "Reason too long"),
      document: z.instanceof(File).optional().nullable(),
    })
    .refine((v) => new Date(v.from_date) <= new Date(v.to_date), {
      path: ["to_date"],
      message: "End date must be on or after start date",
    })
    .refine((v) => (v.duration === "half-day" ? v.from_date === v.to_date : true), {
      path: ["duration"],
      message: "Half-day leave must have the same start and end date",
    })

  const sanitizeReason = (reason: string) => reason.replace(/[<>]/g, "").trim()

  const uploadDocument = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split(".").pop()
      const fileName = `leave-${Date.now()}.${fileExt}`
      const filePath = `${userId}/${fileName}`
      // Prefer leave_docs bucket; fallback to documents
      const tryUpload = async (bucket: string) => {
        const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })
        if (error) throw error
        const { data: urlData } = await supabase.storage.from(bucket).getPublicUrl(data.path)
        return urlData?.publicUrl ?? null
      }
      try {
        return await tryUpload("leave_docs")
      } catch (e) {
        return await tryUpload("documents")
      }
    } catch (error) {
      console.error("Document upload error:", error)
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload supporting document" })
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleApplyLeave = async () => {
    try {
      setSubmitting(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const parsed = leaveSchema.safeParse(newLeave)
      if (!parsed.success) {
        const firstErr = parsed.error.errors[0]
        toast({ variant: "destructive", title: "Invalid input", description: firstErr.message })
        setSubmitting(false)
        return
      }

      const docUrl = newLeave.document ? await uploadDocument(newLeave.document, user.id) : null

      const { error } = await supabase.from("leaves").insert({
        user_id: user.id,
        from_date: newLeave.from_date,
        to_date: newLeave.to_date,
        // Backward compatibility with legacy schema
        leave_type: newLeave.duration,
        category: newLeave.category,
        duration: newLeave.duration,
        reason: sanitizeReason(newLeave.reason),
        document_url: docUrl,
        status: "pending",
      })
      if (error) throw error

      toast({
        title: "Success",
        description: "Leave request submitted",
      })

      setOpen(false)
      setNewLeave({
        from_date: "",
        to_date: "",
        category: "vacation",
        duration: "full-day",
        reason: "",
        document: null,
      })

      fetchLeaves()
    } catch (error: any) {
      console.error("Apply leave error:", error)
      const msg = typeof error?.message === "string" ? error.message : "Failed to apply for leave"
      const details = typeof error?.details === "string" ? error.details : undefined
      toast({
        variant: "destructive",
        title: "Error",
        description: details ? `${msg} – ${details}` : msg,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Derived values must be declared before any early returns to keep hook order stable
  const stats = useMemo(() => {
    const pending = leaves.filter((l) => l.status === "pending").length
    const approved = leaves.filter((l) => l.status === "approved").length
    const rejected = leaves.filter((l) => l.status === "rejected").length
    const cancelled = leaves.filter((l) => l.status === "cancelled").length
    return { total: leaves.length, pending, approved, rejected, cancelled }
  }, [leaves])

  const filteredLeaves = useMemo(() => {
    if (filter === "all") return leaves
    return leaves.filter((l) => l.status === filter)
  }, [leaves, filter])

  if (loading) return <div>Loading...</div>

  /**
   * Maps a leave status to Tailwind classes for badge styling.
   * Change: narrowed type and documented intent.
   */
  const getStatusColor = (status: Leave["status"]) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "cancelled":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const handleCancel = async (leaveId: string) => {
    try {
      const { error } = await supabase.rpc("cancel_leave", { leave_id_input: leaveId })
      if (error) throw error
      toast({ title: "Cancelled", description: "Your leave request was cancelled" })
      fetchLeaves()
    } catch (error) {
      console.error("Cancel error:", error)
      toast({ variant: "destructive", title: "Failed", description: "Could not cancel this request" })
    }
  }



  /**
   * Render an animated leave card with hover affordances.
   * Note: Cards participate in inner scroll container introduced below.
   */
  const renderLeaveCard = (leave: Leave, index: number) => (
    <motion.div key={leave.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg">
                    {leave.category.charAt(0).toUpperCase() + leave.category.slice(1)}
                  </h3>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${leave.status === "pending" ? "bg-amber-100 text-amber-700" : leave.status === "approved" ? "bg-emerald-100 text-emerald-700" : leave.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                    {leave.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {leave.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {leave.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                    {leave.status === "cancelled" && <X className="h-3 w-3 mr-1" />}
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(leave.from_date).toLocaleDateString()} - {new Date(leave.to_date).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span>{leave.duration === "full-day" ? "Full Day" : "Half Day"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Reason:</p>
                <p className="text-sm">{leave.reason}</p>
              </div>

              {leave.document_url ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <a href={leave.document_url} target="_blank" rel="noreferrer" className="hover:underline">
                    Document
                  </a>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Applied on: {new Date(leave.applied_at).toLocaleDateString()}</span>
                {leave.decision_at ? <><span>•</span><span>Updated: {new Date(leave.decision_at).toLocaleDateString()}</span></> : null}
                {leave.admin_comment ? <><span>•</span><span>Admin: {leave.admin_comment}</span></> : null}
              </div>
            </div>
          </div>

          <div className="flex md:flex-col gap-2">
            {leave.status === "pending" && (
              <Button
                variant="outline"
                className="h-9 px-4 rounded-lg text-sm border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => handleCancel(leave.id)}
              >
                Cancel
              </Button>
            )}
            {/* <Button variant="outline" className="h-9 px-4 rounded-lg text-sm">View Details</Button> */}
          </div>
        </div>
      </Card>
    </motion.div>
  )

  return (
    // Layout: constrain height to viewport and enable vertical scrolling
    // Added: min/max height with overflow to ensure consistent scroll on all devices
    <div className=" bg-[#E8E8ED] dark:bg-[#1C1C1E] p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl mb-2">My Leaves</h1>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{usedLeaves ?? 0}</span>
              <span className="mx-1">/</span>
              <span className="opacity-80">{totalLeaves ?? "-"}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Track, apply, and manage leave requests with elegant clarity.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-3">
            <DialogTrigger asChild>
              <Button className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#227631] to-[#3FA740] text-white">
                <Plus className="h-4 w-4 mr-2" /> Apply for Leave
              </Button>
            </DialogTrigger>

            <Button
              onClick={async () => {
                // call the page-level fetch to refresh leaves list
                try {
                  await fetchLeaves()
                  toast({ title: "Refreshed", description: "Leave list updated" })
                } catch (err) {
                  console.error("Refresh leaves failed", err)
                  toast({ variant: "destructive", title: "Error", description: "Failed to refresh leaves" })
                }
              }}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#227631] to-[#3FA740] text-white hover:opacity-90"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_date" className="text-sm">From Date</Label>
                <Input id="from_date" type="date"   className="[color-scheme:light] dark:[color-scheme:dark]" value={newLeave.from_date} onChange={(e) => setNewLeave({ ...newLeave, from_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_date" className="text-sm">To Date</Label>
                <Input id="to_date" type="date"   className="[color-scheme:light] dark:[color-scheme:dark]"  value={newLeave.to_date} onChange={(e) => setNewLeave({ ...newLeave, to_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm">Leave Type</Label>
                <Select value={newLeave.category} onValueChange={(val) => setNewLeave({ ...newLeave, category: val as Leave["category"] })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm">Duration</Label>
                <Select value={newLeave.duration} onValueChange={(d) => setNewLeave({ ...newLeave, duration: d as Leave["duration"] })}>
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-day">Full Day</SelectItem>
                    <SelectItem value="half-day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="reason" className="text-sm">Reason</Label>
                <Textarea id="reason" value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} placeholder="Please provide a reason for your leave..." />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="document" className="text-sm">Supporting Document (optional)</Label>
                <Input id="document" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setNewLeave({ ...newLeave, document: e.target.files?.[0] ?? null })} />
              </div>
            </div>
            <Button onClick={handleApplyLeave} className="w-full" disabled={submitting || uploading}>{submitting || uploading ? "Submitting..." : "Submit Leave Request"}</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Requests</p>
              <p className="text-2xl">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-2xl">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Approved</p>
              <p className="text-2xl">{stats.approved}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Rejected</p>
              <p className="text-2xl">{stats.rejected}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center gap-2 border-b">
          {["all", "pending", "approved", "rejected", "cancelled"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as typeof filter)}
              className={`px-4 py-2 text-sm transition-all relative ${filter === tab ? "" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {filter === tab && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#227631] to-[#3FA740]" />
              )}
            </button>
          ))}
        </div>

        {filteredLeaves.length === 0 ? (
          <Card className="p-16">
            <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <CalendarDays className="h-8 w-8" />
              </div>
              <h3 className="text-xl mb-3">No leave requests found</h3>
              <p className="text-sm text-muted-foreground mb-6">Start by submitting a new leave request. You can attach a document if needed.</p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" /> Apply for Leave
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLeaves.map((leave, idx) => renderLeaveCard(leave, idx))}
          </div>
        )}
      </div>
    </div>
  )
}
