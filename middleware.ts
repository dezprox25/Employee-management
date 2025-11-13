import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Middleware to consolidate admin/employee routes under dashboard,
// preserving backward compatibility via redirects with a pane query.
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const pathname = req.nextUrl.pathname

  // Map legacy paths to dashboard with pane selection
  const redirects: Record<string, string> = {
    "/admin/employees": "/admin/dashboard?pane=employees",
    "/admin/leaves": "/admin/dashboard?pane=leaves",
    "/admin/attendance": "/admin/dashboard?pane=attendance",
    "/admin/reports": "/admin/dashboard?pane=reports",
    "/employee/attendance": "/employee/dashboard?pane=attendance",
    "/employee/leaves": "/employee/dashboard?pane=leaves",
  }

  for (const [from, to] of Object.entries(redirects)) {
    if (pathname === from || pathname.startsWith(from + "/")) {
      const [toPath, toSearch] = to.split("?")
      url.pathname = toPath
      url.search = toSearch ? `?${toSearch}` : ""
      // Permanent redirect (308) to update bookmarks while preserving method/body
      return NextResponse.redirect(url, 308)
    }
  }

  // Apply Supabase session update and auth guard logic
  const sessionResponse = await updateSession(req)
  return sessionResponse
}

// Only run on relevant app routes; exclude API/static assets implicitly
export const config = {
  matcher: [
    "/admin/:path*",
    "/employee/:path*",
  ],
}
