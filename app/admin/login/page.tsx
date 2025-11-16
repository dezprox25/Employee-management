// "use client"

// import type React from "react"

// // Admin login uses Supabase auth and role-based redirect
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { useRouter } from "next/navigation"
// import { useState } from "react"
// import { useToast } from "@/hooks/use-toast"
// import { isValidAdminCredentials } from "@/lib/admin/credentials"
// import { createClient } from "@/lib/supabase/client"
// import { Eye, EyeOff } from "lucide-react"

// export default function AdminLoginPage() {
//   const [email, setEmail] = useState("admin@gmail.com")
//   const [password, setPassword] = useState("admin123")
//   const [showPassword, setShowPassword] = useState(false)
//   const [isLoading, setIsLoading] = useState(false)
//   const router = useRouter()
//   const { toast } = useToast()

//   const handleAdminLogin = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)

//     try {
//       // Basic client-side rate limiting
//       const key = `loginAttempts:${email}:admin`
//       const lockKey = `lockUntil:${email}:admin`
//       const lockUntil = Number(localStorage.getItem(lockKey) || 0)
//       if (lockUntil && Date.now() < lockUntil) {
//         const remaining = Math.ceil((lockUntil - Date.now()) / 60000)
//         throw new Error(`Too many attempts. Try again in ${remaining} min`)
//       }
//       const supabase = createClient()
//       const { error } = await supabase.auth.signInWithPassword({ email, password })
//       if (error) throw error

//       const {
//         data: { user },
//       } = await supabase.auth.getUser()
//       if (!user) throw new Error("Login failed")

//       const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
//       const role = profile?.role

//       if (role === "admin") {
//         router.push("/admin/dashboard")
//         return
//       }

//       // Optional dev fallback: allow code-admin login if env enables and creds match
//       if (process.env.NEXT_PUBLIC_ALLOW_CODE_ADMIN === "true" && isValidAdminCredentials(email, password)) {
//         document.cookie = "admin_code_login=true; path=/; max-age=86400; samesite=lax"
//         router.push("/admin/dashboard")
//         return
//       }

//       router.push("/employee/dashboard")
//     } catch (error: unknown) {
//       // Track failed attempts and lock after 5 failures for 5 minutes
//       const key = `loginAttempts:${email}:admin`
//       const lockKey = `lockUntil:${email}:admin`
//       const attempts = Number(localStorage.getItem(key) || 0) + 1
//       localStorage.setItem(key, String(attempts))
//       if (attempts >= 5) {
//         localStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000))
//         localStorage.removeItem(key)
//       }
//       toast({
//         variant: "destructive",
//         title: "Login Failed",
//         description: error instanceof Error ? error.message : "Invalid credentials",
//       })
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   return (
//     <div className=" bg-black">
//       <div className="w-full h-screen  flex justify-around">
//         <div className="w-1/2 relative overflow-hidden">
//           <video
//             className="absolute inset-0 w-full h-full object-cover"
//             src="https://res.cloudinary.com/dn60aovto/video/upload/v1762619868/dezprox-instro_hxdqis.mp4"
//             autoPlay
//             muted
//             loop
//             playsInline
//           />
//         </div>
//         <div className="w-1/2 h-screen p-10 place-content-center">
//           <h1 className="text-9xl font-bold absolute top-0 tracking-[80px] mx-auto right-0 text-transparent bg-clip-text bg-gradient-to-r from-white/10 to-white/5 uppercase ">Admin</h1>
//           <h1 className="text-9xl font-bold absolute bottom-10 tracking-[80px] mx-auto right-0 text-transparent bg-clip-text bg-gradient-to-r from-white/20 to-white/5 uppercase ">Login</h1>
//           <Card className="border-2  border-none w-[500px] mx-auto rounded-none shadow-none bg-transparent">

//             <CardContent>
//               <form onSubmit={handleAdminLogin} className="space-y-14">
//                 <div className="relative">
//                   <Input
//                     id="email"
//                     name="email"
//                     type="email"
//                     className="border-0 border-b border-white text-white text-center font-semibold tracking-widest py-1 transition-colors focus:outline-none focus:ring-0 focus:border-b focus:border-white peer bg-inherit rounded-none shadow-none"
//                     // placeholder="admin@company.com"
//                     required
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                   />
//                   <label
//                     htmlFor="email"
//                     className={`absolute left-0 text-white tracking-widest cursor-text transition-all  ${email ? 'text-xs -top-8 text-blue-700' : 'top-1'} peer-focus:text-xs peer-focus:-top-8 peer-focus:text-blue-700`}
//                   >Email</label>
//                 </div>
//                 <div className="relative">
//                   <Input
//                     id="password"
//                     name="password"
//                     type={showPassword ? "text" : "password"}
//                     className="border-0 border-b border-white text-white text-center font-semibold tracking-widest py-1 transition-colors focus:outline-none focus:ring-0 focus:border-b focus:border-white peer bg-inherit rounded-none shadow-none pr-10"
//                     required
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                   />
//                   <label
//                     htmlFor="password"
//                     className={`absolute left-0 text-white tracking-widest cursor-text transition-all ${password ? 'text-xs -top-8 text-blue-700' : 'top-1'} peer-focus:text-xs peer-focus:-top-8 peer-focus:text-blue-700`}
//                   >Password</label>
//                   <button
//                     type="button"
//                     aria-label={showPassword ? "Hide password" : "Show password"}
//                     onClick={() => setShowPassword((v) => !v)}
//                     className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
//                   >
//                     {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
//                   </button>
//                 </div>
//                 <div className="relative group">
//                   <div className="relative w-full h-14 opacity-90 overflow-hidden rounded-xl bg-black z-10">
//                     <div className="absolute z-10 -translate-x-44 group-hover:translate-x-[30rem] ease-in transition-all duration-700 h-full w-44 bg-gradient-to-r from-gray-500 to-white/10 opacity-30 -skew-x-12"></div>

//                     <div className="absolute flex items-center justify-center text-white z-[1] opacity-90 rounded-2xl inset-0.5 bg-black">
//                       <button
//                         type="submit"
//                         disabled={isLoading}
//                         className="font-semibold text-lg h-full opacity-90 w-full px-16 py-3 rounded-xl bg-black"
//                       >
//                         {isLoading ? "Logging in..." : "Admin Login"}
//                       </button>
//                     </div>
//                     <div className="absolute duration-1000 group-hover:animate-spin w-full h-[100px] bg-gradient-to-r from-green-500 to-yellow-500 blur-[30px]"></div>
//                   </div>
//                 </div>
//               </form>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   )
// }