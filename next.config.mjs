// Comma-separated extra hostnames for dev (e.g. custom tunnel domain). Wildcards like *.example.com work.
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // User uploads are images only: never let the browser sniff or run them as pages.
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" },
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
