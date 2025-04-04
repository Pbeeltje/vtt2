import { NextResponse } from "next/server"
import { createClient } from "@libsql/client"
import { getUserFromCookie } from "@/lib/auth"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
})

export async function GET(req: Request) {
  console.log("Entering GET function in /api/characters/route.ts")

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration is missing")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const user = await getUserFromCookie()

  if (!user) {
    console.log("User is not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("User authenticated:", user)

  try {
    console.log("Fetching all characters for the user")
    const result = await client.execute({
      sql: "SELECT * FROM Character WHERE UserId = ?",
      args: [user.id],
    })

    console.log("Characters fetched:", result.rows)
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching characters:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch characters",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  console.log("Entering POST function in /api/characters/route.ts")

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Database configuration is missing")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const user = await getUserFromCookie()

  if (!user) {
    console.log("User is not authenticated")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("User authenticated:", user)

  try {
    const { category } = await req.json()
    console.log(`Attempting to add new character in category: ${category}`)

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    console.log("Executing SQL insert")
    const result = await client.execute({
      sql: "INSERT INTO Character (Name, Description, Path, Category, UserId) VALUES (?, ?, ?, ?, ?)",
      args: [`New ${category}`, "Description placeholder", "Warrior", category, user.id],
    })

    console.log("SQL insert result:", result)

    if (!result.lastInsertRowid) {
      throw new Error("Failed to insert new character")
    }

    console.log("Fetching newly inserted character")
    const newCharacter = await client.execute({
      sql: "SELECT * FROM Character WHERE CharacterId = ?",
      args: [result.lastInsertRowid],
    })

    console.log("New character fetched:", newCharacter.rows[0])

    return NextResponse.json(newCharacter.rows[0])
  } catch (error) {
    console.error("Error adding character:", error)
    return NextResponse.json(
      { error: "Failed to add character", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

