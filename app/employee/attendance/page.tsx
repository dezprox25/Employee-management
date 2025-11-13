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
function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "-"
  const n = Number(hours)
  if (Number.isNaN(n)) return "-"
  return n.toFixed(2)
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
    // Layout: viewport-constrained height with vertical scrolling for consistent behavior
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto bg-background">
      {/* <NavigationHeader title="Attendance" showLogout={false} /> */}

      <div className="border-b border-border bg-gradient-to-b from-card/50 to-background transition-smooth">
        <div className="9 mx-auto px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
            
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
              className="hover-lift glow-accent bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 slide-up">
              <div className="bg-card border border-border rounded-lg p-4 hover-lift transition-smooth">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Hours</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-accent">{totalHours.toFixed(1)}</p>
                  </div>
                  <Clock className="w-8 h-8 text-accent/40" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 hover-lift transition-smooth">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Recent Days</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-primary">{records.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary/40" />
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 hover-lift transition-smooth">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Avg Daily</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-primary">{avgHours.toFixed(1)}h</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-primary/40" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto px-6 py-8 sm:py-12">
        <Card className="border border-border shadow-sm hover-lift transition-smooth  p-5">
          <CardHeader className="border-b border-border bg-card/30 backdrop-blur-sm">
            <CardTitle className="text-xl sm:text-2xl text-foreground">Attendance Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                <p className="text-sm text-muted-foreground">Loading your records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No attendance logs found</p>
              </div>
            ) : (
              // Logs table: cap height and enable vertical scrolling to avoid page overflow
              <div className="overflow-x-auto max-h-[60dvh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Login</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Logout</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Hours</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold text-muted-foreground">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, idx) => (
                      <TableRow
                        key={r.id}
                        className="border-b border-border hover:bg-muted/20 transition-colors duration-200 animate-in fade-in"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <TableCell className="text-xs sm:text-sm font-medium text-foreground py-3">{r.date}</TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground py-3">
                          {formatTimestamp(r.login_time)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground py-3">
                          {formatTimestamp(r.logout_time)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm font-medium text-accent py-3">
                          {formatHours(r.total_hours)}h
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm capitalize py-3">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium transition-smooth ${
                              r.status === "present"
                                ? "bg-accent/10 text-accent"
                                : r.status === "absent"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {r.status ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground py-3 truncate">
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
