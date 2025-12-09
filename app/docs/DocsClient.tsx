"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"

type DocItem = { id: string; title: string; body: string; bullets?: string[] }
type DocGroup = { group: string; items: DocItem[] }

export default function DocsClient() {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string>("intro")
  const containerRef = useRef<HTMLDivElement | null>(null)

  const docs: DocGroup[] = useMemo(
    () => [
      {
        group: "Get Started",
        items: [
          {
            id: "intro",
            title: "Introduction",
            body:
              "EMS is a frontend-focused experience for employees and admins. This guide explains how to use the panels, without backend/API or installation details.",
            bullets: [
              "Employees: Punch in/out, review attendance, apply for leave",
              "Admins: Monitor dashboard, manage employees, reconcile attendance, review leaves and feedback",
              "Realtime updates ensure information stays current",
            ],
          },
        ],
      },
      {
        group: "Employee",
        items: [
          {
            id: "emp-dashboard",
            title: "Dashboard",
            body:
              "Overview of your workday with current time, session status, and quick actions.",
            bullets: [
              "Clock card shows current local time and date",
              "Active session indicator appears when punched in",
              "Work duration timer updates every second",
              "Quick link to Leave and Attendance panels",
            ],
          },
          {
            id: "emp-punch",
            title: "Punch In/Out",
            body:
              "Start and end sessions from the dashboard using the slide controls.",
            bullets: [
              "Slide to Check In creates a new session",
              "Slide to Check Out closes only the active session",
              "Future-dated times and out-before-in are blocked",
              "Auto punch-out occurs on tab close/inactivity when needed",
            ],
          },
          {
            id: "emp-attendance",
            title: "Attendance",
            body:
              "View your recent attendance logs and totals.",
            bullets: [
              "Login and logout times shown in 12h format",
              "Duration computed as H:MM:SS",
              "Totals and averages displayed at the top",
              "Realtime updates reflect new punches and corrections",
            ],
          },
          {
            id: "emp-leaves",
            title: "Leaves",
            body:
              "Apply for leave and track usage against your balance.",
            bullets: [
              "Choose category and duration (full/half-day)",
              "View leave balance and usage history",
              "Approved leaves automatically contribute to used totals",
              "Status indicators (approved, pending, rejected)",
            ],
          },
        ],
      },
      {
        group: "Admin",
        items: [
          {
            id: "admin-dashboard",
            title: "Admin Dashboard",
            body:
              "Monitor attendance and leaves with live notifications and quick insights.",
            bullets: [
              "Live updates: recent logins and leave submissions",
              "Feedback panel with attachments and contact details",
              "Summary cards for totals and trends",
              "Actions for refreshing and navigation",
            ],
          },
          {
            id: "admin-employees",
            title: "Manage Employees",
            body:
              "Create and manage employee accounts from the UI.",
            bullets: [
              "Add new employees and set roles",
              "Welcome email sent automatically (mobile‑friendly)",
              "View and update employee details",
              "Search and filter employees",
            ],
          },
          {
            id: "admin-attendance",
            title: "Attendance Management",
            body:
              "Review daily attendance and reconcile sessions when required.",
            bullets: [
              "Inspect sessions per employee",
              "Auto corrections reflected via real-time updates",
              "Non-overwriting punch-out maintains history",
              "Export summaries from the dashboard (if enabled)",
            ],
          },
          {
            id: "admin-leaves",
            title: "Leave Management",
            body:
              "Approve or reject leave requests and monitor balances.",
            bullets: [
              "Pending approvals list",
              "Reason and dates visible per request",
              "Balance updates tracked automatically",
              "Search and filter by employee/date",
            ],
          },
        ],
      },
      {
        group: "Help",
        items: [
          {
            id: "faq",
            title: "FAQ & Troubleshooting",
            body:
              "Common usage questions and quick fixes.",
            bullets: [
              "Cannot punch out: ensure a session is active",
              "Logout mismatched: auto punch-out will reconcile",
              "Email missing: check spam or contact support",
              "Slow UI: close heavy tabs; the dashboard is lightweight",
            ],
          },
          {
            id: "changelog",
            title: "Changelog",
            body:
              "Recent user-facing improvements.",
            bullets: [
              "Punch-out fix for preserving history",
              "Responsive welcome email",
              "Docs page with search and sidebar",
              "Realtime notifications in admin dashboard",
            ],
          },
        ],
      },
    ],
    [],
  )

  const flat = useMemo(() => docs.flatMap((g) => g.items), [docs])

  useEffect(() => {
    const headings = flat.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[]
    if (!headings.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top))
        const first = visible[0]
        if (first?.target?.id) setActiveId(first.target.id)
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.5, 1] },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [flat])

  const normalized = query.trim().toLowerCase()
  const searchResults = normalized
    ? flat.filter((i) =>
        i.title.toLowerCase().includes(normalized) ||
        i.body.toLowerCase().includes(normalized) ||
        (i.bullets || []).some((b) => b.toLowerCase().includes(normalized)),
      )
    : []

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={containerRef} className="min-h-screen w-full bg-[#E8E8ED] dark:bg-[#1C1C1E] scroll-smooth">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">EMS Documentation</h1>
            <p className="text-muted-foreground">User and Admin guide (frontend usage)</p>
          </div>
          <div className="relative w-64">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs"
              className="w-full h-11 px-4 rounded-xl border border-ash-200 dark:border-dark-700 bg-white dark:bg-black text-ash-900 dark:text-white outline-none focus:ring-2 focus:ring-[#3FA740]/50"
              aria-label="Search documentation"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          <aside className="md:sticky md:top-6 h-max md:max-h-[calc(100vh-120px)] overflow-auto rounded-2xl p-4 bg-white/80 dark:bg-black/40 border border-ash-200 dark:border-dark-700">
            {docs.map((group) => (
              <div key={group.group} className="mb-6">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{group.group}</div>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => scrollTo(item.id)}
                        className={`w-full text-left px-2 py-1 rounded-lg transition-colors ${
                          activeId === item.id ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "hover:bg-ash-100/60 dark:hover:bg-white/10"
                        }`}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          <main className="space-y-8">
            {normalized ? (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-3">Search Results</h2>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matches found.</p>
                ) : (
                  <ul className="space-y-4">
                    {searchResults.map((i) => (
                      <li key={`sr-${i.id}`} className="group">
                        <button
                          onClick={() => scrollTo(i.id)}
                          className="text-left w-full"
                        >
                          <div className="font-medium group-hover:text-green-600">{i.title}</div>
                          <div className="text-sm text-muted-foreground">{i.body}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}

            {docs.map((group) => (
              <section key={`sec-${group.group}`} className="space-y-6">
                {group.items.map((item) => (
                  <Card key={item.id} id={item.id} className="p-6">
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold">{item.title}</h2>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                      {item.bullets && item.bullets.length > 0 && (
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          {item.bullets.map((b) => (
                            <li key={`${item.id}-${b}`}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                ))}
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  )
}
