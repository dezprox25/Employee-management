"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, X } from "lucide-react"
import { useState, useMemo } from "react"
import Link from "next/link"

interface NavigationHeaderProps {
  title: string
  isAdmin?: boolean
  /**
   * Controls visibility of the Logout button in the header.
   * Defaults to true to preserve existing behavior.
   */
  showLogout?: boolean
}

export function NavigationHeader({ title, isAdmin = false, showLogout = true }: NavigationHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Clear temporary admin code-login cookie
    if (typeof document !== "undefined") {
      document.cookie = "admin_code_login=; Max-Age=0; path=/";
    }
    router.push("/auth/login")
  }

  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        <div className="hidden md:flex items-center gap-4">
          {isAdmin && (
            <>
              <Link href="/admin/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link href="/admin/dashboard?pane=employees">
                <Button variant="ghost">Employees</Button>
              </Link>
              <Link href="/admin/dashboard?pane=leaves">
                <Button variant="ghost">Leaves</Button>
              </Link>
              <Link href="/admin/dashboard?pane=attendance">
                <Button variant="ghost">Attendance</Button>
              </Link>
              <Link href="/admin/dashboard?pane=reports">
                <Button variant="ghost">Reports</Button>
              </Link>
            </>
          )}
       
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-foreground">
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t bg-card/50 p-4 space-y-2">
          {isAdmin && (
            <>
              <Link href="/admin/dashboard">
                <Button variant="ghost" className="w-full">
                  Dashboard
                </Button>
              </Link>
              <Link href="/admin/dashboard?pane=employees">
                <Button variant="ghost" className="w-full">
                  Employees
                </Button>
              </Link>
              <Link href="/admin/dashboard?pane=leaves">
                <Button variant="ghost" className="w-full">
                  Leaves
                </Button>
              </Link>
              <Link href="/admin/dashboard?pane=attendance">
                <Button variant="ghost" className="w-full">
                  Attendance
                </Button>
              </Link>
              <Link href="/admin/dashboard?pane=reports">
                <Button variant="ghost" className="w-full">
                  Reports
                </Button>
              </Link>
            </>
          )}
          {showLogout && (
            <Button variant="ghost" className="w-full gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          )}
        </div>
      )}
    </header>
  )
}
