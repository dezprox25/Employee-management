import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
import EmployeeDashboardClient from "./client"

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <EmployeeDashboardClient />
    </Suspense>
  )
}
