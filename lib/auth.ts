// Server-only auth helpers. Deliberately NOT a "use server" module: nothing here may be
// callable from the browser. The login server action lives in lib/auth-actions.ts.
import { cookies, headers } from "next/headers"
import bcrypt from "bcryptjs"
import { createClient } from "@libsql/client"
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  createSessionToken,
  safeEqual,
  verifySessionToken,
  type SessionUser,
} from "./session-token"
import { clientIpFromHeaders, rateLimit } from "./rate-limit"

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
})

/** The env-configured DM (DM_USERNAME / DM_PASSWORD) always uses this user id. */
const ENV_DM_USER_ID = 0

function envDmConfigured(): boolean {
  return Boolean(process.env.DM_USERNAME && process.env.DM_PASSWORD)
}

export async function setUserCookie(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
  })
}

/**
 * Returns the logged-in user, or null. The cookie must carry a valid signature, and the
 * role is re-read from the database so demotions and deleted accounts take effect at once.
 */
export async function getUserFromCookie(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
    if (!session) return null

    const result = await client.execute({
      sql: "SELECT Role FROM User WHERE UserId = ?",
      args: [session.id],
    })
    if (result.rows.length > 0) {
      return { ...session, role: String(result.rows[0].Role ?? "player") }
    }
    if (session.id === ENV_DM_USER_ID && envDmConfigured()) {
      return { ...session, role: "DM" }
    }
    return null
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
      await setUserCookie({ id: ENV_DM_USER_ID, username: dmUsername, role: "DM" })
      return { success: true, role: "DM", username: dmUsername }
    }

    const result = await client.execute({
      sql: "SELECT UserId, Username, Password, Role FROM User WHERE Username = ?",
      args: [sanitizedUsername],
    })
    if (result.rows.length === 0) {
      return { success: false, error: "Invalid credentials" }
    }

    const user = result.rows[0]
    const isMatch = await bcrypt.compare(password, user.Password as string)
    if (!isMatch) {
      return { success: false, error: "Invalid credentials" }
    }

    const sessionUser: SessionUser = {
      id: Number(user.UserId),
      username: String(user.Username),
      role: (user.Role as string) || "player",
    }
    await setUserCookie(sessionUser)
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
