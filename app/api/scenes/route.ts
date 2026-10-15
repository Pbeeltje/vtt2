import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"
import { getActiveSceneId } from "@/lib/app-settings"
import { db } from "@/lib/db"
import { normalizeSceneState, parseSceneData } from "@/lib/scene-model"
import { getSceneRow, listSceneRows, writeSceneIfVersion } from "@/lib/scene-store"
import { broadcastSceneState } from "@/lib/scene-sync"

/** DMs get every scene; players only get the active one (the others may hold unrevealed maps). */
export async function GET() {
  try {
    const user = await requireAuth()
    if (user.role === "DM") {
      return NextResponse.json(await listSceneRows())
    }
    const activeId = await getActiveSceneId()
    const active = activeId ? await getSceneRow(activeId) : null
    return NextResponse.json(active ? [active] : [])
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 })
  }
}

/**
 * DM saves the whole map state. `baseVersion` is the version the edit started from; if someone
 * else saved in between (a player moved a token), the answer is 409 with the current state so the
 * client can merge and retry.
 */
export async function POST(req: Request) {
  try {
    await requireAuth("DM")
    const { sceneId: rawId, sceneData, baseVersion } = await req.json()
    const sceneId = parseId(rawId)
    if (!sceneId) {
      return NextResponse.json({ error: "Scene ID is required and must be a number" }, { status: 400 })
    }

    // null clears the scene back to "no saved data".
    if (sceneData === null) {
      const result = await db.execute({
        sql: "UPDATE DMImage SET SceneData = NULL WHERE Id = ? AND Category = 'Scene'",
        args: [sceneId],
      })
      if (result.rowsAffected === 0) return NextResponse.json({ error: "Scene not found" }, { status: 404 })
      broadcastSceneState(req, sceneId, null)
      return NextResponse.json({ sceneId, state: null })
    }

    if (typeof sceneData !== "object" || !Number.isInteger(baseVersion) || baseVersion < 0) {
      return NextResponse.json({ error: "sceneData must be an object and baseVersion an integer" }, { status: 400 })
    }
    if (JSON.stringify(sceneData).length > 5_000_000) {
      return NextResponse.json({ error: "Scene data is too large" }, { status: 413 })
    }

    const saved = await writeSceneIfVersion(sceneId, normalizeSceneState(sceneData), baseVersion)
    if (!saved) {
      const row = await getSceneRow(sceneId)
      if (!row) return NextResponse.json({ error: "Scene not found" }, { status: 404 })
      return NextResponse.json(
        { error: "Scene changed since this edit started", state: parseSceneData(row.SceneData) },
        { status: 409 }
      )
    }

    broadcastSceneState(req, sceneId, saved)
    return NextResponse.json({ sceneId, state: saved })
  } catch (error) {
    console.error("[API /scenes POST] Error:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to save scene" }, { status: 500 })
  }
}
