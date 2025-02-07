import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@libsql/client"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL as string,
  authToken: process.env.TURSO_AUTH_TOKEN as string,
})

export async function POST(req: Request) {
  console.log("Registration attempt received")
  const clonedReq = req.clone()
  console.log("Request body:", await clonedReq.json())
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await client.execute({
      sql: "SELECT * FROM User WHERE Username = ?",
      args: [username],
    })

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create new user
    const result = await client.execute({
      sql: "INSERT INTO User (Username, Password) VALUES (?, ?)",
      args: [username, hashedPassword],
    })

    if (!result.lastInsertRowid) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    return NextResponse.json({ message: "User registered successfully" })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      {
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

