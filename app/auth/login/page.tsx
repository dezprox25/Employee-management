"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff } from "lucide-react"
import Hyperspeed from '@/components/Hyperspeed';

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    try {
      // Basic client-side rate limiting
      const key = `loginAttempts:${email}:employee`
      const lockKey = `lockUntil:${email}:employee`
      const lockUntil = Number(localStorage.getItem(lockKey) || 0)
      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 60000)
        throw new Error(`Too many attempts. Try again in ${remaining} min`)
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Get user role to redirect appropriately
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

        if (userData?.role === "admin") {
          router.push("/admin/dashboard")
        } else {
          router.push("/employee/dashboard")
        }
      }
    } catch (error: unknown) {
      // Track failed attempts and lock after 5 failures for 5 minutes
      const key = `loginAttempts:${email}:employee`
      const lockKey = `lockUntil:${email}:employee`
      const attempts = Number(localStorage.getItem(key) || 0) + 1
      localStorage.setItem(key, String(attempts))
      if (attempts >= 5) {
        localStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000))
        localStorage.removeItem(key)
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className=" bg-black">
      <div className="w-full h-screen  flex justify-around">
        <div className="w-1/2 relative overflow-hidden flex items-center">
          {/* <video
            className="absolute inset-0 w-full h-full object-cover"
            src="https://res.cloudinary.com/dn60aovto/video/upload/v1762619868/dezprox-instro_hxdqis.mp4"
            autoPlay
            muted
            loop
            playsInline
          /> */}
          <div className="absolute w-96 h-96 space-y-4  mx-auto left-0 right-0 place-content-center text-center" >
            <h1 className="text-7xl font-bold text-green-500">Dezprox</h1>
            <h1 className="text-xl font-semibold text-green-600">Dream | Design | Deploy</h1>
          </div>

          <Hyperspeed
            effectOptions={{
              onSpeedUp: () => { },
              onSlowDown: () => { },
              distortion: 'turbulentDistortion',
              length: 400,
              roadWidth: 10,
              islandWidth: 2,
              lanesPerRoad: 4,
              fov: 90,
              fovSpeedUp: 150,
              speedUp: 2,
              carLightsFade: 0.4,
              totalSideLightSticks: 20,
              lightPairsPerRoadWay: 40,
              shoulderLinesWidthPercentage: 0.05,
              brokenLinesWidthPercentage: 0.1,
              brokenLinesLengthPercentage: 0.5,
              lightStickWidth: [0.12, 0.5],
              lightStickHeight: [1.3, 1.7],
              movingAwaySpeed: [60, 80],
              movingCloserSpeed: [-120, -160],
              carLightsLength: [400 * 0.03, 400 * 0.2],
              carLightsRadius: [0.05, 0.14],
              carWidthPercentage: [0.3, 0.5],
              carShiftX: [-0.8, 0.8],
              carFloorSeparation: [0, 5],
              colors: {
                roadColor: 0x080808,
                islandColor: 0x0a0a0a,
                background: 0x000000,
                shoulderLines: 0xFFFFFF,
                brokenLines: 0xFFFFFF,
                leftCars: [0xD856BF, 0x6750A2, 0xC247AC],
                rightCars: [0x03B3C3, 0x0E5EA5, 0x324555],
                sticks: 0x03B3C3,
              }
            }}
          />
        </div>

        <div className="w-1/2 h-screen p-10 place-content-center">
          <h1 className="text-9xl font-bold absolute top-0 tracking-[30px] mx-auto right-0 text-transparent bg-clip-text bg-gradient-to-r from-white/10 to-white/5 uppercase ">Employee</h1>
          <h1 className="text-9xl font-bold absolute bottom-10 tracking-[80px] mx-auto right-0 text-transparent bg-clip-text bg-gradient-to-r from-white/20 to-white/5 uppercase ">Login</h1>
          <Card className="border-2  border-none w-[500px] mx-auto rounded-none shadow-none bg-transparent">

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-14">
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    className="border-0 border-b border-white text-white text-center font-semibold tracking-widest py-1 transition-colors focus:outline-none focus:ring-0 focus:border-b focus:border-white peer bg-inherit rounded-none shadow-none"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <label
                    htmlFor="email"
                    className={`absolute left-0 text-white tracking-widest cursor-text transition-all  ${email ? 'text-xs -top-8 text-blue-700' : 'top-1'} peer-focus:text-xs peer-focus:-top-8 peer-focus:text-blue-700`}
                  >Email</label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="border-0 border-b border-white text-white text-center font-semibold tracking-widest py-1 transition-colors focus:outline-none focus:ring-0 focus:border-b focus:border-white peer bg-inherit rounded-none shadow-none pr-10"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <label
                    htmlFor="password"
                    className={`absolute left-0 text-white tracking-widest cursor-text transition-all ${password ? 'text-xs -top-8 text-blue-700' : 'top-1'} peer-focus:text-xs peer-focus:-top-8 peer-focus:text-blue-700`}
                  >Password</label>
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="relative group">
                  <div className="relative w-full h-14 opacity-90 overflow-hidden rounded-xl bg-black z-10">
                    <div className="absolute z-10 -translate-x-44 group-hover:translate-x-[30rem] ease-in transition-all duration-700 h-full w-44 bg-gradient-to-r from-gray-500 to-white/10 opacity-30 -skew-x-12"></div>

                    <div className="absolute flex items-center justify-center text-white z-[1] opacity-90 rounded-2xl inset-0.5 bg-black">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="font-semibold text-lg h-full opacity-90 w-full px-16 py-3 rounded-xl bg-black"
                      >
                        {isLoading ? "Logging in..." : "Employee Login"}
                      </button>
                    </div>
                    <div className="absolute duration-1000 group-hover:animate-spin w-full h-[100px] bg-gradient-to-r from-green-500 to-yellow-500 blur-[30px]"></div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
