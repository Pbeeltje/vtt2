import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@libsql/client"
import { setUserCookie } from "@/lib/auth"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
})

export async function POST(req: Request) {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration is missing")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const { username, password, isTestLogin = false } = await req.json()

    console.log("Received login request:", { username, isTestLogin })

    if (isTestLogin) {
      console.log("Handling test login")
      if (username === "DM_User" && password === "dm_password") {
        const userForCookie = {
          id: 0,
          username: "DM_User",
          role: "DM" as const,
        }
        console.log("Test login successful, setting cookie")
        try {
          await setUserCookie(userForCookie)
        } catch (cookieError) {
          console.error("Error setting user cookie:", cookieError)
          return NextResponse.json({ error: "Failed to set user cookie", details: cookieError }, { status: 500 })
        }
        return NextResponse.json({ message: "Logged in successfully", role: "DM" })
      } else {
        return NextResponse.json({ error: "Invalid test credentials" }, { status: 401 })
      }
    }

    const result = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [username],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const user = result.rows[0]
    const isMatch = await bcrypt.compare(password, user.Password)

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const userForCookie = {
      id: user.UserId,
      username: user.Username,
      role: user.Role || "player", // Default to "player" if Role is not set
    }

    console.log("Login successful, setting cookie")
    try {
      await setUserCookie(userForCookie)
    } catch (cookieError) {
      console.error("Error setting user cookie:", cookieError)
      return NextResponse.json({ error: "Failed to set user cookie", details: cookieError }, { status: 500 })
    }

    return NextResponse.json({ message: "Logged in successfully", role: userForCookie.role })
  } catch (error) {
    console.error("Login error:", error)
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return NextResponse.json(
      {
        error: "Login failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

