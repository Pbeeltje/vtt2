import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"
import { getUserFromCookie } from "@/lib/auth"

const client = createClient({
  url: "file:./vttdatabase.db",
  authToken: "", // No auth token needed for local file
})

export async function GET(req: Request) {
  console.log("Entering GET /api/chat")

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

    const savedMessageObject = newMessage.rows[0]
    console.log("New chat message saved:", savedMessageObject)

    // Emit event for new chat message
    try {
      const { getIO } = await import('../../../lib/socket'); // Dynamically import to avoid issues in non-socket environments if any
      const io = getIO();
      // For now, emitting globally. If chat becomes scene-specific, this needs a room.
      // Also, ensure the client side is prepared to handle the structure of savedMessageObject
      io.emit('new_message', savedMessageObject); 
      console.log(`Socket.IO: Emitted new_message globally`, savedMessageObject);
    } catch (socketError) {
      console.error("Socket.IO emit error in POST /api/chat:", socketError);
    }

    return NextResponse.json(savedMessageObject)
  } catch (error) {
    console.error("Error saving chat message:", error)
    return NextResponse.json(
      { error: "Failed to save chat message", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
