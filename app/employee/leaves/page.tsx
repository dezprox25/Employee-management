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
import { Plus, FileDown, X, CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageTransition } from "@/components/animations/page-transition"
import { CardEntrance } from "@/components/animations/card-entrance"
import { StatsGrid } from "@/components/animations/stats-grid"
import { StatCounter } from "@/components/animations/stat-counter"
import { PulseButton } from "@/components/animations/pulse-button"

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
    ;(async () => {
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
    <CardEntrance key={leave.id} delay={index * 0.05}>
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight">
                  {new Date(leave.from_date).toLocaleDateString()} – {new Date(leave.to_date).toLocaleDateString()}
                </span>
                <Badge className={getStatusColor(leave.status)} variant="secondary">
                  {leave.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {leave.category.charAt(0).toUpperCase() + leave.category.slice(1)} • {leave.duration === "full-day" ? "Full Day" : "Half Day"}
              </p>
              <p className="text-sm leading-relaxed">{leave.reason}</p>
              <div className="flex flex-wrap items-center gap-3">
                {leave.document_url ? (
                  <a
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    href={leave.document_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileDown className="w-4 h-4" /> View document
                  </a>
                ) : null}
                {leave.admin_comment ? (
                  <span className="text-xs text-muted-foreground">Admin: {leave.admin_comment}</span>
                ) : null}
              </div>
              {leave.decision_at ? (
                <p className="text-xs text-muted-foreground">Updated: {new Date(leave.decision_at).toLocaleString()}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Submitted: {new Date(leave.applied_at).toLocaleString()}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {leave.status === "pending" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
                  onClick={() => handleCancel(leave.id)}
                >
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </CardEntrance>
  )

  return (
    // Layout: constrain height to viewport and enable vertical scrolling
    // Added: min/max height with overflow to ensure consistent scroll on all devices
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background">
      {/* <PageTransition /> */}
      {/* <NavigationHeader title="Leave Management" /> */}

      {/* Hero Section */}
      <div className="relative mx-auto  px-6 pt-6">
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-4 p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">My Leaves</h2>
                <p className="text-muted-foreground text-sm md:text-base">Track, apply, and manage leave requests with elegant clarity.</p>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <PulseButton isPulsing={leaves.length === 0}>
                    <Plus className="w-4 h-4" />
                    Apply for Leave
                  </PulseButton>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle className="text-xl">Apply for Leave</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="from_date" className="text-sm">From Date</Label>
                      <Input
                        id="from_date"
                        type="date"
                        value={newLeave.from_date}
                        onChange={(e) => setNewLeave({ ...newLeave, from_date: e.target.value })}
                        className="transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="to_date" className="text-sm">To Date</Label>
                      <Input
                        id="to_date"
                        type="date"
                        value={newLeave.to_date}
                        onChange={(e) => setNewLeave({ ...newLeave, to_date: e.target.value })}
                        className="transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm">Leave Type</Label>
                      <Select
                        value={newLeave.category}
                        onValueChange={(val) => setNewLeave({ ...newLeave, category: val as Leave["category"] })}
                      >
                        <SelectTrigger id="category" className="transition-all">
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
                        <SelectTrigger id="duration" className="transition-all">
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
                      <Textarea
                        id="reason"
                        value={newLeave.reason}
                        onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                        placeholder="Please provide a reason for your leave..."
                        className="min-h-24 transition-all focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="document" className="text-sm">Supporting Document (optional)</Label>
                      <Input
                        id="document"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setNewLeave({ ...newLeave, document: e.target.files?.[0] ?? null })}
                        className="transition-all"
                      />
                    </div>
                  </div>
                  <Button onClick={handleApplyLeave} className="w-full" disabled={submitting || uploading}>
                    {submitting || uploading ? "Submitting..." : "Submit Leave Request"}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <StatsGrid>
              <Card className="bg-background/60 backdrop-blur ">
                <CardContent className="pt-6 flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Total Requests</div>
                    <div className="text-lg font-semibold"><StatCounter from={0} to={stats.total} /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur">
                <CardContent className="pt-6 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Pending</div>
                    <div className="text-lg font-semibold"><StatCounter from={0} to={stats.pending} /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur">
                <CardContent className="pt-6 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Approved</div>
                    <div className="text-lg font-semibold"><StatCounter from={0} to={stats.approved} /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/60 backdrop-blur">
                <CardContent className="pt-6 flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Rejected</div>
                    <div className="text-lg font-semibold"><StatCounter from={0} to={stats.rejected} /></div>
                  </div>
                </CardContent>
              </Card>
            </StatsGrid>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto overflow-y-auto px-6 py-8 space-y-6 h-[calc(100vh-180px)] scroll-smooth">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {filteredLeaves.length === 0 ? (
          <CardEntrance>
            <Card>
              <CardContent className="pt-8">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarDays className="size-6" />
                    </EmptyMedia>
                    <EmptyTitle>No leave requests found</EmptyTitle>
                    <EmptyDescription>
                      Start by submitting a new leave request. You can attach a document if needed.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Plus className="w-4 h-4" /> Apply for Leave
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          </CardEntrance>
        ) : (
          // Content list: cap height and allow inner scroll to keep header visible
          <div className="space-y-3 max-h-[60dvh] overflow-y-auto pr-1">
            {filteredLeaves.map((leave, idx) => renderLeaveCard(leave, idx))}
          </div>
        )}
      </div>
    </div>
  )
}
