'use client'
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Search, HelpCircle, Bell, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface AdminDashboardResponse {
    stats: any; // Define a more specific type if known
    attendanceTrends: any; // Define a more specific type if known
    latePatterns: any; // Define a more specific type if known
    leaveBreakdown: any; // Define a more specific type if known
    typeDistribution: any; // Define a more specific type if known
}

interface DashboardHeaderProps {
    lastUpdated: Date | null;
    setLastUpdated: (date: Date | null) => void;
    timeRange: "weekly" | "monthly";
    setTimeRange: (range: "weekly" | "monthly") => void;
    refreshInterval: number;
    setRefreshInterval: (interval: number) => void;
    setLoading: (loading: boolean) => void;
    setStats: (stats: any) => void; // Replace 'any' with actual type if known
    setAttendanceTrends: (trends: any) => void; // Replace 'any' with actual type if known
    setLatePatterns: (patterns: any) => void; // Replace 'any' with actual type if known
    setLeaveBreakdown: (breakdown: any) => void; // Replace 'any' with actual type if known
    setTypeDistribution: (distribution: any) => void; // Replace 'any' with actual type if known
    error: string | null; // Add error prop
    setError: (error: string | null) => void;
}

export function DashboardHeader({
    lastUpdated,
    setLastUpdated,
    timeRange,
    setTimeRange,
    refreshInterval,
    setRefreshInterval,
    setLoading,
    setStats,
    setAttendanceTrends,
    setLatePatterns,
    setLeaveBreakdown,
    setTypeDistribution,
    error, // Destructure error prop
    setError,
}: DashboardHeaderProps) {
    // const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // useEffect(() => {
    //     setLastUpdated(new Date());
    //     const interval = setInterval(() => {
    //         setLastUpdated(new Date());
    //     }, 60 * 1000); // Update every minute
    //     return () => clearInterval(interval);
    // }, []);

    const supabase = createClient()
    const { toast } = useToast()
    const [notifOpen, setNotifOpen] = useState(false)
    const [feedbackOpen, setFeedbackOpen] = useState(false)
    type Notif = { id: string; type: "login" | "leave"; name: string; ts: string; meta: string; read: boolean }
    type FeedbackItem = { id: string; user_id: string; name: string; ts: string; status: 'pending' | 'reviewed' | 'resolved'; description: string; attachment_path?: string | null; contact_email?: string | null }
    const [notifs, setNotifs] = useState<Notif[]>([])
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
    const [notifLoading, setNotifLoading] = useState(false)
    const [feedbackLoading, setFeedbackLoading] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [isDeletingOne, setIsDeletingOne] = useState(false)
    const [bulkConfirmOpenFeedback, setBulkConfirmOpenFeedback] = useState(false)
    const [bulkDeletingFeedback, setBulkDeletingFeedback] = useState(false)
    const [confirmClearOpen, setConfirmClearOpen] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [groupsExpanded, setGroupsExpanded] = useState({ today: true, yesterday: true, week: true, older: true })
    const [feedbackGroupsExpanded, setFeedbackGroupsExpanded] = useState({ today: true, yesterday: true, week: true, older: true })
    const [imageOpen, setImageOpen] = useState(false)
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [imageName, setImageName] = useState<string | null>(null)
    const [imageScale, setImageScale] = useState<number>(1)
    const isValidEmail = (v: string) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)
    const isImagePath = (p: string) => /\.(png|jpe?g|webp)$/i.test(p)
    const fileNameFromPath = (p: string) => (p?.split("/").pop() || p)
    const resolveAttachmentUrl = async (path: string): Promise<string> => {
        try {
            const res = await fetch("/api/admin/feedback-attachment-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            })
            if (res.ok) {
                const j = await res.json().catch(() => ({}))
                if (j?.url) return j.url as string
            }
        } catch {}
        try {
            const { data } = await supabase.storage.from("feedback_attachments").createSignedUrl(path, 300)
            const url = (data as any)?.signedUrl || ""
            if (url) return url
        } catch {}
        try {
            const { data } = await supabase.storage.from("feedback_attachments").getPublicUrl(path)
            return data?.publicUrl || ""
        } catch {
            return ""
        }
    }
    const openImage = async (path: string) => {
        try {
            const url = await resolveAttachmentUrl(path)
            if (!url) {
                toast({ variant: "destructive", title: "Attachment unavailable" })
                return
            }
            setImageSrc(url)
            setImageName(fileNameFromPath(path))
            setImageScale(1)
            setImageOpen(true)
        } catch {
            toast({ variant: "destructive", title: "Attachment error" })
        }
    }
    const openDocument = async (path: string) => {
        try {
            const url = await resolveAttachmentUrl(path)
            if (!url) {
                toast({ variant: "destructive", title: "Attachment unavailable" })
                return
            }
            if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer")
        } catch {
            toast({ variant: "destructive", title: "Attachment error" })
        }
    }

    const confirmDeleteFeedback = async () => {
        if (!confirmDeleteId) return
        try {
            setIsDeletingOne(true)
            const res = await fetch("/api/admin/delete-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feedback_id: Number(confirmDeleteId) }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j?.ok) throw new Error(j?.error || `Server returned ${res.status}`)
            setFeedbacks((cur) => cur.filter((f) => String(f.id) !== String(confirmDeleteId)))
            toast({ title: "Feedback deleted" })
            setConfirmDeleteId(null)
        } catch (e: any) {
            toast({ variant: "destructive", title: "Delete failed", description: e?.message || "Try again later" })
        } finally {
            setIsDeletingOne(false)
        }
    }

    const handleBulkDeleteFeedback = async () => {
        try {
            setBulkDeletingFeedback(true)
            const res = await fetch("/api/admin/clear-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ statuses: ["resolved", "reviewed"] }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j?.ok) throw new Error(j?.error || `Server returned ${res.status}`)
            setFeedbacks((cur) => cur.filter((f) => !(f.status === "resolved" || f.status === "reviewed")))
            toast({ title: "Feedback cleared" })
            setBulkConfirmOpenFeedback(false)
        } catch (e: any) {
            toast({ variant: "destructive", title: "Clear failed", description: e?.message || "Try again later" })
        } finally {
            setBulkDeletingFeedback(false)
        }
    }

    const fmt = (ts: string) => {
        const d = new Date(ts)
        return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", hour12: true, month: "short", day: "numeric" })
    }

    useEffect(() => {
        const init = async () => {
            try {
                setNotifLoading(true)
                const { data: leaves } = await supabase
                    .from("leaves")
                    .select("user_id, category, status, applied_at")
                    .order("applied_at", { ascending: false })
                    .limit(15)
                const { data: attendance } = await supabase
                    .from("attendance")
                    .select("user_id, login_time, created_at")
                    .order("created_at", { ascending: false })
                    .limit(15)
                const userIds = Array.from(new Set([...(leaves?.map((r: any) => r.user_id) || []), ...(attendance?.map((r: any) => r.user_id) || [])]))
                const { data: users } = await supabase.from("users").select("id,name,role").in("id", userIds)
                const nameById = new Map<string, { name: string; role: string | null }>()
                users?.forEach((u: any) => nameById.set(u.id, { name: u.name, role: u.role }))
                const ln: Notif[] = (attendance || [])
                    .filter((a: any) => !!a.login_time)
                    .map((a: any) => ({ id: `login-${a.user_id}-${a.created_at}`, type: "login", name: nameById.get(a.user_id)?.name || a.user_id, ts: a.created_at || a.login_time, meta: nameById.get(a.user_id)?.role || "", read: false }))
                const lv: Notif[] = (leaves || [])
                    .map((l: any) => ({ id: `leave-${l.user_id}-${l.applied_at}`, type: "leave", name: nameById.get(l.user_id)?.name || l.user_id, ts: l.applied_at, meta: `${l.category} • ${l.status}`, read: false }))
                const merged = [...ln, ...lv].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 50)
                setNotifs(applySuppression(merged))
            } catch (e: any) {
                toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to load notifications" })
            } finally {
                setNotifLoading(false)
            }
        }
        init()
        const initFeedback = async () => {
            try {
                setFeedbackLoading(true)
                const { data } = await supabase
                    .from("feedback")
                    .select("feedback_id, user_id, feedback_text, submission_date, status, attachment_path, contact_email")
                    .order("submission_date", { ascending: false })
                    .limit(50)
                const ids = Array.from(new Set((data || []).map((f: any) => f.user_id)))
                const { data: users } = await supabase.from("users").select("id,name").in("id", ids)
                const nameMap = new Map<string, string>()
                users?.forEach((u: any) => nameMap.set(u.id, u.name))
                const items: FeedbackItem[] = (data || []).map((f: any) => ({
                    id: f.feedback_id,
                    user_id: f.user_id,
                    name: nameMap.get(f.user_id) || f.user_id,
                    ts: f.submission_date,
                    status: f.status || 'pending',
                    description: f.feedback_text || "",
                    attachment_path: f.attachment_path || null,
                    contact_email: f.contact_email || null,
                }))
                setFeedbacks(items)
            } catch (e: any) {
                toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to load feedback" })
            } finally {
                setFeedbackLoading(false)
            }
        }
        initFeedback()
        const ch1 = supabase
            .channel("notif-attendance")
            .on("postgres_changes", { event: "insert", schema: "public", table: "attendance" }, async (payload: any) => {
                try {
                    const u = payload.new?.user_id
                    const { data: user } = await supabase.from("users").select("name,role").eq("id", u).single()
                    const n: Notif = { id: `login-${u}-${payload.new?.created_at}`, type: "login", name: user?.name || u, ts: payload.new?.created_at || new Date().toISOString(), meta: user?.role || "", read: false }
                    setNotifs((cur) => applySuppression([n, ...cur]).slice(0, 50))
                } catch (_) {}
            })
            .subscribe()
        const ch2 = supabase
            .channel("notif-leaves")
            .on("postgres_changes", { event: "insert", schema: "public", table: "leaves" }, async (payload: any) => {
                try {
                    const u = payload.new?.user_id
                    const { data: user } = await supabase.from("users").select("name").eq("id", u).single()
                    const n: Notif = { id: `leave-${u}-${payload.new?.applied_at}`, type: "leave", name: user?.name || u, ts: payload.new?.applied_at || new Date().toISOString(), meta: `${payload.new?.category} • ${payload.new?.status || "pending"}`, read: false }
                    setNotifs((cur) => applySuppression([n, ...cur]).slice(0, 50))
                } catch (_) {}
            })
            .subscribe()
        const ch3 = supabase
            .channel("feedback-updates")
            .on("postgres_changes", { event: "insert", schema: "public", table: "feedback" }, async (payload: any) => {
                try {
                    const u = payload.new?.user_id
                    const { data: user } = await supabase.from("users").select("name").eq("id", u).single()
                    const item: FeedbackItem = {
                        id: payload.new?.feedback_id,
                        user_id: u,
                        name: user?.name || u,
                        ts: payload.new?.submission_date || new Date().toISOString(),
                        status: payload.new?.status || 'pending',
                        description: payload.new?.feedback_text || "",
                        attachment_path: payload.new?.attachment_path || null,
                    }
                    setFeedbacks((cur) => [item, ...cur].slice(0, 50))
                } catch (_) {}
            })
            .subscribe()
        return () => {
            supabase.removeChannel(ch1)
            supabase.removeChannel(ch2)
            supabase.removeChannel(ch3)
        }
    }, [])

    const applySuppression = (items: Notif[]) => {
        try {
            const clearedAt = typeof window !== "undefined" ? window.localStorage.getItem("admin_notif_cleared_at") : null
            const deletedIds = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("admin_notif_deleted_ids") || "[]") : []
            const clearedMs = clearedAt ? new Date(clearedAt).getTime() : 0
            return items.filter((n) => (!clearedMs || new Date(n.ts).getTime() > clearedMs) && !deletedIds.includes(n.id))
        } catch {
            return items
        }
    }

    const groupByDate = (items: Notif[]) => {
        const now = new Date()
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
        const dayMs = 24 * 60 * 60 * 1000
        const yesterday = new Date(startOfDay(now).getTime() - dayMs)
        const startOfWeek = new Date(startOfDay(now).getTime() - (now.getDay() === 0 ? 6 : now.getDay() - 1) * dayMs)
        const groups: { today: Notif[]; yesterday: Notif[]; week: Notif[]; older: Notif[] } = { today: [], yesterday: [], week: [], older: [] }
        for (const n of items) {
            const dt = new Date(n.ts)
            if (isSameDay(dt, now)) groups.today.push(n)
            else if (isSameDay(dt, yesterday)) groups.yesterday.push(n)
            else if (dt >= startOfWeek) groups.week.push(n)
            else groups.older.push(n)
        }
        const sortDesc = (arr: Notif[]) => arr.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        return { today: sortDesc(groups.today), yesterday: sortDesc(groups.yesterday), week: sortDesc(groups.week), older: sortDesc(groups.older) }
    }

    const groupFeedbackByDate = (items: FeedbackItem[]) => {
        const now = new Date()
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
        const dayMs = 24 * 60 * 60 * 1000
        const yesterday = new Date(startOfDay(now).getTime() - dayMs)
        const startOfWeek = new Date(startOfDay(now).getTime() - (now.getDay() === 0 ? 6 : now.getDay() - 1) * dayMs)
        const groups: { today: FeedbackItem[]; yesterday: FeedbackItem[]; week: FeedbackItem[]; older: FeedbackItem[] } = { today: [], yesterday: [], week: [], older: [] }
        for (const n of items) {
            const dt = new Date(n.ts)
            if (isSameDay(dt, now)) groups.today.push(n)
            else if (isSameDay(dt, yesterday)) groups.yesterday.push(n)
            else if (dt >= startOfWeek) groups.week.push(n)
            else groups.older.push(n)
        }
        const sortDesc = (arr: FeedbackItem[]) => arr.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        return { today: sortDesc(groups.today), yesterday: sortDesc(groups.yesterday), week: sortDesc(groups.week), older: sortDesc(groups.older) }
    }

    const handleDeleteOne = (id: string) => {
        setRemovingId(id)
        setTimeout(() => {
            setNotifs((cur) => cur.filter((n) => n.id !== id))
            try {
                const arr = JSON.parse(window.localStorage.getItem("admin_notif_deleted_ids") || "[]")
                arr.push(id)
                window.localStorage.setItem("admin_notif_deleted_ids", JSON.stringify(Array.from(new Set(arr))))
            } catch {}
            setRemovingId(null)
        }, 200)
    }

    const handleClearAllConfirmed = () => {
        setDeletingAll(true)
        setTimeout(() => {
            setNotifs([])
            try {
                window.localStorage.setItem("admin_notif_cleared_at", new Date().toISOString())
                window.localStorage.setItem("admin_notif_deleted_ids", JSON.stringify([]))
            } catch {}
            setDeletingAll(false)
            setConfirmClearOpen(false)
        }, 300)
    }

    const unread = notifs.filter((n) => !n.read).length
    const markAllRead = () => setNotifs((cur) => cur.map((n) => ({ ...n, read: true })))

    return (
        <>
            <div className="flex items-center  justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => { /* sidebar is fixed; noop */ }}>
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl">Hello, Admin 👋</h1>
                        <p className="text-sm text-muted-foreground mt-1">Here's what's going on today.</p>
                        <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">Live updates</span>
                            {lastUpdated && (
                                <span className="text-xs text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* <Button variant="ghost" size="icon" className="rounded-full">
                        <Search className="h-5 w-5" />
                    </Button> */}
                    <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                        <SheetTrigger asChild>
                            <div className="relative inline-block group overflow-visible">
                                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open feedback">
                                    <HelpCircle className="h-5 w-5" />
                                </Button>
                                <div className="absolute w-40 -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-black text-white text-xs px-2 py-1 rounded">
                                    Click to see the feedbacks
                                </div>
                            </div>
                        </SheetTrigger>
                        <SheetContent side="right" aria-label="Employee feedback">
                            <SheetHeader>
                                <SheetTitle>Employee Feedback</SheetTitle>
                                <SheetDescription>Newest first</SheetDescription>
                            </SheetHeader>
                            <div className="px-4 pb-4 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">Total: {feedbacks.length}</div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkConfirmOpenFeedback(true)}
                                    aria-label="Clear all feedback"
                                >
                                    {bulkDeletingFeedback ? "Clearing..." : "Clear All Feedback"}
                                </Button>
                            </div>
                            <div className="p-4 space-y-4 overflow-y-auto h-full" aria-label="Feedback list">
                                {feedbackLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading...</div>
                                ) : feedbacks.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No feedback yet</div>
                                ) : (
                                    (() => {
                                        const g = groupFeedbackByDate(feedbacks)
                                        const sections: Array<{ key: keyof typeof g; label: string }> = [
                                            { key: "today", label: "Today" },
                                            { key: "yesterday", label: "Yesterday" },
                                            { key: "week", label: "This Week" },
                                            { key: "older", label: "Older" },
                                        ]
                                        return sections.map((s) => (
                                            <div key={s.key} aria-label={s.label} className="space-y-2">
                                                <button
                                                    className="flex w-full items-center justify-between text-sm font-semibold"
                                                    aria-expanded={feedbackGroupsExpanded[s.key]}
                                                    onClick={() => setFeedbackGroupsExpanded((cur) => ({ ...cur, [s.key]: !cur[s.key] }))}
                                                >
                                                    <span>{s.label}</span>
                                                    {feedbackGroupsExpanded[s.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </button>
                                                {feedbackGroupsExpanded[s.key] && (
                                                    <div role="list" className="space-y-3">
                                                        {g[s.key].map((n) => (
                                                            <div
                                                                key={n.id}
                                                                role="listitem"
                                                                className="flex items-start justify-between rounded-lg border p-3 transition-smooth bg-card"
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="text-sm font-medium">{n.name} • {n.status}</div>
                                                                    <div className="text-xs text-muted-foreground break-words">{n.description}</div>
                                                                    {n.contact_email && isValidEmail(n.contact_email) ? (
                                                                        <div className="text-xs mt-1"><a className="text-primary underline" href={`mailto:${n.contact_email}`}>{n.contact_email}</a></div>
                                                                    ) : null}
                                                                    {n.attachment_path ? (
                                                                        (() => {
                                                                            const name = fileNameFromPath(n.attachment_path || "")
                                                                            const isImg = isImagePath(name)
                                                                            return (
                                                                                <div className="text-xs mt-1">
                                                                                    <button className="text-primary underline" onClick={() => (isImg ? openImage(n.attachment_path!) : openDocument(n.attachment_path!))} aria-label="Open attachment">
                                                                                        {name}
                                                                                    </button>
                                                                                </div>
                                                                            )
                                                                        })()
                                                                    ) : null}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-xs text-muted-foreground">{fmt(n.ts)}</div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        aria-label={`Delete feedback by ${n.name}`}
                                                                        title="Delete feedback"
                                                                        onClick={() => setConfirmDeleteId(String(n.id))}
                                                                        disabled={isDeletingOne && String(confirmDeleteId) === String(n.id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    })()
                                )}
                            </div>
                            <Dialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete this feedback?</DialogTitle>
                                        <DialogDescription>Only the selected item will be removed.</DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setConfirmDeleteId(null)} aria-label="Cancel delete">Cancel</Button>
                                        <Button variant="destructive" onClick={confirmDeleteFeedback} disabled={isDeletingOne} aria-label="Confirm delete">{isDeletingOne ? "Deleting..." : "Delete"}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={bulkConfirmOpenFeedback} onOpenChange={setBulkConfirmOpenFeedback}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Clear all resolved feedback?</DialogTitle>
                                        <DialogDescription>Items marked as resolved or reviewed will be deleted.</DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[40vh] overflow-auto text-sm">
                                        {feedbacks.filter((f) => f.status === "resolved" || f.status === "reviewed").length === 0 ? (
                                            <div className="text-muted-foreground">No resolved feedback to delete</div>
                                        ) : (
                                            <ul className="space-y-2">
                                                {feedbacks.filter((f) => f.status === "resolved" || f.status === "reviewed").map((f) => (
                                                    <li key={`del-${f.id}`}>{f.name} • {f.description.slice(0, 80)}{f.description.length > 80 ? "…" : ""}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setBulkConfirmOpenFeedback(false)} aria-label="Cancel clear">Cancel</Button>
                                        <Button variant="destructive" onClick={handleBulkDeleteFeedback} disabled={bulkDeletingFeedback} aria-label="Confirm clear">{bulkDeletingFeedback ? "Clearing..." : "Proceed"}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </SheetContent>
                    </Sheet>
                    <Dialog open={imageOpen} onOpenChange={(o) => { setImageOpen(o); if (!o) { setImageSrc(null); setImageScale(1) } }}>
                        <DialogContent className="w-screen h-screen max-w-none p-4">
                            <DialogHeader>
                                <DialogTitle>Image Preview</DialogTitle>
                                <DialogDescription>{imageName || ""}</DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm truncate max-w-[50%]">{imageName || ""}</div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setImageScale((s) => Math.min(s + 0.25, 5))} aria-label="Zoom in">+</Button>
                                    <Button variant="outline" size="sm" onClick={() => setImageScale((s) => Math.max(s - 0.25, 0.25))} aria-label="Zoom out">-</Button>
                                    <Button variant="destructive" size="sm" onClick={() => setImageOpen(false)} aria-label="Close">Close</Button>
                                </div>
                            </div>
                            <div className="w-full h-full flex items-center justify-center overflow-auto">
                                {imageSrc ? (
                                    <img src={imageSrc} alt={imageName || "attachment"} style={{ transform: `scale(${imageScale})` }} className="max-w-full max-h-[80vh] object-contain" />
                                ) : (
                                    <div className="text-sm text-muted-foreground">Attachment unavailable</div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full group" aria-label="Notifications">
                                <div className="relative">
                                    <Bell className="h-5 w-5" />
                                    {unread > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />}
                                </div>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" aria-label="Notification panel">
                            <SheetHeader>
                                <SheetTitle>Notifications</SheetTitle>
                                <SheetDescription>Newest first</SheetDescription>
                            </SheetHeader>
                            <div className="px-4 pb-4 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">Unread: {unread}</div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={markAllRead} aria-label="Mark all as read">Mark all as read</Button>
                                    <Button variant="destructive" size="sm" onClick={() => setConfirmClearOpen(true)} aria-label="Clear all">{deletingAll ? "Clearing..." : "Clear All"}</Button>
                                </div>
                            </div>
                            <div className="p-4 space-y-4 overflow-y-auto h-full" aria-label="Notifications">
                                {notifLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading...</div>
                                ) : notifs.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No notifications</div>
                                ) : (
                                    (() => {
                                        const g = groupByDate(notifs)
                                        const sections: Array<{ key: keyof typeof g; label: string }> = [
                                            { key: "today", label: "Today" },
                                            { key: "yesterday", label: "Yesterday" },
                                            { key: "week", label: "This Week" },
                                            { key: "older", label: "Older" },
                                        ]
                                        return sections.map((s) => (
                                            <div key={s.key} aria-label={s.label} className="space-y-2">
                                                <button
                                                    className="flex w-full items-center justify-between text-sm font-semibold"
                                                    aria-expanded={groupsExpanded[s.key]}
                                                    onClick={() => setGroupsExpanded((cur) => ({ ...cur, [s.key]: !cur[s.key] }))}
                                                >
                                                    <span>{s.label}</span>
                                                    {groupsExpanded[s.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </button>
                                                {groupsExpanded[s.key] && (
                                                    <div role="list" className="space-y-3">
                                                        {g[s.key].map((n) => (
                                                            <div
                                                                key={n.id}
                                                                role="listitem"
                                                                className={`flex items-start justify-between rounded-lg border p-3 transition-smooth ${n.read ? "bg-card" : "bg-accent/10"} ${removingId === n.id ? "opacity-0 translate-y-2" : "opacity-100"}`}
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="text-sm font-medium">{n.type === "login" ? `${n.name} logged in` : `${n.name} requested ${n.meta.split(" • ")[0]}`}</div>
                                                                    <div className="text-xs text-muted-foreground">{n.type === "login" ? n.meta : n.meta}</div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-xs text-muted-foreground">{fmt(n.ts)}</div>
                                                                    <Button variant="ghost" size="icon" aria-label="Delete notification" onClick={() => handleDeleteOne(n.id)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    })()
                                )}
                            </div>
                            <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Clear all notifications?</DialogTitle>
                                    </DialogHeader>
                                    <div className="text-sm text-muted-foreground">This action cannot be undone. Only new notifications will appear.</div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
                                        <Button variant="destructive" onClick={handleClearAllConfirmed} aria-label="Confirm clear all">Confirm</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </SheetContent>
                    </Sheet>
                    <AnimatedThemeToggler className="p-1  rounded-full hover:bg-accent transition-colors" />
                </div>

            </div>
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Label htmlFor="range" className="text-sm text-muted-foreground">Range:</Label>
                    <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "weekly" | "monthly")}>
                        <SelectTrigger id="range" className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">Auto-refresh:</Label>
                    <Switch id="auto-refresh" checked={refreshInterval > 0} onCheckedChange={(checked) => setRefreshInterval(checked ? 30 : 0)} />
                </div>

                <Button className="ml-auto" onClick={() => {
                    setLoading(true)
                    fetch(`/api/admin/dashboard?range=${timeRange}`)
                        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`API error: ${res.status}`))))
                        .then((data: AdminDashboardResponse) => {
                            setStats(data.stats)
                            setAttendanceTrends(data.attendanceTrends)
                            setLatePatterns(data.latePatterns)
                            setLeaveBreakdown(data.leaveBreakdown)
                            setTypeDistribution(data.typeDistribution)
                            setLastUpdated(new Date())
                            setError(null)
                        })
                        .catch((err: Error) => setError(err?.message || "Refresh failed"))
                        .finally(() => setLoading(false))
                }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh now
                </Button>

                {error && ( // Use the error prop here
                    <Alert variant="destructive" className="w-full mt-4">
                        <AlertTitle>Failed to load data</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </>
    );
}
