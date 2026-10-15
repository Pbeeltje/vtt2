import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"
import { getActiveSceneId } from "@/lib/app-settings"
import { db } from "@/lib/db"
import { rescalePath, rescaleSceneState } from "@/lib/scene-model"
import { getSceneRow, updateScene } from "@/lib/scene-store"
import { broadcastSceneState, emitToSceneExceptSender } from "@/lib/scene-sync"

type Params = { params: Promise<{ id: string }> }

/** One scene. Players may only load the active scene. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth()
    const sceneId = parseId((await params).id)
    if (!sceneId) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 })
    if (user.role !== "DM" && (await getActiveSceneId()) !== sceneId) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 })
    }
    const scene = await getSceneRow(sceneId)
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 })
    return NextResponse.json(scene)
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to fetch scene" }, { status: 500 })
  }
}

/**
 * DM changes a scene's scale and/or border size. A new scale moves tokens, images, fog and
 * drawings with the map, so this works for any scene, loaded or not.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAuth("DM")
    const sceneId = parseId((await params).id)
    if (!sceneId) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 })

    const body = await req.json()
    const scale = body.scale === undefined ? undefined : Number(body.scale)
    const borderSize = body.borderSize === undefined ? undefined : Number(body.borderSize)
    if (scale !== undefined && !(Number.isFinite(scale) && scale > 0 && scale <= 20)) {
      return NextResponse.json({ error: "scale must be between 0 and 20" }, { status: 400 })
    }
    if (borderSize !== undefined && !(Number.isFinite(borderSize) && borderSize >= 0 && borderSize <= 1)) {
      return NextResponse.json({ error: "borderSize must be between 0 and 1" }, { status: 400 })
    }

    let factor = 1
    const result = await updateScene(sceneId, (state) => {
      factor = scale === undefined ? 1 : scale / (state.scale || 1)
      const rescaled = scale === undefined ? state : rescaleSceneState(state, scale)
      return borderSize === undefined ? rescaled : { ...rescaled, borderSize }
    })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

    if (factor !== 1) {
      const drawings = await db.execute({ sql: "SELECT id, path FROM drawing WHERE sceneId = ?", args: [sceneId] })
      if (drawings.rows.length > 0) {
        await db.batch(
          drawings.rows.map((row) => ({
            sql: "UPDATE drawing SET path = ? WHERE id = ?",
            args: [rescalePath(String(row.path), factor), String(row.id)],
          })),
          "write"
        )
        emitToSceneExceptSender(req, sceneId, "drawings_reset", sceneId)
      }
    }

    broadcastSceneState(req, sceneId, result.state)
    return NextResponse.json({ sceneId, state: result.state })
  } catch (error) {
    console.error("[API /scenes/[id] PATCH] Error:", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to update scene" }, { status: 500 })
  }
}
