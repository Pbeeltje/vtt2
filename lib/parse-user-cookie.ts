/**
 * Parse the signed `user` session cookie from a raw Cookie header (e.g. Socket.IO handshake).
 * Must stay free of "use server" / next/headers so it can run in the Node socket stack.
 */
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionUser } from "./session-token"

export type { SessionUser }

function cookieValueFromHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (key !== name) continue
    return trimmed.slice(eq + 1)
  }
  return null
}

export function parseUserFromCookieHeader(cookieHeader: string | undefined): SessionUser | null {
  const raw = cookieValueFromHeader(cookieHeader, SESSION_COOKIE_NAME)
  if (!raw) return null
  try {
    return verifySessionToken(decodeURIComponent(raw))
  } catch {
    return null
  }
}

/** Socket.IO room for clients that presented a valid `user` cookie at connect time. */
export const AUTHENTICATED_ROOM = "authenticated"
