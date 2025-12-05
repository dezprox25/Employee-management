"use client"

import { RefreshCw, Menu, Search, HelpCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"
import { useId } from "react";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [name, setName] = useState<string | null>(null)
  const tooltipId = useId()
  const { toast } = useToast()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [description, setDescription] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contactEmail, setContactEmail] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    // fetch user name for employee header
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).single()
        if (profile && profile.name) setName(profile.name)
      } catch (err) {
        // ignore - header should still render
      }
    })()

    return () => clearInterval(timer)
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="border-b border-white/50 sticky top-0 z-10 dark:border-white/20 bg-white/70 dark:bg-white/15 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="px-6 py-4">
        {/* Top row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl">Hello, {name ?? "Employee"}</h1>
              <p className="text-sm text-muted-foreground mt-1">Here's your dashboard today.</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Live updates</span>
                <span className="text-xs text-muted-foreground">
                  Last updated: {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
              <DialogTrigger asChild>
                <div className="relative right-4 inline-block group overflow-visible">
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open feedback form">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                  <div
                    id={tooltipId}
                    role="tooltip"
                    className="absolute pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 px-2 py-1 text-[10px] font-medium text-white bg-[#1A1F2C] backdrop-blur-sm rounded-lg shadow-lg border border-neutral-800/10 transition-all duration-200 ease-in-out whitespace-nowrap z-50 bottom-full left-1/2 -translate-x-1/2 -translate-y-2 mb-1"
                  >
                    Need any help? Contact the Dezprox Team
                    <span className="absolute w-2 h-2 bg-[#1A1F2C] transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Feedback</DialogTitle>
                  <DialogDescription>Describe your issue, and optionally add contact email and an image.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-description">Description</Label>
                    <Textarea
                      id="feedback-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue in detail"
                      className="min-h-24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feedback-email">Contact email (optional)</Label>
                    <Input
                      id="feedback-email"
                      type="email"
                      placeholder="you@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feedback-file">Attach image (optional)</Label>
                    <Input
                      id="feedback-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0] || null
                        setFile(f)
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={async () => {
                      if (!description.trim()) {
                        toast({ variant: "destructive", title: "Missing fields", description: "Enter description" })
                        return
                      }
                      setIsSubmitting(true)
                      try {
                        const supabase = createClient()
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user?.id) throw new Error("Not authenticated")
                        const fd = new FormData()
                        fd.append("feedback_text", description.trim())
                        if (contactEmail.trim()) fd.append("contact_email", contactEmail.trim())
                        if (file) fd.append("file", file)
                        const res = await fetch("/api/employee/submit-feedback", { method: "POST", body: fd })
                        if (!res.ok) {
                          const j = await res.json().catch(() => ({}))
                          throw new Error(j?.error || `Server error ${res.status}`)
                        }
                        toast({ title: "Feedback submitted", description: "Thanks for your input" })
                        setDescription("")
                        setContactEmail("")
                        setFile(null)
                        setFeedbackOpen(false)
                      } catch (e: any) {
                        toast({ variant: "destructive", title: "Failed to submit", description: e?.message || "Try again later" })
                      } finally {
                        setIsSubmitting(false)
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          
            <AnimatedThemeToggler className="p-2 rounded-full hover:bg-accent transition-colors" />
          </div>
        </div>

      </div>
    </div>
  );
}
