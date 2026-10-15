/**
 * Small in-memory fixed-window rate limiter (single server process).
 * Used for login and registration endpoints.
 */
type Bucket = { count: number; resetAt: number }

const BUCKETS_KEY = "__vttRateLimitBuckets"
type RateGlobal = { [BUCKETS_KEY]?: Map<string, Bucket> }

function buckets(): Map<string, Bucket> {
  const g = globalThis as RateGlobal
  if (!g[BUCKETS_KEY]) g[BUCKETS_KEY] = new Map()
  return g[BUCKETS_KEY]!
}

/** Returns true if the action is allowed, false if `key` exceeded `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const map = buckets()
  const bucket = map.get(key)
  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    if (map.size > 10_000) {
      for (const [k, b] of map) if (b.resetAt <= now) map.delete(k)
    }
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

/** Best-effort client IP from proxy headers (Cloudflare tunnel sets cf-connecting-ip). */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  )
}
