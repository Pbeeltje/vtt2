"use server"

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { createClient } from "@libsql/client"

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "",
})

// Session timeout in milliseconds (7 days)
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000

export async function setUserCookie(user: { id: number; username: string; role: string }) {
  try {
    const cookieStore = cookies()
    const sessionTimeout = 7 * 24 * 60 * 60 * 1000 // 7 days
    const expires = new Date(Date.now() + sessionTimeout)
    
    cookieStore.set("user", JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires,
    })
  } catch (error) {
    console.error("Error in setUserCookie:", error)
    throw new Error("Failed to set user cookie: " + (error instanceof Error ? error.message : String(error)))
  }
}

export async function getUserFromCookie() {
  try {
    const cookieStore = cookies()
    const userCookie = cookieStore.get("user")
    if (userCookie && userCookie.value) {
      const user = JSON.parse(userCookie.value)
      
      // Check if user data is valid
      if (user && user.id !== undefined && user.username && user.role) {
        return user
      }
    }
    return null
  } catch (error) {
    console.error("Error in getUserFromCookie:", error)
    return null
  }
}

export async function clearUserCookie() {
  try {
    const cookieStore = cookies()
    cookieStore.delete("user")
  } catch (error) {
    console.error("Error in clearUserCookie:", error)
    throw new Error("Failed to clear user cookie: " + (error instanceof Error ? error.message : String(error)))
  }
}

interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

interface SuccessfulLoginResult extends LoginResult {
  success: true;
  role: string;
}

export async function loginUser(username: string, password: string): Promise<LoginResult | SuccessfulLoginResult> {
  try {
    // Input validation
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return { success: false, error: "Invalid input" }
    }

    const sanitizedUsername = username.trim();
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 50) {
      return { success: false, error: "Invalid username format" }
    }

    const result = await client.execute({
      sql: "SELECT * FROM user WHERE Username = ?",
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

    const userForCookie = {
      id: user.UserId as number,
      username: user.Username as string,
      role: (user.Role as string) || "player",
    }

    await setUserCookie(userForCookie)

    return { success: true, role: userForCookie.role }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Login failed" }
  }
}

export async function loginDM() {
  try {
    const dmUsername = process.env.DM_USERNAME;
    const dmPassword = process.env.DM_PASSWORD;
    
    // Only allow DM login if environment variables are configured
    if (!dmUsername || !dmPassword) {
      return { success: false, error: "DM credentials not configured" }
    }

    const userForCookie = {
      id: 0,
      username: dmUsername,
      role: "DM" as const,
    }
    await setUserCookie(userForCookie)
    return { success: true, role: "DM" }
  } catch (error) {
    console.error("DM Login error:", error)
    return { success: false, error: "DM login failed" }
  }
}

// Helper function to validate user permissions
export async function requireAuth(requiredRole?: 'DM' | 'player') {
  const user = await getUserFromCookie()
  if (!user) {
    throw new Error("Authentication required")
  }
  
  if (requiredRole && user.role !== requiredRole) {
    throw new Error("Insufficient permissions")
  }
  
  return user
}

// Helper function to check if session is valid
export async function isSessionValid() {
  const user = await getUserFromCookie()
  return user !== null
}
