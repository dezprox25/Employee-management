// "use client"

// import { createClient } from "@/lib/supabase/client"
// import { useEffect, useState, useMemo, useRef, useCallback } from "react"
// import { useRouter, useSearchParams } from 'next/navigation'
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Clock, AlertCircle, LayoutDashboard, CalendarDays, ClipboardList, Loader2, LogOut, Menu, X, ChevronRight } from 'lucide-react'
// import { CardEntrance } from "@/components/animations/card-entrance"

// import { cn, formatTime12hCompactFromString, formatTime12hFromDate } from "@/lib/utils"
// import LeavemManagement from '@/app/employee/leaves/page'
// import AttendanceNanagement from '@/app/employee/attendance/page'
// import { useToast } from "@/hooks/use-toast"
// import { SlideToCheckIn } from "@/components/employee/slide-to-check-in"
// import { SlideToCheckOut } from "@/components/employee/slide-to-check-out"
// import { motion, AnimatePresence } from "framer-motion"
// import EmployeeSVG from "/employee-working.svg"
// import { WorkDurationCard } from "@/components/employee/WorkDurationCard"
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
// import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
// import { Textarea } from "@/components/ui/textarea"
// import { DashboardHeader } from "@/components/employee/DashboardHeader"
// import { useHeartbeat } from "@/hooks/use-heartbeat"

// interface UserData {
//   name: string
//   type: string
//   work_time_start: string
//   work_time_end: string
//   total_leaves: number
//   used_leaves: number
// }

// interface TodayAttendance {
//   login_time?: string
//   logout_time?: string
//   status: string
//   total_hours?: number
// }

// interface TimeRecord {
//   id: string
//   date: string
//   checkIn: string
//   checkOut?: string
// }

// interface PendingPunchOut {
//   timestamp: string
//   trigger: string
//   synced: boolean
// }

// export default function EmployeeDashboardClient() {
//   const { toast } = useToast()
//   const router = useRouter()
//   const searchParams = useSearchParams()

//   const [showTabCloseDialog, setShowTabCloseDialog] = useState(false)
//   const [isConfirmingPunchOut, setIsConfirmingPunchOut] = useState(false)

//   const [userData, setUserData] = useState<UserData | null>(null)
//   const [userId, setUserId] = useState<string>("")
//   const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null)
//   const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
//   const [loading, setLoading] = useState(true)
//   const [isPunchedIn, setIsPunchedIn] = useState(false)
//   const [currentTime, setCurrentTime] = useState(new Date())
//   const [activeTab, setActiveTab] = useState<"dashboard" | "leaves" | "attendance">("dashboard")
//   const [sidebarOpen, setSidebarOpen] = useState(false)
//   const [lateDialogOpen, setLateDialogOpen] = useState(false)
//   const [lateReason, setLateReason] = useState("")
//   const [lateReasonPreset, setLateReasonPreset] = useState("")
//   const [latePunchTimestamp, setLatePunchTimestamp] = useState<string>("")
//   const [lateSubmitting, setLateSubmitting] = useState(false)

//   const [records, setRecords] = useState<TimeRecord[]>([])
//   const [activeSession, setActiveSession] = useState<TimeRecord | null>(null)
//   const [workDuration, setWorkDuration] = useState<string>("00:00:00")

//   const unloadHandledRef = useRef(false)
//   const punchOutSentRef = useRef(false)
//   const pendingPunchOutRef = useRef<any | null>(null)
//   const unloadSentRef = useRef(false)
//   const logoutSentRef = useRef(false)
//   const syncTokenRef = useRef(0)
//   const tabCloseHandlerRef = useRef<(() => void) | null>(null)

//   const AUTO_PUNCH_OUT_TIMEOUT = 5000
//   const SYNC_CHECK_INTERVAL = 30000
//   const CONFIRM_ON_LEAVE = false

//   useEffect(() => {
//     const checkAutoLogin = async () => {
//       try {
//         const pendingAutoLogin = sessionStorage.getItem("pendingAutoLogin")
//         if (pendingAutoLogin) {
//           sessionStorage.removeItem("pendingAutoLogin")
//           console.info("[auth] Pending auto-login detected, user should be redirected to login")
//           // User will be redirected to login page when auth check fails
//         }
//       } catch (err) {
//         console.error("[auto-login] Error checking auto-login:", err)
//       }
//     }
//     checkAutoLogin()
//   }, [])

//   const localCheckout = useCallback(() => {
//     setIsPunchedIn(false)
//     setActiveSession(null)
//     try {
//       localStorage.removeItem("timeRecords")
//     } catch { }
//   }, [setIsPunchedIn, setActiveSession])

//   const commonLateReasons = useMemo(
//     () => [
//       "Traffic",
//       "Public transport delay",
//       "Medical appointment",
//       "Personal emergency",
//       "System issues",
//       "Weather",
//     ],
//     [],
//   )

//   const sidebarLinks = useMemo(
//     () => [
//       {
//         label: "Dashboard",
//         page: "dashboard",
//         icon: LayoutDashboard,
//       },
//       {
//         label: "Leave Management",
//         page: "leaves",
//         icon: CalendarDays,
//       },
//       {
//         label: "My Attendance Records",
//         page: "attendance",
//         icon: ClipboardList,
//       },
//     ],
//     []
//   )

//   const performAutoLogout = useCallback(async () => {
//     try {
//       if (logoutSentRef.current) {
//         console.info("[auto-logout] Auto logout already sent, skipping")
//         return
//       }
//       logoutSentRef.current = true

//       console.info("[auto-logout] Initiating auto logout and clearing auth data")

//       // Set flag for auto-login on return
//       try {
//         sessionStorage.setItem("pendingAutoLogin", "true")
//       } catch { }

//       // Clear all auth-related storage
//       const keysToRemove: string[] = []
//       try {
//         for (let i = 0; i < localStorage.length; i++) {
//           const key = localStorage.key(i)
//           if (key && (/^sb-/i.test(key) || /supabase/i.test(key) || /auth/i.test(key))) {
//             keysToRemove.push(key)
//           }
//         }
//         keysToRemove.forEach(key => {
//           try {
//             localStorage.removeItem(key)
//           } catch { }
//         })
//       } catch { }

//       // Clear session storage auth data
//       try {
//         const sessionKeysToRemove: string[] = []
//         for (let i = 0; i < sessionStorage.length; i++) {
//           const key = sessionStorage.key(i)
//           if (key && (/^sb-/i.test(key) || /supabase/i.test(key) || /auth/i.test(key))) {
//             sessionKeysToRemove.push(key)
//           }
//         }
//         sessionKeysToRemove.forEach(key => {
//           try {
//             sessionStorage.removeItem(key)
//           } catch { }
//         })
//       } catch { }

//       // Attempt to sign out from Supabase
//       try {
//         const supabase = createClient()
//         await supabase.auth.signOut()
//       } catch (err) {
//         console.warn("[auto-logout] SupabasesignOut failed:", err)
//       }

//       console.info("[auto-logout] Auto logout completed - auth data cleared")
//     } catch (err) {
//       console.error("[auto-logout] Error during auto logout:", err)
//     }
//   }, [])

//   const fetchUserData = useCallback(async () => {
//     const supabase = createClient()
//     try {
//       const { data: { user } } = await supabase.auth.getUser()

//       if (!user) {
//         setIsPunchedIn(false)
//         setActiveSession(null)
//         setUserData(null)
//         setUserId("")
//         setTodayAttendance(null)
//         try {
//           localStorage.removeItem("timeRecords")
//         } catch { }
//         return
//       }

//       setUserId(user.id)

//       const { data: userData } = await supabase
//         .from("users")
//         .select("*")
//         .eq("id", user.id)
//         .single()

//       setUserData(userData)

//       const today = new Date().toISOString().split("T")[0]
//       const { data: attendanceData } = await supabase
//         .from("attendance")
//         .select("*")
//         .eq("user_id", user.id)
//         .eq("date", today)
//         .order("login_time", { ascending: false })
//         .limit(1)

//       const attendance = attendanceData?.[0] || null
//       setTodayAttendance(attendance)

//       const isActive = !!(attendance && attendance.login_time && !attendance.logout_time)
//       setIsPunchedIn(isActive)

//       if (isActive && !activeSession) {
//         const newRecord: TimeRecord = {
//           id: crypto.randomUUID(),
//           date: today,
//           checkIn: attendance.login_time,
//         }
//         setRecords([newRecord])
//         setActiveSession(newRecord)
//         try {
//           localStorage.setItem("timeRecords", JSON.stringify([newRecord]))
//         } catch { }
//       } else if (!isActive && activeSession) {
//         const logoutTime = attendance?.logout_time || new Date().toISOString()
//         const updated = records.map((r) =>
//           !r.checkOut ? { ...r, checkOut: logoutTime } : r
//         )
//         setRecords(updated)
//         setActiveSession(null)
//         setIsPunchedIn(false)
//         try {
//           localStorage.setItem("timeRecords", JSON.stringify(updated))
//         } catch { }
//       }
//     } catch (error) {
//       console.error("[fetchUserData] Error:", error)
//     } finally {
//       setLoading(false)
//     }
//   }, [activeSession, records])

//   useEffect(() => {
//     fetchUserData()
//   }, [fetchUserData])

//   useHeartbeat({
//     employeeId: userId,
//     enabled: !loading && !!userId && isPunchedIn,
//     interval: 10000,
//   })

//   useEffect(() => {
//     if (!userId) return

//     const supabase = createClient()

//     const subscription = supabase
//       .channel(`employee_status:${userId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "employee_status",
//           filter: `employee_id=eq.${userId}`,
//         },
//         (payload: any) => {
//           console.log("[realtime] Status update:", payload)
//           const newStatus = payload.new
//           if (newStatus?.status === "OUT" && isPunchedIn) {
//             setIsPunchedIn(false)
//             setActiveSession(null)
//             try {
//               localStorage.removeItem("timeRecords")
//             } catch { }
//             toast({
//               title: "Auto Punch-Out",
//               description: "You have been automatically punched out due to inactivity.",
//               variant: "default",
//             })
//           }
//         }
//       )
//       .subscribe((status: any) => {
//         if (status !== "SUBSCRIBED") {
//           console.warn("[realtime] Subscription status:", status)
//         } else {
//           console.info("[realtime] Subscribed to employee status updates")
//         }
//       })

//     return () => {
//       supabase.removeChannel(subscription)
//     }
//   }, [userId, isPunchedIn, toast])

//   const syncFromDatabase = useCallback(async () => {
//     try {
//       const supabase = createClient()
//       const { data: { user } } = await supabase.auth.getUser()
//       if (!user) {
//         setIsPunchedIn(false)
//         setActiveSession(null)
//         return
//       }
//       const today = new Date().toISOString().split("T")[0]
//       const { data: attendanceData } = await supabase
//         .from("attendance")
//         .select("*")
//         .eq("user_id", user.id)
//         .eq("date", today)
//         .order("login_time", { ascending: false })
//         .limit(1)

//       const attendance = attendanceData?.[0] || null
//       const isActive = !!(attendance && attendance.login_time && !attendance.logout_time)
//       setIsPunchedIn(isActive)
//       setTodayAttendance(attendance)
//     } catch (err) {
//       console.error("[sync] Error:", err)
//     }
//   }, [])

//   const flushPending = useCallback(async () => {
//     try {
//       const pending = localStorage.getItem("pendingPunchOut")
//       if (!pending) return

//       const pendingData = JSON.parse(pending)
//       const res = await fetch("/api/employee/auto-punch-out", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ 
//           trigger: "reconcile", 
//           source: "app-load", 
//           ts: pendingData?.ts,
//           originalTrigger: pendingData?.trigger,
//         }),
//         credentials: "include",
//         cache: "no-store",
//       })

//       if (res.ok) {
//         localStorage.removeItem("pendingPunchOut")
//         setIsPunchedIn(false)
//         setActiveSession(null)
//       }
//     } catch (err) {
//       console.error("[flush] Error:", err)
//     }
//   }, [])

//   useEffect(() => {
//     if (activeTab === "attendance") {
//       const fetchRecords = async () => {
//         const supabase = createClient()
//         try {
//           const { data: { user } } = await supabase.auth.getUser()
//           if (user) {
//             const { data } = await supabase
//               .from("attendance")
//               .select("*")
//               .eq("user_id", user.id)
//               .order("date", { ascending: false })
//               .limit(30)
//             setAttendanceRecords(data || [])
//           }
//         } catch (error) {
//           console.error("[fetchAttendance] Error:", error)
//         }
//       }
//       fetchRecords()
//     }
//   }, [activeTab])

//   useEffect(() => {
//     if (!activeSession) {
//       setWorkDuration("00:00:00")
//       return
//     }

//     const updateDuration = () => {
//       const startMs = new Date(activeSession.checkIn).getTime()
//       const diffMs = Date.now() - startMs
//       const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
//       const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
//       const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
//       const seconds = String(totalSeconds % 60).padStart(2, "0")
//       setWorkDuration(`${hours}:${minutes}:${seconds}`)
//     }

//     updateDuration()
//     const interval = setInterval(updateDuration, 1000)
//     return () => clearInterval(interval)
//   }, [activeSession])

//   const performAutoPunchOut = useCallback(async (trigger: string, showDialog: boolean = false) => {
//     if (punchOutSentRef.current) {
//       console.info("[auto-punch-out] Auto punch-out already sent, skipping")
//       return
//     }

//     punchOutSentRef.current = true
//     const punchOutTime = new Date().toISOString()

//     console.info("[auto-punch-out] Initiating auto punch-out", { trigger, time: punchOutTime, showDialog })

//     // Show confirmation dialog if needed
//     if (showDialog) {
//       setShowTabCloseDialog(true)
//     }

//     // Immediately clear UI state
//     setIsPunchedIn(false)
//     setActiveSession(null)

//     try {
//       localStorage.removeItem("timeRecords")
//     } catch { }

//     const payload = {
//       timestamp: punchOutTime,
//       trigger,
//       source: "tab-close",
//     }

//     console.log("[auto-punch-out] Payload being sent:", payload)

//     // Priority 1: Use sendBeacon (most reliable during unload)
//     let beaconSent = false
//     try {
//       if (typeof navigator !== "undefined" && navigator.sendBeacon) {
//         const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
//         beaconSent = navigator.sendBeacon("/api/employee/auto-punch-out", blob)
//         console.info("[auto-punch-out] ✅ sendBeacon invoked, result:", beaconSent)
//       }
//     } catch (e) {
//       console.warn("[auto-punch-out] ❌ sendBeacon failed:", e)
//     }

//     // Priority 2: Fallback to keepalive fetch (works if beacon not available)
//     if (!beaconSent) {
//       try {
//         const controller = new AbortController()
//         const timeoutId = setTimeout(() => controller.abort(), AUTO_PUNCH_OUT_TIMEOUT)

//         const response = await fetch("/api/employee/auto-punch-out", {
//           method: "POST",
//           body: JSON.stringify(payload),
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           keepalive: true,
//           signal: controller.signal,
//         })

//         clearTimeout(timeoutId)

//         if (response.ok) {
//           console.info("[auto-punch-out] ✅ Keepalive fetch succeeded")
//           beaconSent = true
//         } else {
//           console.warn("[auto-punch-out] ❌ Keepalive fetch failed with status:", response.status)
//         }
//       } catch (e) {
//         console.warn("[auto-punch-out] ❌ Keepalive fetch error:", e)
//       }
//     }

//     // Priority 3: Store pending as last-resort fallback
//     if (!beaconSent) {
//       try {
//         const pending: PendingPunchOut = {
//           timestamp: punchOutTime,
//           trigger,
//           synced: false,
//         }
//         localStorage.setItem("pendingPunchOut", JSON.stringify(pending))
//         pendingPunchOutRef.current = pending
//         console.info("[auto-punch-out] 💾 Stored pending punch-out in localStorage for later reconciliation")
//       } catch (e) {
//         console.error("[auto-punch-out] Failed to store pending punch-out:", e)
//       }
//     }

//     console.info("[auto-punch-out] Auto punch-out completed. Beacon sent:", beaconSent)
//   }, [])

//   useEffect(() => {
//     if (!isPunchedIn) return

//     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
//       if (unloadHandledRef.current) return
//       unloadHandledRef.current = true

//       try { sessionStorage.setItem(`maybe_unload_${userId}`, "true") } catch {}
//       console.info("[auto-punch-out] beforeunload event - marked maybe_unload flag")
//     }

//     const handlePageHide = () => {
//       if (unloadHandledRef.current) return
//       unloadHandledRef.current = true

//       console.info("[auto-punch-out] pagehide event triggered - performing auto punch-out")

//       // Perform punch-out WITHOUT logging out yet (need auth to complete punch-out)
//       performAutoPunchOut("pagehide", false)

//       // Schedule logout after a small delay to allow punch-out to complete
//       setTimeout(() => {
//         performAutoLogout()
//       }, 100)
//     }

//     window.addEventListener("beforeunload", handleBeforeUnload, { capture: true })
//     window.addEventListener("pagehide", handlePageHide, { capture: true })

//     return () => {
//       window.removeEventListener("beforeunload", handleBeforeUnload, { capture: true })
//       window.removeEventListener("pagehide", handlePageHide, { capture: true })
//     }
//   }, [isPunchedIn, performAutoPunchOut, performAutoLogout, userId])

//   useEffect(() => {
//     const handleFocus = () => {
//       console.info("[sync] Window focused - checking for pending punch-out")
//       syncPendingPunchOut()
//       fetchUserData()
//     }

//     const handleOnline = () => {
//       console.info("[sync] Network online - checking for pending punch-out")
//       syncPendingPunchOut()
//     }

//     const handleVisibilityChange = () => {
//       if (document.visibilityState === "visible") {
//         console.info("[sync] Tab became visible - checking for pending punch-out")
//         syncPendingPunchOut()
//         fetchUserData()
//       }
//     }

//     window.addEventListener("focus", handleFocus)
//     window.addEventListener("online", handleOnline)
//     document.addEventListener("visibilitychange", handleVisibilityChange)

//     return () => {
//       window.removeEventListener("focus", handleFocus)
//       window.removeEventListener("online", handleOnline)
//       document.removeEventListener("visibilitychange", handleVisibilityChange)
//     }
//   }, [fetchUserData])

//   useEffect(() => {
//     const interval = setInterval(() => {
//       if (pendingPunchOutRef.current && !pendingPunchOutRef.current.synced) {
//         console.info("[sync] Interval check - syncing pending punch-out")
//         syncPendingPunchOut()
//       }
//     }, SYNC_CHECK_INTERVAL)

//     return () => clearInterval(interval)
//   }, [])

//   const syncPendingPunchOut = useCallback(async () => {
//     const pending = pendingPunchOutRef.current
//     if (!pending || pending.synced) return

//     try {
//       const response = await fetch("/api/employee/auto-punch-out", {
//         method: "POST",
//         body: JSON.stringify({
//           timestamp: pending.timestamp,
//           trigger: pending.trigger,
//           source: "reconciliation",
//         }),
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//       })

//       if (response.ok) {
//         console.info("[sync] Successfully synced pending punch-out")
//         pending.synced = true
//         try {
//           localStorage.removeItem("pendingPunchOut")
//         } catch { }
//         pendingPunchOutRef.current = null

//         const punchOutTime = new Date(pending.timestamp).toLocaleTimeString()
//         toast({
//           title: "Auto Punch-Out",
//           description: `You were automatically punched out at ${punchOutTime}`,
//           variant: "default",
//         })
//       } else {
//         console.warn("[sync] Failed to sync pending punch-out, status:", response.status)
//       }
//     } catch (error) {
//       console.error("[sync] Error syncing pending punch-out:", error)
//     }
//   }, [toast])

//   const validateAutoPunchOut = useCallback(() => {
//     const results = {
//       browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
//       sendBeacon: typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function",
//       keepaliveFetch: typeof fetch !== "undefined" && typeof AbortController !== "undefined",
//       localStorage: false,
//       visibilityAPI: typeof document !== "undefined" && "visibilityState" in document,
//       onlineStatus: typeof navigator !== "undefined" && "onLine" in navigator,
//       eventListeners: {
//         beforeunload: false,
//         pagehide: false,
//         visibilitychange: false,
//         unload: false,
//         focus: false,
//         online: false
//       }
//     }

//     try {
//       const testKey = "__auto_punch_out_test__"
//       localStorage.setItem(testKey, "test")
//       localStorage.removeItem(testKey)
//       results.localStorage = true
//     } catch {}

//     if (typeof window !== "undefined") {
//       results.eventListeners.beforeunload = true
//       results.eventListeners.pagehide = true
//       results.eventListeners.unload = true
//       results.eventListeners.focus = true
//       results.eventListeners.online = true
//     }

//     if (typeof document !== "undefined") {
//       results.eventListeners.visibilitychange = true
//     }

//     console.log("[auto-punch-out-validation] Feature detection results:", results)

//     return results
//   }, [])

//   const links = useMemo(
//     () => [
//       {
//         label: "Dashboard",
//         href: "/employee/dashboard?pane=dashboard",
//         icon: LayoutDashboard,
//         onClick: (e: React.MouseEvent) => {
//           e.preventDefault()
//           router.push("/employee/dashboard?pane=dashboard")
//           setActiveTab("dashboard")
//         },
//       },
//       {
//         label: "Leave Management",
//         href: "/employee/dashboard?pane=leaves",
//         icon: CalendarDays,
//         onClick: (e: React.MouseEvent) => {
//           e.preventDefault()
//           router.push("/employee/dashboard?pane=leaves")
//           setActiveTab("leaves")
//         },
//       },
//       {
//         label: "My Attendance Records",
//         href: "/employee/dashboard?pane=attendance",
//         icon: ClipboardList,
//         onClick: (e: React.MouseEvent) => {
//           e.preventDefault()
//           router.push("/employee/dashboard?pane=attendance")
//           setActiveTab("attendance")
//         },
//       },
//     ],
//     [router],
//   )

//   useEffect(() => {
//     const p = searchParams.get("pane")
//     if (p === "leaves" || p === "attendance" || p === "dashboard") {
//       setActiveTab(p as "dashboard" | "leaves" | "attendance")
//     } else {
//       setActiveTab("dashboard")
//     }
//   }, [searchParams])

//   useEffect(() => {
//     const timer = setInterval(() => setCurrentTime(new Date()), 1000)
//     return () => clearInterval(timer)
//   }, [])

//   useEffect(() => {
//     if (loading) return

//     const reconcilePending = async () => {
//       try {
//         const pending = localStorage.getItem("pendingPunchOut")
//         if (!pending) return

//         const record = JSON.parse(pending)
//         console.info("[auto-punch-out] Attempting to reconcile pending punch-out", {
//           timestamp: record.ts,
//           trigger: record.trigger,
//           hasError: !!record.errorDetails,
//           wasOnline: record.onlineStatus
//         })

//         const res = await fetch("/api/employee/auto-punch-out", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ 
//             trigger: "reconcile", 
//             source: "app-load", 
//             ts: record?.ts,
//             originalTrigger: record?.trigger,
//             errorDetails: record?.errorDetails
//           }),
//           credentials: "include",
//           cache: "no-store",
//         })

//         if (res.ok) {
//           const result = await res.json()
//           localStorage.removeItem("pendingPunchOut")
//           console.info("[auto-punch-out] Successfully reconciled pending punch-out", result)

//           try {
//             localStorage.removeItem("autoPunchOutOccurred")
//           } catch {}

//           setIsPunchedIn(false)
//           setActiveSession(null)

//           if (result.action === "updated") {
//             console.info("[auto-punch-out] User was automatically punched out at", record.ts)
//             toast({ 
//               title: "Auto Punch-Out Completed", 
//               description: `You were automatically punched out at ${new Date(record.ts).toLocaleTimeString()}`,
//               variant: "default"
//             })
//           }
//         } else {
//           const errorText = await res.text()
//           console.warn("[auto-punch-out] Reconciliation failed", {
//             status: res.status,
//             error: errorText,
//             timestamp: record.ts
//           })

//           if (record.errorDetails && record.errorDetails.attemptCount && record.errorDetails.attemptCount >= 3) {
//             console.error("[auto-punch-out] Multiple reconciliation attempts failed - manual intervention may be required")
//           }
//         }
//       } catch (err: any) {
//         console.error("[auto-punch-out] Reconciliation error", {
//           error: err.message || err,
//           timestamp: new Date().toISOString()
//         })

//         console.info("[auto-punch-out] Preserving pending data for next reconciliation attempt")
//       }
//     }

//     reconcilePending().then(() => {
//       console.log("[auto-punch-out] Pending reconciliation completed")
//     }).catch(error => {
//       console.error("[auto-punch-out] Error during pending reconciliation:", error)
//     })
//   }, [loading, toast])

//   useEffect(() => {
//     const run = async () => {
//       try {
//         const pending = localStorage.getItem("pendingLogout")
//         if (!pending) return
//         const supabase = createClient()
//         const { data: { user } } = await supabase.auth.getUser()
//         if (user) {
//           await supabase.auth.signOut()
//         }
//         localStorage.removeItem("pendingLogout")
//       } catch (err) {
//       }
//     }
//     run()
//   }, [])

//   useEffect(() => {
//     if (activeTab === "attendance") {
//       fetchAttendanceRecords()
//     }
//   }, [activeTab])

//   const fetchAttendanceRecords = async () => {
//     const supabase = createClient()
//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser()
//       if (!user) return
//       const { data } = await supabase
//         .from("attendance")
//         .select("date, status, login_time, logout_time, total_hours")
//         .eq("user_id", user.id)
//         .order("date", { ascending: false })
//         .limit(30)
//       setAttendanceRecords(data || [])
//     } catch (error) {
//       console.error("Error fetching attendance records:", error)
//     }
//   }


//   const computeStatus = (): "present" | "late" => {
//     try {
//       if (!userData?.work_time_start) return "present"

//       const now = new Date()
//       const scheduled = new Date()
//       const [h, m] = userData.work_time_start.split(":").map((v) => parseInt(v, 10))
//       scheduled.setHours(h || 9, m || 0, 0, 0)

//       const toleranceMinutes = 10
//       return now.getTime() > scheduled.getTime() + toleranceMinutes * 60 * 1000 ? "late" : "present"
//     } catch {
//       return "present"
//     }
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-screen w-full">
//         <div className="text-center">
//           <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
//           <p className="text-muted-foreground">Loading...</p>
//         </div>
//       </div>
//     )
//   }

//   const formatRecordTime = (isoString: string) => {
//     try {
//       const date = new Date(isoString)
//       const hours = date.getHours()
//       const minutes = String(date.getMinutes()).padStart(2, "0")
//       const ampm = hours >= 12 ? "PM" : "AM"
//       const formattedHours = hours % 12 || 12
//       return `${formattedHours}:${minutes} ${ampm}`
//     } catch {
//       return isoString
//     }
//   }

//   const handleCheckIn = async () => {
//     if (activeSession) {
//       toast({ title: "Already checked in", description: "You have an active session.", variant: "destructive" })
//       return
//     }
//     const now = new Date()
//     const status = computeStatus()
//     const nowIso = now.toISOString()

//     if (status === "late") {
//       setLateDialogOpen(true)
//       return
//     }

//     try {
//       const supabase = createClient()
//       const { data: { user } } = await supabase.auth.getUser()
//       if (!user) {
//         toast({ title: "Not authenticated", description: "Please log in to punch in.", variant: "destructive" })
//         return
//       }
//       await supabase.from("attendance").insert({
//         user_id: user.id,
//         date: nowIso.split("T")[0],
//         login_time: nowIso,
//         status: "present",
//         reason: null,
//       })

//       const newRecord: TimeRecord = {
//         id: crypto.randomUUID(),
//         date: nowIso.split("T")[0],
//         checkIn: nowIso,
//       }
//       const updated = [newRecord, ...records]
//       setRecords(updated)
//       setActiveSession(newRecord)
//       setIsPunchedIn(true)
//       try {
//         localStorage.setItem("timeRecords", JSON.stringify(updated))
//       } catch (err) {
//         console.warn("Failed to persist timeRecords", err)
//       }
//       toast({ title: "Checked in", description: formatRecordTime(newRecord.checkIn) })
//       fetchUserData()
//     } catch (error: any) {
//       toast({ title: "Punch in failed", description: error?.message || "Could not update attendance.", variant: "destructive" })
//     }
//   }

//   const handleCheckOut = async () => {
//     if (!activeSession) {
//       toast({ title: "No active session", description: "You are not checked in.", variant: "destructive" })
//       return
//     }
//     const now = new Date()
//     const nowIso = now.toISOString()
//     try {
//       const supabase = createClient()
//       const { data: { user } } = await supabase.auth.getUser()
//       if (!user) {
//         toast({ title: "Not authenticated", description: "Please log in to punch out.", variant: "destructive" })
//         return
//       }

//       let totalHours = 0
//       try {
//         const loginDate = new Date(activeSession.checkIn)
//         totalHours = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60)
//       } catch { }

//       await supabase
//         .from("attendance")
//         .update({ logout_time: nowIso, total_hours: totalHours })
//         .eq("user_id", user.id)
//         .eq("date", nowIso.split("T")[0])

//       const updated = records.map((r) => (r.id === activeSession.id ? { ...r, checkOut: nowIso } : r))
//       setRecords(updated)
//       setActiveSession(null)
//       setIsPunchedIn(false)
//       try {
//         localStorage.setItem("timeRecords", JSON.stringify(updated))
//       } catch (err) {
//         console.warn("Failed to persist timeRecords", err)
//       }
//       toast({ title: "Checked out", description: formatRecordTime(nowIso) })
//       fetchUserData()
//     } catch (error: any) {
//       toast({ title: "Punch out failed", description: error?.message || "Could not update attendance.", variant: "destructive" })
//     }
//   }

//   const submitLate = async () => {
//     try {
//       const supabase = createClient()
//       const { data: { user } } = await supabase.auth.getUser()
//       if (!user) {
//         toast({ title: "Not authenticated", description: "Please log in to punch in.", variant: "destructive" })
//         return
//       }
//       const nowIso = latePunchTimestamp || new Date().toISOString()
//       const finalReason = `${lateReasonPreset ? `${lateReasonPreset}: ` : ""}${lateReason.trim()}`
//       if (!finalReason.trim()) {
//         toast({ title: "Reason required", description: "Please enter a reason for late punch-in.", variant: "destructive" })
//         return
//       }
//       await supabase.from("attendance").insert({
//         user_id: user.id,
//         date: nowIso.split("T")[0],
//         login_time: nowIso,
//         status: "late",
//         reason: finalReason,
//       })

//       const newRecord: TimeRecord = {
//         id: crypto.randomUUID(),
//         date: nowIso.split("T")[0],
//         checkIn: nowIso,
//       }
//       const updated = [newRecord, ...records]
//       setRecords(updated)
//       setActiveSession(newRecord)
//       setIsPunchedIn(true)
//       try {
//         localStorage.setItem("timeRecords", JSON.stringify(updated))
//       } catch (err) {
//         console.warn("Failed to persist timeRecords", err)
//       }

//       setLateDialogOpen(false)
//       setLateReason("")
//       setLateReasonPreset("")
//       toast({ title: "Punched in (late)", description: formatRecordTime(nowIso) })
//       fetchUserData()
//     } catch (error: any) {
//       toast({ title: "Late reason failed", description: error?.message || "Could not save late reason.", variant: "destructive" })
//     }
//   }

//   const leavesRemaining = userData ? userData.total_leaves - userData.used_leaves : 0

//   const handleLogout = async () => {
//     const supabase = createClient()
//     try {
//       await supabase.auth.signOut()
//     } catch { }
//     router.replace("/auth/login")
//   }

//   const onMenuClick = () => setSidebarOpen(true)

//   function SidebarPanel() {
//     return (
//       <>
//         {sidebarOpen && (
//           <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
//         )}
//         <aside
//           className={cn(
//             "fixed left-0 top-0 h-full bg-white/70 dark:bg-white/15 backdrop-blur-2xl border-r border-white/60 dark:border-white/20 z-50 transition-transform duration-300 lg:translate-x-0",
//             sidebarOpen ? "translate-x-0" : "-translate-x-full",
//             "w-64 flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
//           )}
//         >
//           <div className="flex items-center justify-between p-6 border-b border-white/50 dark:border-white/20">
//             <div className="flex items-center relative">
//               <img src="/dezprox horizontal black logo.png" alt="Dezprox Logo" className="h-8 w-auto dark:hidden" />
//               <img src="/dezprox horizontal white logo.png" alt="Dezprox Logo" className="h-8 w-auto hidden dark:block" />
//             </div>
//             <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
//               <X className="h-5 w-5" />
//             </Button>
//           </div>
//           <nav className="flex-1 overflow-y-auto p-4">
//             <div className="space-y-1">
//               {sidebarLinks.map((item) => {
//                 const Icon = item.icon as any
//                 return (
//                   <button
//                     key={item.page}
//                     className={cn(
//                       "w-full flex items-center gap-3 px-4 py-3 rounded-[20px] transition-all group",
//                       activeTab === item.page
//                         ? "bg-white/70 dark:bg-white/15 text-green-600 dark:text-green-400 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/60 dark:border-white/20"
//                         : "text-foreground hover:bg-white/40 dark:hover:bg-white/10 border border-transparent"
//                     )}
//                     onClick={() => {
//                       setActiveTab(item.page as any)
//                       setSidebarOpen(false)
//                     }}
//                   >
//                     <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${activeTab === item.page ? "" : "group-hover:rotate-12"}`} />
//                     <span>{item.label}</span>
//                   </button>
//                 )
//               })}
//             </div>
//           </nav>
//           <div className="border-t border-white/30 dark:border-white/10">
//             <div className="p-4">
//               <button
//                 onClick={handleLogout}
//                 className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-white/30 dark:hover:bg-red-950/30 backdrop-blur-sm transition-all group"
//               >
//                 <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1 group-hover:scale-110" />
//                 <span className="transition-transform group-hover:translate-x-1">Logout</span>
//               </button>
//             </div>
//           </div>
//         </aside>
//       </>
//     )
//   }

//   return (
//     <div
//       className={cn(
//         "mx-auto flex w-full  flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-background md:flex-row dark:border-neutral-700",
//         "h-screen",
//       )}
//     >
//       <SidebarPanel />

//       <AlertDialog open={showTabCloseDialog} onOpenChange={setShowTabCloseDialog}>
//         <AlertDialogContent className="sm:max-w-[400px]">
//           <AlertDialogHeader>
//             <AlertDialogTitle>Auto Punch-Out</AlertDialogTitle>
//             <AlertDialogDescription>
//               You are closing the tab. You will be automatically punched out and your session will be saved to the database.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <div className="py-2 px-4 bg-muted rounded-lg text-sm">
//             <p className="text-muted-foreground">
//               <span className="font-medium text-foreground">Time:</span> {new Date().toLocaleTimeString()}
//             </p>
//           </div>
//           <div className="flex gap-3 justify-end">
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction 
//               onClick={() => {
//                 setShowTabCloseDialog(false)
//                 setIsConfirmingPunchOut(true)
//               }}
//               className="bg-green-600 hover:bg-green-700"
//             >
//               Confirm Punch-Out
//             </AlertDialogAction>
//           </div>
//         </AlertDialogContent>
//       </AlertDialog>

//       {/* Late reason dialog for late punch-in */}
//       <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
//         <DialogContent className="sm:max-w-[480px]">
//           <DialogHeader>
//             <DialogTitle>Late punch-in reason</DialogTitle>
//           </DialogHeader>

//           <div className="space-y-4">
//             <div className="text-sm text-muted-foreground">
//               <span className="font-medium text-foreground">Timestamp:</span> {new Date().toISOString()}
//             </div>

//             <div className="grid gap-2">
//               <label htmlFor="commonReason" className="text-sm font-medium">Common reasons (optional)</label>
//               <select
//                 id="commonReason"
//                 value={lateReasonPreset}
//                 onChange={(e) => setLateReasonPreset(e.target.value)}
//                 className="w-full rounded-md border bg-background p-2 text-sm"
//                 aria-label="Select a common late reason"
//               >
//                 <option value="">Select a common reason</option>
//                 {commonLateReasons.map((r) => (
//                   <option key={r} value={r}>{r}</option>
//                 ))}
//               </select>
//             </div>

//             <div className="grid gap-2">
//               <label htmlFor="lateReason" className="text-sm font-medium">Reason (required)</label>
//               <Textarea
//                 id="lateReason"
//                 value={lateReason}
//                 onChange={(e) => setLateReason(e.target.value)}
//                 placeholder="Write a brief explanation..."
//                 aria-required="true"
//                 className="min-h-[88px]"
//               />
//               {!lateReason.trim() && (
//                 <p className="text-xs text-destructive">Reason is required.</p>
//               )}
//             </div>

//             <div className="flex items-center justify-end gap-2 pt-2">
//               <Button
//                 variant="outline"
//                 type="button"
//                 onClick={() => {
//                   setLateDialogOpen(false)
//                   setLateReason("")
//                   setLateReasonPreset("")
//                 }}
//                 aria-label="Cancel late reason"
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="button"
//                 onClick={submitLate}
//                 disabled={!lateReason.trim()}
//                 aria-label="Submit late reason"
//               >
//                 Submit
//               </Button>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>

//       {/* Content area */}
//       <div className="flex flex-1 flex-col overflow-y-auto lg:ml-64  bg-[#E8E8ED] dark:bg-[#1C1C1E] ">
//         <DashboardHeader onMenuClick={onMenuClick}  isEmployee={true} />
//         <div className="flex h-full w-full flex-1 flex-col gap-6 rounded-tl-2xl bg-transparent p-5   ">
//           {/* Breadcrumb */}

//           {activeTab === "dashboard" && (
//             <>
//               <Card className="bg-black border-0 rounded-3xl h-96 p-8 overflow-hidden shadow-lg">
//                 <div className="flex items-center justify-between">
//                   <div className="flex-1">
//                     <h2 className="text-3xl text-[#3FA740] font-bold tracking-wider mb-3 text-center">Welcome back {userData?.name ?? "Employee"}</h2>
//                     <p className="text-white text-center mb-1">
//                       {userData?.type === "fulltime" ? "Full-time Employee" : userData?.type === "intern1" ? "Working Intern" : "Learning Intern"}
//                     </p>
//                     <p className="text-white/70 text-center">Working Hours: {formatTime12hCompactFromString(userData?.work_time_start)} - {formatTime12hCompactFromString(userData?.work_time_end)}</p>
//                   </div>
//                   <img src="/employee-working.png" alt="Employee" className="h-40 w-auto" />
//                 </div>
//               </Card>

//               <Card className="backdrop-blur-2xl bg-white/80 dark:bg-black/60 border border-white/20 dark:border-white/10 rounded-4xl p-8 shadow-2xl">
//                 <div className="flex items-center gap-2 text-muted-foreground mb-6">
//                   <Clock className="h-5 w-5" />
//                   <span className="text-sm">Today's Attendance</span>
//                 </div>
//                 <div className="text-center mb-8">
//                   <div className="text-6xl text-foreground mb-2">{formatTime12hFromDate(currentTime)}</div>
//                   <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</div>
//                 </div>
//                 {!activeSession ? (
//                   <div className="space-y-4">
//                     <SlideToCheckIn onComplete={handleCheckIn} />
//                     <p className="text-center text-xs text-muted-foreground">Drag the button to start work</p>
//                   </div>
//                 ) : (
//                   <div className="space-y-6">
//                     <div className="flex items-center justify-between">
//                       <div className="flex items-center gap-2">
//                         <span className="w-2 h-2 bg-green-500 rounded-full" />
//                         <span className="text-sm">Active Session</span>
//                       </div>
//                     </div>
//                     <WorkDurationCard duration={workDuration} checkInTime={formatRecordTime(activeSession.checkIn)} />
//                     <div className="space-y-4">
//                       <SlideToCheckOut onComplete={handleCheckOut} />
//                       <p className="text-center text-xs text-muted-foreground">Drag the button to end your work day</p>
//                     </div>
//                   </div>
//                 )}
//               </Card>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <Card className="p-6">
//                   <div className="flex items-center justify-between mb-6">
//                     <h3 className="text-sm">Leave Balance</h3>
//                     <span className="text-xs text-muted-foreground">Info</span>
//                   </div>
//                   <div>
//                     <div className="mb-3">
//                       <div className="text-5xl mb-1">{(userData?.total_leaves ?? 0) - (userData?.used_leaves ?? 0)}</div>
//                       <div className="text-sm text-muted-foreground">{userData?.used_leaves ?? 0}/{userData?.total_leaves ?? 0} used</div>
//                     </div>
//                     <div className="h-2 bg-secondary rounded-full overflow-hidden">
//                       <div className="h-full bg-primary" style={{ width: `${((userData?.used_leaves || 0) / Math.max(1, userData?.total_leaves || 1)) * 100}%` }} />
//                     </div>
//                   </div>
//                 </Card>
//                 <Card className="p-6">
//                   <h3 className="mb-6 text-sm">Quick Actions</h3>
//                   <Button onClick={() => setActiveTab("leaves")} className="w-full justify-between h-12 rounded-xl bg-background text-foreground border hover:bg-muted transition-all">
//                     <span className="text-sm">Apply for Leave</span>
//                     <ChevronRight className="h-4 w-4" />
//                   </Button>
//                   <button
//                     onClick={() => {
//                       const results = validateAutoPunchOut()
//                       console.log("[auto-punch-out-test] Validation results:", results)
//                       alert(`Auto Punch-Out Feature Detection:\n\n` +
//                         `Browser: ${results.browser.substring(0, 50)}...\n` +
//                         `sendBeacon: ${results.sendBeacon ? "✅ Available" : "❌ Not Available"}\n` +
//                         `Keepalive Fetch: ${results.keepaliveFetch ? "✅ Available" : "❌ Not Available"}\n` +
//                         `LocalStorage: ${results.localStorage ? "✅ Available" : "❌ Not Available"}\n` +
//                         `Visibility API: ${results.visibilityAPI ? "✅ Available" : "❌ Not Available"}\n` +
//                         `Online Status: ${results.onlineStatus ? "✅ Available" : "❌ Not Available"}\n\n` +
//                         `Event Listeners: ${Object.entries(results.eventListeners).map(([k,v]) => `${k}: ${v ? "✅" : "❌"}`).join(", ")}`
//                       )
//                     }}
//                     className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-50 hover:opacity-100"
//                     title="Test Auto Punch-Out Features (Developer Tool)"
//                   >
//                     Test Auto Punch-Out
//                   </button>
//                 </Card>
//               </div>
//             </>
//           )}

//           {activeTab === "leaves" && (
//             <LeavemManagement />
//           )}

//           {activeTab === "attendance" && (
//             <AttendanceNanagement />
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }


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
}

export default function EmployeeDashboardClient() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

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
              title: "Auto Punch-Out",
              description: "You have been automatically punched out due to inactivity.",
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [userId, isPunchedIn, toast])

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
            title: "Session Restored",
            description: "Your previous session was automatically closed.",
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

  const computeStatus = (): "present" | "late" => {
    try {
      if (!userData?.work_time_start) return "present"
      const now = new Date()
      const scheduled = new Date()
      const [h, m] = userData.work_time_start.split(":").map((v) => parseInt(v, 10))
      scheduled.setHours(h || 9, m || 0, 0, 0)
      const toleranceMinutes = 10
      return now.getTime() > scheduled.getTime() + toleranceMinutes * 60 * 1000 ? "late" : "present"
    } catch {
      return "present"
    }
  }

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

  const handleCheckIn = async () => {
    if (activeSession) {
      toast({ title: "Already checked in", variant: "destructive" })
      return
    }

    const status = computeStatus()
    if (status === "late") {
      setLateDialogOpen(true)
      return
    }

    const nowIso = new Date().toISOString()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" })
        return
      }

      await supabase.from("attendance").insert({
        user_id: user.id,
        date: nowIso.split("T")[0],
        login_time: nowIso,
        status: "present",
      })

      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        date: nowIso.split("T")[0],
        checkIn: nowIso,
      }

      setRecords([newRecord])
      setActiveSession(newRecord)
      setIsPunchedIn(true)
      punchOutSentRef.current = false // Reset on new punch-in

      try {
        localStorage.setItem("timeRecords", JSON.stringify([newRecord]))
      } catch { }

      toast({ title: "Checked in", description: formatRecordTime(nowIso) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Punch in failed", description: error?.message, variant: "destructive" })
    }
  }

  const handleCheckOut = async () => {
    if (!activeSession) {
      toast({ title: "No active session", variant: "destructive" })
      return
    }

    const nowIso = new Date().toISOString()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" })
        return
      }

      const loginDate = new Date(activeSession.checkIn)
      const totalHours = (Date.now() - loginDate.getTime()) / (1000 * 60 * 60)

      await supabase
        .from("attendance")
        .update({ logout_time: nowIso, total_hours: totalHours })
        .eq("user_id", user.id)
        .eq("date", nowIso.split("T")[0])

      setActiveSession(null)
      setIsPunchedIn(false)
      punchOutSentRef.current = false

      try {
        localStorage.removeItem("timeRecords")
      } catch { }

      toast({ title: "Checked out", description: formatRecordTime(nowIso) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Punch out failed", description: error?.message, variant: "destructive" })
    }
  }

  const submitLate = async () => {
    const finalReason = `${lateReasonPreset ? `${lateReasonPreset}: ` : ""}${lateReason.trim()}`
    if (!finalReason.trim()) {
      toast({ title: "Reason required", variant: "destructive" })
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
      toast({ title: "Punched in (late)", description: formatRecordTime(nowIso) })
      fetchUserData()
    } catch (error: any) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" })
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    try {
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
            <img src="/dezprox horizontal black logo.png" alt="Logo" className="h-8 dark:hidden" />
            <img src="/dezprox horizontal white logo.png" alt="Logo" className="h-8 hidden dark:block" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Late punch-in reason</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* <select
              value={lateReasonPreset}
              onChange={(e) => setLateReasonPreset(e.target.value)}
              className="w-full rounded-md border p-2"
            >
              <option value="">Select a reason</option>
              {commonLateReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select> */}
            <Textarea
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="Additional details..."
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLateDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitLate} disabled={!lateReason.trim()}>Submit</Button>
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

              <div className="hidden gap-6">
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