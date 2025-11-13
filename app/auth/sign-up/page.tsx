"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DisabledSignUp() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/login")
  }, [router])

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-background to-card">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-muted-foreground">Sign up is disabled. Redirecting to Admin Login…</p>
      </div>
    </div>
  )
}
