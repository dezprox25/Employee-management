import { useEffect, useRef, useCallback } from "react"

interface UseHeartbeatOptions {
  employeeId: string
  enabled?: boolean
  interval?: number // milliseconds, default 10000 (10 seconds)
}

/**
 * Hook that sends periodic heartbeats to the server.
 * Also attempts a final heartbeat on tab close using sendBeacon.
 */
export function useHeartbeat({
  employeeId,
  enabled = true,
  interval = 10000,
}: UseHeartbeatOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `session-${Date.now()}`
  )
  const lastHeartbeatRef = useRef<number>(0)

  const sendHeartbeat = useCallback(async () => {
    if (!enabled || !employeeId) return

    try {
      const now = Date.now()
      lastHeartbeatRef.current = now

      const response = await fetch("/api/employee/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          sessionId: sessionIdRef.current,
        }),
        credentials: "include",
      })

      if (!response.ok) {
        console.warn(`[heartbeat] Server returned ${response.status}`)
      } else {
        console.debug(`[heartbeat] ✓ sent for ${employeeId}`)
      }
    } catch (err: any) {
      console.warn("[heartbeat] failed to send:", err?.message)
      // Don't throw — server-side timeout will catch this
    }
  }, [employeeId, enabled])

  // Send initial heartbeat and set up periodic interval
  useEffect(() => {
    if (!enabled || !employeeId) return

    // Send immediately
    sendHeartbeat()

    // Then periodically
    intervalRef.current = setInterval(sendHeartbeat, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [employeeId, enabled, interval, sendHeartbeat])

  // Send a final heartbeat attempt on unload
  useEffect(() => {
    if (!enabled || !employeeId) return

    const onBeforeUnload = () => {
      const payload = JSON.stringify({
        employeeId,
        sessionId: sessionIdRef.current,
        final: true,
      })

      // Try sendBeacon first (most reliable for unload)
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/employee/heartbeat", payload)
      } else {
        // Fallback: synchronous fetch (may not complete)
        try {
          const xhr = new XMLHttpRequest()
          xhr.open("POST", "/api/employee/heartbeat", false)
          xhr.setRequestHeader("Content-Type", "application/json")
          xhr.send(payload)
        } catch (e) {
          // Ignore errors on unload
        }
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [enabled, employeeId])

  return {
    sessionId: sessionIdRef.current,
    lastHeartbeat: lastHeartbeatRef.current,
    sendNow: sendHeartbeat,
  }
}
