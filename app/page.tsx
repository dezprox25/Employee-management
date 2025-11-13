"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { CardEntrance } from "@/components/animations/card-entrance"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"


export default function Home() {
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

        if (userData?.role === "admin") {
          redirect("/admin/dashboard")
        } else {
          redirect("/employee/dashboard")
        }
      }
    }

    checkAuth()
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-card overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      <CardEntrance delay={0}>
        <div className="text-center space-y-8 relative z-10">
          <AnimatedThemeToggler className="" />
          <div className="w-40 h-40 rounded-full shadow-[0_3px_15px_rgba(0,0,0,0.2)] mx-auto place-content-center overflow-hidden  ">
            <img src="/dezproxlogo.png" alt="dezprox-logo" className="w-32 h-32 mx-auto rounded-full object-cover" />
          </div>
          <div>
            <h1 className="text-5xl font-bold text-foreground mb-4"><a className="text-green-700" target="_blank" href="https://www.dezprox.com/">Dezprox</a> Team Management System</h1>
            <p className="text-xl text-muted-foreground">
              Streamline attendance, leave management, and team coordination
            </p>
          </div>
          <div className="flex items-center justify-center gap-10">
            <div className="flex gap-4 justify-center">
              <Link href="/auth/login">
                <Button size="lg" className="gap-2 bg-green-600 text-white hover:bg-white hover:text-green-600">
                  Employee Login
                </Button>
              </Link>
            </div>
            <div className="text-center">
              <Link href="/admin/login">
                <Button variant="ghost" size="lg" className="text-green-600 hover:text-white hover:bg-green-600">
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardEntrance>



    </div>
  )
}
