import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if no user and not already on auth routes or home
  const path = request.nextUrl.pathname
  const isApiRoute = path.startsWith("/api/")
  const isPublicAdminLogin = path === "/admin/login"
  const isAdminArea = path.startsWith("/admin")
  const isCodeAdmin = request.cookies.get("admin_code_login")?.value === "true"
  // Never redirect API routes; let the API return JSON errors
  if (isApiRoute) {
    return supabaseResponse
  }

  if (!user && !path.startsWith("/auth") && path !== "/" && !(isPublicAdminLogin || (isAdminArea && isCodeAdmin))) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
