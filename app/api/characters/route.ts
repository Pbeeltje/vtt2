import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse } from "@/lib/api-errors"
import { emitCharacterUpdated } from "@/lib/character-sync"

const SELECT_CHARACTER = "SELECT c.*, u.Username AS ownerUsername FROM character c LEFT JOIN user u ON c.userId = u.UserId"

/** DMs see every character; players see the ones they own. */
export async function GET() {
  try {
    const user = await requireAuth()
    const result = user.role === "DM"
      ? await db.execute(SELECT_CHARACTER)
      : await db.execute({ sql: `${SELECT_CHARACTER} WHERE c.userId = ?`, args: [user.id] })
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching characters:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 })
  }
}

const VALID_CATEGORIES = ["Party", "NPC", "Monster"]

/** Creates a character. Only DMs may create NPCs and Monsters; a player's new character is theirs. */
export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const { category } = await req.json()

    if (typeof category !== "string" || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category. Must be one of: Party, NPC, Monster" }, { status: 400 })
    }
    if (category !== "Party" && user.role !== "DM") {
      return NextResponse.json({ error: "Only DMs can create NPCs and Monsters" }, { status: 403 })
    }

    const inserted = await db.execute({
      sql: "INSERT INTO character (Name, Description, Path, category, userId) VALUES (?, ?, 'Warrior', ?, ?) RETURNING CharacterId",
      args: [`New ${category}`, "", category, user.id],
    })
    const created = await db.execute({
      sql: `${SELECT_CHARACTER} WHERE c.CharacterId = ?`,
      args: [inserted.rows[0].CharacterId],
    })
    const character = created.rows[0]
    emitCharacterUpdated(character)
    return NextResponse.json(character, { status: 201 })
  } catch (error) {
    console.error("Error adding character:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to add character" }, { status: 500 })
  }
}
