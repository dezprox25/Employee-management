"use client"
import { ReactNode, useMemo, Suspense } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LayoutDashboard, Users, CalendarDays, BarChart3, LogOut } from "lucide-react"
import Image from "next/image"

import { createClient } from "@/lib/supabase/client"
// import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
// import { cn } from "@/lib/utils"

interface AdminSidebarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  handleLogout: () => void;
}


function AdminSidebar({ onNavigate, currentPage, handleLogout }: AdminSidebarProps) {
  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
    { icon: Users, label: "Employees", page: "employees" },
    { icon: CalendarDays, label: "Leaves", page: "leaves" },
    { icon: BarChart3, label: "Attendance", page: "attendance" },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white/70 dark:bg-white/15 backdrop-blur-2xl border-r border-white/60 dark:border-white/20 z-50 w-64 flex flex-col shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}
    >
      <div className="flex items-center justify-between p-6 border-b border-white/50 dark:border-white/20">
        <div className="flex items-center relative">
          <Image src="/dezprox horizontal black logo.png" alt="Deeprox Logo" width={160} height={32} className="h-8 w-auto dark:hidden" />
          <Image src="/dezprox horizontal white logo.png" alt="Deeprox Logo" width={160} height={32} className="h-8 w-auto hidden dark:block" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[20px] transition-all group ${
                  currentPage === item.page
                    ? "bg-white/70 dark:bg-white/15 text-green-600 dark:text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/60 dark:border-white/20"
                    : "text-foreground hover:bg-white/40 dark:hover:bg-white/10 border border-transparent"
                }`}
                onClick={() => onNavigate(item.page)}
              >
                <Icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                  currentPage === item.page ? "" : "group-hover:rotate-12"
                }`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/30 dark:border-white/10">
        <div className="p-4">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-white/30 dark:hover:bg-red-950/30 backdrop-blur-sm transition-all group"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1 group-hover:scale-110" />
            <span className="transition-transform group-hover:translate-x-1">Logout</span>
          </button>
        </div>
        {/* <div className="p-4">
          <AnimatedThemeToggler />
        </div> */}
      </div>
    </aside>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleNavigate = (page: string) => {
    if (page === "dashboard") {
      router.push("/admin/dashboard");
    } else {
      router.push(`/admin/dashboard?pane=${page}`);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    if (typeof document !== "undefined") {
      document.cookie = "admin_code_login=; Max-Age=0; path=/";
    }
    router.replace("/");
  };

  const showSidebar = !(pathname?.startsWith("/admin/login"))

  function SidebarWithState() {
    const searchParams = useSearchParams()
    const currentPage = useMemo(() => {
      const pane = searchParams?.get("pane")
      if (pane) return pane
      const segments = pathname?.split("/").filter(Boolean)
      if (segments && segments.length >= 2 && segments[0] === "admin") {
        return segments[1] === "dashboard" ? "dashboard" : segments[1]
      }
      return "dashboard"
    }, [pathname, searchParams])

    return (
      <AdminSidebar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        handleLogout={handleLogout}
      />
    )
  }

  return (
    <div className="h-screen flex">
      {showSidebar && (
        <Suspense fallback={<div className="w-64" />}> 
          <SidebarWithState />
        </Suspense>
      )}
      <main className="flex-1 overflow-auto ml-64">{children}</main>
    </div>
  )
}