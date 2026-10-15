// Helpers for broadcasting scene changes over Socket.IO with one consistent payload shape.
import { getIO } from "./socket"
import type { SceneState } from "./scene-model"

/** Socket id the client sent in the X-Socket-Id header, so it doesn't receive its own echo. */
function senderSocketId(req: Request): string | null {
  const id = req.headers.get("x-socket-id")
  return id && id.length <= 64 ? id : null
}

/** Emit to everyone in the scene room except the socket that made this request. */
export function emitToSceneExceptSender(req: Request, sceneId: number | string, event: string, ...args: unknown[]) {
  const room = getIO().to(String(sceneId))
  const sender = senderSocketId(req)
  ;(sender ? room.except(sender) : room).emit(event, ...args)
}

/**
 * `scene_updated(sceneId, state)`: the full saved state, version included, so clients can merge
 * it with their unsaved edits (see mergeSceneStates). A `null` state means the scene was cleared.
 */
export function broadcastSceneState(req: Request | null, sceneId: number, state: SceneState | null) {
  try {
    if (req) emitToSceneExceptSender(req, sceneId, "scene_updated", sceneId, state)
    else getIO().to(String(sceneId)).emit("scene_updated", sceneId, state)
  } catch (error) {
    console.error("[scene-sync] emit failed:", error)
  }
}
