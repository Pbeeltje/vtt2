import { NextResponse } from "next/server"
import { getUserFromCookie } from "@/lib/auth"
import { postChatMessage } from "@/lib/chat"
import { db } from "@/lib/db"
import { describeTest, isTestAttribute, rollDice, scoreTest } from "@/lib/dice"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Rolls a Test for a character: a d20 against the attribute score stored on the server, so the
 * score can't be faked. The result goes to chat in the character's name.
 * Body: { characterId: 3, attribute: "Strength" | "Dexternity" | "Mind" | "Charisma" }.
 */
export async function POST(req: Request) {
  const user = await getUserFromCookie()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!rateLimit(`roll:user:${user.id}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many rolls; slow down a little" }, { status: 429 })
  }

  try {
    const { characterId, attribute } = await req.json()
    if (!Number.isInteger(characterId) || characterId <= 0) {
      return NextResponse.json({ error: "characterId is required" }, { status: 400 })
    }
    if (!isTestAttribute(attribute)) {
      return NextResponse.json({ error: "attribute must be Strength, Dexternity, Mind or Charisma" }, { status: 400 })
    }

    // The column name comes from the fixed attribute list, never from the request text itself.
    const found = await db.execute({
      sql: `SELECT Name, userId, ${attribute} AS score FROM character WHERE CharacterId = ?`,
      args: [characterId],
    })
    const row = found.rows[0]
    if (!row) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }
    if (user.role !== "DM" && Number(row.userId) !== user.id) {
      return NextResponse.json({ error: "You can only roll for your own characters" }, { status: 403 })
    }
    const score = Number(row.score)
    if (!Number.isFinite(score) || row.score === null) {
      return NextResponse.json({ error: `${String(row.Name)} has no ${attribute} score yet` }, { status: 400 })
    }

    const dice = rollDice("d20")
    const test = scoreTest(attribute, score, dice.total)
    const speaker = { speakerName: String(row.Name), senderType: "character" as const }
    const message = await postChatMessage(user, speaker, "diceRoll", describeTest(test), { ...dice, test })
    return NextResponse.json(message)
  } catch (error) {
    console.error("Error rolling a test:", error)
    return NextResponse.json({ error: "Failed to roll" }, { status: 500 })
  }
}
