import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromCookie } from "@/lib/auth"
import { parseId } from "@/lib/api-errors"
import { emitCharacterDeleted, emitCharacterUpdated } from "@/lib/character-sync"
import { tokenCharacterId } from "@/lib/scene-model"
import { listSceneRows, updateScene } from "@/lib/scene-store"
import { broadcastSceneState } from "@/lib/scene-sync"
import { refreshCharacterTokens } from "@/lib/token-refresh"

type Params = { params: Promise<{ id: string }> }

const SELECT_CHARACTER = "SELECT c.*, u.Username AS ownerUsername FROM character c LEFT JOIN user u ON c.userId = u.UserId WHERE c.CharacterId = ?"

const NUMBER_FIELDS = [
  "Age", "Level", "Guard", "Armor", "MaxGuard", "Strength", "MaxStrength", "Dexternity", "MaxDexternity",
  "Mind", "MaxMind", "Charisma", "MaxCharisma", "Skill", "MaxSkill", "Mp", "MaxMp",
]
const TEXT_FIELDS: Record<string, number> = { Name: 100, Description: 20_000 }
const URL_FIELDS = ["PortraitUrl", "TokenUrl"]
const PATHS = ["Warrior", "Magic User"]

/**
 * Turns a partial character from the client into validated column values. Unknown fields are
 * ignored; empty numeric inputs are skipped (the column keeps its value).
 */
function columnsFromBody(body: Record<string, unknown>, isDM: boolean): Record<string, unknown> | string {
  const columns: Record<string, unknown> = {}
  for (const field of NUMBER_FIELDS) {
    const value = body[field]
    if (value === undefined || value === null || value === "") continue
    const n = typeof value === "number" ? value : Number(value)
    if (!Number.isInteger(n) || Math.abs(n) > 100_000) return `${field} must be a whole number`
    columns[field] = n
  }
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const value = body[field]
    if (value === undefined) continue
    if (typeof value !== "string" || value.length > max) return `${field} must be text of at most ${max} characters`
    columns[field] = field === "Name" ? value.trim() || "Unknown" : value
  }
  for (const field of URL_FIELDS) {
    const value = body[field]
    if (value === undefined) continue
    if (value !== null && (typeof value !== "string" || value.length > 2000)) return `${field} must be a URL`
    columns[field] = value || null
  }
  if (body.Path !== undefined) {
    if (typeof body.Path !== "string" || !PATHS.includes(body.Path)) return "Path must be Warrior or Magic User"
    columns.Path = body.Path
  }
  if (body.JobId !== undefined) {
    if (body.JobId !== null && !Number.isInteger(body.JobId)) return "JobId must be a number or null"
    columns.JobId = body.JobId
  }
  if (isDM && body.userId !== undefined) {
    const userId = Number(body.userId)
    if (!Number.isInteger(userId) || userId < 0) return "userId must be a user id"
    columns.userId = userId
  }
  return columns
}

export async function PUT(request: Request, { params }: Params) {
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: "Invalid character ID" }, { status: 400 })

  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  try {
    const ownerResult = await db.execute({ sql: "SELECT userId FROM character WHERE CharacterId = ?", args: [id] })
    if (ownerResult.rows.length === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 })
    }
    const previousOwnerId = Number(ownerResult.rows[0].userId)
    const isDM = user.role === "DM"
    if (!isDM && previousOwnerId !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this character" }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid character data" }, { status: 400 })
    const columns = columnsFromBody(body as Record<string, unknown>, isDM)
    if (typeof columns === "string") return NextResponse.json({ error: columns }, { status: 400 })

    if (columns.userId !== undefined && columns.userId !== previousOwnerId) {
      const target = await db.execute({ sql: "SELECT 1 FROM user WHERE UserId = ?", args: [columns.userId as number] })
      if (target.rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 400 })
    }

    const fields = Object.keys(columns)
    if (fields.length > 0) {
      await db.execute({
        sql: `UPDATE character SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE CharacterId = ?`,
        args: [...fields.map((f) => columns[f] as string | number | null), id],
      })
    }

    const updated = (await db.execute({ sql: SELECT_CHARACTER, args: [id] })).rows[0]
    if (fields.length > 0) {
      emitCharacterUpdated(updated, previousOwnerId)
      await refreshCharacterTokens(updated)
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating character:", error)
    return NextResponse.json({ error: "Failed to update character" }, { status: 500 })
  }
}

/** DM deletes a character with its jobs, inventory and tokens on every scene. */
export async function DELETE(request: Request, { params }: Params) {
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: "Invalid Character ID format" }, { status: 400 })

  const user = await getUserFromCookie()
  if (!user || user.role !== "DM") {
    return NextResponse.json({ error: "Not authorized to delete characters." }, { status: 403 })
  }

  try {
    const owner = await db.execute({ sql: "SELECT userId FROM character WHERE CharacterId = ?", args: [id] })
    if (owner.rows.length === 0) {
      return NextResponse.json({ error: "Character not found or already deleted" }, { status: 404 })
    }
    const ownerId = Number(owner.rows[0].userId)

    const items = await db.execute({
      sql: "SELECT ItemId FROM inventory WHERE CharacterId = ? AND ItemId IS NOT NULL",
      args: [id],
    })
    // Inventory rows reference items, so they go first.
    await db.batch(
      [
        { sql: "DELETE FROM job WHERE CharacterId = ?", args: [id] },
        { sql: "DELETE FROM inventory WHERE CharacterId = ?", args: [id] },
        ...items.rows.map((row) => ({ sql: "DELETE FROM item WHERE ItemId = ?", args: [Number(row.ItemId)] })),
        { sql: "DELETE FROM character WHERE CharacterId = ?", args: [id] },
      ],
      "write"
    )

    // Remove its tokens from every scene (versioned, so concurrent edits aren't lost).
    for (const scene of await listSceneRows()) {
      if (!scene.SceneData) continue
      const hasToken = (state: { elements: { topLayer: Parameters<typeof tokenCharacterId>[0][] } }) =>
        state.elements.topLayer.some((token) => tokenCharacterId(token) === id)
      const result = await updateScene(scene.Id, (state) =>
        hasToken(state)
          ? { ...state, elements: { ...state.elements, topLayer: state.elements.topLayer.filter((t) => tokenCharacterId(t) !== id) } }
          : { error: "unchanged", status: 200 }
      )
      if ("state" in result) broadcastSceneState(null, scene.Id, result.state)
    }

    emitCharacterDeleted(id, ownerId)
    return NextResponse.json({ message: "Character and associated data deleted successfully" })
  } catch (error) {
    console.error(`Error deleting character ${id}:`, error)
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 })
  }
}
