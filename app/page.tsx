"use client"

import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"
import Link from "next/link"
// import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { CardEntrance } from "@/components/animations/card-entrance"
// import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import Image from "next/image"
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button"

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
    <>
      <div className="min-h-screen lg:flex hidden flex-col   items-center justify-center  text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        </div>

        <CardEntrance delay={0} >
          <div className="text-center space-y-8 relative z-20">
            {/* <AnimatedThemeToggler className="" /> */}
            <div className="w-40 h-40 rounded-full shadow-[0_3px_15px_rgba(0,0,0,0.2)] mx-auto place-content-center overflow-hidden  ">
              <img src="/dezproxlogo.png" alt="dezprox-logo" className="w-32 h-32 mx-auto rounded-full object-cover" />
            </div>
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-4 text-white "><a className="text-green-400" target="_blank" href="https://www.dezprox.com/">Dezprox</a> Team Management System</h1>
              <p className="text-xl text-muted-foreground">
                Streamline attendance, leave management, and team coordination
              </p>
            </div>
            <div className="flex items-center justify-center gap-10">
              <div className="flex items-center gap-4 justify-center">
                {/* <h1 className="text-3xl uppercase tracking-wide font-bold text-black">Avengers</h1> */}
                <Link href="/auth/login">
                  {/* <img src="/captain-american-shield.png" alt="captain-american-shield" className="absolute right-10 w-96 h-[4  00px] focus:scale-110 transition-transform duration-300" /> */}


                  <InteractiveHoverButton className="text-red-400 font-bold">Avengers</InteractiveHoverButton>


                  {/* <Button size="lg" className="gap-2 dark:bg-white dark:text-green-500  bg-green-600 uppercase text-white hover:bg-white hover:text-green-600">
                    Assemble !
                  </Button> */}
                </Link>
                {/* <Link href="/docs" className="ml-4">
                  <Button
                    size="lg"
                    className="gap-2 bg-green-600 text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3FA740] rounded-xl"
                  >
                    Project Documentation
                  </Button>
                </Link> */}
              </div>
            </div>
          </div>
        </CardEntrance>
      </div>
      <Image width={100} height={100} src="/avengers-assemble-wallpapers.jpg" alt="hero" className="w-full h-full top-0 object-cover absolute brightness-80 -z-10 " />
    </>
  )
}
