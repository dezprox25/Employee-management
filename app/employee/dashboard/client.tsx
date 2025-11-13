"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle, LayoutDashboard, CalendarDays, ListChecks, Loader2 } from "lucide-react"
import { CardEntrance } from "@/components/animations/card-entrance"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import { cn, formatTime12hCompactFromString, formatTime12hFromDate } from "@/lib/utils"
import LeavemManagement from '@/app/employee/leaves/page'
import AttendanceNanagement from '@/app/employee/attendance/page'
import { useToast } from "@/hooks/use-toast"
import { SlideToCheckIn } from "@/components/employee/slide-to-check-in"
import { SlideToCheckOut } from "@/components/employee/slide-to-check-out"
import { motion, AnimatePresence } from "framer-motion"
import EmployeeSVG from "/employee-working.svg"
import { WorkDurationCard } from "@/components/employee/WorkDurationCard"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface UserData {
  name: string
  type: string
  work_time_start: string
  work_time_end: string
  total_leaves: number
  used_leaves: number
}

interface TodayAttendance {
  login_time?: string
  logout_time?: string
  status: string
  total_hours?: number
}

// Local time-tracking record used for slide-to-check-in/out UI
interface TimeRecord {
  id: string
  date: string
  checkIn: string
  checkOut?: string
}

export default function EmployeeDashboardClient() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPunchedIn, setIsPunchedIn] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "leaves" | "attendance">("dashboard")
  // Local time-tracking state for animated check-in/out UI
  const [records, setRecords] = useState<TimeRecord[]>([])
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null)
  const [workDuration, setWorkDuration] = useState<string>("00:00:00")
  // Late reason form state
  const [lateDialogOpen, setLateDialogOpen] = useState(false)
  const [lateReason, setLateReason] = useState("")
  const [lateReasonPreset, setLateReasonPreset] = useState("")
  const [latePunchTimestamp, setLatePunchTimestamp] = useState<string>("")
  const [lateSubmitting, setLateSubmitting] = useState(false)
  // Auto punch-out configuration and state
  const CONFIRM_ON_LEAVE = true
  const unloadSentRef = useRef(false)
  const commonLateReasons = useMemo(
    () => [
      "Traffic",
      "Public transport delay",
      "Medical appointment",
      "Personal emergency",
      "System issues",
      "Weather",
    ],
    [],
  )

  // Sidebar links must be declared before any conditional returns to preserve hook order
  const links = useMemo(
    () => [
      {
        label: "Dashboard",
        href: "/employee/dashboard?pane=dashboard",
        icon: <LayoutDashboard className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault()
          router.push("/employee/dashboard?pane=dashboard")
          setActiveTab("dashboard")
        },
      },
      {
        label: "Leave Management",
        href: "/employee/dashboard?pane=leaves",
        icon: <CalendarDays className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault()
          router.push("/employee/dashboard?pane=leaves")
          setActiveTab("leaves")
        },
      },
      {
        label: "My Attendance Records",
        href: "/employee/dashboard?pane=attendance",
        icon: <ListChecks className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault()
          router.push("/employee/dashboard?pane=attendance")
          setActiveTab("attendance")
        },
      },
    ],
    [router],
  )

  // Sync active tab with the pane query param for deep linking/backwards compatibility
  useEffect(() => {
    const p = searchParams.get("pane")
    if (p === "leaves" || p === "attendance" || p === "dashboard") {
      setActiveTab(p as "dashboard" | "leaves" | "attendance")
    } else {
      setActiveTab("dashboard")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchUserData()
  }, [])

  // Hydrate local time records and any active session from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("timeRecords")
      if (raw) {
        const parsed: TimeRecord[] = JSON.parse(raw)
        setRecords(Array.isArray(parsed) ? parsed : [])
        const active = parsed.find((r) => !r.checkOut)
        if (active) setActiveSession(active)
      }
    } catch (err) {
      console.warn("Failed to read timeRecords from storage", err)
    }
  }, [])

  // Update visible work duration while a session is active
  useEffect(() => {
    if (!activeSession) {
      setWorkDuration("00:00:00")
      return
    }
    const startMs = new Date(activeSession.checkIn).getTime()
    const tick = () => {
      const diffMs = Date.now() - startMs
      const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
      const seconds = String(totalSeconds % 60).padStart(2, "0")
      setWorkDuration(`${hours}:${minutes}:${seconds}`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  // Flush any pending offline punch-out from previous shutdowns
  useEffect(() => {
    const flushPending = async () => {
      try {
        const pending = localStorage.getItem("pendingPunchOut")
        if (!pending) return
        const record = JSON.parse(pending)
        // Attempt server-side reconciliation
        const res = await fetch("/api/employee/auto-punch-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "reconcile", source: "app-load", ts: record?.ts }),
          credentials: "include",
          cache: "no-store",
        })
        if (res.ok) {
          localStorage.removeItem("pendingPunchOut")
          console.info("[auto-punch-out] reconciled pending punch-out on app load")
          fetchUserData()
        } else {
          console.warn("[auto-punch-out] reconciliation failed", await res.text())
        }
      } catch (err) {
        console.error("[auto-punch-out] reconciliation error", err)
      }
    }
    flushPending()
  }, [])

  // Load records when switching to attendance tab
  useEffect(() => {
    if (activeTab === "attendance") {
      fetchAttendanceRecords()
    }
  }, [activeTab])

  const fetchUserData = async () => {
    const supabase = createClient()
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from("users").select("*").eq("id", user.id).single()

        setUserData(data)

        const today = new Date().toISOString().split("T")[0]
        const { data: attendance } = await supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .single()

        if (attendance) {
          setTodayAttendance(attendance)
          setIsPunchedIn(!attendance.logout_time)
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceRecords = async () => {
    const supabase = createClient()
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("attendance")
        .select("date, status, login_time, logout_time, total_hours")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(30)
      setAttendanceRecords(data || [])
    } catch (error) {
      console.error("Error fetching attendance records:", error)
    }
  }

  // Punch in/out logic is handled by the unified Punch component

  // Reliable tab/browser close detection with sendBeacon + fallbacks
  useEffect(() => {
    const sendAutoPunchOut = (trigger: string) => {
      try {
        if (unloadSentRef.current) return
        unloadSentRef.current = true

        const payload = JSON.stringify({
          trigger,
          source: "beforeunload/pagehide",
          ts: new Date().toISOString(),
          ua: (typeof navigator !== "undefined" && navigator.userAgent) || "",
        })
        const blob = new Blob([payload], { type: "application/json" })

        let beaconOk = false
        try {
          if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            beaconOk = navigator.sendBeacon("/api/employee/auto-punch-out", blob)
            console.info("[auto-punch-out] sendBeacon invoked", { ok: beaconOk, trigger })
          }
        } catch (beErr) {
          console.error("[auto-punch-out] sendBeacon error", beErr)
        }

        if (!beaconOk) {
          // Fallback: keepalive fetch (supported by Chrome/Edge/Firefox/Safari 16+)
          try {
            fetch("/api/employee/auto-punch-out", {
              method: "POST",
              body: payload,
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              keepalive: true,
            }).catch((fe) => console.warn("[auto-punch-out] keepalive fetch failed", fe))
          } catch (fe) {
            console.warn("[auto-punch-out] keepalive fetch error", fe)
          }
        }

        if (!beaconOk && typeof navigator !== "undefined" && navigator.onLine === false) {
          // Offline: persist intent for reconciliation on next app load
          try {
            localStorage.setItem(
              "pendingPunchOut",
              JSON.stringify({ ts: new Date().toISOString(), trigger }),
            )
            console.info("[auto-punch-out] stored pending punch-out due to offline state")
          } catch (lsErr) {
            console.warn("[auto-punch-out] localStorage write failed", lsErr)
          }
        }
      } catch (err) {
        console.error("[auto-punch-out] unexpected error in sender", err)
      }
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isPunchedIn) return
      // Optional confirmation per business logic
      if (CONFIRM_ON_LEAVE) {
        e.preventDefault()
        e.returnValue = ""
      }
      // Try synchronous punch-out start
      sendAutoPunchOut("beforeunload")
    }

    const onPageHide = () => {
      if (!isPunchedIn) return
      // Safari reliability: pagehide fires even on bfcache
      sendAutoPunchOut("pagehide")
      // Best-effort local checkout to update state; may not complete before unload
      try {
        void handleCheckOut()
      } catch (err) {
        console.warn("[auto-punch-out] local handleCheckOut failed", err)
      }
    }

    if (isPunchedIn) {
      unloadSentRef.current = false
      window.addEventListener("beforeunload", onBeforeUnload, { capture: true })
      window.addEventListener("pagehide", onPageHide, { capture: true })
      console.debug("[auto-punch-out] unload handlers attached")
    }

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload, { capture: true } as any)
      window.removeEventListener("pagehide", onPageHide, { capture: true } as any)
      unloadSentRef.current = false
      console.debug("[auto-punch-out] unload handlers detached")
    }
  }, [isPunchedIn])

  // submitLateReason removed; late reason capture handled inside Punch component
  // Late status computation based on scheduled work start and 10-minute tolerance
  const computeStatus = (): "present" | "late" => {
    try {
      const now = new Date()
      const scheduled = new Date()
      const [h, m] = (userData?.work_time_start || "09:00").split(":").map((v) => parseInt(v, 10))
      scheduled.setHours(h || 9, m || 0, 0, 0)
      const toleranceMinutes = 10
      return now.getTime() > scheduled.getTime() + toleranceMinutes * 60 * 1000 ? "late" : "present"
    } catch {
      return "present"
    }
  }

  if (loading) return <div>Loading...</div>

  // Format a record timestamp as 12-hour time with AM/PM
  const formatRecordTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      const hours = date.getHours()
      const minutes = String(date.getMinutes()).padStart(2, "0")
      const ampm = hours >= 12 ? "PM" : "AM"
      const formattedHours = hours % 12 || 12
      return `${formattedHours}:${minutes} ${ampm}`
    } catch {
      return isoString
    }
  }

  // Process employee check-in (local-only for animated UI)
  const handleCheckIn = async () => {
    if (activeSession) {
      toast({ title: "Already checked in", description: "You have an active session.", variant: "destructive" })
      return
    }
    const now = new Date()
    const status = computeStatus()
    const nowIso = now.toISOString()
    // Late: open dialog to capture reason, defer DB insert until submit
    if (status === "late") {
      setLatePunchTimestamp(nowIso)
      setLateDialogOpen(true)
      return
    }

    // On-time present: persist to Supabase and local state
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Not authenticated", description: "Please log in to punch in.", variant: "destructive" })
        return
      }
      await supabase.from("attendance").insert({
        user_id: user.id,
        date: nowIso.split("T")[0],
        login_time: nowIso,
        status,
        reason: null,
      })

      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        date: nowIso.split("T")[0],
        checkIn: nowIso,
      }
      const updated = [newRecord, ...records]
      setRecords(updated)
      setActiveSession(newRecord)
      setIsPunchedIn(true)
      try {
        localStorage.setItem("timeRecords", JSON.stringify(updated))
      } catch (err) {
        console.warn("Failed to persist timeRecords", err)
      }
      toast({ title: "Checked in", description: formatRecordTime(newRecord.checkIn) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Punch in failed", description: error?.message || "Could not update attendance.", variant: "destructive" })
    }
  }

  // Process employee check-out (local-only for animated UI)
  const handleCheckOut = async () => {
    if (!activeSession) {
      toast({ title: "No active session", description: "You are not checked in.", variant: "destructive" })
      return
    }
    const now = new Date()
    const nowIso = now.toISOString()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Not authenticated", description: "Please log in to punch out.", variant: "destructive" })
        return
      }

      // Compute total hours using local activeSession check-in
      let totalHours = 0
      try {
        const loginDate = new Date(activeSession.checkIn)
        totalHours = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60)
      } catch {}

      await supabase
        .from("attendance")
        .update({ logout_time: nowIso, total_hours: totalHours })
        .eq("user_id", user.id)
        .eq("date", nowIso.split("T")[0])

      const updated = records.map((r) => (r.id === activeSession.id ? { ...r, checkOut: nowIso } : r))
      setRecords(updated)
      setActiveSession(null)
      setIsPunchedIn(false)
      try {
        localStorage.setItem("timeRecords", JSON.stringify(updated))
      } catch (err) {
        console.warn("Failed to persist timeRecords", err)
      }
      toast({ title: "Checked out", description: formatRecordTime(nowIso) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Punch out failed", description: error?.message || "Could not update attendance.", variant: "destructive" })
    }
  }

  // Submit late reason and complete late punch-in
  const submitLate = async () => {
    try {
      setLateSubmitting(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Not authenticated", description: "Please log in to punch in.", variant: "destructive" })
        return
      }
      const nowIso = latePunchTimestamp || new Date().toISOString()
      const finalReason = `${lateReasonPreset ? `${lateReasonPreset}: ` : ""}${lateReason.trim()}`
      if (!finalReason.trim()) {
        toast({ title: "Reason required", description: "Please enter a reason for late punch-in.", variant: "destructive" })
        return
      }
      await supabase.from("attendance").insert({
        user_id: user.id,
        date: nowIso.split("T")[0],
        login_time: nowIso,
        status: "late",
        reason: finalReason,
      })

      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        date: nowIso.split("T")[0],
        checkIn: nowIso,
      }
      const updated = [newRecord, ...records]
      setRecords(updated)
      setActiveSession(newRecord)
      setIsPunchedIn(true)
      try {
        localStorage.setItem("timeRecords", JSON.stringify(updated))
      } catch (err) {
        console.warn("Failed to persist timeRecords", err)
      }

      setLateDialogOpen(false)
      setLateReason("")
      setLateReasonPreset("")
      toast({ title: "Punched in (late)", description: formatRecordTime(nowIso) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Late reason failed", description: error?.message || "Could not save late reason.", variant: "destructive" })
    } finally {
      setLateSubmitting(false)
    }
  }

  const leavesRemaining = userData ? userData.total_leaves - userData.used_leaves : 0

  // links declared above

  return (
    <div
      className={cn(
        "mx-auto flex w-full  flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-background md:flex-row dark:border-neutral-700",
        "h-screen",
      )}
    >
      <Sidebar open={open} setOpen={setOpen} >
        <SidebarBody className="justify-between  gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <div className="mt-4 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={{ label: link.label, href: link.href, icon: link.icon }}
                  onClick={link.onClick as any}
                />
              ))}
            </div>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Late reason dialog for late punch-in */}
      <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Late punch-in reason</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Timestamp:</span> {latePunchTimestamp || new Date().toISOString()}
            </div>

            <div className="grid gap-2">
              <label htmlFor="commonReason" className="text-sm font-medium">Common reasons (optional)</label>
              <select
                id="commonReason"
                value={lateReasonPreset}
                onChange={(e) => setLateReasonPreset(e.target.value)}
                className="w-full rounded-md border bg-background p-2 text-sm"
                aria-label="Select a common late reason"
              >
                <option value="">Select a common reason</option>
                {commonLateReasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label htmlFor="lateReason" className="text-sm font-medium">Reason (required)</label>
              <Textarea
                id="lateReason"
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="Write a brief explanation..."
                aria-required="true"
                className="min-h-[88px]"
              />
              {!lateReason.trim() && (
                <p className="text-xs text-destructive">Reason is required.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setLateDialogOpen(false)
                  setLateReason("")
                  setLateReasonPreset("")
                }}
                aria-label="Cancel late reason"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitLate}
                disabled={lateSubmitting || !lateReason.trim()}
                aria-label="Submit late reason"
              >
                {lateSubmitting ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content area */}
      <div className="flex flex-1 p-4 md:p-8 overflow-y-auto ">
        <div className="flex h-full w-full flex-1 flex-col gap-6 rounded-tl-2xl bg-transparent  ">
          {/* Breadcrumb */}
          <div className="text-sm text-muted-foreground">
            Employee / Dashboard{activeTab !== "dashboard" ? ` / ${activeTab === "leaves" ? "Leaves" : "Attendance"}` : ""}
          </div>
          {activeTab === "dashboard" && (
            <>
              <CardEntrance delay={0}>
                <Card className="bg-black text-white min-h-[300px] text-center place-content-center  ">
                  <CardHeader>
                    <CardTitle className="text-4xl  font-bold tracking-wider text-green-600 ">Welcome back {userData?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold  ">
                      {userData?.type === "fulltime"
                        ? "Full-time Employee"
                        : userData?.type === "intern1"
                          ? "Working Intern"
                          : "Learning Intern"}
                    </p>
                    <p className="text-2xl font-bold mt-2">
                      Working Hours: {formatTime12hCompactFromString(userData?.work_time_start)} - {formatTime12hCompactFromString(userData?.work_time_end)}
                    </p>
                  </CardContent>
                  <img src="/employee-working.png" alt="" className="w-96 lg:absolute top-0 right-10" />
                </Card>
              </CardEntrance>

              <CardEntrance delay={0.1}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Today's Attendance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold font-mono">{formatTime12hFromDate(currentTime)}</div>
                      <div className="text-sm text-muted-foreground mt-2">{currentTime.toLocaleDateString()}</div>
                    </div>

                    {todayAttendance && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge
                            variant={
                              todayAttendance.status === "present"
                                ? "default"
                                : todayAttendance.status === "late"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {todayAttendance.status}
                          </Badge>
                        </div>
                        {todayAttendance.login_time && (
                          <div className="flex justify-between">
                            <span>Punch In:</span>
                            <span>{new Date(todayAttendance.login_time).toLocaleTimeString()}</span>
                          </div>
                        )}
                        {todayAttendance.logout_time && (
                          <div className="flex justify-between">
                            <span>Punch Out:</span>
                            <span>{new Date(todayAttendance.logout_time).toLocaleTimeString()}</span>
                          </div>
                        )}
                        {todayAttendance.total_hours && (
                          <div className="flex justify-between font-semibold">
                            <span>Total Hours:</span>
                            <span>{todayAttendance.total_hours.toFixed(2)} hrs</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* <Punch
                      className="w-full"
                      isPunchedIn={isPunchedIn}
                      userData={{ work_time_start: userData?.work_time_start }}
                      commonLateReasons={commonLateReasons}
                      onPunchedIn={({ status, login_time }) => {
                        setIsPunchedIn(true)
                        toast({
                          title: status === "late" ? "Punched in (late)" : "Punched in",
                          description: new Date(login_time).toLocaleTimeString(),
                        })
                        fetchUserData()
                      }}
                      onPunchedOut={({ total_hours, logout_time }) => {
                        setIsPunchedIn(false)
                        toast({
                          title: "Punched out",
                          description: `Worked ${total_hours.toFixed(2)} hrs`,
                        })
                        fetchUserData()
                      }}
                      onError={(message) =>
                        toast({ title: "Punch failed", description: message, variant: "destructive" })
                      }
                    /> */}
                    <AnimatePresence mode="wait">
                      {activeSession ? (
                        <WorkDurationCard
                          duration={workDuration}
                          checkInTime={formatRecordTime(activeSession.checkIn)}
                        />
                      ) : null}
                    </AnimatePresence>
                    
                    <motion.div
                      className="space-y-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      {!activeSession ? (
                        <SlideToCheckIn onComplete={handleCheckIn} />
                      ) : (
                        <SlideToCheckOut onComplete={handleCheckOut} />
                      )}
                    </motion.div>
                  </CardContent>
                </Card>
              </CardEntrance>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CardEntrance delay={0.2}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{leavesRemaining}</div>
                      <p className="text-xs text-muted-foreground">
                        {userData?.used_leaves}/{userData?.total_leaves} used
                      </p>
                      <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${((userData?.used_leaves || 0) / (userData?.total_leaves || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </CardEntrance>

                <CardEntrance delay={0.3}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full bg-transparent" variant="outline">
                        Apply for Leave
                      </Button>
                    </CardContent>
                  </Card>
                </CardEntrance>
              </div>
            </>
          )}

          {activeTab === "leaves" && (
            // <Card>
            //   <CardHeader>
            //     <CardTitle>Leave Management</CardTitle>
            //   </CardHeader>
            //   <CardContent className="space-y-6">
            //     <div className="flex items-center justify-between">
            //       <div>
            //         <div className="text-sm text-muted-foreground">Used / Total</div>
            //         <div className="text-xl font-semibold">
            //           {userData?.used_leaves ?? 0} / {userData?.total_leaves ?? 0}
            //         </div>
            //       </div>fsdgadgvar
            //       <Button variant="default">Apply for Leave</Button>
            //     </div>
            //     <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            //       <div
            //         className="h-full bg-primary"
            //         style={{ width: `${((userData?.used_leaves || 0) / (userData?.total_leaves || 1)) * 100}%` }}
            //       />
            //     </div>
            //   </CardContent>
            // </Card>
            <LeavemManagement />
          )}

          {activeTab === "attendance" && (
            // <Card>
            //   <CardHeader>
            //     <CardTitle>My Attendance Records</CardTitle>
            //   </CardHeader>
            //   <CardContent>
            //     <div className="space-y-2">
            //       {attendanceRecords.length === 0 && (
            //         <div className="text-sm text-muted-foreground">No records found</div>
            //       )}
            //       {attendanceRecords.map((r, idx) => (
            //         <div key={idx} className="grid grid-cols-4 gap-2 text-sm py-2 border-b">
            //           <div>{new Date(r.date).toLocaleDateString()}</div>
            //           <div>
            //             <Badge
            //               variant={
            //                 r.status === "present" ? "default" : r.status === "late" ? "secondary" : "destructive"
            //               }
            //             >
            //               {r.status}
            //             </Badge>
            //           </div>
            //           <div>{r.login_time ? new Date(r.login_time).toLocaleTimeString() : "-"}</div>
            //           <div>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "-"}</div>
            //         </div>
            //       ))}
            //     </div>
            //   </CardContent>
            // </Card>
            <AttendanceNanagement />

          )}
        </div>
      </div>
    </div>
  )
}