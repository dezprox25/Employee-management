"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { NavigationHeader } from "@/components/navigation-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Calendar, Clock, TrendingUp, RotateCcw } from "lucide-react"
import { formatTime12hFromString } from "@/lib/utils"

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

/**
 * Format a timestamp into a localized 12h time string.
 * Note: Handles null/undefined and imperfect inputs gracefully.
 */
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "-"
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) {
      const raw = String(ts).trim()
      const match = raw.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/)
      return match ? formatTime12hFromString(match[1]) : "-"
    }
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
  } catch (e) {
    console.warn("formatTimestamp: failed to format", ts, e)
    return "-"
  }
}

/**
 * Format numeric hours to two decimals; returns '-' for invalid values.
 */
/**
 * Format numeric hours into H:MM:SS (e.g. 4:30:20).
 * Accepts a numeric hour value (e.g. 4.5055) and converts it to
 * hours, minutes, seconds. Returns '-' for invalid inputs.
 */
function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "-"
  const n = Number(hours)
  if (Number.isNaN(n) || !isFinite(n)) return "-"

  // Convert hours (possibly fractional) to total seconds
  const totalSeconds = Math.max(0, Math.round(n * 3600))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return `${h}:${mm}:${ss}`
}

// EmployeeAttendancePage: scroll improvements and documentation added
export default function EmployeeAttendancePage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [isPunchedIn, setIsPunchedIn] = useState(false)
  const unloadSentRef = useRef(false)
  const CONFIRM_ON_LEAVE = false

  useEffect(() => {
    const checkRoleAndLoad = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login")
        return
      }
      const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (profile?.role === "admin") {
        router.replace("/admin/dashboard")
        return
      }
      await loadRecords(user.id)
    }
    checkRoleAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRecords = async (userId: string) => {
    try {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - 60)
      const sinceStr = since.toISOString().split("T")[0]
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", sinceStr)
        .order("date", { ascending: false })
      setRecords(data || [])
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load attendance history",
      })
    } finally {
      setLoading(false)
    }
  }

  const computePunchState = async (userId: string) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0]
      const { data } = await supabase
        .from("attendance")
        .select("login_time, logout_time")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .limit(1)
      const rec = Array.isArray(data) && data.length ? data[0] : null
      const inNow = !!(rec && rec.login_time && !rec.logout_time)
      setIsPunchedIn(inNow)
    } catch (err) {
      console.warn("[auto-punch-out] computePunchState failed", err)
    }
  }

  const reconcilePendingPunchOut = async () => {
    try {
      const pending = localStorage.getItem("pendingPunchOut")
      if (!pending && !isPunchedIn) return
      const payload = pending ? JSON.parse(pending) : { ts: new Date().toISOString(), trigger: "reconcile" }
      const res = await fetch("/api/employee/auto-punch-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "reconcile", source: "attendance-page-load", ts: payload?.ts }),
        credentials: "include",
        cache: "no-store",
      })
      if (res.ok) {
        try {
          localStorage.removeItem("pendingPunchOut")
        } catch {}
        toast({ title: "Logout updated", description: "Your session was auto-closed on last tab close." })
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) await loadRecords(user.id)
      } else {
        console.warn("[auto-punch-out] reconciliation failed", await res.text())
      }
    } catch (err) {
      console.error("[auto-punch-out] reconciliation error", err)
    }
  }

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      await computePunchState(user.id)
      if (isPunchedIn || localStorage.getItem("pendingPunchOut")) {
        await reconcilePendingPunchOut()
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sendAutoPunchOut = (trigger: string) => {
      try {
        if (unloadSentRef.current) return
        unloadSentRef.current = true
        const payload = JSON.stringify({
          trigger,
          source: "attendance-page",
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
          try {
            localStorage.setItem("pendingPunchOut", JSON.stringify({ ts: new Date().toISOString(), trigger }))
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
    }

    const onUnload = () => {
      if (!isPunchedIn) return
      sendAutoPunchOut("unload")
    }

    if (isPunchedIn) {
      unloadSentRef.current = false
      window.addEventListener("beforeunload", onBeforeUnload, { capture: true })
      window.addEventListener("unload", onUnload, { capture: true })
      console.debug("[auto-punch-out] attendance unload handlers attached")
    }

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload, { capture: true } as any)
      window.removeEventListener("unload", onUnload, { capture: true } as any)
      unloadSentRef.current = false
      console.debug("[auto-punch-out] attendance unload handlers detached")
    }
  }, [isPunchedIn])

  const totalHours = records.reduce((sum, r) => sum + (r.total_hours || 0), 0)
  const avgHours = records.length > 0 ? totalHours / records.length : 0

  return (
    <div className="bg-[#E8E8ED] dark:bg-[#1C1C1E] ">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl">Attendance</h1>
            <p className="text-sm text-muted-foreground">Your recent logs and totals.</p>
          </div>
          <Button
            onClick={async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser()
              if (!user) {
                toast({ variant: "destructive", title: "Error", description: "Not authenticated" })
                router.replace("/auth/login")
                return
              }
              await loadRecords(user.id)
            }}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#227631] to-[#3FA740] text-white hover:opacity-90"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
                  <p className="text-3xl">{totalHours.toFixed(1)}</p>
                </div>
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Recent Days</p>
                  <p className="text-3xl">{records.length}</p>
                </div>
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Daily</p>
                  <p className="text-3xl">{avgHours.toFixed(1)}h</p>
                </div>
                <TrendingUp className="w-6 h-6 text-muted-foreground" />
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="px-6 py-6">
        <Card className="rounded-[24px]">
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Attendance Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Loading your records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No attendance logs found</p>
              </div>
            ) : (
              <div className=" ">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm">Login</TableHead>
                      <TableHead className="text-xs sm:text-sm">Logout</TableHead>
                      <TableHead className="text-xs sm:text-sm">Duration</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, idx) => (
                      <TableRow key={r.id} style={{ animationDelay: `${idx * 30}ms` }}>
                        <TableCell className="text-xs sm:text-sm font-medium">{r.date}</TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground">
                          {formatTimestamp(r.login_time)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground">
                          {formatTimestamp(r.logout_time)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm font-medium">
                          {formatHours(r.total_hours)} 
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm capitalize">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              r.status === "present"
                                ? "bg-emerald-100 text-emerald-700"
                                : r.status === "absent"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {r.status ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground truncate">
                          {r.reason ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
