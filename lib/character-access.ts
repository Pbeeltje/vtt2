import { NextResponse } from "next/server"
import { db } from "./db"
import { getUserFromCookie } from "./auth"
import type { SessionUser } from "./session-token"

/**
 * The logged-in user if they may edit this character (its owner, or a DM); otherwise the
 * 401/403/404 response to return.
 */
export async function requireCharacterAccess(characterId: number | null): Promise<SessionUser | NextResponse> {
  if (!characterId) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 })
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const result = await db.execute({ sql: "SELECT userId FROM character WHERE CharacterId = ?", args: [characterId] })
  if (result.rows.length === 0) return NextResponse.json({ error: "Character not found" }, { status: 404 })
  if (user.role !== "DM" && Number(result.rows[0].userId) !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }
  return user
}
