// Checks server.ts runs on every HTTP request before Next sees it, and that the Socket.IO
// handshake shares. Plain functions over Node's header object, so they are easy to test.
import type { IncomingHttpHeaders } from "http"

type Headers = IncomingHttpHeaders

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim() || undefined

/**
 * Whether forwarded headers (X-Forwarded-*, CF-Connecting-IP) can be believed. Only a proxy on
 * this machine sets them honestly: cloudflared and ngrok connect over loopback. Anyone on the LAN
 * could otherwise fake their IP and dodge the login rate limit. TRUST_PROXY=true trusts everyone
 * (for a reverse proxy on another machine).
 */
export function isTrustedProxy(remoteAddress: string | undefined): boolean {
  if (process.env.TRUST_PROXY === "true") return true
  if (!remoteAddress) return false
  return remoteAddress === "::1" || remoteAddress.startsWith("127.") || remoteAddress.startsWith("::ffff:127.")
}

const FORWARDED_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "x-real-ip", "cf-connecting-ip", "forwarded"]

/** Drops forwarded headers from untrusted clients and records their real address instead. */
export function sanitizeForwardedHeaders(headers: Headers, remoteAddress: string | undefined): void {
  if (isTrustedProxy(remoteAddress)) return
  for (const name of FORWARDED_HEADERS) delete headers[name]
  if (remoteAddress) headers["x-forwarded-for"] = remoteAddress
}

/**
 * False when a browser on another site sent this request. Requests without an Origin header
 * (same-origin GETs, curl, tests) pass. Compared with the host the browser used, which is
 * X-Forwarded-Host behind a tunnel, as Next does for server actions.
 */
export function isSameOrigin(headers: Headers): boolean {
  if (first(headers["sec-fetch-site"]) === "cross-site") return false
  const origin = first(headers.origin)
  if (!origin) return true
  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return false // "null" (sandboxed frames, file://) or garbage
  }
  const hosts = [first(headers["x-forwarded-host"]), first(headers.host)].filter(Boolean).map((h) => h!.toLowerCase())
  return hosts.includes(originHost)
}

const MB = 1024 * 1024
/** Uploads and full scene saves are big; everything else is small JSON. */
const LARGE_BODY_PATHS = ["/api/images", "/api/scenes"]
export const MAX_BODY_BYTES = 1 * MB
export const MAX_LARGE_BODY_BYTES = 8 * MB

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * Rejects API writes from other sites (CSRF) and oversized bodies before they are read into
 * memory. Returns the status and message to answer with, or null to let the request through.
 */
export function checkApiRequest(method: string | undefined, pathname: string, headers: Headers): { status: number; error: string } | null {
  if (!pathname.startsWith("/api/") || SAFE_METHODS.has((method ?? "GET").toUpperCase())) return null
  if (!isSameOrigin(headers)) return { status: 403, error: "Cross-site request blocked" }

  const limit = LARGE_BODY_PATHS.includes(pathname) ? MAX_LARGE_BODY_BYTES : MAX_BODY_BYTES
  const length = headers["content-length"]
  if (length === undefined) {
    // Browsers always send a length; a streamed body could be any size.
    if (headers["transfer-encoding"]) return { status: 411, error: "Content-Length required" }
    return null
  }
  const bytes = Number(length)
  if (!Number.isFinite(bytes) || bytes < 0) return { status: 400, error: "Bad Content-Length" }
  if (bytes > limit) return { status: 413, error: "Request is too large" }
  return null
}
