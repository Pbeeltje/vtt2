let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

// Comma-separated extra hostnames for dev (e.g. custom tunnel domain). Wildcards like *.example.com work.
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // Without this, loading the app via an HTTPS tunnel (ngrok, cloudflared, etc.) can 403 /_next/* in dev.
    allowedDevOrigins: [
      'localhost',
      '*.ngrok-free.app',
      '*.ngrok.app',
      '*.ngrok.io',
      '*.trycloudflare.com',
      '*.cloudflareaccess.com',
      '*.loca.lt',
      '*.ts.net',
      ...extraDevOrigins,
    ],
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig
