"use client"
import { cn } from "@/lib/utils"
import Image from "next/image"
import type React from "react"
import { useMemo } from "react"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
// import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

interface Links {
  label: string
  href: string
  icon: React.JSX.Element | React.ReactNode
}

// Sidebar is now a simple wrapper; all toggle/animation logic removed.
export const Sidebar = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

// SidebarBody renders a permanent, fixed-width sidebar across breakpoints.
export const SidebarBody = (props: React.ComponentProps<"div">) => {
  return <DesktopSidebar {...props} />
}

type DivChildrenSafeProps = Omit<React.ComponentProps<"div">, "children"> & {
  children?: React.ReactNode
}

export const DesktopSidebar = ({ className, children, ...props }: DivChildrenSafeProps) => {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleLogout: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    e.preventDefault()
    try {
      await supabase.auth.signOut()
    } catch {}
    if (typeof document !== "undefined") {
      document.cookie = "admin_code_login=; Max-Age=0; path=/"
    }
    router.replace("/")
  }

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-neutral-100 border-r-[0.1px] border-white/20  dark:bg-neutral-800 w-[260px] shrink-0",
        className,
      )}
      {...props}
    >
      
      <div className={cn("flex items-center justify-between border-b border-white/20 p-5")}>
        <a href="/" aria-label="Home" className="flex items-center gap-2">
          <Image
            src="/dezprox horizontal black logo.png"
            alt="Dezprox"
            width={160}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </a>
      </div>
      {children}
      {/* Bottom actions: Theme toggle and Logout */}
      <div className="mt-auto items-center gap-2 px-1 pt-4 border-t border-neutral-200/60 dark:border-neutral-800 p-5 ">
        {/* <AnimatedThemeToggler /> */}
        <SidebarLink
          link={{
            label: "Logout",
            href: "#",
            icon: <LogOut className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
          }}
          onClick={handleLogout}
        />
      </div>
    </div>
  )
}

// Mobile-specific overlay and toggles removed; the sidebar remains a static column.

export const SidebarLink = ({
  link,
  className,
  onClick,
  ...props
}: {
  link: Links
  className?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) => {
  return (
    <a
      href={link.href}
      className={cn("flex items-center justify-start gap-2 group/sidebar px-5", className)}
      onClick={onClick}
      {...props}
    >
      {link.icon}

      <span className="text-neutral-700 dark:text-neutral-200 text-sm transition duration-150 whitespace-pre inline-block !p-0 !m-0">
        {link.label}
      </span>
    </a>
  )
}

