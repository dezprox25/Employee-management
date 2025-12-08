"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, LayoutDashboard, CalendarDays, ClipboardList, Loader2, LogOut, X, ChevronRight } from 'lucide-react'
import { cn, formatTime12hCompactFromString, formatTime12hFromDate } from "@/lib/utils"
import LeavemManagement from '@/app/employee/leaves/page'
import AttendanceNanagement from '@/app/employee/attendance/page'
import { useToast } from "@/hooks/use-toast"
import { SlideToCheckIn } from "@/components/employee/slide-to-check-in"
import { SlideToCheckOut } from "@/components/employee/slide-to-check-out"
import { WorkDurationCard } from "@/components/employee/WorkDurationCard"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { DashboardHeader } from "@/components/employee/DashboardHeader"
import { useHeartbeat } from "@/hooks/use-heartbeat"
import { useTheme } from "next-themes"

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

interface TimeRecord {
  id: string
  date: string
  checkIn: string
  checkOut?: string
  rowId?: number
}

export function isFutureTimestamp(iso: string) {
  try {
    return new Date(iso).getTime() - Date.now() > 60 * 1000
  } catch {
    return false
  }
}

export function computeTotalHours(loginIso: string, logoutIso: string) {
  try {
    const start = new Date(loginIso).getTime()
    const end = new Date(logoutIso).getTime()
    return Math.max(0, (end - start) / (1000 * 60 * 60))
  } catch {
    return 0
  }
}

export function closeLatestOpenSession(rows: Array<{ id: number; login_time: string; logout_time?: string }>, nowIso: string) {
  const idx = rows.findIndex((r) => !r.logout_time)
  if (idx === -1) return rows
  const r = rows[idx]
  const total = computeTotalHours(r.login_time, nowIso)
  const updated = { ...r, logout_time: nowIso }
  return rows.map((row, i) => (i === idx ? updated : row))
}

export default function EmployeeDashboardClient() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()

  const [userData, setUserData] = useState<UserData | null>(null)
  const [computedUsedLeaves, setComputedUsedLeaves] = useState<number | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPunchedIn, setIsPunchedIn] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<"dashboard" | "leaves" | "attendance">("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lateDialogOpen, setLateDialogOpen] = useState(false)
  const [lateReason, setLateReason] = useState("")
  const [lateReasonPreset, setLateReasonPreset] = useState("")

  const [records, setRecords] = useState<TimeRecord[]>([])
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null)
  const [workDuration, setWorkDuration] = useState<string>("00:00:00")

  const punchOutSentRef = useRef(false)
  const isUnloadingRef = useRef(false)

  const commonLateReasons = useMemo(
    () => ["Traffic", "Public transport delay", "Medical appointment", "Personal emergency", "System issues", "Weather"],
    []
  )

  const sidebarLinks = useMemo(
    () => [
      { label: "Dashboard", page: "dashboard", icon: LayoutDashboard },
      { label: "Leave Management", page: "leaves", icon: CalendarDays },
      { label: "My Attendance", page: "attendance", icon: ClipboardList },
    ],
    []
  )

  useEffect(() => {
    try {
      const a = new Image()
      a.src = "/dezprox horizontal black logo.png"
      const b = new Image()
      b.src = "/dezprox horizontal white logo.png"
    } catch {}
  }, [])

  const fetchUserData = useCallback(async () => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsPunchedIn(false)
        setActiveSession(null)
        setUserData(null)
        setUserId("")
        setTodayAttendance(null)
        try {
          localStorage.removeItem("timeRecords")
        } catch { }
        return
      }

      setUserId(user.id)

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single()

      setUserData(userData)

      if (userData?.work_time_start && userData?.work_time_end) {
        const start = new Date(userData.work_time_start)
        const end = new Date(userData.work_time_end)
        setWorkDuration(`${start.getHours()}:${start.getMinutes()}:${end.getHours()}:${end.getMinutes()}`)
      }

      // Compute used leaves from the `leaves` table as a fallback/verification
      // This avoids showing stale values if `users.used_leaves` is out-of-sync.
      (async () => {
        try {
          const { data: leaveRows, error: leaveErr } = await supabase
            .from("leaves")
            .select("from_date,to_date,duration,status")
            .eq("user_id", user.id)
            .in("status", ["approved"])

          if (leaveErr) {
            console.warn('[fetchUserData] could not read leaves to compute used_leaves', leaveErr)
            setComputedUsedLeaves(null)
            return
          }

          let used = 0
            ; (leaveRows || []).forEach((r: any) => {
              try {
                if (!r || !r.from_date) return
                const from = new Date(r.from_date)
                const to = r.to_date ? new Date(r.to_date) : from
                // Count inclusive days
                const dayMs = 1000 * 60 * 60 * 24
                const diff = Math.round((to.getTime() - from.getTime()) / dayMs)
                const days = Math.max(0, diff) + 1

                if ((r.duration || "full-day") === "half-day") {
                  // Treat a half-day leave as 0.5 (assume single-day half-day records)
                  used += 0.5
                } else {
                  used += days
                }
              } catch (err) {
                // ignore row-level parsing problems
              }
            })

          // Round to nearest 0.5 to avoid weird floating errors
          const rounded = Math.round(used * 2) / 2
          setComputedUsedLeaves(rounded)
          console.info('[fetchUserData] computed used leaves from leaves table', rounded)
        } catch (err) {
          console.warn('[fetchUserData] compute used leaves error', err)
          setComputedUsedLeaves(null)
        }
      })()

      const today = new Date().toISOString().split("T")[0]
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("login_time", { ascending: false })
        .limit(1)

      const attendance = attendanceData?.[0] || null
      setTodayAttendance(attendance)

      const isActive = !!(attendance && attendance.login_time && !attendance.logout_time)
      setIsPunchedIn(isActive)

      if (isActive && !activeSession) {
        const newRecord: TimeRecord = {
          id: crypto.randomUUID(),
          date: today,
          checkIn: attendance.login_time,
          rowId: typeof attendance.id === "number" ? attendance.id : undefined,
        }
        setRecords([newRecord])
        setActiveSession(newRecord)
        try {
          localStorage.setItem("timeRecords", JSON.stringify([newRecord]))
        } catch { }
      } else if (!isActive && activeSession) {
        const logoutTime = attendance?.logout_time || new Date().toISOString()
        const updated = records.map((r) =>
          !r.checkOut ? { ...r, checkOut: logoutTime } : r
        )
        setRecords(updated)
        setActiveSession(null)
        setIsPunchedIn(false)
        try {
          localStorage.setItem("timeRecords", JSON.stringify(updated))
        } catch { }
      }
    } catch (error) {
      console.error("[fetchUserData] Error:", error)
    } finally {
      setLoading(false)
    }
  }, [activeSession, records])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  // Heartbeat hook
  useHeartbeat({
    employeeId: userId,
    enabled: !loading && !!userId && isPunchedIn,
    interval: 10000,
  })

  // Real-time subscription
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const subscription = supabase
      .channel(`employee_status:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_status",
          filter: `employee_id=eq.${userId}`,
        },
        (payload: any) => {
          const newStatus = payload.new
          if (newStatus?.status === "OUT" && isPunchedIn) {
            setIsPunchedIn(false)
            setActiveSession(null)
            try {
              localStorage.removeItem("timeRecords")
            } catch { }
            toast({
              title: <span className="dark:text-white">Auto Punch-Out</span>,
              description: <span className="dark:text-white">You have been automatically punched out due to inactivity.</span>,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [userId, isPunchedIn, toast])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const today = new Date().toISOString().split("T")[0]
    const channel = supabase
      .channel(`attendance:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new
          if (!row || row.date !== today) return
          setTodayAttendance(row)
          const punchedIn = !!(row.login_time && !row.logout_time)
          setIsPunchedIn(punchedIn)
          if (punchedIn) {
            const rec: TimeRecord = { id: crypto.randomUUID(), date: row.date, checkIn: row.login_time, rowId: typeof row.id === "number" ? row.id : undefined }
            setRecords([rec])
            setActiveSession(rec) 
            try { localStorage.setItem("timeRecords", JSON.stringify([rec])) } catch {}
            toast({ title: <span className="dark:text-white">Checked in</span>, description: <span className="dark:text-white">{formatRecordTime(row.login_time)}</span> })
          } else {
            toast({ title: <span className="dark:text-white">Attendance updated</span> })
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "attendance", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new
          const oldRow = payload.old
          if (!row || row.date !== today) return
          setTodayAttendance(row)
          const punchedIn = !!(row.login_time && !row.logout_time)
          setIsPunchedIn(punchedIn)
          const logoutChanged = !!row.logout_time && oldRow?.logout_time !== row.logout_time
          const loginChanged = !!row.login_time && oldRow?.login_time !== row.login_time
          if (logoutChanged) {
            setRecords((cur) => cur.map((r) => (!r.checkOut ? { ...r, checkOut: row.logout_time } : r)))
            setActiveSession(null)
            try { localStorage.removeItem("timeRecords") } catch {}
            toast({ title: <span className="dark:text-white">Checked out</span>, description: <span className="dark:text-white">{formatRecordTime(row.logout_time)}</span> })
          } else if (loginChanged && punchedIn) {
            const rec: TimeRecord = { id: crypto.randomUUID(), date: row.date, checkIn: row.login_time, rowId: typeof row.id === "number" ? row.id : undefined }
            setRecords([rec])
            setActiveSession(rec)
            try { localStorage.setItem("timeRecords", JSON.stringify([rec])) } catch {}
            toast({ title: <span className="dark:text-white">Checked in</span>, description: <span className="dark:text-white">{formatRecordTime(row.login_time)}</span> })
          } else {
            toast({ title: <span className="dark:text-white">Attendance updated</span> })
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, toast])

  // Auto punch-out on tab close
  useEffect(() => {
    if (!isPunchedIn || !userId) return

    const handleTabClose = () => {
      if (isUnloadingRef.current || punchOutSentRef.current) return

      isUnloadingRef.current = true
      punchOutSentRef.current = true

      const payload = JSON.stringify({
        trigger: "tab_close",
        timestamp: new Date().toISOString(),
      })

      // Try sendBeacon first (most reliable)
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon("/api/employee/auto-punch-out", payload)
        console.log("[tab-close] sendBeacon sent:", sent)
      } else {
        // Fallback to fetch with keepalive
        fetch("/api/employee/auto-punch-out", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
        }).catch(err => console.warn("[tab-close] fetch failed:", err))
      }

      // Clear local state
      try {
        localStorage.removeItem("timeRecords")
        localStorage.setItem("pendingPunchOut", JSON.stringify({
          timestamp: new Date().toISOString(),
          trigger: "tab_close"
        }))
      } catch { }
    }

    // Use both events for better browser compatibility
    window.addEventListener("beforeunload", handleTabClose)
    window.addEventListener("pagehide", handleTabClose)

    return () => {
      window.removeEventListener("beforeunload", handleTabClose)
      window.removeEventListener("pagehide", handleTabClose)
    }
  }, [isPunchedIn, userId])

  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange(async (event: any) => {
      if (event === "SIGNED_OUT") {
        await performAutoPunchOut("auth_signout")
      }
    })
    return () => {
      try { (data as any)?.subscription?.unsubscribe?.() } catch {}
    }
  }, [isPunchedIn, userId])

  // Check for pending punch-out on mount
  useEffect(() => {
    const checkPendingPunchOut = async () => {
      try {
        const pending = localStorage.getItem("pendingPunchOut")
        if (!pending) return

        const data = JSON.parse(pending)

        // Try to sync with server
        const response = await fetch("/api/employee/auto-punch-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger: "reconciliation",
            source: "app_reload",
            timestamp: data.timestamp,
          }),
          credentials: "include",
        })

        if (response.ok) {
          localStorage.removeItem("pendingPunchOut")
          toast({
            title: <span className="dark:text-white">Session Restored</span>,
            description: <span className="dark:text-white">Your previous session was automatically closed.</span>,
          })
        }
      } catch (err) {
        console.error("[reconciliation] Error:", err)
      }
    }

    if (!loading) {
      checkPendingPunchOut()
    }
  }, [loading, toast])

  useEffect(() => {
    const run = async () => {
      if (loading || !userId) return
      const row = todayAttendance
      if (!row?.login_time || row?.logout_time) return
      const lastTs = (typeof localStorage !== "undefined" && localStorage.getItem("lastAutoPunchOutTs")) || null
      const loginAgeMs = Date.now() - new Date(row.login_time).getTime()
      const thresholdMs = 2 * 60 * 1000
      if (lastTs && loginAgeMs > thresholdMs) {
        try {
          const res = await fetch("/api/employee/auto-punch-out", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ trigger: "rejoin_correction", source: "app_reload" }),
          })
          if (res.ok) {
            try { localStorage.removeItem("lastAutoPunchOutTs") } catch {}
            toast({ title: <span className="dark:text-white">Session corrected</span> })
            fetchUserData()
          }
        } catch {}
      }
    }
    run()
  }, [userId, loading, todayAttendance, fetchUserData, toast])

  // Work duration timer
  useEffect(() => {
    if (!activeSession) {
      setWorkDuration("00:00:00")
      return
    }

    const updateDuration = () => {
      const startMs = new Date(activeSession.checkIn).getTime()
      const diffMs = Date.now() - startMs
      const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
      const seconds = String(totalSeconds % 60).padStart(2, "0")
      setWorkDuration(`${hours}:${minutes}:${seconds}`)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync active tab
  useEffect(() => {
    const p = searchParams.get("pane")
    if (p === "leaves" || p === "attendance" || p === "dashboard") {
      setActiveTab(p as any)
    }
  }, [searchParams])

  const LATE_GRACE_MINUTES = 10
  const computeStatus = (): "present" | "late" => {
    try {
      if (!userData?.work_time_start) return "present"
      const now = new Date()
      const scheduled = new Date()
      const [h, m] = userData.work_time_start.split(":").map((v) => parseInt(v, 10))
      scheduled.setHours(h || 9, m || 0, 0, 0)
      return now.getTime() > scheduled.getTime() + LATE_GRACE_MINUTES * 60 * 1000 ? "late" : "present"
    } catch {
      return "present"
    }
  }

  const lateThresholdText = useMemo(() => {
    if (!userData?.work_time_start) return null
    const now = new Date()
    const [h, m] = userData.work_time_start.split(":").map((v) => parseInt(v, 10))
    now.setHours(h || 9, m || 0, 0, 0)
    now.setMinutes(now.getMinutes() + LATE_GRACE_MINUTES)
    return formatTime12hFromDate(now)
  }, [userData])

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

  const isFutureTimestamp = (iso: string) => {
    try {
      const diff = new Date(iso).getTime() - Date.now()
      return diff > 60 * 1000
    } catch {
      return false
    }
  }

  const performAutoPunchOut = async (trigger: string) => {
    if (!isPunchedIn || !userId || punchOutSentRef.current) return false
    punchOutSentRef.current = true
    const nowIso = new Date().toISOString()
    const payload = JSON.stringify({ trigger, source: "employee_dashboard", timestamp: nowIso })
    try {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon("/api/employee/auto-punch-out", payload)
        if (!sent) throw new Error("beacon_failed")
      } else {
        await fetch("/api/employee/auto-punch-out", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
        })
      }
      setActiveSession(null)
      setIsPunchedIn(false)
      try { localStorage.removeItem("timeRecords") } catch {}
      try { localStorage.setItem("lastAutoPunchOutTs", nowIso) } catch {}
      toast({ title: <span className="dark:text-white">Auto Punch-Out</span>, description: <span className="dark:text-white">Checked out on logout</span> })
      return true
    } catch (err) {
      try { localStorage.setItem("pendingPunchOut", JSON.stringify({ timestamp: nowIso, trigger })) } catch {}
      toast({ title: <span className="dark:text-white">Auto punch-out pending</span>, variant: "destructive" })
      return false
    }
  }

  const handleCheckIn = async () => {
    if (activeSession) {
      toast({ title: <span className="dark:text-white">Already checked in</span>, variant: "destructive" })
      return
    }

    const status = computeStatus()
    if (status === "late") {
      setLateDialogOpen(true)
      return
    }

    const nowIso = new Date().toISOString()
    if (isFutureTimestamp(nowIso)) {
      toast({ title: <span className="dark:text-white">Invalid time</span>, description: <span className="dark:text-white">Future-dated punch is not allowed</span>, variant: "destructive" })
      return
    }
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: <span className="dark:text-white">Not authenticated</span>, variant: "destructive" })
        return
      }

      const today = nowIso.split("T")[0]
      const { data: openRows, error: openErr } = await supabase
        .from("attendance")
        .select("id, login_time, logout_time")
        .eq("user_id", user.id)
        .eq("date", today)
        .is("logout_time", null)
        .order("login_time", { ascending: false })
        .limit(1)

      if (openErr) {
        toast({ title: <span className="dark:text-white">Punch in failed</span>, description: <span className="dark:text-white">Unable to check existing sessions</span>, variant: "destructive" })
        return
      }

      if (openRows && openRows.length > 0) {
        toast({ title: <span className="dark:text-white">Already checked in</span>, description: <span className="dark:text-white">An active session exists</span>, variant: "destructive" })
        return
      }

      const { data: insertedRow, error: insErr } = await supabase
        .from("attendance")
        .insert({ user_id: user.id, date: today, login_time: nowIso, status: "present" })
        .select("id, date, login_time")
        .single()

      if (insErr || !insertedRow) {
        toast({ title: <span className="dark:text-white">Punch in failed</span>, description: <span className="dark:text-white">Database error</span>, variant: "destructive" })
        return
      }

      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        date: insertedRow.date,
        checkIn: insertedRow.login_time,
        rowId: insertedRow.id as number,
      }

      setRecords([newRecord])
      setActiveSession(newRecord)
      setIsPunchedIn(true)
      punchOutSentRef.current = false // Reset on new punch-in

      try {
        localStorage.setItem("timeRecords", JSON.stringify([newRecord]))
      } catch { }

      try {
        await supabase.from("attendance_events").insert({ user_id: user.id, punch_type: "in", ts: nowIso, status: "present" })
      } catch {}

      toast({ title: <span className="dark:text-white">Checked in</span>, description: <span className="dark:text-white">{formatRecordTime(nowIso)}</span> })
      fetchUserData()
    } catch (error: any) {
      toast({ title: <span className="dark:text-white">Punch in failed</span>, description: <span className="dark:text-white">{error?.message}</span>, variant: "destructive" })
    }
  }

  const handleCheckOut = async () => {
    if (!activeSession) {
      toast({ title: <span className="dark:text-white">No active session</span>, variant: "destructive" })
      return
    }

    const nowIso = new Date().toISOString()
    if (isFutureTimestamp(nowIso)) {
      toast({ title: <span className="dark:text-white">Invalid time</span>, description: <span className="dark:text-white">Future-dated punch is not allowed</span>, variant: "destructive" })
      return
    }
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: <span className="dark:text-white">Not authenticated</span>, variant: "destructive" })
        return
      }

      const today = nowIso.split("T")[0]
      const { data: openRows, error: selErr } = await supabase
        .from("attendance")
        .select("id, login_time, logout_time")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("login_time", { ascending: false })
        .limit(3)

      if (selErr) {
        toast({ title: <span className="dark:text-white">Punch out failed</span>, description: <span className="dark:text-white">Unable to read attendance</span>, variant: "destructive" })
        return
      }

      const openRow = (openRows || []).find((r: any) => !r.logout_time)
      if (!openRow) {
        toast({ title: <span className="dark:text-white">No active session</span>, description: <span className="dark:text-white">Cannot punch out before punching in</span>, variant: "destructive" })
        return
      }

      const loginMs = new Date(openRow.login_time as string).getTime()
      const logoutMs = new Date(nowIso).getTime()
      if (logoutMs < loginMs) {
        toast({ title: <span className="dark:text-white">Invalid sequence</span>, description: <span className="dark:text-white">Punch out cannot be before punch in</span>, variant: "destructive" })
        return
      }

      const totalHours = Math.max(0, (logoutMs - loginMs) / (1000 * 60 * 60))

      const { data: updatedRow, error: updErr } = await supabase
        .from("attendance")
        .update({ logout_time: nowIso, total_hours: totalHours })
        .eq("id", openRow.id)
        .is("logout_time", null)
        .select("id, logout_time")
        .single()

      if (updErr || !updatedRow) {
        toast({ title: <span className="dark:text-white">Punch out failed</span>, description: <span className="dark:text-white">Concurrent modification detected</span>, variant: "destructive" })
        return
      }

      setActiveSession(null)
      setIsPunchedIn(false)
      punchOutSentRef.current = false

      try {
        localStorage.removeItem("timeRecords")
      } catch { }

      try {
        await supabase.from("attendance_events").insert({ user_id: user.id, punch_type: "out", ts: nowIso, status: "present" })
      } catch {}

      toast({ title: <span className="dark:text-white">Checked out</span>, description: <span className="dark:text-white">{formatRecordTime(nowIso)}</span> })
      fetchUserData()
    } catch (error: any) {
      toast({ title: <span className="dark:text-white">Punch out failed</span>, description: <span className="dark:text-white">{error?.message}</span>, variant: "destructive" })
    }
  }

  const submitLate = async () => {
    const finalReason = `${lateReasonPreset ? `${lateReasonPreset}: ` : ""}${lateReason.trim()}`
    if (!finalReason.trim()) {
      toast({ title: <span className="dark:text-white">Reason required</span>, variant: "destructive" })
      return
    }

    const nowIso = new Date().toISOString()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      setRecords([newRecord])
      setActiveSession(newRecord)
      setIsPunchedIn(true)
      punchOutSentRef.current = false

      try {
        localStorage.setItem("timeRecords", JSON.stringify([newRecord]))
      } catch { }

      setLateDialogOpen(false)
      setLateReason("")
      setLateReasonPreset("")
      toast({ title: <span className="dark:text-white">Punched in (late)</span>, description: <span className="dark:text-white">{formatRecordTime(nowIso)}</span> })
      fetchUserData()
    } catch (error: any) {
      toast({ title: <span className="dark:text-white">Failed</span>, description: <span className="dark:text-white">{error?.message}</span>, variant: "destructive" })
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    try {
      await performAutoPunchOut("logout")
      await new Promise((r) => setTimeout(r, 100))
      await supabase.auth.signOut()
    } catch { }
    router.replace("/auth/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  function SidebarPanel() {
    return (
      <>
        {sidebarOpen && (
          <div className="fixed inset-0 bg-white shad-lg z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={cn(
            "fixed left-0 top-0 h-full bg-[#F8F8FA] dark:bg-white/15 backdrop-blur-2xl border-r z-50 transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "w-64 flex flex-col"
          )}
        >
          <div className="flex items-center justify-between p-6 border-b">
            <img
              src={resolvedTheme === "dark" ? "/dezprox horizontal white logo.png" : "/dezprox horizontal black logo.png"}
              alt="Logo"
              className="h-8"
              loading="eager"
              fetchPriority="high"
            />
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {sidebarLinks.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.page}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ",
                      activeTab === item.page
                        ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)] text-green-500 dark:text-green-400 "
                        : ""
                    )}
                    onClick={() => {
                      setActiveTab(item.page as any)
                      setSidebarOpen(false)
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
          <div className="border-t p-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </aside>
      </>
    )
  }

  return (
    <div className="flex h-screen w-full">
      <SidebarPanel />

      <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
        <DialogContent className="backdrop-blur-[60px] bg-white/90 dark:bg-black/90 border border-white/30 dark:border-white/20 rounded-[32px] p-8 shadow-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl text-ash-900 dark:text-white mb-2">Late Arrival</DialogTitle>
            <p className="text-sm text-ash-500 dark:text-dark-400">
              {`You're arriving after ${lateThresholdText ?? "your scheduled start time"}. Please provide a reason.`}
            </p>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-ash-700 dark:text-dark-300 mb-3">
                Late punch-in reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                className="w-full min-h-[120px] px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-ash-200 dark:border-dark-700 rounded-xl text-ash-900 dark:text-white placeholder:text-ash-400 dark:placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-[#3FA740]/50 resize-none"
                placeholder="Please provide details..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setLateDialogOpen(false)}
                className="flex-1 h-12 rounded-xl bg-white/80 dark:bg-black/80 backdrop-blur-sm text-ash-900 dark:text-white border border-ash-200 dark:border-dark-700 hover:bg-white dark:hover:bg-black/60 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={submitLate}
                disabled={!lateReason.trim()}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#227631] to-[#3FA740] text-white hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto lg:ml-64 bg-[#E8E8ED] dark:bg-[#1C1C1E]">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 p-5 space-y-6">
          {activeTab === "dashboard" && (
            <>
              <Card className="bg-black border-0 rounded-3xl p-8">
                <h2 className="text-3xl text-[#3FA740] font-bold text-center">
                  Welcome back {userData?.name ?? "Employee"}
                </h2>
                <p className="text-white text-center mt-2">
                  {userData?.type === "fulltime" ? "Full-time Employee" :
                    userData?.type === "intern1" ? "Working Intern" : "Learning Intern"}
                </p>
                <p className="text-white/70 text-center">
                  Working Hours: {formatTime12hCompactFromString(userData?.work_time_start)} -
                  {formatTime12hCompactFromString(userData?.work_time_end)}
                </p>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="h-5 w-5" />
                  <span>Today's Attendance</span>
                </div>
                <div className="text-center mb-8">
                  <div className="text-6xl mb-2">{formatTime12hFromDate(currentTime)}</div>
                  <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</div>
                </div>
                {!activeSession ? (
                  <div className="space-y-4">
                    <SlideToCheckIn onComplete={handleCheckIn} />
                    <p className="text-center text-xs text-muted-foreground">Drag to start work</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm">Active Session</span>
                    </div>
                    <WorkDurationCard duration={workDuration} checkInTime={formatRecordTime(activeSession.checkIn)} />
                    <SlideToCheckOut onComplete={handleCheckOut} />
                  </div>
                )}
              </Card>

              <div className=" gap-6">
                <Card className="p-6">
                  <h3 className="mb-6">Leave Balance</h3>
                  <div>
                    <div className="text-5xl mb-3 font-bold">
                      {(userData?.total_leaves ?? 0) - (computedUsedLeaves ?? userData?.used_leaves ?? 0)}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                      {computedUsedLeaves ?? (userData?.used_leaves ?? 0)}/{userData?.total_leaves ?? 0} used
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (((computedUsedLeaves ?? (userData?.used_leaves ?? 0)) / Math.max(1, userData?.total_leaves ?? 1)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </Card>
                <Card className="p-6 hidden">
                  <h3 className="mb-6">Quick Actions</h3>
                  <Button
                    onClick={() => setActiveTab("leaves")}
                    className="w-full justify-between"
                  >
                    <span>Apply for Leave</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Card>
              </div>
            </>
          )}

          {activeTab === "leaves" && <LeavemManagement />}
          {activeTab === "attendance" && <AttendanceNanagement />}
        </div>
      </div>
    </div>
  )
}
