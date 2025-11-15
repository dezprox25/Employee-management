"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle, LayoutDashboard, CalendarDays, ClipboardList, Loader2, LogOut, Menu, X, ChevronRight } from "lucide-react"
import { CardEntrance } from "@/components/animations/card-entrance"

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
// import { DashboardHeader } from "@/components/employee/DashboardHeader"
import { DashboardHeader } from "@/components/employee/DashboardHeader"

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
  const logoutSentRef = useRef(false)
  const syncTokenRef = useRef(0)

  const localCheckout = useCallback(() => {
    setIsPunchedIn(false)
    setActiveSession(null)
    try {
      localStorage.removeItem("timeRecords")
    } catch { }
  }, [setIsPunchedIn, setActiveSession])

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
        icon: <ClipboardList className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
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

  useEffect(() => {
    const run = async () => {
      try {
        const pending = localStorage.getItem("pendingLogout")
        if (!pending) return
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.auth.signOut()
        }
        localStorage.removeItem("pendingLogout")
      } catch (err) {
      }
    }
    run()
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
      } else {
        setIsPunchedIn(false)
        setActiveSession(null)
        try {
          const raw = localStorage.getItem("timeRecords")
          if (raw) {
            localStorage.removeItem("timeRecords")
          }
        } catch {}
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
      if (CONFIRM_ON_LEAVE) {
        e.preventDefault()
        e.returnValue = ""
      }
      sendAutoPunchOut("beforeunload")
      localCheckout()
    }

    const onPageHide = () => {
      if (!isPunchedIn) return
      sendAutoPunchOut("pagehide")
      localCheckout()
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

  useEffect(() => {
    const clearAuthStorage = () => {
      try {
        const keys = Object.keys(localStorage)
        keys.forEach((k) => {
          if (/^sb-/i.test(k) || /supabase/i.test(k) || /auth/i.test(k)) {
            try { localStorage.removeItem(k) } catch {}
          }
        })
      } catch {}
      try {
        const skeys = Object.keys(sessionStorage)
        skeys.forEach((k) => {
          if (/^sb-/i.test(k) || /supabase/i.test(k) || /auth/i.test(k)) {
            try { sessionStorage.removeItem(k) } catch {}
          }
        })
      } catch {}
    }

    const autoLogout = async (trigger: string) => {
      try {
        if (logoutSentRef.current) return
        logoutSentRef.current = true
        const supabase = createClient()
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase.auth.signOut()
          }
        } catch {}
        clearAuthStorage()
      } catch (err) {
        try {
          localStorage.setItem("pendingLogout", JSON.stringify({ ts: new Date().toISOString(), trigger }))
        } catch {}
      }
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      localCheckout()
      autoLogout("beforeunload")
    }
    const onPageHide = () => {
      localCheckout()
      autoLogout("pagehide")
    }

    window.addEventListener("beforeunload", onBeforeUnload, { capture: true })
    window.addEventListener("pagehide", onPageHide, { capture: true })

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload as any, { capture: true } as any)
      window.removeEventListener("pagehide", onPageHide as any, { capture: true } as any)
      logoutSentRef.current = false
    }
  }, [])

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
      } catch { }

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

  const handleLogout = async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch { }
    router.replace("/auth/login")
  }

  const onMenuClick = () => setOpen(true)

  interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    onNavigate: (page: string) => void
    currentPage: string
    onLogout: () => void
    isEmployee?: boolean
  }

  function SidebarPanel({ isOpen, onClose, onNavigate, currentPage, onLogout, isEmployee = false }: SidebarProps) {
    const adminMenuItems = [
      { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
      { icon: CalendarDays, label: "Leaves", page: "leaves" },
      { icon: ClipboardList, label: "Attendance", page: "attendance" },
    ]
    const employeeMenuItems = [
      { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
      { icon: CalendarDays, label: "Leave Management", page: "leaves" },
      { icon: ClipboardList, label: "Attendance", page: "attendance" },
    ]
    const menuItems = isEmployee ? employeeMenuItems : adminMenuItems
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
        )}
        <aside
          className={`fixed left-0 top-0 h-full bg-white/70 dark:bg-white/15 backdrop-blur-2xl border-r border-white/60 dark:border-white/20 z-50 transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
            } w-64 flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}
        >
          <div className="flex items-center justify-between p-6 border-b border-white/50 dark:border-white/20">
            <div className="flex items-center relative">
              <img src="/dezprox horizontal black logo.png" alt="Deeprox Logo" className="h-8 w-auto dark:hidden" />
              <img src="/dezprox horizontal white logo.png" alt="Deeprox Logo" className="h-8 w-auto hidden dark:block" />
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon as any
                return (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-[20px] transition-all group ${currentPage === item.page
                        ? "bg-white/70 dark:bg-white/15 text-green-600 dark:text-green-400 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/60 dark:border-white/20"
                        : "text-foreground hover:bg-white/40 dark:hover:bg-white/10 border border-transparent"
                      }`}
                    onClick={() => onNavigate(item.page)}
                  >
                    <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${currentPage === item.page ? "" : "group-hover:rotate-12"}`} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
          <div className="border-t border-white/30 dark:border-white/10">
            <div className="p-4">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-white/30 dark:hover:bg-red-950/30 backdrop-blur-sm transition-all group"
              >
                <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1 group-hover:scale-110" />
                <span className="transition-transform group-hover:translate-x-1">Logout</span>
              </button>
            </div>
          </div>
        </aside>
      </>
    )
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full  flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-background md:flex-row dark:border-neutral-700",
        "h-screen",
      )}
    >
      <SidebarPanel
        isOpen={open}
        onClose={() => setOpen(false)}
        onNavigate={(page) => {
          if (page === "dashboard") {
            router.push("/employee/dashboard?pane=dashboard")
            setActiveTab("dashboard")
          } else if (page === "leaves") {
            router.push("/employee/dashboard?pane=leaves")
            setActiveTab("leaves")
          } else if (page === "attendance") {
            router.push("/employee/dashboard?pane=attendance")
            setActiveTab("attendance")
          }
        }}
        currentPage={activeTab}
        onLogout={handleLogout}
        isEmployee={true}
      />

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
      <div className="flex flex-1 flex-col overflow-y-auto lg:ml-64  bg-[#E8E8ED] dark:bg-[#1C1C1E] ">
        <DashboardHeader onMenuClick={onMenuClick}  isEmployee={true} />
        <div className="flex h-full w-full flex-1 flex-col gap-6 rounded-tl-2xl bg-transparent p-5   ">
          {/* Breadcrumb */}
         
          {activeTab === "dashboard" && (
            <>
              <Card className="bg-black border-0 rounded-[24px] h-96 p-8 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-3xl text-[#3FA740] font-bold tracking-wider mb-3 text-center">Welcome back {userData?.name ?? "Employee"}</h2>
                    <p className="text-white text-center mb-1">
                      {userData?.type === "fulltime" ? "Full-time Employee" : userData?.type === "intern1" ? "Working Intern" : "Learning Intern"}
                    </p>
                    <p className="text-white/70 text-center">Working Hours: {formatTime12hCompactFromString(userData?.work_time_start)} - {formatTime12hCompactFromString(userData?.work_time_end)}</p>
                  </div>
                  <img src="/employee-working.png" alt="Employee" className="h-40 w-auto" />
                </div>
              </Card>

              <Card className="backdrop-blur-[40px] bg-white/80 dark:bg-black/60 border border-white/20 dark:border-white/10 rounded-[32px] p-8 shadow-2xl">
                <div className="flex items-center gap-2 text-muted-foreground mb-6">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm">Today's Attendance</span>
                </div>
                <div className="text-center mb-8">
                  <div className="text-6xl text-foreground mb-2">{formatTime12hFromDate(currentTime)}</div>
                  <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</div>
                </div>
                {!activeSession ? (
                  <div className="space-y-4">
                    <SlideToCheckIn onComplete={handleCheckIn} />
                    <p className="text-center text-xs text-muted-foreground">Drag the button to start work</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm">Active Session</span>
                      </div>
                    </div>
                    <WorkDurationCard duration={workDuration} checkInTime={formatRecordTime(activeSession.checkIn)} />
                    <div className="space-y-4">
                      <SlideToCheckOut onComplete={handleCheckOut} />
                      <p className="text-center text-xs text-muted-foreground">Drag the button to end your work day</p>
                    </div>
                  </div>
                )}
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm">Leave Balance</h3>
                    <span className="text-xs text-muted-foreground">Info</span>
                  </div>
                  <div>
                    <div className="mb-3">
                      <div className="text-5xl mb-1">{(userData?.total_leaves ?? 0) - (userData?.used_leaves ?? 0)}</div>
                      <div className="text-sm text-muted-foreground">{userData?.used_leaves ?? 0}/{userData?.total_leaves ?? 0} used</div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${((userData?.used_leaves || 0) / Math.max(1, userData?.total_leaves || 1)) * 100}%` }} />
                    </div>
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="mb-6 text-sm">Quick Actions</h3>
                  <Button onClick={() => setActiveTab("leaves")} className="w-full justify-between h-12 rounded-xl bg-background text-foreground border hover:bg-muted transition-all">
                    <span className="text-sm">Apply for Leave</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Card>
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
