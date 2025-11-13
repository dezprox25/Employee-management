import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
import AdminDashboardClient from "./client"

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-background p-6 md:p-8 grid place-items-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Spinner />
            <span>Loading dashboard…</span>
          </div>
        </div>
      }
    >
      <AdminDashboardClient />
    </Suspense>
  )
}
