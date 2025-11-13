'use client'
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Search, HelpCircle, Bell, RefreshCw } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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

    return (
        <>
            <div className="flex items-center justify-between mb-6">
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
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Search className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <HelpCircle className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Bell className="h-5 w-5" />
                    </Button>
                    <AnimatedThemeToggler className="p-2 rounded-full hover:bg-accent transition-colors" />
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