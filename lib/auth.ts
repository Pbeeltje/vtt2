"use server"

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { createClient } from "@libsql/client"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
})

export async function setUserCookie(user: { id: number; username: string; role: string }) {
  console.log("Setting user cookie:", user)
  try {
    const cookieStore = cookies()
    const userString = JSON.stringify(user)
    cookieStore.set("user", userString)
    console.log("User cookie set successfully")
  } catch (error) {
    console.error("Error in setUserCookie:", error)
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    throw new Error("Failed to set user cookie: " + (error instanceof Error ? error.message : String(error)))
  }
}

export async function getUserFromCookie() {
  console.log("Getting user from cookie")
  try {
    const cookieStore = cookies()
    const userCookie = cookieStore.get("user")
    if (userCookie && userCookie.value) {
      const user = JSON.parse(userCookie.value)
      console.log("User found in cookie:", user)
      if (user && user.id !== undefined && user.username && user.role) {
        return user
      }
    }
    console.log("No valid user found in cookie")
    return null
  } catch (error) {
    console.error("Error in getUserFromCookie:", error)
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return null
  }
}

export async function clearUserCookie() {
  try {
    const cookieStore = cookies()
    cookieStore.delete("user")
    console.log("User cookie cleared")
  } catch (error) {
    console.error("Error in clearUserCookie:", error)
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    throw new Error("Failed to clear user cookie: " + (error instanceof Error ? error.message : String(error)))
  }
}

export async function loginUser(username: string, password: string) {
  try {
    const result = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [username],
    })

    if (result.rows.length === 0) {
      return { success: false, error: "Invalid credentials" }
    }

    const user = result.rows[0]
    const isMatch = await bcrypt.compare(password, user.Password)

    if (!isMatch) {
      return { success: false, error: "Invalid credentials" }
    }

    const userForCookie = {
      id: user.UserId,
      username: user.Username,
      role: user.Role || "player",
    }

    await setUserCookie(userForCookie)

    return { success: true, role: userForCookie.role }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "An unexpected error occurred during login" }
  }
}

export async function loginDM() {
  try {
    const userForCookie = {
      id: 0,
      username: "DM_User",
      role: "DM" as const,
    }
    await setUserCookie(userForCookie)
    return { success: true, role: "DM" }
  } catch (error) {
    console.error("DM Login error:", error)
    return { success: false, error: "An error occurred during DM login" }
  }
}

