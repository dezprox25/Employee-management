/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const allowedOrigin = process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || "http://localhost:3001"

    // Allow required third-party endpoints while keeping CSP tight
    const vercelAnalyticsSrc = "https://va.vercel-scripts.com"
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    let supabaseHost = ""
    try {
      if (supabaseUrl) supabaseHost = new URL(supabaseUrl).host
    } catch {}

    const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'", vercelAnalyticsSrc]
    const connectSrc = [
      "'self'",
      vercelAnalyticsSrc,
      // Explicit project host (if available)
      ...(supabaseHost ? [
        `https://${supabaseHost}`,
        `wss://${supabaseHost}`,
      ] : []),
      // Fallback wildcard to cover environments where env var may be absent
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]

    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      `script-src ${scriptSrc.join(' ')}`,
      `connect-src ${connectSrc.join(' ')}`,
      "font-src 'self' data:",
      "frame-ancestors 'self'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), fullscreen=(self)' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, X-Signature' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },
}

export default nextConfig
