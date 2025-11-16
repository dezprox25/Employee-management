import { useEffect, useRef } from "react";
import io from "socket.io-client";

/**
 * useSocketPresence
 * - Uses sessionStorage + beforeunload + pagehide+sendBeacon to detect real tab close
 * - Sends regular heartbeats (via Socket.io when enabled, otherwise HTTP) as a fallback
 * - Only triggers auto-punch-out when a true tab/window close is detected
 *
 * Usage: useSocketPresence(userId, onAutoPunchOut, { useSocket: true })
 */
export function useSocketPresence(
  userId: string | null | undefined,
  onAutoPunchOut: () => void,
  opts?: { useSocket?: boolean; serverUrl?: string; heartbeatMs?: number }
) {
  const socketRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);
  const optsSafe = { useSocket: true, serverUrl: "http://localhost:4000", heartbeatMs: 10000, ...(opts || {}) };

  useEffect(() => {
    if (!userId) return;

    const key = `presence_stillHere_${userId}`;

    // Check previous session flag. If previous unload set it to 'false' and this navigation is NOT a reload,
    // treat it as a real navigation coming back and attempt reconcile (best-effort).
    try {
      const prev = sessionStorage.getItem(key);
      const navEntries = (performance as any).getEntriesByType?.("navigation") || [];
      const navType = navEntries[0]?.type || (performance as any).navigation?.type || "navigate";

      if (prev === "false" && navType !== "reload") {
        // Reconcile: attempt to flush pending punch-out (server may have already handled it)
        ;(async () => {
          try {
            const res = await fetch("/api/employee/auto-punch-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trigger: "reconcile", source: "session-reload" }),
              credentials: "include",
              cache: "no-store",
            });
            if (res.ok) {
              const body = await res.json().catch(() => null);
              if (body?.action === "updated") {
                onAutoPunchOut();
              }
            }
          } catch (err) {
            // ignore
          }
        })();
      }
    } catch (err) {
      // ignore sessionStorage / performance errors
    }

    // Mark this tab as active
    try {
      sessionStorage.setItem(key, "true");
    } catch {}

    // beforeunload: set flag so we can distinguish in next load
    const onBeforeUnload = () => {
      try {
        sessionStorage.setItem(key, "false");
      } catch {}
    };

    // pagehide: send a beacon (reliable during unload) to notify server of true tab close or navigation away
    const onPageHide = (e: PageTransitionEvent) => {
      try {
        if (e.persisted) return; // bfcache restore — not a close
        const payload = JSON.stringify({ trigger: "pagehide", source: "beacon" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/employee/auto-punch-out", payload);
        } else {
          // best-effort fallback
          fetch("/api/employee/auto-punch-out", { method: "POST", body: payload, credentials: "include", headers: { "Content-Type": "application/json" } });
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    // Initialize socket if enabled
    if (optsSafe.useSocket) {
      try {
        socketRef.current = io(optsSafe.serverUrl, { withCredentials: true });
        // announce presence
        socketRef.current.emit("employee-online", { userId });

        socketRef.current.on("auto-punched-out", () => {
          onAutoPunchOut();
          try { alert("You were automatically punched out."); } catch {}
        });
      } catch (err) {
        // socket init failed — we'll fall back to HTTP heartbeats
        socketRef.current = null;
      }
    }

    // heartbeat function
    const doHeartbeat = async () => {
      try {
        if (socketRef.current) {
          socketRef.current.emit("heartbeat", { userId });
          return;
        }

        // HTTP heartbeat fallback — server can identify user by cookie session (credentials included)
        await fetch("/api/employee/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ employeeId: userId }),
          cache: "no-store",
        });
      } catch (err) {
        // ignore heartbeat errors
      }
    };

    // start heartbeat interval
    heartbeatRef.current = window.setInterval(doHeartbeat, optsSafe.heartbeatMs);

    // run initial heartbeat immediately
    void doHeartbeat();

    // cleanup
    return () => {
      try {
        window.removeEventListener("beforeunload", onBeforeUnload);
        window.removeEventListener("pagehide", onPageHide);
      } catch {}

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      try {
        // clear active flag for this tab
        sessionStorage.removeItem(key);
      } catch {}

      try {
        socketRef.current?.disconnect?.();
      } catch {}
    };
  }, [userId, onAutoPunchOut, optsSafe.useSocket, optsSafe.serverUrl, optsSafe.heartbeatMs]);
}
