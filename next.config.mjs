// Comma-separated extra hostnames for dev (e.g. custom tunnel domain). Wildcards like *.example.com work.
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// Every page: no framing (clickjacking), no plugins, no <base> or form tricks, no MIME sniffing.
// No script-src: Next's inline scripts would need nonces. React escaping is the XSS defence.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/((?!uploads/).*)', headers: securityHeaders },
      // User uploads are images only: never let the browser sniff or run them as pages.
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
  // No ESLint setup; type errors still fail the build (see npm run typecheck).
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // Without this, loading the app via an HTTPS tunnel (ngrok, cloudflared, etc.) can 403 /_next/* in dev.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.ngrok-free.app',
    '*.ngrok.app',
    '*.ngrok.io',
    '*.trycloudflare.com',
    '*.cloudflareaccess.com',
    '*.loca.lt',
    '*.ts.net',
    ...extraDevOrigins,
  ],
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
}

export default nextConfig
