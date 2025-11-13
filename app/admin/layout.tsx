"use client"
import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import { LayoutDashboard, Users, CalendarDays, BarChart3 } from "lucide-react"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Hide sidebar on admin login route to keep login standalone
  const showSidebar = !(pathname?.startsWith("/admin/login"))

  const adminLinks = [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Employees",
      href: "/admin/dashboard?pane=employees",
      icon: <Users className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Leaves",
      href: "/admin/dashboard?pane=leaves",
      icon: <CalendarDays className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Attendance",
      href: "/admin/dashboard?pane=attendance",
      icon: <BarChart3 className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    // {
    //   label: "Reports",
    //   href: "/admin/dashboard?pane=reports",
    //   icon: <FileText className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
    // },
  ]

  return (
    <div className="h-screen flex">
      {showSidebar && (
        <Sidebar>
          <SidebarBody className="gap-5">
            <div className="overflow-x-hidden flex h-full flex-col">
              {/* Navigation links */}
              <div className="flex flex-col gap-5">
                {adminLinks.map((link, idx) => (
                  <SidebarLink key={idx} link={{ label: link.label, href: link.href, icon: link.icon }} />
                ))}
              </div>
            </div>
          </SidebarBody>
        </Sidebar>
      )}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}