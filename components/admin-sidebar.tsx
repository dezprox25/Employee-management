"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Users, CalendarDays, BarChart3, LayoutDashboard, FileText } from "lucide-react"
import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active: boolean }) {
  return (
    <Link href={href} aria-label={label} className="block">
      <Button
        variant={active ? "secondary" : "ghost"}
        className="w-full justify-start gap-2"
        aria-current={active ? "page" : undefined}
      >
        <Icon className="w-4 h-4" />
        {label}
      </Button>
    </Link>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  // Hide sidebar on admin login route to keep login standalone
  if (pathname?.startsWith("/admin/login")) return null

  const searchParams = useSearchParams()
  const pane = searchParams.get("pane") || null

  const items = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, paneKey: null as null | string },
    { href: "/admin/dashboard?pane=employees", label: "Employees", icon: Users, paneKey: "employees" },
    { href: "/admin/dashboard?pane=leaves", label: "Leaves", icon: CalendarDays, paneKey: "leaves" },
    { href: "/admin/dashboard?pane=attendance", label: "Attendance", icon: BarChart3, paneKey: "attendance" },
    { href: "/admin/dashboard?pane=reports", label: "Reports", icon: FileText, paneKey: "reports" },
  ]

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    if (typeof document !== "undefined") {
      document.cookie = "admin_code_login=; Max-Age=0; path=/"
    }
    window.location.href = "/auth/login"
  }

  return (
    <aside className="w-64 border-r bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <Link href="/admin/dashboard" className="font-bold text-lg">
          Dezprox Admin
        </Link>
      </div>
      <nav className="p-2 space-y-1 flex-1">
        {items.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={
              pathname === "/admin/dashboard" && ((item.paneKey === null && pane === null) || item.paneKey === pane)
            }
          />
        ))}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full gap-2" onClick={handleLogout} aria-label="Logout">
          <LogOut className="w-4 h-4" /> Logout
        </Button>
      </div>
    </aside>
  )
}