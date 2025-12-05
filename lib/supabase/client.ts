// This is normal in Next.js apps with middleware - middleware creates one instance
// and browser components create another. They communicate via secure cookies.
if (typeof window !== "undefined") {
  const originalWarn = console.warn
  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.("Multiple GoTrueClient instances")) {
      return
    }
    originalWarn.apply(console, args)
  }
}

import { createBrowserClient } from "@supabase/ssr"

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: true,
        },
      },
    )
  }
  return supabaseInstance
}
