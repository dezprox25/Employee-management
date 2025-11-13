import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

function setSecurityHeaders(res: NextResponse) {
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "SAMEORIGIN")
  res.headers.set("Referrer-Policy", "no-referrer")
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), usb=(), payment=(), interest-cohort=()")
}

function getAllowedOrigin(originHeader: string | null): string | null {
  const envCsv = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || ""
  const list = envCsv.split(",").map((s) => s.trim()).filter(Boolean)
  if (!originHeader) return list[0] || null
  if (list.length === 0) {
    // dev fallback: echo origin to avoid breaking local testing
    return process.env.NODE_ENV === "production" ? null : originHeader
  }
  return list.includes(originHeader) ? originHeader : null
}

function setCorsHeaders(res: NextResponse, origin: string) {
  res.headers.set("Access-Control-Allow-Origin", origin)
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Signature")
  res.headers.set("Access-Control-Allow-Credentials", "true")
}

// Middleware to consolidate admin/employee routes under dashboard,
// preserving backward compatibility via redirects with a pane query.
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const pathname = req.nextUrl.pathname
  const isApiRoute = pathname.startsWith("/api/")

  // Enforce HTTPS in production (behind proxies) when incoming proto is http
  const proto = req.headers.get("x-forwarded-proto") || ""
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (process.env.NODE_ENV === "production" && !isLocalhost && proto === "http") {
    url.protocol = "https"
    return NextResponse.redirect(url, 308)
  }

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

  // Handle CORS preflight for API routes
  if (isApiRoute && req.method === "OPTIONS") {
    const allowed = getAllowedOrigin(req.headers.get("origin"))
    const res = new NextResponse(null, { status: 204 })
    if (allowed) setCorsHeaders(res, allowed)
    setSecurityHeaders(res)
    return res
  }

  // Apply Supabase session update and auth guard logic
  const sessionResponse = await updateSession(req)

  // Add security headers globally
  setSecurityHeaders(sessionResponse)

  // Add CORS for API routes (actual requests)
  if (isApiRoute) {
    const allowed = getAllowedOrigin(req.headers.get("origin"))
    if (allowed) setCorsHeaders(sessionResponse, allowed)
  }

  return sessionResponse
}

// Only run on relevant app routes; exclude API/static assets implicitly
export const config = {
  matcher: [
    "/admin/:path*",
    "/employee/:path*",
    "/api/:path*",
  ],
}
