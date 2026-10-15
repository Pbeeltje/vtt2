// Server-only auth helpers. Deliberately NOT a "use server" module: nothing here may be
// callable from the browser. The login server action lives in lib/auth-actions.ts.
import { cookies, headers } from "next/headers"
import bcrypt from "bcryptjs"
import { db as client } from "./db"
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionToken,
  safeEqual,
  type SessionUser,
} from "./session-token"
import { resolveSessionUser } from "./session-user"
import { clientIpFromHeaders, rateLimit } from "./rate-limit"
import { ENV_DM_USER_ID } from "./env-dm"

/**
 * Secure cookies are only kept on https. Players often join over plain http on the LAN, so mark
 * the cookie Secure only when this request came over https (directly or through a tunnel).
 */
async function requestIsHttps(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "true") return true
  const h = await headers()
  return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https"
}

/** `storedPassword` is the user's DB password hash (ignored for the env DM); see credentialStamp. */
export async function setUserCookie(user: SessionUser, storedPassword: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user, storedPassword), {
    httpOnly: true,
    secure: await requestIsHttps(),
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
  })
}

/**
 * Returns the logged-in user, or null. The cookie must carry a valid signature, the account
 * must still exist with the same password, and the role is re-read from the database so
 * demotions take effect at once.
 */
export async function getUserFromCookie(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    return await resolveSessionUser(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  } catch (error) {
    console.error("Error in getUserFromCookie:", error)
    return null
  }
}

export async function clearUserCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export interface LoginResult {
  success: boolean
  error?: string
  role?: string
  username?: string
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000
/** bcrypt hash of a random string, compared against when the username doesn't exist. */
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.ZDGZ0JkE6nB1zMqXcN3gAo6R0F0C"

/** Checks credentials, applies rate limits and sets the session cookie on success. */
export async function authenticateAndSetCookie(username: unknown, password: unknown): Promise<LoginResult> {
  try {
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return { success: false, error: "Invalid input" }
    }

    const sanitizedUsername = username.trim()
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 50 || password.length > 200) {
      return { success: false, error: "Invalid credentials" }
    }

    const ip = clientIpFromHeaders(await headers())
    if (
      !rateLimit(`login:ip:${ip}`, 30, LOGIN_WINDOW_MS) ||
      !rateLimit(`login:user:${sanitizedUsername.toLowerCase()}`, 10, LOGIN_WINDOW_MS)
    ) {
      return { success: false, error: "Too many login attempts. Try again in a few minutes." }
    }

    // Env-configured DM account (DM_USERNAME / DM_PASSWORD).
    const dmUsername = process.env.DM_USERNAME
    const dmPassword = process.env.DM_PASSWORD
    if (dmUsername && dmPassword && sanitizedUsername === dmUsername) {
      if (!safeEqual(password, dmPassword)) {
        return { success: false, error: "Invalid credentials" }
      }
      await setUserCookie({ id: ENV_DM_USER_ID, username: dmUsername, role: "DM" }, "")
      return { success: true, role: "DM", username: dmUsername }
    }

    const result = await client.execute({
      sql: "SELECT UserId, Username, Password, Role FROM User WHERE Username = ? COLLATE NOCASE AND UserId <> ?",
      args: [sanitizedUsername, ENV_DM_USER_ID],
    })
    // Unknown names still pay for a bcrypt compare, so timing doesn't reveal which accounts exist.
    const user = result.rows[0]
    const isMatch = await bcrypt.compare(password, user ? String(user.Password) : DUMMY_HASH)
    if (!user || !isMatch) {
      return { success: false, error: "Invalid credentials" }
    }

    const sessionUser: SessionUser = {
      id: Number(user.UserId),
      username: String(user.Username),
      role: (user.Role as string) || "player",
    }
    await setUserCookie(sessionUser, String(user.Password))
    return { success: true, role: sessionUser.role, username: sessionUser.username }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Login failed" }
  }
}

// Helper function to validate user permissions
export async function requireAuth(requiredRole?: "DM" | "player"): Promise<SessionUser> {
  const user = await getUserFromCookie()
  if (!user) {
    throw new Error("Authentication required")
  }

  if (requiredRole && user.role !== requiredRole) {
    throw new Error("Insufficient permissions")
  }

  return user
}
