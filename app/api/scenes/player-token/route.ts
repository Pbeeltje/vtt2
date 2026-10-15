import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"
import { getActiveSceneId } from "@/lib/app-settings"
import { db } from "@/lib/db"
import { tokenCharacterId, type SceneState } from "@/lib/scene-model"
import { updateScene } from "@/lib/scene-store"
import { broadcastSceneState } from "@/lib/scene-sync"
import type { LayerImage } from "@/app/types/layerImage"
import type { Character } from "@/app/types/character"
import { createCharacterToken } from "@/app/lib/tokens"

// Players place, move and remove their own character tokens on the active scene through here;
// the DM edits the whole scene via POST /api/scenes.

/** Map coordinates in pixels; far beyond any real map, but keeps junk like 1e300 out. */
const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000

/** Ownership comes from the database, never from the userId inside the token JSON. */
async function ownedCharacterIds(userId: number): Promise<Set<number>> {
  const result = await db.execute({ sql: "SELECT CharacterId FROM character WHERE userId = ?", args: [userId] })
  return new Set(result.rows.map((row) => Number(row.CharacterId)))
}

/** The scene id from the request, if it is the active scene (players can't touch others). */
async function activeSceneOrError(rawSceneId: unknown): Promise<number | NextResponse> {
  const sceneId = parseId(rawSceneId)
  if (!sceneId) return NextResponse.json({ error: "Scene ID is required" }, { status: 400 })
  if ((await getActiveSceneId()) !== sceneId) {
    return NextResponse.json({ error: "Tokens can only be changed on the active scene" }, { status: 403 })
  }
  return sceneId
}

function respond(req: Request, sceneId: number, result: { state: SceneState } | { error: string; status: number }, extra?: object) {
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  broadcastSceneState(req, sceneId, result.state)
  return NextResponse.json({ sceneId, state: result.state, ...extra })
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth("player")
    const { sceneId: rawSceneId, tokenData } = await req.json()
    const sceneId = await activeSceneOrError(rawSceneId)
    if (sceneId instanceof NextResponse) return sceneId

    if (
      !tokenData || typeof tokenData !== "object" ||
      typeof tokenData.id !== "string" || !/^[\w-]{1,100}$/.test(tokenData.id) ||
      !isCoordinate(tokenData.x) || !isCoordinate(tokenData.y)
    ) {
      return NextResponse.json({ error: "Invalid token data" }, { status: 400 })
    }
    const characterId = tokenCharacterId(tokenData)
    const row = characterId === null
      ? undefined
      : (await db.execute({ sql: "SELECT * FROM character WHERE CharacterId = ? AND userId = ?", args: [characterId, user.id] })).rows[0]
    if (!row) {
      return NextResponse.json({ error: "You can only place your own character tokens" }, { status: 403 })
    }
    const character = { ...row, CharacterId: Number(row.CharacterId), userId: Number(row.userId) } as unknown as Character

    // Built from the database, like the client builds it; only the id and position are the client's.
    let placedToken: LayerImage | null = null
    const result = await updateScene(sceneId, (state) => {
      if (state.elements.topLayer.some((token) => token.id === tokenData.id)) {
        return { error: "A token with this id already exists", status: 409 }
      }
      placedToken = { ...createCharacterToken(character, tokenData.x, tokenData.y, state.gridSize), id: tokenData.id }
      return { ...state, elements: { ...state.elements, topLayer: [...state.elements.topLayer, placedToken] } }
    })
    return respond(req, sceneId, result, { tokenData: placedToken })
  } catch (error) {
    console.error("[API /player-token POST] Error:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to place token" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth("player")
    const { searchParams } = new URL(req.url)
    const tokenId = searchParams.get("tokenId")
    const sceneId = await activeSceneOrError(searchParams.get("sceneId"))
    if (sceneId instanceof NextResponse) return sceneId
    if (!tokenId) return NextResponse.json({ error: "Token ID is required" }, { status: 400 })

    const owned = await ownedCharacterIds(user.id)
    const result = await updateScene(sceneId, (state) => {
      const token = state.elements.topLayer.find((t) => t.id === tokenId)
      if (!token) return { error: "Token not found", status: 404 }
      const characterId = tokenCharacterId(token)
      if (characterId === null || !owned.has(characterId)) {
        return { error: "You can only delete your own character tokens", status: 403 }
      }
      return { ...state, elements: { ...state.elements, topLayer: state.elements.topLayer.filter((t) => t.id !== tokenId) } }
    })
    return respond(req, sceneId, result)
  } catch (error) {
    console.error("[API /player-token DELETE] Error:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to delete token" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth("player")
    const { sceneId: rawSceneId, tokenData } = await req.json()
    const sceneId = await activeSceneOrError(rawSceneId)
    if (sceneId instanceof NextResponse) return sceneId
    if (!tokenData || typeof tokenData.id !== "string") {
      return NextResponse.json({ error: "Token data is required" }, { status: 400 })
    }
    if (!isCoordinate(tokenData.x) || !isCoordinate(tokenData.y)) {
      return NextResponse.json({ error: "Invalid token position" }, { status: 400 })
    }

    // Check ownership of the token as stored on the server, not the one sent by the client.
    const owned = await ownedCharacterIds(user.id)
    const result = await updateScene(sceneId, (state) => {
      const stored = state.elements.topLayer.find((t) => t.id === tokenData.id)
      if (!stored) return { error: "Token not found", status: 404 }
      const characterId = tokenCharacterId(stored)
      if (characterId === null || !owned.has(characterId)) {
        return { error: "You can only move your own character tokens", status: 403 }
      }
      const topLayer = state.elements.topLayer.map((t) => (t.id === tokenData.id ? { ...t, x: tokenData.x, y: tokenData.y } : t))
      return { ...state, elements: { ...state.elements, topLayer } }
    })
    return respond(req, sceneId, result)
  } catch (error) {
    console.error("[API /player-token PUT] Error:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update token position" }, { status: 500 })
  }
}
