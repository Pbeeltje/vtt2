/**
 * Parse the `user` session cookie from a raw Cookie header (e.g. Socket.IO handshake).
 * Must stay free of "use server" / next/headers so it can run in the Node socket stack.
 */
export type SessionUser = { id: number; username: string; role: string }

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
  const raw = cookieValueFromHeader(cookieHeader, "user")
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    const user = JSON.parse(decoded) as unknown
    if (
      user &&
      typeof user === "object" &&
      "id" in user &&
      "username" in user &&
      "role" in user &&
      typeof (user as SessionUser).username === "string" &&
      typeof (user as SessionUser).role === "string"
    ) {
      const id = Number((user as SessionUser).id)
      if (!Number.isFinite(id)) return null
      return { id, username: (user as SessionUser).username, role: (user as SessionUser).role }
    }
  } catch {
    return null
  }
  return null
}

/** Socket.IO room for clients that presented a valid `user` cookie at connect time. */
export const AUTHENTICATED_ROOM = "authenticated"
