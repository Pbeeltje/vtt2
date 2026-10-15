import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { authErrorResponse, parseId } from "@/lib/api-errors"
import { getActiveSceneId, setActiveSceneId } from "@/lib/app-settings"
import { getSceneRow } from "@/lib/scene-store"
import { getIO, AUTHENTICATED_ROOM, removePlayersFromInactiveScenes } from "@/lib/socket"

/** The active scene id (what players see), for any logged-in user. */
export async function GET() {
  try {
    await requireAuth()
    return NextResponse.json({ sceneId: await getActiveSceneId() })
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

/** DM makes a scene active: it is stored (so reloads land there) and every client switches to it. */
export async function POST(req: Request) {
  try {
    await requireAuth("DM")
    const body = await req.json()
    const id = parseId(body.sceneId)
    if (!id) {
      return NextResponse.json({ error: "sceneId must be a number" }, { status: 400 })
    }
    if (!(await getSceneRow(id))) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 })
    }

    await setActiveSceneId(id)
    // Players stop receiving updates for the scene they were on, whatever their client does.
    removePlayersFromInactiveScenes(id)
    getIO().to(AUTHENTICATED_ROOM).emit("force_scene_change", id)
    return NextResponse.json({ ok: true, sceneId: id })
  } catch (error) {
    console.error("[set-active]", error)
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
