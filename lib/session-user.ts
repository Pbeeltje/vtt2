// Turns a session token into the logged-in user, for route handlers (lib/auth.ts) and the
// Socket.IO handshake (lib/socket.ts) alike. No next/headers here, so both can use it.
import { db } from "./db"
import { ENV_DM_USER_ID, envDmConfigured } from "./env-dm"
import { credentialStamp, safeEqual, verifySessionToken, type SessionUser } from "./session-token"

/**
 * The user behind a token, or null. Besides the signature and expiry, the account must still
 * exist and its password must be the one the session was created with. The role is re-read
 * from the database so demotions take effect at once.
 */
export async function resolveSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  const session = verifySessionToken(token)
  if (!session) return null

  const result = await db.execute({ sql: "SELECT Role, Password FROM user WHERE UserId = ?", args: [session.id] })
  const row = result.rows[0]
  if (!row) {
    // The env DM works even before ensureEnvDmUser has given it a row.
    if (session.id !== ENV_DM_USER_ID || !envDmConfigured()) return null
    if (!safeEqual(session.cred, credentialStamp(ENV_DM_USER_ID, ""))) return null
    return { id: session.id, username: session.username, role: "DM" }
  }
  if (!safeEqual(session.cred, credentialStamp(session.id, String(row.Password ?? "")))) return null
  return { id: session.id, username: session.username, role: String(row.Role ?? "player") }
}
