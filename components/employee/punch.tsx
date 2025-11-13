"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Zap, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Punch component
 *
 * Single, unified component that encapsulates both Punch In and Punch Out flows,
 * including animations, accessibility, and Supabase integration.
 *
 * - Starts rotating when punch in is activated and remains rotating while punched in.
 * - Stops rotating with smooth fade when punch out is triggered.
 * - Uses CSS transforms/animations for performance.
 *
 * Props:
 * - isPunchedIn: current punch state controlled by parent
 * - userData: minimal data for scheduling logic (work_time_start)
 * - onPunchedIn: callback after successful punch-in
 * - onPunchedOut: callback after successful punch-out
 * - onError: optional error callback with message
 * - supabase: optional injected client for tests/mocks
 * - className: optional CSS classes
 * - nowOverride: optional Date used for testing
 * - commonLateReasons: optional list of predefined late reasons
 *
 * Usage:
 *
 *  <Punch
 *    isPunchedIn={isPunchedIn}
 *    userData={{ work_time_start: "09:00" }}
 *    onPunchedIn={({ status }) => setIsPunchedIn(true)}
 *    onPunchedOut={({ total_hours }) => setIsPunchedIn(false)}
 *    onError={(msg) => toast({ title: "Punch failed", description: msg, variant: "destructive" })}
 *  />
 */
export interface UserDataBrief {
  work_time_start?: string
}

export interface SupabaseClientLike {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  from: (table: string) => any
}

export interface PunchInSuccess {
  status: "present" | "late"
  login_time: string
}

export interface PunchOutSuccess {
  logout_time: string
  total_hours: number
}

export interface PunchProps {
  isPunchedIn: boolean
  userData: UserDataBrief | null
  onPunchedIn: (data: PunchInSuccess) => void
  onPunchedOut: (data: PunchOutSuccess) => void
  onError?: (message: string) => void
  supabase?: SupabaseClientLike
  className?: string
  nowOverride?: Date
  commonLateReasons?: string[]
}

export default function Punch({
  isPunchedIn,
  userData,
  onPunchedIn,
  onPunchedOut,
  onError,
  supabase,
  className,
  nowOverride,
  commonLateReasons,
}: PunchProps) {
  const [loading, setLoading] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lateReason, setLateReason] = useState("")
  const [lateReasonPreset, setLateReasonPreset] = useState("")
  const [latePunchTimestamp, setLatePunchTimestamp] = useState("")
  const [loginTimeIso, setLoginTimeIso] = useState<string | null>(null)
  const sb = supabase || createClient()

  useEffect(() => {
    // Keep rotating indicator in sync with punch state
    setRotating(isPunchedIn)
  }, [isPunchedIn])

  // Preload today's login_time to compute total_hours accurately on punch-out
  useEffect(() => {
    const loadLogin = async () => {
      try {
        const {
          data: { user },
        } = await sb.auth.getUser()
        if (!user) return
        const today = (nowOverride || new Date()).toISOString().split("T")[0]
        const { data: attendance } = await sb
          .from("attendance")
          .select("login_time")
          .eq("user_id", user.id)
          .eq("date", today)
          .single()
        setLoginTimeIso(attendance?.login_time || null)
      } catch (e) {
        // preload failures should not block UI
      }
    }
    loadLogin()
  }, [sb, nowOverride])

  const reasons = useMemo(
    () =>
      commonLateReasons || [
        "Traffic",
        "Public transport delay",
        "Medical appointment",
        "Personal emergency",
        "System issues",
        "Weather",
      ],
    [commonLateReasons],
  )

  const computeStatus = useCallback((): "present" | "late" => {
    const nowDate = nowOverride || new Date()
    const scheduled = new Date()
    const [h, m] = (userData?.work_time_start || "09:00").split(":").map((v) => parseInt(v, 10))
    scheduled.setHours(h || 9, m || 0, 0, 0)
    const toleranceMinutes = 10
    return nowDate.getTime() > scheduled.getTime() + toleranceMinutes * 60 * 1000 ? "late" : "present"
  }, [nowOverride, userData?.work_time_start])

  const punchIn = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user) {
        onError?.("Not authenticated. Please log in to punch in.")
        return
      }
      const nowIso = (nowOverride || new Date()).toISOString()
      const status = computeStatus()

      if (status === "late") {
        setLatePunchTimestamp(nowIso)
        setDialogOpen(true)
        return
      }

      await sb.from("attendance").insert({
        user_id: user.id,
        date: nowIso.split("T")[0],
        login_time: nowIso,
        status,
        reason: null,
      })
      setRotating(true)
      onPunchedIn({ status, login_time: nowIso })
    } catch (error: any) {
      onError?.(error?.message || "Could not update attendance.")
    } finally {
      setLoading(false)
    }
  }, [sb, computeStatus, nowOverride, onError, onPunchedIn])

  const submitLate = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user) {
        onError?.("Not authenticated. Please log in to punch in.")
        return
      }
      const nowIso = latePunchTimestamp || (nowOverride || new Date()).toISOString()
      const finalReason = `${lateReasonPreset ? `${lateReasonPreset}: ` : ""}${lateReason.trim()}`
      if (!finalReason.trim()) {
        onError?.("Reason required for late punch-in.")
        return
      }
      await sb.from("attendance").insert({
        user_id: user.id,
        date: nowIso.split("T")[0],
        login_time: nowIso,
        status: "late",
        reason: finalReason,
      })
      setDialogOpen(false)
      setLateReason("")
      setLateReasonPreset("")
      setRotating(true)
      onPunchedIn({ status: "late", login_time: nowIso })
    } catch (error: any) {
      onError?.(error?.message || "Could not save late reason.")
    } finally {
      setLoading(false)
    }
  }, [sb, latePunchTimestamp, lateReason, lateReasonPreset, nowOverride, onError, onPunchedIn])

  const punchOut = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user) {
        onError?.("Not authenticated. Please log in to punch out.")
        return
      }

      const nowIso = (nowOverride || new Date()).toISOString()
      let totalHours = 0
      if (loginTimeIso) {
        const loginDate = new Date(loginTimeIso)
        const logoutDate = new Date(nowIso)
        totalHours = (logoutDate.getTime() - loginDate.getTime()) / (1000 * 60 * 60)
      }

      await sb
        .from("attendance")
        .update({ logout_time: nowIso, total_hours: totalHours })
        .eq("user_id", user.id)
        .eq("date", nowIso.split("T")[0])

      setRotating(false)
      onPunchedOut({ logout_time: nowIso, total_hours: totalHours })
    } catch (error: any) {
      onError?.(error?.message || "Could not update attendance.")
    } finally {
      setLoading(false)
    }
  }, [sb, loginTimeIso, nowOverride, onError, onPunchedOut])

  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      {/* Rotating status indicator */}
      <div
        role="status"
        aria-live="polite"
        aria-label={rotating ? "Working session active" : "Idle"}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300",
          rotating ? "opacity-100" : "opacity-0",
          "transition-opacity duration-300 ease-out",
        )}
        data-animating={rotating ? "true" : "false"}
      >
        <Clock className={cn("h-4 w-4", rotating ? "animate-spin" : "")} />
      </div>

      {isPunchedIn ? (
        <Button
          type="button"
          onClick={punchOut}
          disabled={loading}
          aria-busy={loading ? "true" : "false"}
          aria-label="Punch Out"
          className={cn(
            "w-full sm:w-auto gap-2",
            "bg-red-500 hover:bg-red-600",
            "transition-transform duration-300 ease-out",
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          <span className="font-medium">Punch Out</span>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={punchIn}
          disabled={loading}
          aria-busy={loading ? "true" : "false"}
          aria-label="Punch In"
          className={cn(
            "w-full sm:w-auto gap-2",
            "bg-green-500 hover:bg-green-600",
            "transition-transform duration-300 ease-out",
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          <span className="font-medium">Punch In</span>
        </Button>
      )}

      {/* Late reason dialog for punch-in */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Late punch-in reason</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Timestamp:</span> {latePunchTimestamp || (nowOverride || new Date()).toISOString()}
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
                {reasons.map((r) => (
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
                  setDialogOpen(false)
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
                disabled={loading || !lateReason.trim()}
                aria-label="Submit late reason"
              >
                {loading ? (
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
    </div>
  )
}