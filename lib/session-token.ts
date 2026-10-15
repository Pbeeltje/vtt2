/**
 * Signed session tokens for the `user` cookie.
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * Kept free of "use server" / next/headers so the Socket.IO handshake can use it too.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto"

export type SessionUser = { id: number; username: string; role: string }

type SessionPayload = SessionUser & { exp: number }

export const SESSION_COOKIE_NAME = "user"
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const GENERATED_SECRET_KEY = "__vttGeneratedSessionSecret"
type SecretGlobal = { [GENERATED_SECRET_KEY]?: string }

function getSecret(): string {
  const configured = process.env.SECRET_COOKIE_PASSWORD?.trim()
  if (configured && configured.length >= 16) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRET_COOKIE_PASSWORD must be set (at least 16 characters, 32+ recommended)")
  }
  // Dev fallback: one random secret per process (shared by route bundles and the socket server).
  const g = globalThis as SecretGlobal
  if (!g[GENERATED_SECRET_KEY]) {
    g[GENERATED_SECRET_KEY] = randomBytes(32).toString("hex")
    console.warn("[session] SECRET_COOKIE_PASSWORD not set; using a random secret. Sessions end when the server restarts.")
  }
  return g[GENERATED_SECRET_KEY]!
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url")
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + SESSION_MAX_AGE_MS,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${data}.${sign(data)}`
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const data = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  const expected = Buffer.from(sign(data))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<SessionPayload>
    const id = Number(payload.id)
    if (
      !Number.isFinite(id) ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null
    }
    return { id, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

/** Constant-time string comparison for secrets typed by users (passwords, invite codes). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "compare").update(a).digest()
  const hb = createHmac("sha256", "compare").update(b).digest()
  return timingSafeEqual(ha, hb)
}
