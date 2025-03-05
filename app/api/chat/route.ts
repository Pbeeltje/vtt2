import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"
import { getUserFromCookie } from "@/lib/auth"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
})

export async function GET(req: Request) {
  console.log("Entering GET /api/chat")

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration missing")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const user = await getUserFromCookie()
  if (!user) {
    console.log("User not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    console.log("Fetching chat messages for user:", user.id)
    const result = await client.execute({
      sql: "SELECT * FROM ChatMessage WHERE UserId = ? ORDER BY Timestamp ASC",
      args: [user.id],
    })
    console.log("Chat messages fetched:", result.rows)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching chat messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch chat messages", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  console.log("Entering POST /api/chat")

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration missing")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const user = await getUserFromCookie()
  if (!user) {
    console.log("User not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { type, content } = await req.json()
    if (!type || !content) {
      return NextResponse.json({ error: "Type and content are required" }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const username = user.username

    console.log("Saving chat message:", { type, content, timestamp, username })
    const result = await client.execute({
      sql: "INSERT INTO ChatMessage (Type, Content, Timestamp, Username, UserId) VALUES (?, ?, ?, ?, ?)",
      args: [type, content, timestamp, username, user.id],
    })

    if (!result.lastInsertRowid) {
      throw new Error("Failed to insert chat message")
    }

    const newMessage = await client.execute({
      sql: "SELECT * FROM ChatMessage WHERE MessageId = ?",
      args: [result.lastInsertRowid],
    })

    console.log("New chat message saved:", newMessage.rows[0])
    return NextResponse.json(newMessage.rows[0])
  } catch (error) {
    console.error("Error saving chat message:", error)
    return NextResponse.json(
      { error: "Failed to save chat message", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}