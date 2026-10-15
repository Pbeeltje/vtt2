import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse } from "@/lib/api-errors"

/**
 * The party row in the bottom panel: every Party character with only what the portrait shows
 * (name, pictures, Guard and MP, owner). Players can't read each other's full sheets, but the
 * party should see each other's state, as in the old computer RPGs.
 */
export async function GET() {
  try {
    await requireAuth()
    const result = await db.execute(
      `SELECT c.CharacterId, c.Name, c.Path, c.PortraitUrl, c.TokenUrl, c.Guard, c.MaxGuard, c.Mp, c.MaxMp, c.userId,
              u.Username AS ownerUsername
         FROM character c LEFT JOIN user u ON c.userId = u.UserId
        WHERE lower(c.category) = 'party'
        ORDER BY c.CharacterId`
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching party:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to fetch the party" }, { status: 500 })
  }
}
