import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"
import { getActiveSceneId } from "@/lib/app-settings"
import { db } from "@/lib/db"
import { tokenCharacterId, type SceneState } from "@/lib/scene-model"
import { updateScene } from "@/lib/scene-store"
import { broadcastSceneState } from "@/lib/scene-sync"
import type { LayerImage } from "@/app/types/layerImage"

// Players place, move and remove their own character tokens on the active scene through here;
// the DM edits the whole scene via POST /api/scenes.

const MAX_TOKEN_JSON_LENGTH = 20_000

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
      typeof tokenData.id !== "string" || tokenData.id.length === 0 || tokenData.id.length > 100 ||
      typeof tokenData.url !== "string" ||
      !Number.isFinite(tokenData.x) || !Number.isFinite(tokenData.y) ||
      JSON.stringify(tokenData).length > MAX_TOKEN_JSON_LENGTH
    ) {
      return NextResponse.json({ error: "Invalid token data" }, { status: 400 })
    }
    const characterId = tokenCharacterId(tokenData)
    if (characterId === null || !(await ownedCharacterIds(user.id)).has(characterId)) {
      return NextResponse.json({ error: "You can only place your own character tokens" }, { status: 403 })
    }

    // Stamp the ids from the database so every client sees the real owner.
    const placedToken: LayerImage = {
      ...tokenData,
      characterId,
      ...(tokenData.character ? { character: { ...tokenData.character, CharacterId: characterId, userId: user.id } } : {}),
    }

    const result = await updateScene(sceneId, (state) => {
      if (state.elements.topLayer.some((token) => token.id === placedToken.id)) {
        return { error: "A token with this id already exists", status: 409 }
      }
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
    if (!Number.isFinite(tokenData.x) || !Number.isFinite(tokenData.y)) {
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
